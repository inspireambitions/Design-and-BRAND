import 'server-only';
import { reportOperationalFailure } from '@/lib/sentry-server';

export function rejectUnauthorisedCron(request: Request, job: string): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    reportOperationalFailure('cron_auth_failed', { area: 'cron', job, code: 'cron_secret_missing', status: 503 });
    return Response.json({ error: 'Scheduled job is not configured.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    reportOperationalFailure('cron_auth_failed', { area: 'cron', job, code: 'invalid_authorisation', status: 401 });
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}
