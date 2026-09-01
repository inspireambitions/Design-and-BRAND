import { processScreeningNotifications } from '@/lib/server/screening-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const result = await processScreeningNotifications({ limit: 5 });
  return Response.json(result, { status: result.configured ? 200 : 503 });
}
