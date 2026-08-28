import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InterviewFlow } from '@/components/InterviewFlow';
import { roleFromToken, verifyInterview } from '@/lib/interview-token';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata: Metadata = {
  title: 'Work sample | Muqabala',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProofSittingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(code)) notFound();

  const admin = createAdminClient();
  if (!admin) notFound();
  const { data } = await admin
    .from('screening_packs')
    .select('signed_token, workplace, expires_at')
    .eq('public_code', code)
    .maybeSingle();
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) notFound();

  const payload = verifyInterview(data.signed_token);
  if (!payload || payload.kind !== 'proof' || payload.questions.length !== 3) notFound();
  const role = roleFromToken(payload);

  return (
    <div className="employer-proof-page employer-light-theme">
      <InterviewFlow
        role={role}
        customTitle={role.title}
        tailored
        interviewToken={data.signed_token}
        proof={{
          workplace: payload.workplace || data.workplace || '',
          recruiterName: payload.recruiterName,
        }}
      />
    </div>
  );
}
