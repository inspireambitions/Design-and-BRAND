import { ScreeningSubmitSchema } from '@/lib/interviews';
import { after } from 'next/server';
import { interviewAccess } from '@/lib/server/interview-access';
import { hasTrustedOrigin, privateNoStoreHeaders, screeningReceiptReference } from '@/lib/server/security';
import { processScreeningNotifications } from '@/lib/server/screening-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const parsed = ScreeningSubmitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Consent is required.' }, { status: 400 });
  const { id } = await params;
  const access = await interviewAccess(id);
  const interview = access.interview;
  if (!access.configured) return Response.json({ configured: false }, { status: 503 });
  if (!access.user) return Response.json({ error: 'Verify your email to submit this interview.' }, { status: 401 });
  if (!interview || !access.candidate || interview.mode !== 'screening') {
    return Response.json({ error: 'Interview not found.' }, { status: 404 });
  }

  const { data: submittedAt, error } = await access.admin!.rpc('submit_screening_interview', {
    p_interview_id: id,
    p_anonymous_token_hash: interview.anonymous_token_hash,
    p_candidate_user_id: access.user.id,
    p_consent_version: parsed.data.consentVersion,
  });
  if (error || !submittedAt) {
    return Response.json({ error: 'Save every response before submitting.' }, { status: 409 });
  }
  after(async () => { await processScreeningNotifications({ interviewId: id, limit: 2 }); });
  return Response.json({
    submitted: true,
    submittedAt,
    reference: screeningReceiptReference(id),
    notificationsQueued: true,
  }, { headers: privateNoStoreHeaders() });
}
