import { processScreeningNotifications } from '@/lib/server/screening-notifications';
import { rejectUnauthorisedCron } from '@/lib/server/cron-auth';
import { reportOperationalEvent, reportOperationalFailure } from '@/lib/sentry-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const rejected = rejectUnauthorisedCron(request, 'screening_notifications');
  if (rejected) return rejected;
  try {
    const result = await processScreeningNotifications({ limit: 5 });
    if (!result.configured) {
      reportOperationalFailure('cron_job_failed', { area: 'cron', job: 'screening_notifications', code: 'provider_not_configured', status: 503 });
      return Response.json(result, { status: 503 });
    }
    reportOperationalEvent('cron_job_completed', { area: 'cron', job: 'screening_notifications', code: 'ok', status: 200 });
    return Response.json(result);
  } catch (error) {
    reportOperationalFailure('cron_job_failed', { area: 'cron', job: 'screening_notifications', code: error instanceof Error ? error.name : 'unknown', status: 503 });
    return Response.json({ error: 'Scheduled notifications failed.' }, { status: 503 });
  }
}
