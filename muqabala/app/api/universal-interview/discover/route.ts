import { randomUUID } from 'node:crypto';
import { mergeAndRankCompetencies, fallbackDiscovery } from '@/lib/universal-interview/blueprint';
import { encryptionConfigured } from '@/lib/universal-interview/crypto';
import { createInterviewState } from '@/lib/universal-interview/engine';
import { callStructured, ModelCallBudget } from '@/lib/universal-interview/model';
import { DISCOVERY_INSTRUCTIONS, discoveryInput } from '@/lib/universal-interview/prompts';
import { createStoredInterview, recordStageMetric } from '@/lib/universal-interview/repository';
import { getRolePack, rolePackFound } from '@/lib/universal-interview/role-packs';
import { assessJobDescription } from '@/lib/universal-interview/sanitise';
import { DiscoverRequestSchema, DiscoverySchema } from '@/lib/universal-interview/schemas';
import { candidateCopySafe, jsonError, publicDiscoveryState, universalInterviewEnabled } from '@/lib/universal-interview/api';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { limitInterviewGeneration, limitInterviewGenerationDaily } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  const started = Date.now();
  if (!universalInterviewEnabled()) return jsonError('This interview is not available yet.', 404, 'not_enabled');
  if (!hasTrustedOrigin(request)) return jsonError('Invalid request origin.', 403, 'invalid_origin');
  if (!encryptionConfigured()) return jsonError('Interview storage is not configured.', 503, 'storage_unavailable');
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > 24_000) return jsonError('That job description is too long.', 413, 'body_too_large');

  const parsed = DiscoverRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('Check the role and profile details.', 400, 'invalid_profile');
  const rateLimit = await limitInterviewGeneration(request);
  if (rateLimit.limited) return jsonError('Too many interviews were started. Wait a few minutes.', 429, 'rate_limited');
  if ((await limitInterviewGenerationDaily()).limited) return jsonError('Interview building is busy today.', 503, 'daily_capacity');
  const { profile, job_description: rawJD } = parsed.data;
  const jdQuality = assessJobDescription(rawJD);

  if (jdQuality.detected_titles.length > 1) {
    const target = profile.target_role.toLowerCase();
    const selected = jdQuality.detected_titles.some((title) => title.toLowerCase() === target);
    if (!selected) {
      return Response.json({
        error: { code: 'role_choice_required', message: 'Choose which role you want to practise.' },
        detected_titles: jdQuality.detected_titles,
      }, { status: 409, headers: privateNoStoreHeaders() });
    }
  }

  const rolePack = getRolePack(profile.target_role);
  const budget = new ModelCallBudget(2);
  const modelDiscovery = await callStructured({
    stage: 'P1',
    schemaName: 'competency_discovery',
    schema: DiscoverySchema,
    instructions: DISCOVERY_INSTRUCTIONS,
    prompt: discoveryInput({ profile, jd: jdQuality, pack: rolePack }),
    budget,
  });
  const fallback = fallbackDiscovery(profile, rolePack);
  const discovery = modelDiscovery && candidateCopySafe(modelDiscovery)
    ? { ...modelDiscovery, seniority_detected: profile.experience_level }
    : fallback;
  discovery.competencies = mergeAndRankCompetencies(discovery.competencies, rolePack, profile.career_change);
  if (discovery.competencies.length < 5) {
    discovery.competencies = mergeAndRankCompetencies(fallback.competencies, rolePack, profile.career_change);
  }

  const state = createInterviewState({
    interviewId: randomUUID(),
    profile,
    jdQuality,
    discovery,
    rolePack,
  });
  try {
    await createStoredInterview(state);
  } catch {
    return jsonError('The interview could not be started safely.', 503, 'storage_unavailable');
  }
  await recordStageMetric({
    interviewId: state.interview_id,
    stage: 'P1',
    promptVersion: state.prompt_version,
    modelCalls: budget.used,
    schemaRetry: budget.schemaRetried,
    fallbackUsed: !modelDiscovery || !candidateCopySafe(modelDiscovery),
    latencyMs: Date.now() - started,
  });

  const notice = jdQuality.outcome === 'PASS'
    ? 'Your blueprint uses the job description and the role pack.'
    : jdQuality.outcome === 'WEAK'
      ? 'Part of this blueprint is assumed because the job description was limited.'
      : rolePackFound(profile.target_role)
        ? 'The job description could not be used, so this blueprint uses the role pack.'
        : 'No reviewed role pack was found, so this blueprint uses the general baseline.';

  return Response.json(
    publicDiscoveryState(state, discovery.role_summary, notice),
    { headers: privateNoStoreHeaders() },
  );
}
