import { cookies } from 'next/headers';
import { shouldClaimPracticeAttempt } from '@/lib/auth-destination';
import { OtpVerifySchema } from '@/lib/interviews';
import { limitAuth } from '@/lib/rate-limit';
import { claimCurrentAttempt } from '@/lib/server/claim-attempt';
import { AUTH_STATE_COOKIE, hasTrustedOrigin, isOpaqueToken, privateNoStoreHeaders, safeNext } from '@/lib/server/security';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = OtpVerifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter the six-digit code.' }, { status: 400 });
  const message = (english: string, arabic: string) => parsed.data.lang === 'ar' ? arabic : english;
  const limited = await limitAuth(request, parsed.data.email);
  if (limited.limited) return Response.json({ error: message('Too many attempts. Please wait and try again.', 'محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.') }, { status: 429 });
  const client = await createClient();
  if (!client) return Response.json({ error: 'Email sign-in is not configured yet.' }, { status: 503 });
  const { data, error } = await client.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: 'email',
  });
  if (error || !data.user) return Response.json({ error: message('That code is invalid or has expired.', 'هذا الرمز غير صحيح أو انتهت صلاحيته.') }, { status: 400 });
  const cookieStore = await cookies();
  const requestedNext = safeNext(parsed.data.next, '/account');
  const claimState = shouldClaimPracticeAttempt(requestedNext)
    ? cookieStore.get(AUTH_STATE_COOKIE)?.value : null;
  if (!shouldClaimPracticeAttempt(requestedNext)) cookieStore.delete(AUTH_STATE_COOKIE);
  if (claimState && !isOpaqueToken(claimState)) {
    await client.auth.signOut();
    return Response.json({ error: message('This report link is invalid. Request a new code.', 'رابط التقرير غير صالح. اطلب رمزاً جديداً.') }, { status: 400 });
  }
  const claimed = claimState ? await claimCurrentAttempt(data.user, claimState) : null;
  if (claimState && !claimed) {
    await client.auth.signOut();
    return Response.json({ error: message('This report link has expired. Request a new code.', 'انتهت صلاحية رابط التقرير. اطلب رمزاً جديداً.') }, { status: 400 });
  }
  const next = claimed
    ? claimed.status === 'completed'
      ? `/account/reports/${claimed.id}`
      : `/practice/${encodeURIComponent(claimed.roleId)}?resume=${encodeURIComponent(claimed.id)}`
    : requestedNext;
  return Response.json({ verified: true, next }, { headers: privateNoStoreHeaders() });
}
