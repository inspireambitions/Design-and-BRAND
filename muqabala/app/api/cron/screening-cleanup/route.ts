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

  const { data: expired, error } = await admin.from('interviews')
    .select('id')
    .eq('mode', 'screening')
    .eq('saved', false)
    .lt('expires_at', new Date().toISOString())
    .order('expires_at')
    .limit(100);
  if (error) return Response.json({ error: 'Cleanup query failed.' }, { status: 503 });

  let deleted = 0;
  for (const interview of expired ?? []) {
    const { data: answers } = await admin.from('interview_answers')
      .select('video_path')
      .eq('interview_id', interview.id)
      .not('video_path', 'is', null);
    const paths = (answers ?? []).map((answer) => answer.video_path).filter((path): path is string => Boolean(path));
    if (paths.length > 0) {
      const { error: storageError } = await admin.storage.from('screening-videos').remove(paths);
      if (storageError) continue;
    }
    const { error: deleteError } = await admin.from('interviews').delete().eq('id', interview.id);
    if (!deleteError) deleted += 1;
  }
  return Response.json({ deleted });
}
