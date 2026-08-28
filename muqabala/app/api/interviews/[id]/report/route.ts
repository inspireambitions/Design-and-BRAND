import { reportProjection, type StoredAnswer } from '@/lib/interviews';
import { signInterview } from '@/lib/interview-token';
import { buildCustomRole, type Role } from '@/lib/roles';
import { interviewAccess } from '@/lib/server/interview-access';
import { privateNoStoreHeaders } from '@/lib/server/security';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await interviewAccess(id);
  if (!access.configured) return Response.json({ configured: false }, { status: 503 });
  if (!access.interview || (!access.owner && !access.anonymous)) return Response.json({ error: 'Not found.' }, { status: 404 });
  if (access.interview.mode === 'screening') {
    // Screening reports belong to the inviting employer. Candidates receive a
    // submission receipt only, never scores, analysis or report data.
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }
  const { data, error } = await access.admin!.from('interview_answers')
    .select('question_index,question_id,question_text,transcript,feedback,scoring_status')
    .eq('interview_id', id)
    .order('question_index');
  if (error) return Response.json({ error: 'Report could not be loaded.' }, { status: 500 });
  const storedRoleSnapshot = access.owner ? access.interview.role_snapshot as Role | null : null;
  const roleSnapshot = storedRoleSnapshot
    && Array.isArray(storedRoleSnapshot.questions)
    && Array.isArray(storedRoleSnapshot.competencies)
    ? storedRoleSnapshot
    : null;
  const genericQuestionIds = new Set(buildCustomRole(access.interview.role_title).questions.map((question) => question.id));
  const tailored = Boolean(
    roleSnapshot
    && access.interview.role_id === 'custom'
    && roleSnapshot.questions.some((question) => !genericQuestionIds.has(question.id)),
  );
  const interviewToken = roleSnapshot && access.interview.role_id === 'custom'
    ? signInterview({
        title: roleSnapshot.title,
        industry: roleSnapshot.industry,
        level: roleSnapshot.level,
        competencies: roleSnapshot.competencies,
        questions: roleSnapshot.questions,
      })
    : null;
  return Response.json(
    {
      ...reportProjection(access.interview, (data ?? []) as StoredAnswer[], Boolean(access.owner)),
      roleSnapshot,
      interviewToken,
      tailored,
    },
    { headers: privateNoStoreHeaders() },
  );
}
