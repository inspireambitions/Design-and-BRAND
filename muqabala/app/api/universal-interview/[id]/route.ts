import { deleteStoredInterview, loadStoredInterview } from '@/lib/universal-interview/repository';
import { jsonError, publicInterviewState, universalInterviewEnabled } from '@/lib/universal-interview/api';
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
    discovery: {
      interview_id: state.interview_id,
      role_summary: `Interview for ${state.role}`,
      competencies: state.discovery,
      suggested_competency_ids: state.blueprint.length
        ? state.blueprint.map((competency) => competency.id)
        : state.discovery.slice(0, 5).map((competency) => competency.id),
      notice: 'Your saved interview has been restored.',
    },
    feedback: state.final_feedback ? {
      ...state.final_feedback,
      retry_question_text: state.plan[state.final_feedback.retry_recommended_question - 1]?.text,
    } : null,
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
