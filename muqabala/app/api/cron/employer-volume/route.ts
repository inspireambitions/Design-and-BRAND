import { employerVolumeEnabled } from '@/lib/employer-volume';
import { processEmployerMessages } from '@/lib/server/employer-messages';
import { scheduleEmployerReminders } from '@/lib/server/employer-reminders';
import { scheduleShortlistEmails } from '@/lib/server/employer-shortlist';
import { rejectUnauthorisedCron } from '@/lib/server/cron-auth';
import { reportOperationalEvent, reportOperationalFailure } from '@/lib/sentry-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Hourly. Expires invites for closed roles, queues due reminders and shortlist
 * emails, then drains the employer message outbox within the provider limit.
 */
export async function GET(request: Request) {
  const rejected = rejectUnauthorisedCron(request, 'employer_volume');
  if (rejected) return rejected;
  if (!employerVolumeEnabled()) return Response.json({ enabled: false }, { status: 200 });
  try {
    const reminders = await scheduleEmployerReminders();
    const shortlist = await scheduleShortlistEmails();
    const sent = await processEmployerMessages({ limit: 50 });
    if (!sent.configured) {
      reportOperationalFailure('cron_job_failed', { area: 'cron', job: 'employer_volume', code: 'provider_not_configured', status: 503 });
      return Response.json({ enabled: true, reminders, shortlist, sent }, { status: 503 });
    }
    reportOperationalEvent('cron_job_completed', { area: 'cron', job: 'employer_volume', code: 'ok', status: 200 });
    return Response.json({ enabled: true, reminders, shortlist, sent });
  } catch (error) {
    reportOperationalFailure('cron_job_failed', { area: 'cron', job: 'employer_volume', code: error instanceof Error ? error.name : 'unknown', status: 503 });
    return Response.json({ error: 'Employer messages failed.' }, { status: 503 });
  }
}
