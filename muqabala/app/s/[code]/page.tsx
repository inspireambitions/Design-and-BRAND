import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmployerVideoInterview } from '@/components/EmployerVideoInterview';
import { ScreeningEmailVerification } from '@/components/ScreeningEmailVerification';
import { getScreeningPack } from '@/lib/screening-pack';
import { screeningPreviewCopy } from '@/lib/screening-preview';
import { currentUser } from '@/lib/supabase/server';

type PageProps = { params: Promise<{ code: string }> };

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
}: PageProps) {
  const { code } = await params;
  const pack = await getScreeningPack(code);
  if (pack.status !== 'active' && pack.status !== 'full') notFound();
  const candidate = await currentUser();

  if (!candidate?.email || !candidate.email_confirmed_at) {
    return (
      <div className="employer-proof-page employer-light-theme">
        <ScreeningEmailVerification
          publicCode={code}
          companyName={pack.workplace}
          roleTitle={pack.role.title}
          roleTitleAr={pack.role.titleAr}
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
