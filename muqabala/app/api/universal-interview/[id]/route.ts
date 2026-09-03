import { deleteStoredInterview, loadStoredInterview } from '@/lib/universal-interview/repository';
import {
  jsonError,
  publicDiscoveryState,
  publicFinalFeedback,
  publicInterviewState,
  publicRetryComparison,
  universalInterviewEnabled,
} from '@/lib/universal-interview/api';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!universalInterviewEnabled()) return jsonError('This interview is not available yet.', 404, 'not_enabled');
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return jsonError('Invalid interview.', 400, 'invalid_request');
  const state = await loadStoredInterview(id);
  if (!state) return jsonError('Interview not found.', 404, 'not_found');
  return Response.json({
    interview: publicInterviewState(state),
    discovery: publicDiscoveryState(
      state,
      `Interview for ${state.role}`,
      'Your saved interview has been restored.',
    ),
    feedback: state.final_feedback
      ? publicFinalFeedback(
          state.final_feedback,
          state.plan[state.final_feedback.retry_recommended_question - 1]?.text,
        )
      : null,
    retry_result: state.retry_result ? publicRetryComparison(state.retry_result) : null,
  }, { headers: privateNoStoreHeaders() });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!universalInterviewEnabled()) return jsonError('This interview is not available yet.', 404, 'not_enabled');
  if (!hasTrustedOrigin(request)) return jsonError('Invalid request origin.', 403, 'invalid_origin');
  const { id } = await context.params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) return jsonError('Invalid interview.', 400, 'invalid_request');
  const deleted = await deleteStoredInterview(id);
  if (!deleted) return jsonError('Interview not found.', 404, 'not_found');
  return Response.json({ deleted: true }, { headers: privateNoStoreHeaders() });
}
