import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmployerVideoInterview } from '@/components/EmployerVideoInterview';
import { getScreeningPack } from '@/lib/screening-pack';
import { screeningPreviewCopy } from '@/lib/screening-preview';

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

  return (
    <div className="employer-proof-page employer-light-theme">
      <EmployerVideoInterview
        role={pack.role}
        interviewToken={pack.signedToken}
        companyName={pack.workplace}
        recruiterName={pack.recruiterName}
        publicCode={code}
        availability={pack.status}
      />
    </div>
  );
}

