import { jsonError, publicInterviewState, universalInterviewEnabled } from '@/lib/universal-interview/api';
import { processUniversalTurn, UniversalTurnError } from '@/lib/universal-interview/process-turn';
import { claimStoredInterview, loadStoredInterview, recordStageMetric, releaseInterviewClaim, saveClaimedInterview } from '@/lib/universal-interview/repository';
import { TurnRequestSchema } from '@/lib/universal-interview/schemas';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { limitScoring } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!universalInterviewEnabled()) return jsonError('This interview is not available yet.', 404, 'not_enabled');
  if (!hasTrustedOrigin(request)) return jsonError('Invalid request origin.', 403, 'invalid_origin');
  const parsed = TurnRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Enter a valid interview answer.', 400, 'invalid_answer');
  const state = await loadStoredInterview(parsed.data.interview_id);
  if (!state) return jsonError('Interview not found.', 404, 'not_found');
  const rateLimit = await limitScoring(request, state.interview_id);
  if (rateLimit.limited) return jsonError('Too many answers were sent. Wait a few minutes.', 429, 'rate_limited');
  const claim = await claimStoredInterview(state);
  if (!claim) return jsonError('This answer is already being processed.', 409, 'interview_busy');
  try {
    const result = await processUniversalTurn(state, parsed.data.answer);
    await saveClaimedInterview(result.state, claim);
    await recordStageMetric({
      interviewId: result.state.interview_id,
      stage: 'TURN',
      promptVersion: result.state.prompt_version,
      modelCalls: result.modelCalls,
      schemaRetry: result.schemaRetry,
      fallbackUsed: result.fallbackUsed,
      latencyMs: result.latencyMs,
    });
    return Response.json({ ...publicInterviewState(result.state), action: result.action }, { headers: privateNoStoreHeaders() });
  } catch (error) {
    await releaseInterviewClaim(state.interview_id, claim);
    if (error instanceof UniversalTurnError) return jsonError(error.message, error.status, error.code);
    return jsonError('We could not read that answer. Please send it again.', 503, 'answer_processing_unavailable');
  }
}
