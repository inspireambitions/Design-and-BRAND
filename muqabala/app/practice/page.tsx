import type { Metadata } from 'next';
import { ROLES } from '@/lib/roles';
import { HomeView } from '@/components/HomeView';

export const metadata: Metadata = {
  title: 'Start practising',
  description: 'Choose a Gulf job interview or paste a job advert and start practising free in English or Arabic.',
  alternates: { canonical: '/practice' },
};

export default function PracticeHomePage() {
  return <HomeView roles={ROLES} />;
}
