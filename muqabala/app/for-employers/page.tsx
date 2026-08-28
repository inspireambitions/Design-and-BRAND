import type { Metadata } from 'next';
import { EmployerProofCreate } from '@/components/EmployerProofCreate';
import { currentUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Work samples for hiring teams',
  description: 'Turn a job description into a focused 12-minute work sample. You review every answer. Nothing is automatically rejected.',
  robots: { index: true, follow: true },
  alternates: { canonical: '/for-employers' },
  openGraph: {
    type: 'website',
    siteName: 'Muqabala',
    title: 'See who can do the job.',
    description: 'Create a focused 12-minute work sample from any job description. You review every answer.',
    url: '/for-employers',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'See who can do the job.',
    description: 'Create a focused 12-minute work sample from any job description. You review every answer.',
  },
};

export const dynamic = 'force-dynamic';

export default async function ForEmployersPage() {
  const user = await currentUser();
  return <EmployerProofCreate signedIn={Boolean(user)} />;
}
