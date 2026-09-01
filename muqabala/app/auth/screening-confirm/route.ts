import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { configuredOrigin } from '@/lib/server/security';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const code = url.searchParams.get('code');
  const safeCode = code && /^[A-Za-z0-9_-]{6,16}$/.test(code) ? code : null;
  const client = await createClient();
  if (client && tokenHash && type && safeCode) {
    const { data, error } = await client.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user?.email && data.user.email_confirmed_at) {
      return NextResponse.redirect(`${configuredOrigin()}/s/${safeCode}`);
    }
  }
  return NextResponse.redirect(safeCode
    ? `${configuredOrigin()}/s/${safeCode}?verification=expired`
    : `${configuredOrigin()}/sign-in?error=expired`);
}

