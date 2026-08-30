import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { interviewAccess } from '@/lib/server/interview-access';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { limitPracticePlan } from '@/lib/rate-limit';
import {
  contentDigest,
  encryptJson,
  issuePlanViewToken,
  keyedHash,
  practicePlanSecretsConfigured,
  tokenHash,
  verifyCompletionProof,
} from '@/lib/practice-plan/crypto';
import { buildSevenDayPlan } from '@/lib/practice-plan/plan';
import {
  maskEmail,
  normalizeEmail,
  PracticePlanRequestSchema,
} from '@/lib/practice-plan/schema';
import { safeEvent } from '@/lib/practice-plan/redaction';
import type { AnswerFeedback } from '@/lib/scoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const FeedbackSchema = z.object({
  questionId: z.string(),
  score: z.number(),
  status: z.enum(['scored', 'unscored']),
  headline: z.string(),
  competencies: z.array(z.object({
    id: z.string(), label: z.string(), score: z.number(), evidence: z.string().nullable().optional(),
  }).passthrough()),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  coachTip: z.string(),
  source: z.enum(['ai', 'structure', 'none']),
}).passthrough();

function json(code: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ code, ...extra }, { status, headers: privateNoStoreHeaders() });
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
  if (!verifyCompletionProof(input.sessionProof, input.sessionId)) return json('INVALID_SESSION_PROOF', 401);
  const access = await interviewAccess(input.sessionId);
  if (!access.configured) return json('TEMPORARILY_UNAVAILABLE', 503);
  if (!access.interview || (!access.owner && !access.anonymous) || access.interview.status !== 'completed' || access.interview.mode === 'screening') {
    return json('INVALID_SESSION_PROOF', 401);
  }

  const email = normalizeEmail(input.email);
  const emailParsed = z.string().email().max(320).safeParse(email);
  if (!emailParsed.success) return json('INVALID_REQUEST', 400);
  const emailHash = keyedHash(email);
  const limited = await limitPracticePlan(request, emailHash);
  if (limited.limited) return json('RATE_LIMITED', 429, { retryAfter: limited.retryAfterSeconds });

  const { data: idempotent } = await access.admin!.from('practice_plan_requests')
    .select('id,interview_id,email_hash,status')
    .eq('client_request_id', input.clientRequestId)
    .maybeSingle();
  if (idempotent) {
    if (idempotent.interview_id !== input.sessionId || idempotent.email_hash !== emailHash) {
      return json('IDEMPOTENCY_CONFLICT', 409);
    }
    return Response.json({ status: 'alreadyRequested', maskedEmail: maskEmail(email) }, { status: 202, headers: privateNoStoreHeaders() });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const { count, error: countError } = await access.admin!.from('practice_plan_requests')
    .select('id', { count: 'exact', head: true })
    .eq('email_hash', emailHash)
    .gte('created_at', since);
  if (countError) return json('TEMPORARILY_UNAVAILABLE', 503);
  if ((count ?? 0) >= 3) return json('RATE_LIMITED', 429, { retryAfter: 86_400 });

  const { data: storedAnswers, error: answersError } = await access.admin!.from('interview_answers')
    .select('question_text,feedback,scoring_status')
    .eq('interview_id', input.sessionId)
    .order('question_index');
  if (answersError || !storedAnswers?.length) return json('TEMPORARILY_UNAVAILABLE', 503);
  const answers = storedAnswers.flatMap((answer) => {
    const feedback = FeedbackSchema.safeParse(answer.feedback);
    return feedback.success ? [{ questionText: answer.question_text, feedback: feedback.data as AnswerFeedback }] : [];
  });
  if (answers.length !== storedAnswers.length) return json('TEMPORARILY_UNAVAILABLE', 503);

  try {
    const plan = buildSevenDayPlan(input.locale, access.interview.role_title, answers);
    const requestId = randomUUID();
    const grantId = randomUUID();
    const grantExpiresAtMs = Date.now() + 14 * 24 * 60 * 60 * 1_000;
    const viewToken = issuePlanViewToken(grantId, grantExpiresAtMs);
    const snapshot = { plan, viewToken };
    const dataExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();
    const providerKey = `practice-plan/${requestId}/v1`;
    const { data, error } = await access.admin!.rpc('create_practice_plan_request', {
      p_request_id: requestId,
      p_interview_id: input.sessionId,
      p_client_request_id: input.clientRequestId,
      p_locale: input.locale,
      p_email_hash: emailHash,
      p_email_ciphertext: encryptJson(email),
      p_plan_ciphertext: encryptJson(snapshot),
      p_plan_digest: contentDigest(plan),
      p_provider_idempotency_key: providerKey,
      p_consent_version: input.consentVersion,
      p_grant_id: grantId,
      p_grant_token_hash: tokenHash(viewToken),
      p_grant_expires_at: new Date(grantExpiresAtMs).toISOString(),
      p_data_expires_at: dataExpiresAt,
    });
    if (error || !data?.[0]) throw new Error('durable_commit_failed');
    if (data[0].result === 'conflict') return json('IDEMPOTENCY_CONFLICT', 409);
    if (data[0].result === 'invalid_session') return json('INVALID_SESSION_PROOF', 401);
    if (data[0].result === 'suppressed') return json('TEMPORARILY_UNAVAILABLE', 503);
    const status = data[0].result === 'already_requested' ? 'alreadyRequested' : 'queued';
    return Response.json({ status, maskedEmail: maskEmail(email) }, { status: 202, headers: privateNoStoreHeaders() });
  } catch (error) {
    console.error(safeEvent('practice_plan_request_failed', { error: error instanceof Error ? error.name : 'unknown' }));
    return json('TEMPORARILY_UNAVAILABLE', 503);
  }
}
