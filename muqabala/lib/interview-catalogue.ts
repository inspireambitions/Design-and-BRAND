import { drawMockQuestions } from './interview-draw';
import { buildCustomRole, ROLES, type Role } from './roles';

export const CATALOGUE_INTERVIEW_VERSION = 'catalogue-v1';

function normaliseTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Return a complete, deterministic interview before any model call is made.
 * Known catalogue roles keep their full question bank. Unknown roles receive
 * the general eight-question interview with the employer's title preserved.
 */
export function catalogueInterviewRole(jobTitle: string): Role {
  const requested = normaliseTitle(jobTitle);
  const matched = requested
    ? ROLES
      .flatMap((role) => {
        const questions = drawMockQuestions(role, 0);
        return questions ? [{ role, questions }] : [];
      })
      .sort((left, right) => right.role.title.length - left.role.title.length)
      .find(({ role }) => requested.includes(normaliseTitle(role.title)))
    : undefined;

  if (!matched) return buildCustomRole(jobTitle);
  return {
    ...matched.role,
    title: jobTitle.trim() || matched.role.title,
    questions: matched.questions,
  };
}
