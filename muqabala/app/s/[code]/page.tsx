import type { Metadata } from 'next';
import { after } from 'next/server';
import { notFound } from 'next/navigation';
import { EmployerVideoInterview } from '@/components/EmployerVideoInterview';
import { ScreeningEmailVerification } from '@/components/ScreeningEmailVerification';
import { getScreeningPack } from '@/lib/screening-pack';
import { screeningPreviewCopy } from '@/lib/screening-preview';
import { currentUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processScreeningNotifications } from '@/lib/server/screening-notifications';
import { screeningInvitationEmailHash, screeningInvitationTokenHash } from '@/lib/server/screening-invitations';

type PageProps = { params: Promise<{ code: string }>; searchParams?: Promise<{ verification?: string; invite?: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const pack = await getScreeningPack(code);
  const availablePack = pack.status === 'active' || pack.status === 'full' ? pack : null;
  const preview = screeningPreviewCopy({
    companyName: availablePack?.workplace,
    jobTitle: availablePack?.role.title,
    questionCount: availablePack?.role.questions.length,
  });

  return {
    title: preview.invitationTitle,
    description: preview.description,
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'website',
      siteName: 'Muqabala',
      title: preview.invitationTitle,
      description: preview.description,
      url: `/s/${code}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: preview.invitationTitle,
      description: preview.description,
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function ProofSittingPage({
  params,
  searchParams,
}: PageProps) {
  const { code } = await params;
  const query = await searchParams;
  const pack = await getScreeningPack(code);
  if (pack.status !== 'active' && pack.status !== 'full' && pack.status !== 'closed') notFound();
  const candidate = await currentUser();
  const inviteToken = query?.invite && /^[A-Za-z0-9_-]{43}$/.test(query.invite) ? query.invite : undefined;
  after(async () => { await processScreeningNotifications({ limit: 5 }); });

  if (candidate?.email && candidate.email_confirmed_at && inviteToken) {
    const admin = createAdminClient();
    const recipientEmailHash = screeningInvitationEmailHash(candidate.email);
    const { data: packRow } = admin
      ? await admin.from('screening_packs').select('id').eq('public_code', code).maybeSingle()
      : { data: null };
    if (!admin || !recipientEmailHash || !packRow) notFound();
    const { data: claim, error: claimError } = await admin.rpc('claim_screening_email_invitation', {
      p_pack_id: packRow.id,
      p_token_hash: screeningInvitationTokenHash(inviteToken),
      p_recipient_email_hash: recipientEmailHash,
      p_candidate_user_id: candidate.id,
    });
    if (claimError || claim !== 'claimed') notFound();
  }

  if (!candidate?.email || !candidate.email_confirmed_at) {
    return (
      <div className="employer-proof-page employer-light-theme">
        <ScreeningEmailVerification
          publicCode={code}
          companyName={pack.workplace}
          roleTitle={pack.role.title}
          roleTitleAr={pack.role.titleAr}
          availability={pack.status}
          inviteToken={inviteToken}
          initialError={query?.verification === 'expired' ? 'That sign-in link has expired. Request a new six-digit code below.' : undefined}
        />
      </div>
    );
  }

  return (
    <div className="employer-proof-page employer-light-theme">
      <EmployerVideoInterview
        role={pack.role}
        interviewToken={pack.signedToken}
        companyName={pack.workplace}
        recruiterName={pack.recruiterName}
        publicCode={code}
        availability={pack.status}
        candidateEmail={candidate.email}
      />
    </div>
  );
}
