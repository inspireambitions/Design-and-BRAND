import { randomBytes } from 'node:crypto';
import { after } from 'next/server';
import { POST as generateInterviewResponse } from '@/app/api/interview/route';
import { ADVERT_CACHE_VERSION } from '@/lib/advert-cache';
import { CATALOGUE_INTERVIEW_VERSION, catalogueInterviewRole } from '@/lib/interview-catalogue';
import { roleFromToken, signProofPack, verifyInterview } from '@/lib/interview-token';
import { configuredOrigin, hasTrustedOrigin } from '@/lib/server/security';
import { limitInterviewGeneration } from '@/lib/rate-limit';
import { ScreeningPackRequestSchema } from '@/lib/screening-pack-request';
import { reportOperationalEvent, reportOperationalFailure } from '@/lib/sentry-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const ENHANCEMENT_DEADLINE_MS = 10_000;

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

async function enhanceScreeningPack(input: {
  admin: AdminClient;
  packId: string;
  employerId: string;
  workplace: string;
  recruiterName: string;
  jobTitle: string;
  jobText: string;
}) {
  try {
    // Run the shared server generator directly. A self-fetch is rejected by
    // protected preview deployments and adds an avoidable network hop.
    const response = await generateInterviewResponse(new Request('https://muqabala.internal/api/interview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Candidate-Session': input.packId,
      },
      body: JSON.stringify({ jobTitle: input.jobTitle, jobText: input.jobText }),
      signal: AbortSignal.timeout(ENHANCEMENT_DEADLINE_MS),
    }));
    const body = await response.json().catch(() => ({})) as {
      tailored?: boolean;
      token?: string;
      reason?: string;
    };
    if (!response.ok || body.tailored !== true || !body.token) {
      reportOperationalEvent('screening_pack_enhancement_skipped', {
        area: 'screening',
        route: '/api/screening/packs',
        code: body.reason || `generation_${response.status}`,
        status: 200,
      });
      return;
    }

    const verified = verifyInterview(body.token);
    if (!verified || verified.kind !== 'practice') {
      reportOperationalFailure('screening_pack_enhancement_rejected', {
        area: 'screening',
        route: '/api/screening/packs',
        code: 'invalid_signed_interview',
        status: 409,
      });
      return;
    }
    const role = roleFromToken(verified);
    const questions = role.questions.slice(0, 8);
    if (questions.length !== 8) {
      reportOperationalFailure('screening_pack_enhancement_rejected', {
        area: 'screening',
        route: '/api/screening/packs',
        code: 'invalid_question_count',
        status: 409,
      });
      return;
    }
    const signedToken = signProofPack({
      title: role.title,
      industry: role.industry,
      level: role.level,
      competencies: role.competencies,
      questions,
      workplace: input.workplace,
      recruiterName: input.recruiterName,
    });
    if (!signedToken) {
      reportOperationalFailure('screening_pack_enhancement_rejected', {
        area: 'screening',
        route: '/api/screening/packs',
        code: 'signing_unavailable',
        status: 503,
      });
      return;
    }

    // This is the race boundary. A public read sets first_opened_at under a row
    // lock. Whichever write wins first determines the one immutable pack every
    // candidate receives.
    const { data: updated, error } = await input.admin
      .from('screening_packs')
      .update({
        signed_token: signedToken,
        question_source: 'ai',
        question_version: ADVERT_CACHE_VERSION,
        enhanced_at: new Date().toISOString(),
      })
      .eq('id', input.packId)
      .eq('employer_id', input.employerId)
      .eq('starts_used', 0)
      .is('first_opened_at', null)
      .select('id')
      .maybeSingle();
    if (error) {
      reportOperationalFailure('screening_pack_enhancement_update_failed', {
        area: 'screening',
        route: '/api/screening/packs',
        code: error.code || 'database_error',
        status: 503,
      });
      return;
    }
    reportOperationalEvent(updated ? 'screening_pack_enhanced' : 'screening_pack_enhancement_skipped', {
      area: 'screening',
      route: '/api/screening/packs',
      code: updated ? 'ok' : 'already_opened',
      status: 200,
    });
  } catch (error) {
    // The catalogue pack is already live. A slow or unavailable model is an
    // expected quality degradation, never a link-creation failure.
    reportOperationalEvent('screening_pack_enhancement_skipped', {
      area: 'screening',
      route: '/api/screening/packs',
      code: error instanceof Error ? error.name : 'generation_unavailable',
      status: 200,
    });
  }
}

function publicCode(): string {
  return randomBytes(6).toString('base64url');
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ configured: false }, { status: 503 });
  const employer = await currentUser();
  if (!employer?.email || !employer.email_confirmed_at) return Response.json({ error: 'Verify your employer email before creating an interview link.' }, { status: 401 });

  const limited = await limitInterviewGeneration(request);
  if (limited.limited) {
    return Response.json(
      { error: 'Too many work samples requested. Please wait and try again.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  const parsed = ScreeningPackRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid work sample.' }, { status: 400 });

  const verified = parsed.data.interviewToken ? verifyInterview(parsed.data.interviewToken) : null;
  if (parsed.data.interviewToken && (!verified || verified.kind !== 'practice')) {
    return Response.json({ error: 'The tailored interview could not be verified.' }, { status: 400 });
  }
  const role = verified && verified.kind === 'practice'
    ? roleFromToken(verified)
    : catalogueInterviewRole(parsed.data.jobTitle || 'Your role');
  const questions = role.questions.slice(0, 8);
  if (questions.length !== 8) return Response.json({ error: 'That job does not have enough questions for an adaptive interview.' }, { status: 400 });

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

  const expiresAt = new Date(Date.now() + parsed.data.expiryDays * 24 * 60 * 60 * 1000).toISOString();
  let code = publicCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: created, error } = await admin.from('screening_packs').insert({
      public_code: code,
      signed_token: signedToken,
      workplace,
      employer_id: employer.id,
      expires_at: expiresAt,
      max_candidates: parsed.data.maxCandidates,
      question_source: parsed.data.interviewToken ? 'legacy' : 'catalogue',
      question_version: parsed.data.interviewToken ? 'legacy' : CATALOGUE_INTERVIEW_VERSION,
    }).select('id').single();
    if (!error) {
      if (created?.id && !parsed.data.interviewToken && parsed.data.jobText) {
        after(() => enhanceScreeningPack({
          admin,
          packId: created.id,
          employerId: employer.id,
          workplace,
          recruiterName,
          jobTitle: role.title,
          jobText: parsed.data.jobText || '',
        }));
      }
      reportOperationalEvent('screening_pack_created', {
        area: 'screening',
        route: '/api/screening/packs',
        code: 'ok',
        status: 201,
      });
      return Response.json({
        id: created?.id,
        url: `${configuredOrigin()}/s/${code}`,
        title: role.title,
        workplace,
        recruiterName,
        questionCount: questions.length,
        expiresAt,
        maxCandidates: parsed.data.maxCandidates,
      }, { status: 201 });
    }
    if (error.code !== '23505') {
      reportOperationalFailure('screening_pack_creation_failed', {
        area: 'screening',
        route: '/api/screening/packs',
        code: error.code || 'database_error',
        status: 503,
      });
      return Response.json({ error: 'The work sample could not be saved.' }, { status: 503 });
    }
    code = publicCode();
  }
  reportOperationalFailure('screening_pack_creation_failed', {
    area: 'screening',
    route: '/api/screening/packs',
    code: 'public_code_collision',
    status: 503,
  });
  return Response.json({ error: 'The work sample could not be saved.' }, { status: 503 });
}
