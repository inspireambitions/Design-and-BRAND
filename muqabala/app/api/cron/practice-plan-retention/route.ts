import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return Response.json({ configured: false }, { status: 503 });
  const { data, error } = await admin.rpc('delete_expired_practice_plan_data', { p_limit: 500 });
  if (error) return Response.json({ error: 'Retention job unavailable.' }, { status: 503 });
  return Response.json({ deleted: data ?? 0 });
}
