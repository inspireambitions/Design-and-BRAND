import { z } from 'zod';
import { limitAuth } from '@/lib/rate-limit';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { screeningInvitationEmailHash, screeningInvitationTokenHash } from '@/lib/server/screening-invitations';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VerifySchema = z.object({
  email: z.string().trim().email().max(254),
  token: z.string().regex(/^\d{6}$/),
  publicCode: z.string().regex(/^[A-Za-z0-9_-]{6,16}$/),
  lang: z.enum(['en', 'ar']).default('en'),
  inviteToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
}).strict();

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = VerifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Enter the six-digit code.' }, { status: 400 });
  const message = (en: string, ar: string) => parsed.data.lang === 'ar' ? ar : en;
  const limited = await limitAuth(request, parsed.data.email);
  if (limited.limited) return Response.json({ error: message('Too many attempts. Please wait and try again.', 'محاولات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.') }, { status: 429 });
  const client = await createClient();
  if (!client) return Response.json({ error: 'Email verification is not configured.' }, { status: 503 });
  const { data, error } = await client.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: 'email',
  });
  if (error || !data.user?.email || !data.user.email_confirmed_at) {
    return Response.json({ error: message('That code is invalid or has expired.', 'هذا الرمز غير صحيح أو انتهت صلاحيته.') }, { status: 400 });
  }
  if (parsed.data.inviteToken) {
    const admin = createAdminClient();
    const recipientEmailHash = screeningInvitationEmailHash(data.user.email);
    if (!admin || !recipientEmailHash) return Response.json({ error: 'Email invitations are not configured.' }, { status: 503 });
    const { data: pack } = await admin.from('screening_packs')
      .select('id').eq('public_code', parsed.data.publicCode).maybeSingle();
    if (!pack) return Response.json({ error: message('This invitation is no longer available.', 'هذه الدعوة لم تعد متاحة.') }, { status: 410 });
    const { data: claim, error: claimError } = await admin.rpc('claim_screening_email_invitation', {
      p_pack_id: pack.id,
      p_token_hash: screeningInvitationTokenHash(parsed.data.inviteToken),
      p_recipient_email_hash: recipientEmailHash,
      p_candidate_user_id: data.user.id,
    });
    if (claimError) return Response.json({ error: 'The invitation could not be verified.' }, { status: 503 });
    if (claim !== 'claimed') {
      const unavailable = claim === 'closed' || claim === 'expired' || claim === 'full';
      return Response.json({ error: message(
        unavailable ? 'This work sample is no longer accepting new candidates.' : 'This invitation does not match that email address.',
        unavailable ? 'لم يعد نموذج العمل يقبل مرشحين جدد.' : 'هذه الدعوة لا تتطابق مع عنوان البريد الإلكتروني.',
      ) }, { status: unavailable ? 410 : 403 });
    }
  }
  return Response.json({ verified: true, next: `/s/${parsed.data.publicCode}` }, { headers: privateNoStoreHeaders() });
}
