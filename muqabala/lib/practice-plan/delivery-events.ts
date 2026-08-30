import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type DeliveryStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'delayed' | 'bounced' | 'complained' | 'failed' | 'suppressed' | 'dead_letter';

export const supportedResendEvents = new Set([
  'email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced',
  'email.complained', 'email.failed', 'email.suppressed',
]);

export function statusAfterEvent(current: DeliveryStatus, eventType: string): DeliveryStatus {
  if (current === 'complained' || current === 'bounced' || current === 'suppressed') return current;
  if (eventType === 'email.complained') return 'complained';
  if (eventType === 'email.bounced') return 'bounced';
  if (eventType === 'email.suppressed') return 'suppressed';
  if (current === 'delivered') return current;
  if (eventType === 'email.delivered') return 'delivered';
  if (eventType === 'email.delivery_delayed') return 'delayed';
  if (eventType === 'email.failed') return 'failed';
  if (eventType === 'email.sent' && (current === 'queued' || current === 'sending')) return 'sent';
  return current;
}

export async function applyStoredResendEvents(admin: SupabaseClient, providerMessageId: string) {
  const { data: request } = await admin.from('practice_plan_requests')
    .select('id,email_hash,status,last_event_at')
    .eq('provider_message_id', providerMessageId)
    .maybeSingle();
  if (!request) return;
  const { data: events } = await admin.from('resend_webhook_events')
    .select('event_type,occurred_at')
    .eq('provider_message_id', providerMessageId)
    .order('occurred_at', { ascending: true });
  let status = request.status as DeliveryStatus;
  let lastEventAt = request.last_event_at as string | null;
  for (const event of events ?? []) {
    status = statusAfterEvent(status, event.event_type);
    if (event.occurred_at && (!lastEventAt || Date.parse(event.occurred_at) > Date.parse(lastEventAt))) lastEventAt = event.occurred_at;
  }
  await admin.from('practice_plan_requests').update({ status, last_event_at: lastEventAt }).eq('id', request.id);
  if (status === 'bounced' || status === 'complained' || status === 'suppressed') {
    const reason = status === 'bounced' ? 'hard_bounce' : status === 'complained' ? 'complaint' : 'provider_suppressed';
    await admin.from('email_suppressions').upsert({ email_hash: request.email_hash, reason, active: true }, { onConflict: 'email_hash' });
  }
}
