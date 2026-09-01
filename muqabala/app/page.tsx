import type { Metadata } from 'next';
import { POPULAR_ROLE_IDS, ROLES, type Role } from '@/lib/roles';
import { catalogueStats } from '@/lib/catalogue-stats';
import type { MarketingRole } from '@/lib/marketing-content';
import { MarketingHome } from '@/components/MarketingSite';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const popularRoles = POPULAR_ROLE_IDS
    .map((id) => ROLES.find((role) => role.id === id))
    .filter((role): role is Role => Boolean(role))
    .map<MarketingRole>((role) => ({
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
  return <MarketingHome roles={popularRoles} stats={catalogueStats()} />;
}
