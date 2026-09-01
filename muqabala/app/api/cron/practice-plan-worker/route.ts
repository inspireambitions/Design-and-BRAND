import { processPracticePlanJobs } from '@/lib/practice-plan/worker';
import { safeEvent } from '@/lib/practice-plan/redaction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (process.env.PRACTICE_PLAN_EMAIL_ENABLED !== 'true') return Response.json({ disabled: true });
  try {
    const results = await processPracticePlanJobs();
    return Response.json({ processed: results.length, states: results.map((result) => result.state) });
  } catch (error) {
    console.error(safeEvent('practice_plan_worker_unavailable', { error: error instanceof Error ? error.name : 'unknown' }));
    return Response.json({ error: 'Worker unavailable.' }, { status: 503 });
  }
}
