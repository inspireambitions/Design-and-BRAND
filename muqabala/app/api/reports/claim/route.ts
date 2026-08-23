import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { hashClaimEmail, hashClaimToken } from '@/lib/report-crypto';
import { limitReportClaim } from '@/lib/report-rate-limit';

const ClaimSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();

export async function POST(request: Request) {
  const rate = await limitReportClaim(request);
  if (!rate.configured) {
    return NextResponse.json({ error: 'Cross-device saving is not available yet.' }, { status: 503 });
  }
  if (!rate.success) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again shortly.', retryAfter: rate.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    );
  }

  const parsed = ClaimSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid claim.' }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: 'Cross-device saving is not available yet.' }, { status: 503 });
  }

  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user?.email) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  let emailHash: string;
  try {
    emailHash = hashClaimEmail(user.email);
  } catch {
    return NextResponse.json({ error: 'Cross-device saving is not available yet.' }, { status: 503 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const { data, error } = await admin
    .from('saved_reports')
    .update({
      owner_id: user.id,
      claimed_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      claim_token_hash: null,
      claim_email_hash: null,
      claim_expires_at: null,
    })
    .eq('claim_token_hash', hashClaimToken(parsed.data.token))
    .eq('claim_email_hash', emailHash)
    .is('owner_id', null)
    .gt('claim_expires_at', now.toISOString())
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
  }
  return NextResponse.json({ saved: true, id: data.id });
}
