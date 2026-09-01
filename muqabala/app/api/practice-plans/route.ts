import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { interviewAccess } from '@/lib/server/interview-access';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { limitPracticePlan } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRole } from '@/lib/roles';
import {
  contentDigest,
  encryptJson,
  issuePlanViewToken,
  keyedHash,
  practicePlanSecretsConfigured,
  tokenHash,
} from '@/lib/practice-plan/crypto';
import { buildSevenDayPlan } from '@/lib/practice-plan/plan';
import { maskEmail, normalizeEmail, PracticePlanRequestSchema } from '@/lib/practice-plan/schema';
import { safeEvent } from '@/lib/practice-plan/redaction';
import { providerIdempotencyKey, type PlanSnapshot } from '@/lib/practice-plan/worker';
import type { AnswerFeedback } from '@/lib/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const FeedbackSchema = z.object({
  questionId: z.string(),
  score: z.number(),
  status: z.enum(['scored', 'unscored']),
  headline: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  coachTip: z.string(),
}).passthrough();

const PLAN_LINK_DAYS = 21;
const DATA_RETENTION_DAYS = 30;
const PER_EMAIL_DAILY_CAP = 3;

function json(code: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ code, ...extra }, { status, headers: privateNoStoreHeaders() });
}

/**
 * The candidate's own feedback for the answered question, read only when the
 * request carries an interview the caller can prove they own (account owner or
 * the anonymous attempt cookie). Anything else sends the plan without it, so a
 * missing cookie never blocks the candidate and a guessed id reveals nothing.
 */
async function ownFeedback(interviewId: string | undefined, questionId: string, roleId: string) {
  if (!interviewId) return { interviewId: null, feedback: null };
  const access = await interviewAccess(interviewId);
  if (!access.configured || !access.interview || (!access.owner && !access.anonymous)) return { interviewId: null, feedback: null };
  if (access.interview.role_id !== roleId || access.interview.mode === 'screening') return { interviewId: null, feedback: null };
  const { data } = await access.admin!.from('interview_answers')
    .select('feedback')
    .eq('interview_id', interviewId)
    .eq('question_id', questionId)
    .maybeSingle();
  const parsed = FeedbackSchema.safeParse(data?.feedback);
  return { interviewId, feedback: parsed.success ? (parsed.data as AnswerFeedback) : null };
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return json('INVALID_REQUEST', 400);
  if (process.env.PRACTICE_PLAN_EMAIL_ENABLED !== 'true' || !practicePlanSecretsConfigured()) {
    return json('TEMPORARILY_UNAVAILABLE', 503);
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 8_192) return json('INVALID_REQUEST', 400);
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > 8_192) return json('INVALID_REQUEST', 400);
  let body: unknown;
  try {
    body = JSON.parse(raw || 'null');
  } catch {
    return json('INVALID_REQUEST', 400);
  }
  const parsed = PracticePlanRequestSchema.safeParse(body);
  if (!parsed.success) return json('INVALID_REQUEST', 400);
  const input = parsed.data;

  const role = getRole(input.roleId);
  if (!role || role.id !== input.roleId) return json('INVALID_REQUEST', 400);

  const admin = createAdminClient();
  if (!admin) return json('TEMPORARILY_UNAVAILABLE', 503);

  const email = normalizeEmail(input.email);
  if (!z.string().email().max(320).safeParse(email).success) return json('INVALID_REQUEST', 400);
  const emailHash = keyedHash(email);
  const limited = await limitPracticePlan(request, emailHash);
  if (limited.limited) return json('RATE_LIMITED', 429, { retryAfter: limited.retryAfterSeconds });

  const { data: idempotent } = await admin.from('practice_plan_requests')
    .select('id,email_hash')
    .eq('client_request_id', input.clientRequestId)
    .maybeSingle();
  if (idempotent) {
    if (idempotent.email_hash !== emailHash) return json('IDEMPOTENCY_CONFLICT', 409);
    return Response.json({ status: 'alreadyRequested', maskedEmail: maskEmail(email) }, { status: 202, headers: privateNoStoreHeaders() });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const { count, error: countError } = await admin.from('practice_plan_requests')
    .select('id', { count: 'exact', head: true })
    .eq('email_hash', emailHash)
    .gte('created_at', since);
  if (countError) return json('TEMPORARILY_UNAVAILABLE', 503);
  if ((count ?? 0) >= PER_EMAIL_DAILY_CAP) return json('RATE_LIMITED', 429, { retryAfter: 86_400 });

  try {
    const own = await ownFeedback(input.interviewId, input.questionId, role.id);
    const plan = buildSevenDayPlan(role, {
      locale: input.locale,
      mode: input.mode,
      focusQuestionId: input.questionId,
      feedback: own.feedback,
    });
    const requestId = randomUUID();
    const grantId = randomUUID();
    const grantExpiresAtMs = Date.now() + PLAN_LINK_DAYS * 24 * 60 * 60 * 1_000;
    const viewToken = issuePlanViewToken(grantId, grantExpiresAtMs);
    const snapshot: PlanSnapshot = { plan, viewToken };
    const dataExpiresAt = new Date(Date.now() + DATA_RETENTION_DAYS * 24 * 60 * 60 * 1_000).toISOString();
    const { data, error } = await admin.rpc('create_practice_plan_request_v2', {
      p_request_id: requestId,
      p_interview_id: own.interviewId,
      p_role_id: role.id,
      p_question_id: plan.focusQuestionId,
      p_mode: input.mode,
      p_client_request_id: input.clientRequestId,
      p_locale: input.locale,
      p_email_hash: emailHash,
      p_email_ciphertext: encryptJson(email),
      p_plan_ciphertext: encryptJson(snapshot),
      p_plan_digest: contentDigest(plan),
      p_provider_idempotency_key: providerIdempotencyKey(requestId, 0),
      p_consent_version: input.consentVersion,
      p_consent_source: input.consentSource,
      p_grant_id: grantId,
      p_grant_token_hash: tokenHash(viewToken),
      p_grant_expires_at: new Date(grantExpiresAtMs).toISOString(),
      p_data_expires_at: dataExpiresAt,
    });
    if (error || !data?.[0]) throw new Error('durable_commit_failed');
    if (data[0].result === 'conflict') return json('IDEMPOTENCY_CONFLICT', 409);
    if (data[0].result === 'invalid_session') return json('INVALID_REQUEST', 400);
    if (data[0].result === 'suppressed') return json('TEMPORARILY_UNAVAILABLE', 503);
    const status = data[0].result === 'already_requested' ? 'alreadyRequested' : 'queued';
    return Response.json({ status, maskedEmail: maskEmail(email) }, { status: 202, headers: privateNoStoreHeaders() });
  } catch (error) {
    console.error(safeEvent('practice_plan_request_failed', { error: error instanceof Error ? error.name : 'unknown' }));
    return json('TEMPORARILY_UNAVAILABLE', 503);
  }
}
