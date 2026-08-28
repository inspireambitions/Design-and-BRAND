import { ScreeningSubmitSchema } from '@/lib/interviews';
import { interviewAccess } from '@/lib/server/interview-access';
import { hasTrustedOrigin, privateNoStoreHeaders } from '@/lib/server/security';

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
  if (!interview || !access.anonymous || interview.mode !== 'screening') {
    return Response.json({ error: 'Interview not found.' }, { status: 404 });
  }
  if (interview.locked_at || interview.submitted_at) {
    return Response.json({ error: 'This interview has already been submitted.' }, { status: 409 });
  }

  const { data: submittedAt, error } = await access.admin!.rpc('submit_screening_interview', {
    p_interview_id: id,
    p_anonymous_token_hash: interview.anonymous_token_hash,
    p_consent_version: parsed.data.consentVersion,
  });
  if (error || !submittedAt) {
    return Response.json({ error: 'Save every response before submitting.' }, { status: 409 });
  }
  return Response.json({ submitted: true, submittedAt }, { headers: privateNoStoreHeaders() });
}
