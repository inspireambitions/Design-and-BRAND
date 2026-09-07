import { activateInterview } from '@/lib/universal-interview/engine';
import { fallbackPlan } from '@/lib/universal-interview/blueprint';
import { jsonError, normaliseGeneratedPlan, publicInterviewState, universalInterviewEnabled } from '@/lib/universal-interview/api';
import { callStructured, ModelCallBudget } from '@/lib/universal-interview/model';
import { PLAN_INSTRUCTIONS, planInput } from '@/lib/universal-interview/prompts';
import { claimStoredInterview, loadStoredInterview, recordStageMetric, saveClaimedInterview } from '@/lib/universal-interview/repository';
import { ConfirmRequestSchema, PlanSchema } from '@/lib/universal-interview/schemas';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { limitInterviewGeneration, limitInterviewGenerationDaily } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  const started = Date.now();
  if (!universalInterviewEnabled()) return jsonError('This interview is not available yet.', 404, 'not_enabled');
  if (!hasTrustedOrigin(request)) return jsonError('Invalid request origin.', 403, 'invalid_origin');
  const parsed = ConfirmRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Choose exactly five competencies.', 400, 'invalid_confirmation');
  const state = await loadStoredInterview(parsed.data.interview_id);
  if (!state) return jsonError('Interview not found.', 404, 'not_found');
  const rateLimit = await limitInterviewGeneration(request, state.interview_id);
  if (rateLimit.limited) return jsonError('Too many interview plans were requested. Wait a few minutes.', 429, 'rate_limited');
  if ((await limitInterviewGenerationDaily()).limited) return jsonError('Interview building is busy today.', 503, 'daily_capacity');
  if (state.phase !== 'AWAITING_CONFIRMATION') return jsonError('This blueprint is already confirmed.', 409, 'already_confirmed');

  let confirmed;
  try {
    confirmed = activateInterview(state, parsed.data.competency_ids, fallbackPlan(
      parsed.data.competency_ids.map((id) => state.discovery.find((item) => item.id === id)!).filter(Boolean),
      state.profile,
      state.role_pack,
    ));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Invalid blueprint.', 400, 'invalid_confirmation');
  }

  const claim = await claimStoredInterview(state);
  if (!claim) return jsonError('This interview is already being updated.', 409, 'interview_busy');

  const budget = new ModelCallBudget(2);
  let plan: ReturnType<typeof normaliseGeneratedPlan> = null;
  for (let attempt = 0; attempt < 2 && budget.remaining > 0 && !plan; attempt += 1) {
    const generated = await callStructured({
      stage: 'P2',
      schemaName: 'interview_plan',
      schema: PlanSchema,
      instructions: PLAN_INSTRUCTIONS,
      prompt: `${planInput(confirmed)}${attempt ? '\n\nYour previous candidate_text failed validation. Return eight corrected questions.' : ''}`,
      budget,
      allowValidationRetry: false,
    });
    plan = generated ? normaliseGeneratedPlan(confirmed, generated.plan) : null;
    if (!plan && budget.remaining > 0) budget.markRetry();
  }
  confirmed = activateInterview(state, parsed.data.competency_ids, plan ?? fallbackPlan(confirmed.blueprint, state.profile, state.role_pack));
  await saveClaimedInterview(confirmed, claim);
  await recordStageMetric({
    interviewId: confirmed.interview_id,
    stage: 'P2',
    promptVersion: confirmed.prompt_version,
    modelCalls: budget.used,
    schemaRetry: budget.schemaRetried,
    fallbackUsed: !plan,
    latencyMs: Date.now() - started,
  });
  return Response.json(publicInterviewState(confirmed), { headers: privateNoStoreHeaders() });
}
