import { SaveAnswerSchema } from '@/lib/interviews';
import { interviewAccess } from '@/lib/server/interview-access';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { issueCompletionProof, practicePlanSecretsConfigured } from '@/lib/practice-plan/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = SaveAnswerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid progress update.' }, { status: 400 });
  const { id } = await params;
  const access = await interviewAccess(id);
  if (!access.configured) return Response.json({ configured: false }, { status: 503 });
  if (!access.interview || (!access.owner && !access.anonymous)) return Response.json({ error: 'Not found.' }, { status: 404 });
  if (access.interview.mode === 'screening') {
    return Response.json({ error: 'Employer interviews accept saved video responses only.' }, { status: 409 });
  }

  const question = access.interview.question_snapshot[parsed.data.questionIndex];
  if (!question) return Response.json({ error: 'Unknown question.' }, { status: 400 });
  const refreshedExpiry = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const { data: saved, error } = await access.admin!.rpc('save_interview_progress', {
    p_interview_id: id,
    p_user_id: access.owner ? access.user!.id : null,
    p_anonymous_token_hash: access.anonymous ? access.interview.anonymous_token_hash : null,
    p_question_index: parsed.data.questionIndex,
    p_question_id: question.id,
    p_question_text: access.interview.language === 'ar' ? question.textAr : question.text,
    p_transcript: parsed.data.transcript,
    p_current_question: parsed.data.currentQuestion,
    p_status: parsed.data.status,
    p_expires_at: refreshedExpiry,
  });
  if (error || saved !== true) return Response.json({ error: 'Progress could not be saved.' }, { status: 503 });
  return Response.json({
    saved: true,
    ...(parsed.data.status === 'completed'
      && process.env.PRACTICE_PLAN_EMAIL_ENABLED === 'true'
      && practicePlanSecretsConfigured()
      ? { completionProof: issueCompletionProof(id) }
      : {}),
  }, { headers: privateNoStoreHeaders() });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const { id } = await params;
  const access = await interviewAccess(id);
  if (!access.interview || !access.owner) return Response.json({ error: 'Not found.' }, { status: 404 });
  const { error } = await access.admin!.from('interviews').delete().eq('id', id).eq('user_id', access.user!.id);
  if (error) return Response.json({ error: 'Report could not be deleted.' }, { status: 500 });
  return Response.json({ deleted: true }, { headers: privateNoStoreHeaders() });
}
