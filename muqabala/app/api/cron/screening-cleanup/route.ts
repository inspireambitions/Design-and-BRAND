import { createAdminClient } from '@/lib/supabase/admin';
import { rejectUnauthorisedCron } from '@/lib/server/cron-auth';
import { reportOperationalEvent, reportOperationalFailure } from '@/lib/sentry-server';
import { deleteExpiredScreeningInterview } from '@/lib/screening-cleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const rejected = rejectUnauthorisedCron(request, 'screening_cleanup');
  if (rejected) return rejected;
  const admin = createAdminClient();
  if (!admin) {
    reportOperationalFailure('cron_job_failed', { area: 'cron', job: 'screening_cleanup', code: 'database_not_configured', status: 503 });
    return Response.json({ configured: false }, { status: 503 });
  }

  const { data: expired, error } = await admin.from('interviews')
    .select('id')
    .eq('mode', 'screening')
    .eq('saved', false)
    .lt('expires_at', new Date().toISOString())
    .order('expires_at')
    .limit(100);
  if (error) {
    reportOperationalFailure('cron_job_failed', { area: 'cron', job: 'screening_cleanup', code: error.code, status: 503 });
    return Response.json({ error: 'Cleanup query failed.' }, { status: 503 });
  }

  let deleted = 0;
  let failed = 0;
  for (const interview of expired ?? []) {
    const result = await deleteExpiredScreeningInterview({
      readPaths: () => admin.from('interview_answers').select('video_path')
        .eq('interview_id', interview.id).not('video_path', 'is', null),
      removeVideos: (paths) => admin.storage.from('screening-videos').remove(paths),
      removeInterview: () => admin.from('interviews').delete().eq('id', interview.id),
    });
    if (!result.deleted) {
      failed += 1;
      reportOperationalFailure('screening_cleanup_item_failed', { area: 'cron', job: 'screening_cleanup', code: result.code || 'cleanup_failed' });
    } else {
      deleted += 1;
    }
  }
  reportOperationalEvent('cron_job_completed', { area: 'cron', job: 'screening_cleanup', code: failed ? 'partial_failure' : 'ok', status: failed ? 503 : 200, count: deleted });
  return Response.json({ deleted, failed }, { status: failed ? 503 : 200 });
}
