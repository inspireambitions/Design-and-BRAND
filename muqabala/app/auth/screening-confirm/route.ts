import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { configuredOrigin } from '@/lib/server/security';
import { screeningInvitationEmailHash, screeningInvitationTokenHash } from '@/lib/server/screening-invitations';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');
  const safeCode = code && /^[A-Za-z0-9_-]{6,16}$/.test(code) ? code : null;
  const invite = url.searchParams.get('invite');
  const safeInvite = invite && /^[A-Za-z0-9_-]{43}$/.test(invite) ? invite : null;
  const client = await createClient();
  if (client && tokenHash && type && safeCode) {
    const { data, error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user?.email && data.user.email_confirmed_at) {
      if (safeInvite) {
        const admin = createAdminClient();
        const recipientEmailHash = screeningInvitationEmailHash(data.user.email);
        const { data: pack } = admin
          ? await admin.from('screening_packs').select('id').eq('public_code', safeCode).maybeSingle()
          : { data: null };
        if (!admin || !recipientEmailHash || !pack) {
          return NextResponse.redirect(`${configuredOrigin()}/s/${safeCode}?verification=expired`);
        }
        const { data: claim, error: claimError } = await admin.rpc('claim_screening_email_invitation', {
          p_pack_id: pack.id,
          p_token_hash: screeningInvitationTokenHash(safeInvite),
          p_recipient_email_hash: recipientEmailHash,
          p_candidate_user_id: data.user.id,
        });
        if (claimError || claim !== 'claimed') {
          return NextResponse.redirect(`${configuredOrigin()}/s/${safeCode}?verification=expired`);
        }
      }
      return NextResponse.redirect(`${configuredOrigin()}/s/${safeCode}`);
    }
  }
  return NextResponse.redirect(safeCode
    ? `${configuredOrigin()}/s/${safeCode}?verification=expired`
    : `${configuredOrigin()}/sign-in?error=expired`);
}
