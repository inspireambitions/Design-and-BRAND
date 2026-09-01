import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { CreateInterviewSchema } from '@/lib/interviews';
import { trustedInterviewPlan } from '@/lib/interview-plan';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import {
  ATTEMPT_COOKIE,
  hasTrustedOrigin,
  newOpaqueToken,
  privateNoStoreHeaders,
  screeningAttemptCookie,
  screeningPackAttemptCookie,
  tokenHash,
} from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ configured: false }, { status: 503 });

  const parsed = CreateInterviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid interview.' }, { status: 400 });
  const plan = trustedInterviewPlan(parsed.data);
  if (!plan) return Response.json({ error: 'Invalid interview question plan.' }, { status: 400 });
  if (parsed.data.mode === 'screening' && !parsed.data.candidateName) {
    return Response.json({ error: 'Candidate name is required.' }, { status: 400 });
  }

  const screeningPack = parsed.data.mode === 'screening'
    ? await admin
        .from('screening_packs')
        .select('id')
        .eq('signed_token', parsed.data.interviewToken ?? '')
        .not('employer_id', 'is', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()
    : null;
  if (parsed.data.mode === 'screening' && (!screeningPack || screeningPack.error || !screeningPack.data)) {
    return Response.json({ error: 'This employer interview link is no longer available.' }, { status: 410 });
  }

  const user = await currentUser();
  if (parsed.data.mode === 'screening' && (!user?.email || !user.email_confirmed_at)) {
    return Response.json({ error: 'Verify your email before starting this employer interview.' }, { status: 401 });
  }
  const cookieStore = await cookies();
  const rawToken = newOpaqueToken();
  let interviewId: string;
  let resumed = false;
  if (parsed.data.mode === 'screening') {
    interviewId = randomUUID();
    const { data: startResult, error: startError } = await admin.rpc('start_screening_interview', {
      p_interview_id: interviewId,
      p_pack_id: screeningPack!.data!.id,
      p_anonymous_token_hash: tokenHash(rawToken),
      p_start_idempotency_hash: tokenHash(rawToken),
      p_candidate_user_id: user!.id,
      p_role_id: plan.role.id,
      p_role_title: parsed.data.language === 'ar' ? plan.role.titleAr : plan.role.title,
      p_language: parsed.data.language,
      p_question_snapshot: plan.questions,
      p_role_snapshot: plan.role,
      p_candidate_name: parsed.data.candidateName!.replace(/\s+/g, ' ').trim(),
    });
    if (startError) return Response.json({ error: 'Interview could not be started.' }, { status: 500 });
    const result = startResult as { status?: string; interview_id?: string } | null;
    if (result?.status === 'full') {
      return Response.json({ error: 'This employer interview link has reached its candidate limit.' }, { status: 409 });
    }
    if ((result?.status !== 'started' && result?.status !== 'resumed') || !result.interview_id) {
      return Response.json({ error: 'This employer interview link is no longer available.' }, { status: 410 });
    }
    interviewId = result.interview_id;
    resumed = result.status === 'resumed';
  } else {
    const { data, error } = await admin
      .from('interviews')
      .insert({
        user_id: user?.id ?? null,
        anonymous_token_hash: user ? null : tokenHash(rawToken),
        role_id: plan.role.id,
        role_title: parsed.data.language === 'ar' ? plan.role.titleAr : plan.role.title,
        language: parsed.data.language,
        mode: parsed.data.mode,
        question_snapshot: plan.questions,
        role_snapshot: plan.role,
        screening_pack_id: null,
        candidate_name: null,
      })
      .select('id')
      .single();
    if (error) return Response.json({ error: 'Interview could not be started.' }, { status: 500 });
    interviewId = data.id;
  }

  if (parsed.data.mode === 'screening' || !user) {
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    } as const;
    cookieStore.set(parsed.data.mode === 'screening' ? screeningAttemptCookie(interviewId) : ATTEMPT_COOKIE, rawToken, cookieOptions);
    if (parsed.data.mode === 'screening') {
      cookieStore.set(screeningPackAttemptCookie(screeningPack!.data!.id), rawToken, cookieOptions);
    }
  }
  return Response.json(
    { id: interviewId, unlocked: parsed.data.mode === 'screening' ? false : Boolean(user), resumed },
    { status: resumed ? 200 : 201, headers: privateNoStoreHeaders() },
  );
}
