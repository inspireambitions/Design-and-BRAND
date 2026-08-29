import { lifecycleEmailConfig } from '@/lib/email/resend';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRACKED_EMAIL_EVENTS = new Set(['email.sent','email.delivered','email.bounced','email.complained','email.suppressed','email.failed']);

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const email = lifecycleEmailConfig();
  const admin = createAdminClient();
  if (!webhookSecret || !email || !admin) return Response.json({ configured: false }, { status: 503 });

  const payload = await request.text();
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  if (!id || !timestamp || !signature) return Response.json({ error: 'Missing webhook signature.' }, { status: 400 });

  let event: ReturnType<typeof email.client.webhooks.verify>;
  try {
    event = email.client.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
  } catch {
    return Response.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  if (!TRACKED_EMAIL_EVENTS.has(event.type)) return Response.json({ received: true });
  const tracked = event as typeof event & { data: { email_id: string } };
  const { data: outcome, error: eventError } = await admin.rpc('record_lifecycle_email_event', {
    p_id: id,
    p_event_type: event.type,
    p_email_id: tracked.data.email_id,
  });
  if (eventError) return Response.json({ error: 'Webhook event could not be processed.' }, { status: 503 });
  return Response.json({ received: true, outcome });
}
