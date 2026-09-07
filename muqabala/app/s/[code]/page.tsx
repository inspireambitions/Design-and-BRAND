import type { Metadata } from 'next';
import { after } from 'next/server';
import { notFound } from 'next/navigation';
import { EmployerVideoInterview } from '@/components/EmployerVideoInterview';
import { ScreeningEmailVerification } from '@/components/ScreeningEmailVerification';
import { getScreeningPack } from '@/lib/screening-pack';
import { screeningPreviewCopy } from '@/lib/screening-preview';
import { currentUser } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { tokenHash } from '@/lib/server/security';
import { processScreeningNotifications } from '@/lib/server/screening-notifications';
import { universalInterviewEnabled } from '@/lib/universal-interview/api';

type PageProps = { params: Promise<{ code: string }>; searchParams?: Promise<{ verification?: string; i?: string }> };

const INVITE_TOKEN = /^[A-Za-z0-9_-]{20,120}$/;

/** 'ok' when the invite is usable, 'closed' when it exists but has expired, null when no usable invite param. */
async function inviteState(token: string | undefined, packId: string): Promise<'ok' | 'closed' | null> {
  if (!token || !INVITE_TOKEN.test(token)) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from('role_invites')
    .select('status,role_id')
    .eq('token_hash', tokenHash(token))
    .maybeSingle();
  if (!data || data.role_id !== packId) return null;
  return data.status === 'expired' ? 'closed' : 'ok';
}

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
  const closedByInvite = pack.status === 'expired' && query?.i && INVITE_TOKEN.test(query.i);
  if (closedByInvite) return <ClosedLink />;
  if (pack.status !== 'active' && pack.status !== 'full') notFound();
  const invite = await inviteState(query?.i, pack.id);
  if (invite === 'closed') return <ClosedLink />;
  const candidate = await currentUser();
  after(async () => { await processScreeningNotifications({ limit: 5 }); });

  if (!candidate?.email || !candidate.email_confirmed_at) {
    return (
      <div className="employer-proof-page employer-light-theme">
        <ScreeningEmailVerification
          publicCode={code}
          companyName={pack.workplace}
          roleTitle={pack.role.title}
          roleTitleAr={pack.role.titleAr}
          availability={pack.status}
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
        inviteToken={invite === 'ok' ? query?.i : undefined}
        brainEnabled={universalInterviewEnabled()}
      />
    </div>
  );
}

function ClosedLink() {
  return (
    <main className="employer-proof-page employer-light-theme" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: '2rem' }}>
      <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>This link has closed</h1>
        <p style={{ color: '#536860' }}>The hiring team is no longer taking answers through this link. If you think this is a mistake, contact them directly.</p>
      </div>
    </main>
  );
}
