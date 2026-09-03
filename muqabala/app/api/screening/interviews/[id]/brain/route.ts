import { z } from 'zod';
import { universalInterviewEnabled } from '@/lib/universal-interview/api';
import { employerBrainAnswerFeedback, employerBrainQuestionSnapshot, publicEmployerBrainState } from '@/lib/universal-interview/employer';
import { processUniversalTurn, UniversalTurnError } from '@/lib/universal-interview/process-turn';
import {
  claimStoredInterview, loadStoredInterview, recordStageMetric,
  releaseInterviewClaim, saveClaimedInterview,
} from '@/lib/universal-interview/repository';
import type { GeneratedQuestion, InterviewState } from '@/lib/universal-interview/types';
import { makeBankQuestion } from '@/lib/universal-interview/questions';
import { interviewAccess } from '@/lib/server/interview-access';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { limitScoring } from '@/lib/rate-limit';
import type { Question } from '@/lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const RequestSchema = z.object({ questionIndex: z.number().int().min(0).max(49) }).strict();

function questionFromSnapshot(question: Question, seniority: InterviewState['seniority']): GeneratedQuestion {
  return makeBankQuestion({
    question_id: question.id,
    candidate_text: question.text,
    interviewer_intent: question.id,
    question_type: 'BEHAVIOURAL',
    target_competencies: question.competencies,
    seniority,
  });
}

async function settleAnswer(
  state: InterviewState,
  question: Question,
  questionIndex: number,
  admin: NonNullable<Awaited<ReturnType<typeof interviewAccess>>['admin']>,
) {
  const counts = state.screening?.evidence_after_answers ?? [];
  const evidenceStart = questionIndex > 0 ? counts[questionIndex - 1] ?? 0 : 0;
  const feedback = employerBrainAnswerFeedback({
    state,
    question: questionFromSnapshot(question, state.seniority),
    questionId: question.id,
    evidenceStart,
  });
  const { error } = await admin.from('interview_answers').update({
    feedback,
    scoring_status: feedback.status === 'scored' ? 'scored' : 'unscored',
  }).eq('interview_id', state.interview_id).eq('question_index', questionIndex);
  if (error) throw new Error('answer_analysis_not_saved');
}

async function syncNextQuestion(
  state: InterviewState,
  admin: NonNullable<Awaited<ReturnType<typeof interviewAccess>>['admin']>,
) {
  const { data: current } = await admin.from('interviews')
    .select('question_snapshot,current_question')
    .eq('id', state.interview_id)
    .maybeSingle();
  if (!current) throw new Error('screening_interview_missing');
  const snapshot = current.question_snapshot as Question[];
  if (state.phase === 'ACTIVE' && state.current_question && snapshot.length === current.current_question) {
    const next = [...snapshot, employerBrainQuestionSnapshot(state.current_question, current.current_question)];
    const { error } = await admin.from('interviews')
      .update({ question_snapshot: next })
      .eq('id', state.interview_id)
      .eq('current_question', current.current_question);
    if (error) throw new Error('next_question_not_saved');
  }
  return current.current_question as number;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!universalInterviewEnabled()) return Response.json({ error: 'The adaptive interview is unavailable.' }, { status: 404 });
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid interview response.' }, { status: 400 });
  const { id } = await params;
  const access = await interviewAccess(id);
  const interview = access.interview;
  if (!access.configured) return Response.json({ configured: false }, { status: 503 });
  if (!access.user) return Response.json({ error: 'Verify your email to continue.' }, { status: 401 });
  if (!interview || !access.candidate || interview.mode !== 'screening' || !interview.screening_pack_id) {
    return Response.json({ error: 'Interview not found.' }, { status: 404 });
  }
  if (interview.locked_at || interview.status !== 'in_progress') {
    return Response.json({ error: 'This interview has already been submitted.' }, { status: 409 });
  }
  const questionIndex = parsed.data.questionIndex;
  const question = interview.question_snapshot[questionIndex];
  const { data: answer } = await access.admin!.from('interview_answers')
    .select('transcript,response_saved_at')
    .eq('interview_id', id)
    .eq('question_index', questionIndex)
    .maybeSingle();
  if (!question || !answer?.response_saved_at) {
    return Response.json({ error: 'Save the recorded response before continuing.' }, { status: 409 });
  }
  let state = await loadStoredInterview(id);
  if (!state?.screening || state.screening.pack_id !== interview.screening_pack_id) {
    return Response.json({ error: 'The adaptive interview state was not found.' }, { status: 409 });
  }
  const processed = state.screening.processed_answer_count;
  if (questionIndex > processed) {
    return Response.json({ error: 'Interview responses must be processed in order.' }, { status: 409 });
  }
  if (questionIndex === processed) {
    const limited = await limitScoring(request, id);
    if (limited.limited) return Response.json({ error: 'The interview is busy. Wait a few minutes.' }, { status: 429 });
    const claim = await claimStoredInterview(state);
    if (!claim) return Response.json({ error: 'This response is already being processed.' }, { status: 409 });
    const answeredQuestion = state.current_question;
    if (!answeredQuestion) {
      await releaseInterviewClaim(id, claim);
      return Response.json({ error: 'The interview is not awaiting a response.' }, { status: 409 });
    }
    try {
      const result = await processUniversalTurn(state, answer.transcript || '');
      result.state.screening!.processed_answer_count += 1;
      result.state.screening!.evidence_after_answers.push(result.state.evidence_ledger.length);
      await saveClaimedInterview(result.state, claim);
      state = result.state;
      await recordStageMetric({
        interviewId: id, stage: 'TURN', promptVersion: state.prompt_version,
        modelCalls: result.modelCalls, schemaRetry: result.schemaRetry,
        fallbackUsed: result.fallbackUsed, latencyMs: result.latencyMs,
      });
    } catch (error) {
      await releaseInterviewClaim(id, claim);
      if (error instanceof UniversalTurnError) {
        return Response.json({ error: error.message, code: error.code }, { status: error.status });
      }
      return Response.json({ error: 'Muqabala could not analyse this response. Retry without recording again.' }, { status: 503 });
    }
  }
  const settled = await settleAnswer(state, question, questionIndex, access.admin!).then(() => true, () => false);
  if (!settled) {
    return Response.json({ error: 'Your response is safe, but its analysis is not ready. Retry to continue.' }, { status: 503 });
  }
  const nextTurnIndex = await syncNextQuestion(state, access.admin!).catch(() => null);
  if (nextTurnIndex === null) {
    return Response.json({ error: 'Your response is safe, but the next question is not ready. Retry to continue.' }, { status: 503 });
  }
  return Response.json({
    brain: publicEmployerBrainState(state),
    nextTurnIndex,
    complete: state.phase === 'COMPLETE',
  }, { headers: privateNoStoreHeaders() });
}
