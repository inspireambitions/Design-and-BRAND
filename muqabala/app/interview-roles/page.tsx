import type { Metadata } from 'next';
import { InterviewRolesPage } from '@/components/MarketingSite';
import { ROLES } from '@/lib/roles';
import type { MarketingRole } from '@/lib/marketing-content';

export const metadata: Metadata = {
  title: 'Gulf job interview practice by role',
  description: 'Browse Gulf job interview practice for hospitality, healthcare, aviation, retail, trades, office and other roles.',
  alternates: { canonical: '/interview-roles' },
};

export default function RolesPage() {
  const roleSummaries = ROLES.map<MarketingRole>((role) => ({
    id: role.id,
    industry: role.industry,
    industryAr: role.industryAr,
    title: role.title,
    titleAr: role.titleAr,
    blurb: role.blurb,
    blurbAr: role.blurbAr,
    questionCount: role.bank && role.questions.slice(1, -1).length + role.bank.length >= 6
      ? 8
      : role.questions.length,
  }));
  return <InterviewRolesPage roles={roleSummaries} />;
}
