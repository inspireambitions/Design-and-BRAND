import { cookies } from 'next/headers';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  hasTrustedOrigin,
  isOpaqueToken,
  privateNoStoreHeaders,
  screeningAttemptCookie,
  screeningPackAttemptCookie,
  screeningReceiptReference,
  newOpaqueToken,
  tokenHash,
} from '@/lib/server/security';
import { currentUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ResumeSchema = z.object({ publicCode: z.string().regex(/^[A-Za-z0-9_-]{6,16}$/) }).strict();

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = ResumeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid employer interview link.' }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return Response.json({ configured: false }, { status: 503 });
  const candidate = await currentUser();
  if (!candidate?.email || !candidate.email_confirmed_at) {
    return Response.json({ error: 'Verify your email to continue this interview.' }, { status: 401 });
  }
  const { data: pack } = await admin.from('screening_packs')
    .select('id,expires_at')
    .eq('public_code', parsed.data.publicCode)
    .not('employer_id', 'is', null)
    .maybeSingle();
  if (!pack || Date.parse(pack.expires_at) <= Date.now()) {
    return Response.json({ resume: null }, { headers: privateNoStoreHeaders() });
  }

  const cookieStore = await cookies();
  const { data: interview, error } = await admin.from('interviews')
    .select('id,candidate_name,current_question,status,submitted_at,expires_at,anonymous_token_hash,candidate_user_id')
    .eq('screening_pack_id', pack.id)
    .eq('candidate_user_id', candidate.id)
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !interview) return Response.json({ resume: null }, { headers: privateNoStoreHeaders() });

  const existingToken = cookieStore.get(screeningPackAttemptCookie(pack.id))?.value;
  const rawToken = isOpaqueToken(existingToken) ? existingToken : newOpaqueToken();
  if (tokenHash(rawToken) !== interview.anonymous_token_hash) {
    const { error: tokenError } = await admin.from('interviews')
      .update({ anonymous_token_hash: tokenHash(rawToken) })
      .eq('id', interview.id)
      .eq('candidate_user_id', candidate.id);
    if (tokenError) return Response.json({ error: 'Your interview could not be resumed.' }, { status: 503 });
  }
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  } as const;
  cookieStore.set(screeningPackAttemptCookie(pack.id), rawToken, cookieOptions);
  cookieStore.set(screeningAttemptCookie(interview.id), rawToken, cookieOptions);

  return Response.json({
    resume: {
      id: interview.id,
      candidateName: interview.candidate_name,
      currentQuestion: interview.current_question,
      complete: Boolean(interview.submitted_at || interview.status === 'completed'),
      submittedAt: interview.submitted_at,
      reference: interview.submitted_at ? screeningReceiptReference(interview.id) : null,
    },
  }, { headers: privateNoStoreHeaders() });
}
