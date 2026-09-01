import 'server-only';

import { randomUUID } from 'node:crypto';
import { buildScreeningNotificationEmail } from '@/lib/screening-notification-email';
import { notificationRetry, screeningNotificationIdempotencyKey } from '@/lib/screening-notification-policy';
import { configuredOrigin, screeningReceiptReference } from './security';
import { createAdminClient } from '@/lib/supabase/admin';

type Job = {
  id: string;
  interview_id: string;
  recipient_kind: 'candidate' | 'employer';
  recipient_user_id: string;
  attempt_count: number;
  lease_token: string;
};

async function markJob(job: Job, values: Record<string, unknown>) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from('screening_notification_outbox').update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('lease_token', job.lease_token)
    .eq('status', 'processing');
}

async function retryJob(job: Job, code: string) {
  const retry = notificationRetry(null, job.attempt_count);
  await markJob(job, {
    status: job.attempt_count >= 10 ? 'failed' : 'pending',
    available_at: new Date(Date.now() + retry.delayMs).toISOString(),
    locked_until: null,
    lease_token: null,
    last_error_code: code,
  });
}

export async function processScreeningNotifications(options: { interviewId?: string; limit?: number; fetchImpl?: typeof fetch } = {}) {
  const admin = createAdminClient();
  const apiKey = process.env.RESEND_TRANSACTIONAL_API_KEY || process.env.RESEND_FEEDBACK_API_KEY;
  if (!admin || !apiKey) return { configured: false, claimed: 0, accepted: 0, failed: 0 };
  const leaseToken = randomUUID();
  const { data, error } = await admin.rpc('claim_screening_notifications', {
    p_limit: options.limit ?? 10,
    p_interview_id: options.interviewId ?? null,
    p_lease_token: leaseToken,
  });
  if (error) return { configured: true, claimed: 0, accepted: 0, failed: 1 };
  const jobs = (data ?? []) as Job[];
  let accepted = 0;
  let failed = 0;

  for (const job of jobs) {
    const { data: interview, error: interviewError } = await admin.from('interviews')
      .select('id,candidate_user_id,role_title,submitted_at,locked_at,screening_pack_id')
      .eq('id', job.interview_id)
      .maybeSingle();
    if (interviewError) {
      await retryJob(job, 'database_unavailable');
      failed += 1;
      continue;
    }
    const packResult = interview?.screening_pack_id
      ? await admin.from('screening_packs').select('workplace,employer_id').eq('id', interview.screening_pack_id).maybeSingle()
      : { data: null, error: null };
    if (packResult.error) {
      await retryJob(job, 'database_unavailable');
      failed += 1;
      continue;
    }
    const pack = packResult.data;
    const expectedUserId = job.recipient_kind === 'candidate' ? interview?.candidate_user_id : pack?.employer_id;
    if (!interview?.submitted_at || !interview.locked_at || !pack || expectedUserId !== job.recipient_user_id) {
      await markJob(job, { status: 'cancelled', locked_until: null, lease_token: null, last_error_code: 'scope_mismatch' });
      failed += 1;
      continue;
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(job.recipient_user_id);
    const recipient = userData.user;
    if (userError && userError.status !== 404) {
      await retryJob(job, 'auth_unavailable');
      failed += 1;
      continue;
    }
    if (!recipient?.email || !recipient.email_confirmed_at) {
      await markJob(job, { status: 'failed', locked_until: null, lease_token: null, last_error_code: 'recipient_unavailable' });
      failed += 1;
      continue;
    }

    const email = buildScreeningNotificationEmail({
      kind: job.recipient_kind,
      companyName: pack.workplace,
      roleTitle: interview.role_title,
      submittedAt: interview.submitted_at,
      reference: screeningReceiptReference(interview.id),
      dashboardUrl: `${configuredOrigin()}/employer/interviews/${interview.id}`,
    });

    let response: Response | null = null;
    try {
      response = await (options.fetchImpl ?? fetch)('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': screeningNotificationIdempotencyKey(job.id),
        },
        body: JSON.stringify({
          from: 'Muqabala <hello@auth.trymuqabala.com>',
          to: [recipient.email],
          reply_to: 'hello@trymuqabala.com',
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
        signal: AbortSignal.timeout(7_000),
      });
    } catch {
      response = null;
    }

    if (response?.ok) {
      const provider = await response.json().catch(() => ({})) as { id?: string };
      await markJob(job, {
        status: 'accepted', accepted_at: new Date().toISOString(), provider_message_id: provider.id?.slice(0, 200) || null,
        locked_until: null, lease_token: null, last_error_code: null,
      });
      accepted += 1;
      continue;
    }

    const retry = notificationRetry(response?.status ?? null, job.attempt_count);
    await markJob(job, {
      status: retry.permanent || job.attempt_count >= 10 ? 'failed' : 'pending',
      available_at: new Date(Date.now() + retry.delayMs).toISOString(),
      locked_until: null,
      lease_token: null,
      last_error_code: response ? `provider_${response.status}` : 'provider_timeout',
    });
    failed += 1;
  }
  return { configured: true, claimed: jobs.length, accepted, failed };
}
