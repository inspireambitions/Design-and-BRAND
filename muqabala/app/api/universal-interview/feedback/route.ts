import { buildFinalFeedback, deterministicFeedbackFallback } from '@/lib/universal-interview/feedback';
import { candidateCopySafe, jsonError, universalInterviewEnabled } from '@/lib/universal-interview/api';
import { callStructured, ModelCallBudget } from '@/lib/universal-interview/model';
import { FEEDBACK_INSTRUCTIONS, feedbackInput } from '@/lib/universal-interview/prompts';
import { claimStoredInterview, loadStoredInterview, recordStageMetric, saveClaimedInterview } from '@/lib/universal-interview/repository';
import { FeedbackRequestSchema, FeedbackSchema } from '@/lib/universal-interview/schemas';
import type { FeedbackModelOutput, InterviewState } from '@/lib/universal-interview/types';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { limitScoring } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

function validFeedbackSemantics(state: InterviewState, output: FeedbackModelOutput): boolean {
  if (!candidateCopySafe(output)) return false;
  const expected = new Set(state.blueprint.map((competency) => competency.id));
  const returned = output.competencies.map((competency) => competency.id);
  if (returned.length !== expected.size || new Set(returned).size !== returned.length) return false;
  if (returned.some((id) => !expected.has(id))) return false;
  const evidenceIds = new Set(state.evidence_ledger.map((entry) => entry.id));
  return output.competencies.every((competency) => competency.evidence_ids.every((id) => evidenceIds.has(id)));
}

export async function POST(request: Request) {
  const started = Date.now();
  if (!universalInterviewEnabled()) return jsonError('This interview is not available yet.', 404, 'not_enabled');
  if (!hasTrustedOrigin(request)) return jsonError('Invalid request origin.', 403, 'invalid_origin');
  const parsed = FeedbackRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Invalid interview.', 400, 'invalid_request');
  const state = await loadStoredInterview(parsed.data.interview_id);
  if (!state) return jsonError('Interview not found.', 404, 'not_found');
  const rateLimit = await limitScoring(request, state.interview_id);
  if (rateLimit.limited) return jsonError('Feedback is busy. Wait a few minutes.', 429, 'rate_limited');
  if (state.phase !== 'COMPLETE') return jsonError('Finish the interview before requesting feedback.', 409, 'not_complete');
  if (state.final_feedback) return Response.json({
    ...state.final_feedback,
    retry_question_text: state.plan[state.final_feedback.retry_recommended_question - 1]?.text,
  }, { headers: privateNoStoreHeaders() });
  const claim = await claimStoredInterview(state);
  if (!claim) return jsonError('Feedback is already being prepared.', 409, 'interview_busy');

  const budget = new ModelCallBudget(2);
  const generated = await callStructured({
    stage: 'F1',
    schemaName: 'final_interview_feedback',
    schema: FeedbackSchema,
    instructions: FEEDBACK_INSTRUCTIONS,
    prompt: feedbackInput(state),
    budget,
    allowValidationRetry: false,
  });
  const safeOutput = generated && validFeedbackSemantics(state, generated)
    ? generated
    : deterministicFeedbackFallback(state);
  state.final_feedback = buildFinalFeedback(state, safeOutput);
  await saveClaimedInterview(state, claim);
  await recordStageMetric({
    interviewId: state.interview_id,
    stage: 'F1',
    promptVersion: state.prompt_version,
    modelCalls: budget.used,
    schemaRetry: budget.schemaRetried,
    fallbackUsed: safeOutput !== generated,
    latencyMs: Date.now() - started,
  });
  return Response.json({
    ...state.final_feedback,
    retry_question_text: state.plan[state.final_feedback.retry_recommended_question - 1]?.text,
  }, { headers: privateNoStoreHeaders() });
}
