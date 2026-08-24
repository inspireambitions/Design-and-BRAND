import { cookies } from 'next/headers';
import { CreateInterviewSchema } from '@/lib/interviews';
import { trustedInterviewPlan } from '@/lib/interview-plan';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { ATTEMPT_COOKIE, hasTrustedOrigin, newOpaqueToken, privateNoStoreHeaders, tokenHash } from '@/lib/server/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const admin = createAdminClient();
  if (!admin) return Response.json({ configured: false }, { status: 503 });

  const parsed = CreateInterviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid interview.' }, { status: 400 });
  const plan = trustedInterviewPlan(parsed.data);
  if (!plan) return Response.json({ error: 'Invalid interview question plan.' }, { status: 400 });
  const user = await currentUser();
  const rawToken = newOpaqueToken();
  const { data, error } = await admin
    .from('interviews')
    .insert({
      user_id: user?.id ?? null,
      anonymous_token_hash: user ? null : tokenHash(rawToken),
      role_id: plan.role.id,
      role_title: parsed.data.language === 'ar' ? plan.role.titleAr : plan.role.title,
      language: parsed.data.language,
      mode: parsed.data.mode,
      question_snapshot: plan.questions,
      role_snapshot: plan.role,
    })
    .select('id')
    .single();
  if (error) return Response.json({ error: 'Interview could not be started.' }, { status: 500 });

  if (!user) {
    const cookieStore = await cookies();
    cookieStore.set(ATTEMPT_COOKIE, rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return Response.json({ id: data.id, unlocked: Boolean(user) }, { status: 201, headers: privateNoStoreHeaders() });
}
