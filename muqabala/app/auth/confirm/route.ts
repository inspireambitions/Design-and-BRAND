import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { claimCurrentAttempt } from '@/lib/server/claim-attempt';
import { configuredOrigin, isOpaqueToken, safeNext } from '@/lib/server/security';
import { createClient } from '@/lib/supabase/server';
import { trackServer } from '@/lib/server/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const claim = url.searchParams.get('claim');
  const next = safeNext(url.searchParams.get('next'), '/account');
  const client = await createClient();
  if (client && tokenHash && type) {
    const { data, error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user) {
      if (claim && !isOpaqueToken(claim)) {
        await client.auth.signOut();
        return NextResponse.redirect(`${configuredOrigin()}/sign-in?error=invalid_claim&next=${encodeURIComponent(next)}`);
      }
      const claimed = claim ? await claimCurrentAttempt(data.user, claim) : null;
      if (claim && !claimed) {
        await client.auth.signOut();
        return NextResponse.redirect(`${configuredOrigin()}/sign-in?error=invalid_claim&next=${encodeURIComponent(next)}`);
      }
      const claimedNext = claimed
        ? claimed.status === 'completed'
          ? `/account/reports/${claimed.id}`
          : `/practice/${encodeURIComponent(claimed.roleId)}?resume=${encodeURIComponent(claimed.id)}`
        : next;
      // A shortlist email Open link lands here first; the role id is the only property sent.
      if (url.searchParams.get('src') === 'shortlist') {
        trackServer('shortlist_email_opened', { role_id: url.searchParams.get('role') ?? undefined, flag_state: 'on' });
      }
      return NextResponse.redirect(`${configuredOrigin()}${claimedNext}`);
    }
  }
  return NextResponse.redirect(`${configuredOrigin()}/sign-in?error=expired&next=${encodeURIComponent(next)}`);
}
