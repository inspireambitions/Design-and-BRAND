import { applyExtraction, deterministicExtractionFallback } from '@/lib/universal-interview/engine';
import { buildFinalFeedback, deterministicFeedbackFallback } from '@/lib/universal-interview/feedback';
import { candidateCopySafe, jsonError, universalInterviewEnabled, validateExtractionSemantics } from '@/lib/universal-interview/api';
import { callStructured, ModelCallBudget } from '@/lib/universal-interview/model';
import {
  EXTRACTION_INSTRUCTIONS,
  extractionInput,
  FEEDBACK_INSTRUCTIONS,
  feedbackInput,
} from '@/lib/universal-interview/prompts';
import { fromPlannedQuestion } from '@/lib/universal-interview/questions';
import { claimStoredInterview, loadStoredInterview, recordStageMetric, saveClaimedInterview } from '@/lib/universal-interview/repository';
import { ExtractionSchema, FeedbackSchema, RetryRequestSchema } from '@/lib/universal-interview/schemas';
import { precheckAnswer } from '@/lib/universal-interview/sanitise';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { limitScoring } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  const started = Date.now();
  if (!universalInterviewEnabled()) return jsonError('This interview is not available yet.', 404, 'not_enabled');
  if (!hasTrustedOrigin(request)) return jsonError('Invalid request origin.', 403, 'invalid_origin');
  const parsed = RetryRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Invalid retry.', 400, 'invalid_request');
  let state = await loadStoredInterview(parsed.data.interview_id);
  if (!state) return jsonError('Interview not found.', 404, 'not_found');
  const rateLimit = await limitScoring(request, state.interview_id);
  if (rateLimit.limited) return jsonError('Feedback is busy. Wait a few minutes.', 429, 'rate_limited');
  if (state.phase !== 'COMPLETE') return jsonError('Finish the interview before retrying an answer.', 409, 'not_complete');
  if (state.retry_used) return jsonError('The one interview retry has already been used.', 409, 'retry_used');
  const completedState = state;
  const planned = state.plan[parsed.data.question_number - 1];
  if (!planned) return jsonError('Question not found.', 404, 'question_not_found');
  const precheck = precheckAnswer(parsed.data.answer);
  if (precheck.kind !== 'NONE') return jsonError('Give a complete new answer for this retry.', 400, 'invalid_retry_answer');
  const claim = await claimStoredInterview(state);
  if (!claim) return jsonError('This retry is already being processed.', 409, 'interview_busy');

  const targetIds = planned.target_competencies;
  const before = Object.fromEntries(targetIds.map((id) => [id, completedState.coverage[id]?.status ?? 'NO_EVIDENCE']));
  const budget = new ModelCallBudget(2);
  const extractionState = structuredClone(completedState);
  extractionState.current_question = fromPlannedQuestion(planned);
  extractionState.question_number = parsed.data.question_number;
  const generatedExtraction = await callStructured({
    stage: 'T1',
    schemaName: 'retry_evidence',
    schema: ExtractionSchema,
    instructions: EXTRACTION_INSTRUCTIONS,
    prompt: extractionInput(extractionState, precheck.cleaned_answer, precheck.short_answer),
    budget,
    allowValidationRetry: false,
  });
  const extraction = generatedExtraction && !validateExtractionSemantics(extractionState, generatedExtraction)
    ? generatedExtraction
    : deterministicExtractionFallback();
  state = applyExtraction(extractionState, extraction, precheck.cleaned_answer);
  state.phase = 'COMPLETE';
  state.status = 'COMPLETE';
  state.current_question = null;
  state.retry_used = true;

  const generatedFeedback = await callStructured({
    stage: 'F1',
    schemaName: 'retry_feedback',
    schema: FeedbackSchema,
    instructions: FEEDBACK_INSTRUCTIONS,
    prompt: feedbackInput(state),
    budget,
    allowValidationRetry: false,
  });
  const knownCompetencies = new Set(state.blueprint.map((competency) => competency.id));
  const knownEvidence = new Set(state.evidence_ledger.map((entry) => entry.id));
  const feedbackSafe = generatedFeedback
    && candidateCopySafe(generatedFeedback)
    && generatedFeedback.competencies.length === knownCompetencies.size
    && generatedFeedback.competencies.every((item) => knownCompetencies.has(item.id)
      && item.evidence_ids.every((id) => knownEvidence.has(id)));
  const output = feedbackSafe ? generatedFeedback : deterministicFeedbackFallback(state);
  state.final_feedback = buildFinalFeedback(state, output);
  const after = Object.fromEntries(targetIds.map((id) => [id, state.coverage[id]?.status ?? 'NO_EVIDENCE']));
  await saveClaimedInterview(state, claim);
  await recordStageMetric({
    interviewId: state.interview_id,
    stage: 'RETRY',
    promptVersion: state.prompt_version,
    modelCalls: budget.used,
    schemaRetry: budget.schemaRetried,
    fallbackUsed: extraction !== generatedExtraction || output !== generatedFeedback,
    latencyMs: Date.now() - started,
  });

  return Response.json({
    question_number: parsed.data.question_number,
    before,
    after,
    feedback: state.final_feedback.competencies.filter((competency) => targetIds.includes(competency.id)),
  }, { headers: privateNoStoreHeaders() });
}
