import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const user = await currentUser();
  if (!user) return Response.json({ error: 'Sign in to delete this interview.' }, { status: 401 });

  const client = await createClient();
  const admin = createAdminClient();
  if (!client || !admin) return Response.json({ error: 'Interview storage is unavailable.' }, { status: 503 });

  const { id } = await params;
  const { data: interview } = await client.from('interviews')
    .select('id,screening_pack_id')
    .eq('id', id)
    .not('submitted_at', 'is', null)
    .maybeSingle();
  if (!interview) return Response.json({ error: 'Interview not found.' }, { status: 404 });

  const { data: answers, error: answerError } = await admin.from('interview_answers')
    .select('video_path')
    .eq('interview_id', interview.id)
    .not('video_path', 'is', null);
  if (answerError) return Response.json({ error: 'The interview could not be deleted.' }, { status: 503 });

  const paths = (answers ?? []).map((answer) => answer.video_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from('screening-videos').remove(paths);
    if (storageError) return Response.json({ error: 'The recordings could not be deleted.' }, { status: 503 });
  }

  const { error: deleteError } = await admin.from('interviews')
    .delete()
    .eq('id', interview.id)
    .eq('screening_pack_id', interview.screening_pack_id);
  if (deleteError) return Response.json({ error: 'The interview could not be deleted.' }, { status: 503 });

  return Response.json({ deleted: true }, { headers: privateNoStoreHeaders() });
}
