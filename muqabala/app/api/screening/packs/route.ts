import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { roleFromToken, signProofPack, verifyInterview } from '@/lib/interview-token';
import { proofQuestions } from '@/lib/proof-questions';
import { configuredOrigin, hasTrustedOrigin } from '@/lib/server/security';
import { limitInterviewGeneration } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  companyName: z.string().trim().min(2).max(80).optional(),
  workplace: z.string().trim().min(2).max(80).optional(),
  recruiterName: z.string().trim().max(80).optional(),
  jobTitle: z.string().max(120).optional(),
  interviewToken: z.string().min(1).max(64_000),
}).strict().refine((value) => Boolean(value.companyName || value.workplace), {
  message: 'Company name is required.',
});

function publicCode(): string {
  return randomBytes(6).toString('base64url');
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ configured: false }, { status: 503 });

  const limited = await limitInterviewGeneration(request);
  if (limited.limited) {
    return Response.json(
      { error: 'Too many work samples requested. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid work sample.' }, { status: 400 });

  const verified = verifyInterview(parsed.data.interviewToken);
  if (!verified || verified.kind !== 'practice') {
    return Response.json({ error: 'The tailored interview could not be verified.' }, { status: 400 });
  }
  const role = roleFromToken(verified);
  const questions = proofQuestions(role);
  if (!questions) return Response.json({ error: 'That job does not have enough questions for a work sample.' }, { status: 400 });

  const workplace = (parsed.data.companyName || parsed.data.workplace || '').trim();
  const recruiterName = (parsed.data.recruiterName || '').trim();
  const signedToken = signProofPack({
    title: role.title,
    industry: role.industry,
    level: role.level,
    competencies: role.competencies,
    questions,
    workplace,
    recruiterName,
  });
  if (!signedToken) return Response.json({ error: 'The work sample could not be signed.' }, { status: 503 });

  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  let code = publicCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await admin.from('screening_packs').insert({
      public_code: code,
      signed_token: signedToken,
      workplace,
      expires_at: expiresAt,
    });
    if (!error) {
      return Response.json({
        url: `${configuredOrigin()}/s/${code}`,
        title: role.title,
        workplace,
        recruiterName,
        questionCount: questions.length,
      }, { status: 201 });
    }
    code = publicCode();
  }
  return Response.json({ error: 'The work sample could not be saved.' }, { status: 503 });
}
