import { cookies } from 'next/headers';
import { z } from 'zod';
import { limitAuth } from '@/lib/rate-limit';
import { AUTH_STATE_COOKIE, configuredOrigin, hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { screeningInvitationEmailHash, screeningInvitationTokenHash } from '@/lib/server/screening-invitations';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  email: z.string().trim().email().max(254),
  publicCode: z.string().regex(/^[A-Za-z0-9_-]{6,16}$/),
  lang: z.enum(['en', 'ar']).default('en'),
  inviteToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
}).strict();

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const message = (en: string, ar: string) => parsed.data.lang === 'ar' ? ar : en;
  const limited = await limitAuth(request, parsed.data.email);
  if (limited.limited) {
    return Response.json({ error: message('Too many codes requested. Please wait and try again.', 'تم طلب رموز كثيرة. انتظر قليلاً ثم حاول مرة أخرى.') }, {
      status: 429,
      headers: { 'Retry-After': String(limited.retryAfterSeconds) },
    });
  }

  const admin = createAdminClient();
  const client = await createClient();
  if (!admin || !client) return Response.json({ error: 'Email verification is not configured.' }, { status: 503 });
  const { data: pack } = await admin.from('screening_packs')
    .select('id,expires_at,closed_at')
    .eq('public_code', parsed.data.publicCode)
    .not('employer_id', 'is', null)
    .maybeSingle();
  if (!pack || Date.parse(pack.expires_at) <= Date.now()) {
    return Response.json({ error: 'This employer interview link is no longer available.' }, { status: 410 });
  }

  if (parsed.data.inviteToken) {
    const recipientEmailHash = screeningInvitationEmailHash(parsed.data.email);
    if (!recipientEmailHash) return Response.json({ error: 'Email invitations are not configured.' }, { status: 503 });
    const { data: invitation, error: invitationError } = await admin.from('screening_email_invitations')
      .select('id,expires_at')
      .eq('screening_pack_id', pack.id)
      .eq('token_hash', screeningInvitationTokenHash(parsed.data.inviteToken))
      .eq('recipient_email_hash', recipientEmailHash)
      .maybeSingle();
    if (invitationError) return Response.json({ error: 'The invitation could not be checked.' }, { status: 503 });
    if (!invitation || Date.parse(invitation.expires_at) <= Date.now()) {
      return Response.json({ error: message('This invitation does not match that email address.', 'هذه الدعوة لا تتطابق مع عنوان البريد الإلكتروني.') }, { status: 403 });
    }
  } else if (pack.closed_at) {
    return Response.json({ error: message('This work sample is closed. Use the original email invitation if you already started.', 'تم إغلاق نموذج العمل. استخدم دعوة البريد الإلكتروني الأصلية إذا كنت قد بدأت بالفعل.') }, { status: 410 });
  }

  // Screening verification must never claim or redirect an unrelated private-practice attempt.
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_STATE_COOKIE);
  const callback = new URL('/auth/screening-confirm', configuredOrigin());
  callback.searchParams.set('code', parsed.data.publicCode);
  if (parsed.data.inviteToken) callback.searchParams.set('invite', parsed.data.inviteToken);
  const { error } = await client.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callback.toString() },
  });
  if (error) return Response.json({ error: message('We could not send the code. Please try again.', 'تعذر إرسال الرمز. حاول مرة أخرى.') }, { status: 502 });
  return Response.json({ sent: true }, { headers: privateNoStoreHeaders() });
}
