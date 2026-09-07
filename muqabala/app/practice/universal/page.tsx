import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { UniversalInterview } from '@/components/UniversalInterview';

export const metadata: Metadata = {
  title: 'Adaptive interview practice',
  description: 'Build an adaptive competency interview that follows your evidence and avoids repeated questions.',
  robots: { index: false, follow: true },
};

export default function UniversalInterviewPage() {
  if (process.env.NEXT_PUBLIC_UNIVERSAL_BRAIN_V2 !== 'on') notFound();
  return <UniversalInterview />;
}
