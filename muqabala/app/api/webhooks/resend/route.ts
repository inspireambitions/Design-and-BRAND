import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyStoredResendEvents, supportedResendEvents } from '@/lib/practice-plan/delivery-events';
import { parseResendWebhook, verifyResendWebhook } from '@/lib/practice-plan/webhook-signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Unavailable.' }, { status: 503 });
  const eventId = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  if (!eventId || !timestamp || !signature || eventId.length > 256) return Response.json({ error: 'Invalid webhook.' }, { status: 400 });
  const payload = await request.text();
  if (Buffer.byteLength(payload, 'utf8') > 256_000) return Response.json({ error: 'Invalid webhook.' }, { status: 400 });
  if (!verifyResendWebhook(payload, { id: eventId, timestamp, signature }, secret)) {
    return Response.json({ error: 'Invalid webhook.' }, { status: 400 });
  }
  const event = parseResendWebhook(payload);
  if (!event) return Response.json({ error: 'Invalid webhook.' }, { status: 400 });
  if (!supportedResendEvents.has(event.type) || !event.data.email_id) return Response.json({ received: true });
  const admin = createAdminClient();
  if (!admin) return Response.json({ error: 'Unavailable.' }, { status: 503 });
  const providerMessageId = event.data.email_id;
  const { error } = await admin.from('resend_webhook_events').insert({
    event_id: eventId,
    event_type: event.type,
    provider_message_id: providerMessageId,
    payload_digest: createHash('sha256').update(payload).digest('hex'),
    occurred_at: event.created_at ?? null,
  });
  if (error?.code === '23505') return Response.json({ received: true, duplicate: true });
  if (error) return Response.json({ error: 'Unavailable.' }, { status: 503 });
  await applyStoredResendEvents(admin, providerMessageId);
  return Response.json({ received: true });
}
