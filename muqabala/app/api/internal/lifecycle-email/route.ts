import { renderLifecycleEmail, type EmailLocale, type LifecycleEmailType } from '@/lib/email/lifecycle';
import { bearerMatches, unsubscribeUrls } from '@/lib/email/preferences';
import { lifecycleEmailConfig } from '@/lib/email/resend';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type ClaimedJob = {
  id: string;
  user_id: string;
  email_type: LifecycleEmailType;
  locale: EmailLocale;
  attempt_count: number;
};

function retryDelayMinutes(attempt: number): number {
  return Math.min(360, 5 * 2 ** Math.max(0, attempt - 1));
}

function errorDetails(error: unknown): { code: string; retryable: boolean } {
  if (!error || typeof error !== 'object') return { code: 'unknown_error', retryable: true };
  const candidate = error as { name?: string; statusCode?: number; message?: string };
  const status = candidate.statusCode;
  const code = (candidate.name || (status ? `http_${status}` : 'provider_error')).slice(0, 100);
  return { code, retryable: !status || status === 429 || status >= 500 };
}

export async function POST(request: Request) {
  const workerSecret = process.env.LIFECYCLE_EMAIL_WORKER_SECRET;
  if (!workerSecret || !bearerMatches(request, workerSecret)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const email = lifecycleEmailConfig();
  const admin = createAdminClient();
  if (!email || !admin || !process.env.EMAIL_PREFERENCES_SECRET) {
    return Response.json({ configured: false }, { status: 503 });
  }

  const { error: pendingEventError } = await admin.rpc('reconcile_pending_lifecycle_email_events', { p_limit: 50 });
  if (pendingEventError) return Response.json({ error: 'Pending provider events could not be reconciled.' }, { status: 503 });

  const { data, error: claimError } = await admin.rpc('claim_lifecycle_email_jobs', { p_limit: 4 });
  if (claimError) return Response.json({ error: 'Job claim failed.' }, { status: 503 });

  const jobs = (data ?? []) as ClaimedJob[];
  const result = { claimed: jobs.length, sent: 0, retried: 0, failed: 0, cancelled: 0 };

  for (const job of jobs) {
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(job.user_id);
    const recipient = userResult?.user?.email;
    if (userError || !recipient || !userResult.user.email_confirmed_at) {
      const { error: cancelError } = await admin.from('lifecycle_email_jobs').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        lease_until: null,
        last_error_code: 'user_not_eligible',
      }).eq('id', job.id).eq('status', 'processing');
      if (cancelError) return Response.json({ error: 'Job cancellation failed.' }, { status: 503 });
      result.cancelled += 1;
      continue;
    }

    let unsubscribe: ReturnType<typeof unsubscribeUrls> | null = null;
    if (job.email_type === 'career_tools_24h') {
      const { data: preference } = await admin.from('lifecycle_email_preferences')
        .select('marketing_opt_in,unsubscribed_at,suppressed_at')
        .eq('user_id', job.user_id)
        .maybeSingle();
      if (!preference?.marketing_opt_in || preference.unsubscribed_at || preference.suppressed_at) {
        const { error: cancelError } = await admin.from('lifecycle_email_jobs').update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          lease_until: null,
          last_error_code: 'marketing_not_permitted',
        }).eq('id', job.id).eq('status', 'processing');
        if (cancelError) return Response.json({ error: 'Job cancellation failed.' }, { status: 503 });
        result.cancelled += 1;
        continue;
      }
      unsubscribe = unsubscribeUrls(job.user_id);
    }

    try {
      const businessAddress = process.env.MUQABALA_BUSINESS_ADDRESS;
      if (job.email_type === 'career_tools_24h' && !businessAddress) {
        throw Object.assign(new Error('Business address not configured.'), { name: 'business_address_missing', statusCode: 400 });
      }
      const content = renderLifecycleEmail({
        type: job.email_type,
        locale: job.locale === 'ar' ? 'ar' : 'en',
        unsubscribeUrl: unsubscribe?.page,
        senderAddress: email.from.match(/<([^>]+)>/)?.[1] ?? email.from,
        businessAddress,
      });
      const { data: sendAllowed, error: eligibilityError } = await admin.rpc('lifecycle_email_send_allowed', { p_job_id: job.id });
      if (eligibilityError) return Response.json({ error: 'Send eligibility could not be checked.' }, { status: 503 });
      if (!sendAllowed) {
        const { error: cancelError } = await admin.from('lifecycle_email_jobs').update({
          status: 'cancelled', cancelled_at: new Date().toISOString(), lease_until: null, last_error_code: 'not_eligible_at_send',
        }).eq('id', job.id).eq('status', 'processing');
        if (cancelError) return Response.json({ error: 'Ineligible job could not be cancelled.' }, { status: 503 });
        result.cancelled += 1;
        continue;
      }
      const { data: sent, error } = await email.client.emails.send({
        from: email.from,
        replyTo: email.replyTo,
        to: recipient,
        subject: content.subject,
        html: content.html,
        text: content.text,
        headers: unsubscribe ? {
          'List-Unsubscribe': `<${unsubscribe.api}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        } : undefined,
        tags: [
          { name: 'email_type', value: job.email_type },
          { name: 'locale', value: job.locale === 'ar' ? 'ar' : 'en' },
        ],
      }, {
        idempotencyKey: `muqabala-${job.email_type}-v1-${job.user_id}`,
      });
      if (error || !sent?.id) throw error ?? new Error('Resend returned no email id.');
      const { data: sentJob, error: sentUpdateError } = await admin.from('lifecycle_email_jobs').update({
        status: 'sent',
        resend_email_id: sent.id,
        sent_at: new Date().toISOString(),
        lease_until: null,
        last_error_code: null,
      }).eq('id', job.id).eq('status', 'processing').select('id').maybeSingle();
      if (sentUpdateError || !sentJob) return Response.json({ error: 'Provider accepted the email, but job state could not be saved.' }, { status: 503 });
      const { error: reconcileError } = await admin.rpc('reconcile_lifecycle_email_events', { p_email_id: sent.id });
      if (reconcileError) return Response.json({ error: 'Provider events could not be reconciled.' }, { status: 503 });
      result.sent += 1;
    } catch (error) {
      const failure = errorDetails(error);
      const retry = failure.retryable && job.attempt_count < 5;
      const { data: retriedJob, error: retryUpdateError } = await admin.from('lifecycle_email_jobs').update({
        status: retry ? 'pending' : 'failed',
        next_attempt_at: retry
          ? new Date(Date.now() + retryDelayMinutes(job.attempt_count) * 60_000).toISOString()
          : new Date().toISOString(),
        lease_until: null,
        last_error_code: failure.code,
      }).eq('id', job.id).eq('status', 'processing').select('id').maybeSingle();
      if (retryUpdateError || !retriedJob) return Response.json({ error: 'Job retry state could not be saved.' }, { status: 503 });
      if (retry) result.retried += 1;
      else result.failed += 1;
    }
  }

  return Response.json(result);
}
