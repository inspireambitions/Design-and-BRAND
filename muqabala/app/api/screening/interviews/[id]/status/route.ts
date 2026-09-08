import { interviewAccess } from '@/lib/server/interview-access';
import { privateNoStoreHeaders, screeningReceiptReference } from '@/lib/server/security';
import { publicEmployerBrainState } from '@/lib/universal-interview/employer';
import { loadStoredInterview } from '@/lib/universal-interview/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await interviewAccess(id);
  const interview = access.interview;
  if (!access.configured) return Response.json({ configured: false }, { status: 503 });
  if (!access.user) return Response.json({ error: 'Verify your email to continue.' }, { status: 401 });
  if (!interview || !access.candidate || interview.mode !== 'screening') {
    return Response.json({ error: 'Interview not found.' }, { status: 404 });
  }

  const { data: answers, error } = await access.admin!.from('interview_answers')
    .select('question_index,video_upload_status,response_saved_at')
    .eq('interview_id', id)
    .order('question_index');
  if (error) return Response.json({ error: 'Interview status could not be checked.' }, { status: 503 });

  let brainState;
  try {
    brainState = await loadStoredInterview(id);
    if (!brainState) {
      const { data: stored, error: lookupError } = await access.admin!.from('universal_interviews')
        .select('id').eq('id', id).maybeSingle();
      if (lookupError || stored) throw new Error('adaptive_status_unavailable');
    }
  } catch {
    return Response.json({ error: 'Your progress is saved. Interview status needs another try.' },
      { status: 503, headers: privateNoStoreHeaders() });
  }
  return Response.json({
    interviewId: id,
    currentQuestion: interview.current_question,
    questionCount: interview.question_snapshot.length,
    answers: (answers ?? []).map((answer) => ({
      questionIndex: answer.question_index,
      uploadStatus: answer.video_upload_status,
      receivedAt: answer.response_saved_at,
    })),
    submitted: Boolean(interview.submitted_at && interview.locked_at),
    submittedAt: interview.submitted_at,
    reference: interview.submitted_at ? screeningReceiptReference(id) : null,
    brain: brainState?.screening ? publicEmployerBrainState(brainState) : null,
  }, { headers: privateNoStoreHeaders() });
}
