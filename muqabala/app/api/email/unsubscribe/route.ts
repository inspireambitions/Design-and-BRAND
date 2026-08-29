import { NextResponse } from 'next/server';
import { verifyPreferenceToken } from '@/lib/email/preferences';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const secret = process.env.EMAIL_PREFERENCES_SECRET ?? '';
  const userId = verifyPreferenceToken(token, secret);
  const admin = createAdminClient();
  if (!userId || !admin) return Response.json({ error: 'Invalid preference link.' }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await admin.from('lifecycle_email_preferences').update({
    marketing_opt_in: false,
    unsubscribed_at: now,
    updated_at: now,
  }).eq('user_id', userId);
  if (error) return Response.json({ error: 'Preference update failed.' }, { status: 503 });

  const { error: cancelError } = await admin.from('lifecycle_email_jobs').update({
    status: 'cancelled',
    cancelled_at: now,
    lease_until: null,
    last_error_code: 'unsubscribed',
  }).eq('user_id', userId).eq('email_type', 'career_tools_24h').eq('status', 'pending');
  if (cancelError) return Response.json({ error: 'Pending email cancellation failed.' }, { status: 503 });

  const acceptsHtml = request.headers.get('accept')?.includes('text/html') || request.headers.get('sec-fetch-mode') === 'navigate';
  const response = acceptsHtml
    ? NextResponse.redirect(new URL(`/email/unsubscribe?status=done&token=${encodeURIComponent(token)}`, request.url), 303)
    : Response.json({ unsubscribed: true });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
