import { cookies } from 'next/headers';
import { shouldClaimPracticeAttempt } from '@/lib/auth-destination';
import { AuthRequestSchema } from '@/lib/interviews';
import { limitAuth } from '@/lib/rate-limit';
import {
  ATTEMPT_COOKIE,
  AUTH_STATE_COOKIE,
  configuredOrigin,
  emailHash,
  hasTrustedOrigin,
  newOpaqueToken,
  privateNoStoreHeaders,
  safeNext,
  tokenHash,
} from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = AuthRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const message = (english: string, arabic: string) => parsed.data.lang === 'ar' ? arabic : english;
  const limited = await limitAuth(request, parsed.data.email);
  if (limited.limited) {
    return Response.json(
      { error: message('Too many codes requested. Please wait and try again.', 'تم طلب رموز كثيرة. انتظر قليلاً ثم حاول مرة أخرى.') },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }
  const client = await createClient();
  if (!client) return Response.json({ error: 'Email sign-in is not configured yet.' }, { status: 503 });
  const next = safeNext(parsed.data.next, '/account');
  const cookieStore = await cookies();
  const attemptToken = cookieStore.get(ATTEMPT_COOKIE)?.value;
  const admin = createAdminClient();
  let claimState: string | null = null;
  // A new request replaces any earlier code flow, including a stale report claim.
  cookieStore.delete(AUTH_STATE_COOKIE);

  if (admin && attemptToken && shouldClaimPracticeAttempt(next)) {
    const { data: interview } = await admin.from('interviews')
      .select('id')
      .eq('anonymous_token_hash', tokenHash(attemptToken))
      .is('user_id', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (interview) {
      claimState = newOpaqueToken();
      const { error: claimError } = await admin.from('auth_claims').insert({
        state_hash: tokenHash(claimState),
        interview_id: interview.id,
        email_hash: emailHash(parsed.data.email),
        expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
      });
      if (claimError) return Response.json({ error: message('Your report could not be prepared for sign-in.', 'تعذر تجهيز تقريرك لتسجيل الدخول.') }, { status: 503 });
      cookieStore.set(AUTH_STATE_COOKIE, claimState, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 20 * 60,
      });
    }
  }

  const callback = new URL('/auth/confirm', configuredOrigin());
  callback.searchParams.set('next', next);
  if (claimState) callback.searchParams.set('claim', claimState);
  const { error } = await client.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callback.toString() },
  });
  if (error) {
    if (claimState && admin) {
      await admin.from('auth_claims').delete().eq('state_hash', tokenHash(claimState)).is('used_at', null);
      cookieStore.delete(AUTH_STATE_COOKIE);
    }
    return Response.json({ error: message('We could not send the email. Please try again.', 'تعذر إرسال البريد. حاول مرة أخرى.') }, { status: 502 });
  }
  return Response.json({ sent: true }, { headers: privateNoStoreHeaders() });
}
