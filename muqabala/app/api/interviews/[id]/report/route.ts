import { reportProjection, type StoredAnswer } from '@/lib/interviews';
import { interviewAccess } from '@/lib/server/interview-access';
import { privateNoStoreHeaders } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await interviewAccess(id);
  if (!access.configured) return Response.json({ configured: false }, { status: 503 });
  if (!access.interview || (!access.owner && !access.anonymous)) return Response.json({ error: 'Not found.' }, { status: 404 });
  const { data, error } = await access.admin!.from('interview_answers')
    .select('question_index,question_id,question_text,transcript,feedback,scoring_status')
    .eq('interview_id', id)
    .order('question_index');
  if (error) return Response.json({ error: 'Report could not be loaded.' }, { status: 500 });
  return Response.json(
    reportProjection(access.interview, (data ?? []) as StoredAnswer[], Boolean(access.owner)),
    { headers: privateNoStoreHeaders() },
  );
}
