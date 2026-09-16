import 'server-only';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { notificationRetry } from '@/lib/screening-notification-policy';
import { whatsAppEnabled } from '@/lib/employer-volume';
import { inviteHtml, inviteSubject, inviteText } from '@/lib/employer-volume/invite-message';
import { reminderHtml, reminderSubject, reminderText, type ReminderKind } from '@/lib/employer-volume/reminder-message';
import {
  firstAnswerSnippet,
  pickShortlistRows,
  shortlistHtml,
  shortlistSubject,
  shortlistText,
  type ShortlistInput,
  type ShortlistRow,
} from '@/lib/employer-volume/shortlist-message';
import { rankedCandidates } from '@/lib/server/employer-candidates';
import { trackServer } from '@/lib/server/analytics';
import { configuredOrigin } from '@/lib/server/security';
import { openToken } from '@/lib/server/invite-token';
import { verifyStoredInterview } from '@/lib/interview-token';
import { manualReminderFailureCanRetry } from '@/lib/recruiter-suite';

type OutboxRow = {
  id: string;
  role_id: string;
  invite_id: string | null;
  kind: 'invite' | 'reminder_1' | 'reminder_2' | 'completion' | 'manual_reminder' | 'shortlist';
  channel: 'email' | 'whatsapp';
  attempt_count: number;
  message_body: string | null;
  retry_of: string | null;
};

type InviteRow = {
  id: string;
  candidate_ref: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  status: string;
  token_cipher: string;
  contact_allowed: boolean;
  opted_out_at: string | null;
  withdrawn_at: string | null;
  deleted_at: string | null;
  last_manual_reminder_at: string | null;
};

/** Resend documents 2 requests per second on standard plans. */
const RESEND_MIN_GAP_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

function manualReminder(messageBody: string, link: string, roleTitle: string) {
  const text = messageBody.replaceAll('{{invitation_link}}', link).trim();
  const html = text.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`).join('');
  return { subject: `Reminder: ${roleTitle} work sample`, text, html };
}

export function inviteLink(publicCode: string, token: string): string {
  return `${configuredOrigin()}/s/${publicCode}?i=${token}`;
}

/**
 * Shortlist email for one role. Each Open link is a Supabase magic link whose
 * `next` lands on that candidate in the review screen, so the employer signs in
 * and arrives with no password step.
 */
async function buildShortlistForRole(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  roleId: string,
  roleTitle: string,
  employerName: string,
): Promise<{ to: string; subject: string; text: string; html: string } | null> {
  const { data: pack } = await admin.from('screening_packs').select('employer_id').eq('id', roleId).maybeSingle();
  if (!pack?.employer_id) return null;
  const { data: userData } = await admin.auth.admin.getUserById(pack.employer_id as string);
  const to = userData.user?.email;
  if (!to || !userData.user?.email_confirmed_at) return null;

  const candidates = await rankedCandidates(admin, roleId);
  if (candidates.length === 0) return null;
  const { count: invited } = await admin.from('role_invites').select('id', { count: 'exact', head: true }).eq('role_id', roleId);

  const rows: ShortlistRow[] = [];
  for (const candidate of pickShortlistRows(candidates)) {
    const next = `/employer/interviews/${candidate.interviewId}`;
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: to,
      options: { redirectTo: `${configuredOrigin()}/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    const hashed = linkData?.properties?.hashed_token;
    const openUrl = hashed
      ? `${configuredOrigin()}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=magiclink&src=shortlist&role=${encodeURIComponent(roleId)}&next=${encodeURIComponent(next)}`
      : `${configuredOrigin()}${next}`;
    rows.push({
      displayName: candidate.displayName,
      coverage: candidate.coverage,
      firstAnswer: firstAnswerSnippet(candidate.answers[0]?.transcript),
      openUrl,
    });
  }

  const input: ShortlistInput = {
    roleTitle,
    employerName,
    invited: invited ?? 0,
    answered: candidates.length,
    fullCoverage: candidates.filter((candidate) => candidate.coverage.full).length,
    rows,
  };
  return { to, subject: shortlistSubject(input), text: shortlistText(input), html: shortlistHtml(input) };
}

/** Drains the employer message outbox. The invite link is rebuilt from the sealed token on each send. */
export function employerEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_TRANSACTIONAL_API_KEY || process.env.RESEND_FEEDBACK_API_KEY);
}

