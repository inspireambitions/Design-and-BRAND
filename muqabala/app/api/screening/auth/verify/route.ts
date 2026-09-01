import { z } from 'zod';
import { limitAuth } from '@/lib/rate-limit';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VerifySchema = z.object({
  email: z.string().trim().email().max(254),
  token: z.string().regex(/^\d{6}$/),
  publicCode: z.string().regex(/^[A-Za-z0-9_-]{6,16}$/),
  lang: z.enum(['en', 'ar']).default('en'),
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
  return Response.json({ verified: true, next: `/s/${parsed.data.publicCode}` }, { headers: privateNoStoreHeaders() });
}
