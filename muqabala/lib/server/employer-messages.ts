import 'server-only';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { notificationRetry } from '@/lib/screening-notification-policy';
import { whatsAppEnabled } from '@/lib/employer-volume';
import { inviteHtml, inviteSubject, inviteText } from '@/lib/employer-volume/invite-message';
import { reminderHtml, reminderSubject, reminderText, type ReminderKind } from '@/lib/employer-volume/reminder-message';
import { configuredOrigin } from '@/lib/server/security';
import { openToken } from '@/lib/server/invite-token';
import { verifyInterview } from '@/lib/interview-token';

type OutboxRow = {
  id: string;
  role_id: string;
  invite_id: string | null;
  kind: 'invite' | 'reminder_1' | 'reminder_2' | 'completion' | 'shortlist';
  channel: 'email' | 'whatsapp';
  attempt_count: number;
};

type InviteRow = {
  id: string;
  candidate_ref: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  status: string;
  token_cipher: string;
};

/** Resend documents 2 requests per second on standard plans. */
const RESEND_MIN_GAP_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function inviteLink(publicCode: string, token: string): string {
  return `${configuredOrigin()}/s/${publicCode}?i=${token}`;
}

/** Drains the employer message outbox. The invite link is rebuilt from the sealed token on each send. */
export async function processEmployerMessages(options: { roleId?: string; limit?: number; fetchImpl?: typeof fetch } = {}) {
  const admin = createAdminClient();
  const apiKey = process.env.RESEND_TRANSACTIONAL_API_KEY || process.env.RESEND_FEEDBACK_API_KEY;
  if (!admin || !apiKey) return { configured: false, claimed: 0, accepted: 0, failed: 0 };

  const leaseToken = randomUUID();
  const { data, error } = await admin.rpc('claim_employer_messages', {
    p_limit: options.limit ?? 20,
    p_lease_token: leaseToken,
    p_role_id: options.roleId ?? null,
  });
  if (error) return { configured: true, claimed: 0, accepted: 0, failed: 1 };
  const jobs = (data ?? []) as OutboxRow[];
  let accepted = 0;
  let failed = 0;

  const mark = (job: OutboxRow, patch: Record<string, unknown>) =>
    admin.from('employer_message_outbox').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', job.id).eq('lease_token', leaseToken);

  const retry = (job: OutboxRow, status: number | null, code: string) => {
    const plan = notificationRetry(status, job.attempt_count);
    return mark(job, {
      status: plan.permanent || job.attempt_count >= 10 ? 'failed' : 'pending',
      available_at: new Date(Date.now() + plan.delayMs).toISOString(),
      locked_until: null,
      lease_token: null,
      last_error_code: code,
    });
  };

  for (const job of jobs) {
    if (job.channel === 'whatsapp' && !whatsAppEnabled()) {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'channel_disabled' });
      failed += 1;
      continue;
    }
    if (job.channel === 'whatsapp') {
      // No messaging provider is configured. Behind the flag this is where the
      // provider call goes; until then the row is left pending for a later run.
      await retry(job, null, 'provider_missing');
      failed += 1;
      continue;
    }

    const [{ data: pack }, { data: invite }] = await Promise.all([
      admin.from('screening_packs').select('id,public_code,workplace,signed_token,expires_at').eq('id', job.role_id).maybeSingle(),
      job.invite_id ? admin.from('role_invites').select('id,candidate_ref,email,phone,name,status,token_cipher').eq('id', job.invite_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const inviteRow = invite as InviteRow | null;
    const rawToken = inviteRow ? openToken(inviteRow.token_cipher) : null;
    const link = pack && rawToken ? { link: inviteLink(pack.public_code, rawToken) } : null;
    if (!pack || (job.kind !== 'shortlist' && (!inviteRow || !link?.link))) {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'scope_mismatch' });
      failed += 1;
      continue;
    }
    if (new Date(pack.expires_at).getTime() <= Date.now()) {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'role_closed' });
      failed += 1;
      continue;
    }
    if (job.kind !== 'invite' && job.kind !== 'shortlist' && inviteRow && inviteRow.status === 'submitted') {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'already_submitted' });
      failed += 1;
      continue;
    }
    if (job.kind !== 'shortlist' && !inviteRow?.email) {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'no_email' });
      failed += 1;
      continue;
    }

    const roleTitle = verifyInterview(pack.signed_token)?.title ?? 'this role';
    const message = { employerName: pack.workplace || 'The hiring team', roleTitle, link: link?.link ?? '' };
    let subject: string;
    let text: string;
    let html: string;
    if (job.kind === 'invite') {
      subject = inviteSubject(message);
      text = inviteText(message);
      html = inviteHtml(message);
    } else if (job.kind === 'shortlist') {
      // Built by the shortlist module in section 4; skipped until then.
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'not_implemented' });
      failed += 1;
      continue;
    } else {
      const kind = job.kind as ReminderKind;
      subject = reminderSubject(kind, message);
      text = reminderText(kind, message);
      html = reminderHtml(kind, message);
    }

    let response: Response | null = null;
    try {
      response = await (options.fetchImpl ?? fetch)('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `employer-message/${job.id}`,
        },
        body: JSON.stringify({
          from: 'Muqabala <hello@auth.trymuqabala.com>',
          to: [inviteRow!.email],
          reply_to: 'hello@trymuqabala.com',
          subject,
          text,
          html,
        }),
        signal: AbortSignal.timeout(7_000),
      });
    } catch {
      response = null;
    }

    if (response?.ok) {
      const provider = await response.json().catch(() => ({})) as { id?: string };
      const now = new Date().toISOString();
      await mark(job, { status: 'accepted', accepted_at: now, provider_message_id: provider.id?.slice(0, 200) || null, locked_until: null, lease_token: null, last_error_code: null });
      const stamp: Record<string, string> = {};
      if (job.kind === 'invite') stamp.invited_at = now;
      if (job.kind === 'reminder_1') stamp.first_reminder_at = now;
      if (job.kind === 'reminder_2') stamp.second_reminder_at = now;
      if (job.kind === 'completion') stamp.completion_reminder_at = now;
      if (job.invite_id && Object.keys(stamp).length) await admin.from('role_invites').update(stamp).eq('id', job.invite_id);
      accepted += 1;
    } else {
      await retry(job, response?.status ?? null, response ? `provider_${response.status}` : 'provider_timeout');
      failed += 1;
    }
    await sleep(RESEND_MIN_GAP_MS);
  }
  return { configured: true, claimed: jobs.length, accepted, failed };
}