export async function processEmployerMessages(options: { roleId?: string; limit?: number; fetchImpl?: typeof fetch; adminClient?: ReturnType<typeof createAdminClient> } = {}) {
  const admin = options.adminClient ?? createAdminClient();
  const apiKey = process.env.RESEND_TRANSACTIONAL_API_KEY || process.env.RESEND_FEEDBACK_API_KEY;
  if (!admin || !apiKey) return { configured: false, claimed: 0, accepted: 0, failed: 0 };

  const leaseToken = randomUUID();
  const { data, error } = await admin.rpc('claim_employer_messages', {
    p_limit: Math.min(options.limit ?? 5, 5),
    p_lease_token: leaseToken,
    p_role_id: options.roleId ?? null,
  });
  if (error) return { configured: true, claimed: 0, accepted: 0, failed: 1 };
  const jobs = (data ?? []) as OutboxRow[];
  let accepted = 0;
  let failed = 0;

  const mark = async (job: OutboxRow, patch: Record<string, unknown>) => {
    const { data, error } = await admin.from('employer_message_outbox')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', job.id).eq('lease_token', leaseToken).select('id');
    if (error || !data?.length) throw new Error('employer_message_state_not_saved');
  };

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

    const [{ data: pack, error: packError }, { data: invite, error: inviteError }] = await Promise.all([
      admin.from('screening_packs').select('id,public_code,workplace,signed_token,expires_at').eq('id', job.role_id).maybeSingle(),
      job.invite_id ? admin.from('role_invites').select('id,candidate_ref,email,phone,name,status,token_cipher,contact_allowed,opted_out_at,withdrawn_at,deleted_at,last_manual_reminder_at').eq('id', job.invite_id).eq('role_id', job.role_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (packError || inviteError) {
      await retry(job, null, 'scope_lookup_failed');
      failed += 1;
      continue;
    }
    const inviteRow = invite as InviteRow | null;
    let validManualRetry = false;
    let previousManualDeliveryAt: string | null = null;
    if (job.kind === 'manual_reminder') {
      const historyQuery = admin.from('employer_message_outbox')
        .select('id,role_id,invite_id,kind,status,last_error_code,created_at,updated_at')
        .eq('role_id', job.role_id)
        .eq('invite_id', job.invite_id)
        .eq('kind', 'manual_reminder');
      const { data: previousManual, error: historyError } = job.retry_of
        ? await historyQuery.eq('id', job.retry_of).maybeSingle()
        : await historyQuery.neq('id', job.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (historyError) {
        await retry(job, null, 'retry_source_lookup_failed');
        failed += 1;
        continue;
      }
      if (job.retry_of) {
        validManualRetry = Boolean(previousManual
          && manualReminderFailureCanRetry(previousManual.status, previousManual.last_error_code));
      } else if (previousManual && !['accepted', 'delivered'].includes(previousManual.status)) {
        await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'invalid_previous_delivery' });
        failed += 1;
        continue;
      } else if (previousManual) {
        previousManualDeliveryAt = previousManual.updated_at ?? previousManual.created_at ?? null;
      }
      if (job.retry_of && !validManualRetry) {
        await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'invalid_retry_source' });
        failed += 1;
        continue;
      }
    }
    const rawToken = inviteRow ? openToken(inviteRow.token_cipher) : null;
    const link = pack && rawToken ? { link: inviteLink(pack.public_code, rawToken) } : null;
    if (!pack || (job.kind !== 'shortlist' && (!inviteRow || !link?.link))) {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'scope_mismatch' });
      failed += 1;
      continue;
    }
    // The closing shortlist email is the one message that goes out after the role closes.
    if (job.kind !== 'shortlist' && new Date(pack.expires_at).getTime() <= Date.now()) {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'role_closed' });
      failed += 1;
      continue;
    }
    if (job.kind !== 'invite' && job.kind !== 'shortlist' && inviteRow && inviteRow.status === 'submitted') {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'already_submitted' });
      failed += 1;
      continue;
    }
    if (job.kind === 'manual_reminder' && inviteRow && (
      inviteRow.contact_allowed === false || inviteRow.opted_out_at || inviteRow.withdrawn_at || inviteRow.deleted_at
    )) {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'contact_disallowed' });
      failed += 1;
      continue;
    }
    if (job.kind === 'manual_reminder' && !validManualRetry && (
      (inviteRow?.last_manual_reminder_at
        && Date.now() - Date.parse(inviteRow.last_manual_reminder_at) < 24 * 60 * 60 * 1_000)
      || (previousManualDeliveryAt
        && Date.now() - Date.parse(previousManualDeliveryAt) < 24 * 60 * 60 * 1_000)
    )) {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'recently_reminded' });
      failed += 1;
      continue;
    }
    if (job.kind !== 'shortlist' && !inviteRow?.email) {
      await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'no_email' });
      failed += 1;
      continue;
    }

    const roleTitle = verifyStoredInterview(pack.signed_token)?.title ?? 'this role';
    const message = { employerName: pack.workplace || 'The hiring team', roleTitle, link: link?.link ?? '' };
    let subject: string;
    let text: string;
    let html: string;
    let recipientEmail: string = inviteRow?.email ?? '';
    if (job.kind === 'invite') {
      subject = inviteSubject(message);
      text = inviteText(message);
      html = inviteHtml(message);
    } else if (job.kind === 'shortlist') {
      const built = await buildShortlistForRole(admin, pack.id, roleTitle, pack.workplace || 'Your team');
      if (!built) {
        await mark(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'no_recipient' });
        failed += 1;
        continue;
      }
      subject = built.subject;
      text = built.text;
      html = built.html;
      recipientEmail = built.to;
    } else if (job.kind === 'manual_reminder') {
      const built = manualReminder(job.message_body || 'Please complete your role work sample:\n\n{{invitation_link}}', link?.link ?? '', roleTitle);
      subject = built.subject;
      text = built.text;
      html = built.html;
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
          to: [recipientEmail],
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
      // The database trigger saves the invite's delivery timestamp in this
      // transaction. A failed stamp leaves the leased job available for retry.
      await mark(job, { status: 'accepted', accepted_at: now, provider_message_id: provider.id?.slice(0, 200) || null, locked_until: null, lease_token: null, last_error_code: null });
      if (job.kind !== 'invite' && job.kind !== 'shortlist') trackServer('reminder_sent', { role_id: job.role_id, channel: job.channel, flag_state: 'on' });
      accepted += 1;
    } else {
      await retry(job, response?.status ?? null, response ? `provider_${response.status}` : 'provider_timeout');
      failed += 1;
    }
    await sleep(RESEND_MIN_GAP_MS);
  }
  return { configured: true, claimed: jobs.length, accepted, failed };
}
