import type { Role } from '@/lib/roles';

/**
 * The slice of a catalogue role that the /practice landing needs to draw one
 * card. The full role (competencies, questions, bank) is roughly 3 KB each and
 * never shown on the landing, so it stays on the server and loads with the
 * role page instead.
 */
export type RoleCard = {
  id: string;
  title: string;
  titleAr: string;
  industry: string;
  industryAr: string;
  blurb: string;
  blurbAr: string;
  questionCount: number;
  /** Position in the popular shortlist, or -1 when the role is directory only. */
  popularRank: number;
};

export function toRoleCards(roles: readonly Role[], popularIds: readonly string[]): RoleCard[] {
  return roles.map((role) => ({
    id: role.id,
    title: role.title,
    titleAr: role.titleAr,
    industry: role.industry,
    industryAr: role.industryAr,
    blurb: role.blurb,
    blurbAr: role.blurbAr,
    questionCount: role.questions.length,
    popularRank: popularIds.indexOf(role.id),
  }));
}

/** The shortlist in its curated order, skipping ids that left the catalogue. */
export function popularRoleCards(cards: readonly RoleCard[]): RoleCard[] {
  return cards
    .filter((card) => card.popularRank >= 0)
    .sort((a, b) => a.popularRank - b.popularRank);
}
