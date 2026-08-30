import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { configuredOrigin } from '@/lib/server/security';
import { decryptJson } from './crypto';
import { practicePlanEmail } from './email-template';
import { EmailProviderError, productionEmailProvider, type EmailProvider } from './email-provider';
import { safeEvent } from './redaction';
import { SevenDayPlanSchema, type SevenDayPlan } from './schema';
import { applyStoredResendEvents } from './delivery-events';

type Snapshot = { plan: SevenDayPlan; viewToken: string };

export function retryBackoffMs(attemptNumber: number, jitter = Math.random()): number {
  const boundedAttempt = Math.min(20, Math.max(1, Math.floor(attemptNumber)));
  const boundedJitter = Math.min(0.9999, Math.max(0, jitter));
  return Math.min(6 * 60 * 60_000, (2 ** boundedAttempt) * 30_000) + Math.floor(boundedJitter * 10_000);
}

export async function processPracticePlanJobs(provider: EmailProvider = productionEmailProvider()) {
  const admin = createAdminClient();
  if (!admin) throw new Error('supabase_not_configured');
  const batch = Math.min(20, Math.max(1, Number(process.env.PRACTICE_PLAN_WORKER_BATCH ?? 5)));
  const ceiling = Math.max(1, Number(process.env.PRACTICE_PLAN_DAILY_SEND_CEILING ?? 500));
  const { data: jobs, error: claimError } = await admin.rpc('claim_practice_plan_jobs', {
    p_limit: batch,
    p_daily_ceiling: ceiling,
  });
  if (claimError) throw new Error('outbox_claim_failed');

  const results: Array<{ id: string; state: string }> = [];
  for (const job of jobs ?? []) {
    const { data: request, error } = await admin.from('practice_plan_requests')
      .select('id,email_hash,email_ciphertext,provider_idempotency_key,provider_message_id,locale,status')
      .eq('id', job.plan_request_id)
      .single();
    if (error || !request) {
      await admin.from('transactional_outbox').update({ state: 'retry', available_at: new Date(Date.now() + 60_000).toISOString(), last_error_code: 'request_missing', locked_at: null }).eq('id', job.outbox_id);
      results.push({ id: job.outbox_id, state: 'retry' });
      continue;
    }

    if (request.provider_message_id) {
      await admin.from('transactional_outbox').update({ state: 'completed', locked_at: null, last_error_code: null }).eq('id', job.outbox_id);
      results.push({ id: job.outbox_id, state: 'completed' });
      continue;
    }

    const { data: suppressed } = await admin.from('email_suppressions')
      .select('email_hash').eq('email_hash', request.email_hash).eq('active', true).maybeSingle();
    if (suppressed) {
      await Promise.all([
        admin.from('practice_plan_requests').update({ status: 'suppressed' }).eq('id', request.id),
        admin.from('transactional_outbox').update({ state: 'dead_letter', locked_at: null, last_error_code: 'suppressed' }).eq('id', job.outbox_id),
      ]);
      results.push({ id: job.outbox_id, state: 'suppressed' });
      continue;
    }

    try {
      const { data: storedSnapshot, error: snapshotError } = await admin.from('practice_plan_snapshots')
        .select('plan_ciphertext')
        .eq('plan_request_id', request.id)
        .single();
      if (snapshotError || !storedSnapshot) throw new EmailProviderError('permanent', 'snapshot_missing');
      const email = decryptJson<string>(request.email_ciphertext);
      const snapshot = decryptJson<Snapshot>(storedSnapshot.plan_ciphertext);
      const plan = SevenDayPlanSchema.parse(snapshot.plan);
      const viewUrl = `${configuredOrigin()}/practice-plan/${encodeURIComponent(snapshot.viewToken)}`;
      const rendered = practicePlanEmail(request.locale === 'ar' ? 'ar' : 'en', plan, viewUrl);
      await admin.from('email_delivery_attempts').insert({
        plan_request_id: request.id,
        attempt_number: job.attempt_number,
        provider: provider.name,
        status: 'started',
      });
      const sent = await provider.send({
        to: email,
        from: process.env.PRACTICE_PLAN_FROM || 'Muqabala Practice <practice@trymuqabala.com>',
        ...rendered,
        idempotencyKey: request.provider_idempotency_key,
      });
      await admin.from('email_delivery_attempts').update({
        status: 'accepted', provider_message_id: sent.providerMessageId,
      }).eq('plan_request_id', request.id).eq('attempt_number', job.attempt_number);
      await admin.from('practice_plan_requests').update({
        status: 'sent', provider_message_id: sent.providerMessageId, last_event_at: new Date().toISOString(),
      }).eq('id', request.id).is('provider_message_id', null);
      await applyStoredResendEvents(admin, sent.providerMessageId);
      await admin.from('transactional_outbox').update({
        state: 'completed', locked_at: null, last_error_code: null,
      }).eq('id', job.outbox_id);
      results.push({ id: job.outbox_id, state: 'sent' });
    } catch (caught) {
      const providerError = caught instanceof EmailProviderError ? caught : new EmailProviderError('retryable', 'worker_error');
      const exhausted = providerError.kind === 'permanent' || job.attempt_number >= 5;
      const delay = retryBackoffMs(job.attempt_number);
      await admin.from('email_delivery_attempts').update({
        status: exhausted ? 'permanent_failure' : 'retryable_failure', error_code: providerError.safeCode,
      }).eq('plan_request_id', request.id).eq('attempt_number', job.attempt_number);
      await Promise.all([
        admin.from('practice_plan_requests').update({ status: exhausted ? 'dead_letter' : 'queued' }).eq('id', request.id),
        admin.from('transactional_outbox').update({
          state: exhausted ? 'dead_letter' : 'retry',
          available_at: new Date(Date.now() + delay).toISOString(),
          locked_at: null,
          last_error_code: providerError.safeCode,
        }).eq('id', job.outbox_id),
      ]);
      console.error(safeEvent('practice_plan_worker_failure', { code: providerError.safeCode, attempt: job.attempt_number }));
      results.push({ id: job.outbox_id, state: exhausted ? 'dead_letter' : 'retry' });
    }
  }
  return results;
}
