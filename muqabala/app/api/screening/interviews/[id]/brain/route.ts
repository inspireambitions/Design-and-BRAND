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
import { TranscriptSegmentsSchema, type TranscriptSegment } from '@/lib/interviews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const RequestSchema = z.object({ questionIndex: z.number().int().min(0).max(49) }).strict();

async function syncTimedEvidence(input: {
  state: InterviewState;
  answerId: string;
  questionIndex: number;
  evidenceStart: number;
  segments: TranscriptSegment[];
  admin: NonNullable<Awaited<ReturnType<typeof interviewAccess>>['admin']>;
}) {
  if (input.segments.length === 0) return;
  const byId = new Map(input.segments.map((segment) => [segment.id, segment]));
  const records = input.state.evidence_ledger.slice(input.evidenceStart).flatMap((entry) => {
    const selected = (Array.isArray(entry.segment_ids) ? entry.segment_ids : [])
      .map((id) => byId.get(id))
      .filter((segment): segment is TranscriptSegment => Boolean(segment));
    if (selected.length === 0) return [];
    const transcriptSpan = selected.map((segment) => segment.text).join(' ').trim().slice(0, 1200);
    if (!transcriptSpan) return [];
    return Object.entries(entry.competencies).map(([competencyId, evidenceStrength]) => ({
      interview_id: input.state.interview_id,
      answer_id: input.answerId,
      question_index: input.questionIndex,
      evidence_key: entry.id,
      competency_id: competencyId,
      transcript_span: transcriptSpan,
      start_ms: selected[0].startMs,
      end_ms: selected.at(-1)!.endMs,
      evidence_strength: evidenceStrength,
      criterion_results: entry.criteria,
      pipeline_version: input.state.prompt_version,
    }));
  });
  if (records.length === 0) return;
  const { error } = await input.admin.from('interview_evidence_records').upsert(records, {
    onConflict: 'interview_id,evidence_key,competency_id',
  });
  if (error) throw new Error('timed_evidence_not_saved');
}

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
    .select('id,transcript,transcript_segments,transcript_timing_version,response_saved_at')
    .eq('interview_id', id)
    .eq('question_index', questionIndex)
    .maybeSingle();
  if (!question || !answer?.response_saved_at) {
    return Response.json({ error: 'Save the recorded response before continuing.' }, { status: 409 });
  }
  const parsedSegments = answer.transcript_timing_version === 'openai-whisper-segment-v1'
    ? TranscriptSegmentsSchema.safeParse(answer.transcript_segments)
    : null;
  const timedSegments = parsedSegments?.success ? parsedSegments.data : [];
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
      const result = await processUniversalTurn(state, answer.transcript || '', {
        allowDeterministicExtractionFallback: true,
        timedSegments,
      });
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
      const internalCode = error instanceof Error && /^[a-z0-9_]+(?::[a-z0-9_]+)?$/i.test(error.message)
        ? error.message.split(':')[0]
        : 'unexpected_turn_error';
      console.warn('screening_brain_turn_failed', { code: internalCode });
      return Response.json({
        error: 'Your response is saved. Its analysis needs another try.',
        code: 'analysis_unavailable',
      }, { status: 503 });
    }
  }
  const evidenceStart = questionIndex > 0 ? state.screening!.evidence_after_answers[questionIndex - 1] ?? 0 : 0;
  const timedEvidenceSaved = await syncTimedEvidence({
    state,
    answerId: answer.id,
    questionIndex,
    evidenceStart,
    segments: timedSegments,
    admin: access.admin!,
  }).then(() => true, () => false);
  if (!timedEvidenceSaved) {
    return Response.json({ error: 'Your response is safe, but its evidence link is not ready. Retry to continue.' }, { status: 503 });
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
