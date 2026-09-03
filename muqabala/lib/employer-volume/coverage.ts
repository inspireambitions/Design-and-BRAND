/**
 * Rubric coverage: up to four ticks or crosses per candidate, never a number.
 *
 * A tick means at least one recorded answer has non-null competency
 * evidence for that rubric item, as stored by the scorer. Items are the role's
 * first four competencies in order. Roles with fewer show fewer.
 */

export type CoverageItem = {
  id: string;
  label: string;
  labelAr: string;
  covered: boolean;
};

export type Coverage = {
  items: CoverageItem[];
  covered: number;
  total: number;
  full: boolean;
};

type CompetencyLike = { id: string; label: string; labelAr?: string };
type AnswerLike = {
  feedback?: { status?: string; competencies?: { id: string; evidence: string | null }[] } | null;
};

export const RUBRIC_ITEMS = 4;

export function rubricItems(competencies: CompetencyLike[] | undefined | null): CompetencyLike[] {
  return (competencies ?? []).slice(0, RUBRIC_ITEMS);
}

export function coverageFor(competencies: CompetencyLike[] | undefined | null, answers: AnswerLike[]): Coverage {
  const items = rubricItems(competencies).map((competency) => {
    const covered = answers.some((answer) =>
      answer.feedback?.status === 'scored'
      && (answer.feedback.competencies ?? []).some((score) => score.id === competency.id && Boolean(score.evidence?.trim())),
    );
    return { id: competency.id, label: competency.label, labelAr: competency.labelAr ?? competency.label, covered };
  });
  const covered = items.filter((item) => item.covered).length;
  return { items, covered, total: items.length, full: items.length > 0 && covered === items.length };
}

/** Full coverage first, then by coverage count, then earliest submission. */
export function compareCandidates<T extends { coverage: Coverage; submittedAt: string }>(a: T, b: T): number {
  if (a.coverage.full !== b.coverage.full) return a.coverage.full ? -1 : 1;
  if (a.coverage.covered !== b.coverage.covered) return b.coverage.covered - a.coverage.covered;
  return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
}

/** Plain-text ticks for email and export: "✓ ✓ ✗ ✓". */
export function coverageMarks(coverage: Coverage): string {
  return coverage.items.map((item) => (item.covered ? '\u2713' : '\u2717')).join(' ');
}
