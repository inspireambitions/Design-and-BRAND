import { applyExtraction } from '@/lib/universal-interview/engine';
import { buildFinalFeedback, deterministicFeedbackFallback } from '@/lib/universal-interview/feedback';
import { candidateCopySafe, jsonError, publicRetryComparison, universalInterviewEnabled, validateExtractionSemantics } from '@/lib/universal-interview/api';
import { callStructured, ModelCallBudget } from '@/lib/universal-interview/model';
import {
  EXTRACTION_INSTRUCTIONS,
  extractionInput,
  FEEDBACK_INSTRUCTIONS,
  feedbackInput,
} from '@/lib/universal-interview/prompts';
import { fromPlannedQuestion } from '@/lib/universal-interview/questions';
import { claimStoredInterview, loadStoredInterview, recordStageMetric, releaseInterviewClaim, saveClaimedInterview } from '@/lib/universal-interview/repository';
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
  if (precheck.kind !== 'NONE' || precheck.word_count < 5) {
    return jsonError('Give a complete new answer for this retry.', 400, 'invalid_retry_answer');
  }
  const claim = await claimStoredInterview(state);
  if (!claim) return jsonError('This retry is already being processed.', 409, 'interview_busy');

  const targetIds = planned.target_competencies;
  const before = Object.fromEntries(targetIds.map((id) => [id, completedState.coverage[id]?.status ?? 'NO_EVIDENCE']));
  const budget = new ModelCallBudget(2);
  const extractionState = structuredClone(completedState);
  extractionState.current_question = fromPlannedQuestion(planned);
  extractionState.question_number = parsed.data.question_number;
  const extractionPrompt = extractionInput(extractionState, precheck.cleaned_answer, precheck.short_answer);
  let extraction = null;
  let semanticFailure = '';
  while (budget.remaining > 0 && !extraction) {
    const generated = await callStructured({
      stage: 'T1',
      schemaName: 'retry_evidence',
      schema: ExtractionSchema,
      instructions: EXTRACTION_INSTRUCTIONS,
      prompt: semanticFailure ? `${extractionPrompt}\n\nYour previous output failed validation: ${semanticFailure}.` : extractionPrompt,
      budget,
      allowValidationRetry: false,
    });
    if (!generated) {
      semanticFailure = 'schema validation failed';
      continue;
    }
    const criteriaEntries = generated.evidence.criteria;
    const criteria = Object.fromEntries(criteriaEntries.map((item) => [item.criterion, item.status]));
    const normalised = { ...generated, evidence: { ...generated.evidence, criteria } };
    const duplicateCriteria = new Set(criteriaEntries.map((item) => item.criterion)).size !== criteriaEntries.length;
    semanticFailure = duplicateCriteria
      ? 'duplicate framework criterion'
      : validateExtractionSemantics(extractionState, normalised) ?? '';
    if (!semanticFailure) extraction = normalised;
  }
  if (!extraction) {
    await releaseInterviewClaim(state.interview_id, claim);
    await recordStageMetric({
      interviewId: state.interview_id,
      stage: 'RETRY',
      promptVersion: state.prompt_version,
      modelCalls: budget.used,
      schemaRetry: budget.schemaRetried,
      fallbackUsed: true,
      latencyMs: Date.now() - started,
    });
    return jsonError('We could not read that retry. Please send it again.', 503, 'answer_processing_unavailable');
  }
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
  const rebuiltFeedback = buildFinalFeedback(state, output);
  const earlierFeedback = completedState.final_feedback;
  if (earlierFeedback) {
    const updatedById = new Map(rebuiltFeedback.competencies.map((item) => [item.id, item]));
    state.final_feedback = {
      ...earlierFeedback,
      competencies: earlierFeedback.competencies.map((item) => (
        targetIds.includes(item.id) ? updatedById.get(item.id) ?? item : item
      )),
      single_highest_value_improvement: feedbackSafe
        ? rebuiltFeedback.single_highest_value_improvement
        : earlierFeedback.single_highest_value_improvement,
    };
  } else {
    state.final_feedback = rebuiltFeedback;
  }
  const after = Object.fromEntries(targetIds.map((id) => [id, state.coverage[id]?.status ?? 'NO_EVIDENCE']));
  state.retry_result = {
    question_number: parsed.data.question_number,
    before,
    after,
    feedback: state.final_feedback.competencies.filter((competency) => targetIds.includes(competency.id)),
  };
  await saveClaimedInterview(state, claim);
  await recordStageMetric({
    interviewId: state.interview_id,
    stage: 'RETRY',
    promptVersion: state.prompt_version,
    modelCalls: budget.used,
    schemaRetry: budget.schemaRetried,
    fallbackUsed: !feedbackSafe,
    latencyMs: Date.now() - started,
  });

  return Response.json(publicRetryComparison(state.retry_result), { headers: privateNoStoreHeaders() });
}
