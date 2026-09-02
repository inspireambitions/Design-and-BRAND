import type { Metadata } from 'next';
import { POPULAR_ROLE_IDS, ROLES } from '@/lib/roles';
import { toRoleCards } from '@/lib/landing/role-cards';
import { HomeView } from '@/components/HomeView';

export const metadata: Metadata = {
  title: 'Start practising',
  description: 'Choose a Gulf job interview or paste a job advert and start practising free in English or Arabic.',
  alternates: { canonical: '/practice' },
};

// Only the card fields cross to the browser. The full catalogue (questions,
// competencies, banks) is around 180 KB and loads with the role page instead.
const ROLE_CARDS = toRoleCards(ROLES, POPULAR_ROLE_IDS);

export default function PracticeHomePage() {
  return <HomeView roles={ROLE_CARDS} />;
}
