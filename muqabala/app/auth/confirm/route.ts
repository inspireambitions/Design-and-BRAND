import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

function safeNextPath(value: string | null): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/reports';
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const claim = url.searchParams.get('claim');
  const next = safeNextPath(url.searchParams.get('next'));
  const supabase = await createServerSupabaseClient();

  if (!code || !supabase) {
    return NextResponse.redirect(new URL('/reports?auth=failed', url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/reports?auth=failed', url.origin));

  const destination = claim
    ? `/reports/claim?token=${encodeURIComponent(claim)}`
    : next;
  return NextResponse.redirect(new URL(destination, url.origin));
}
