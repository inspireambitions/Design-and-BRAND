import { employerVolumeEnabled } from '@/lib/employer-volume';
import { processEmployerMessages } from '@/lib/server/employer-messages';
import { scheduleEmployerReminders } from '@/lib/server/employer-reminders';
import { scheduleShortlistEmails } from '@/lib/server/employer-shortlist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Hourly. Expires invites for closed roles, queues due reminders and shortlist
 * emails, then drains the employer message outbox within the provider limit.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!employerVolumeEnabled()) return Response.json({ enabled: false }, { status: 200 });

  const reminders = await scheduleEmployerReminders();
  const shortlist = await scheduleShortlistEmails();
  const sent = await processEmployerMessages({ limit: 50 });
  return Response.json({ enabled: true, reminders, shortlist, sent }, { status: sent.configured ? 200 : 503 });
}
