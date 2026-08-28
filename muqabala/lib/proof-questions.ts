import type { Question, Role } from './roles';

/**
 * Creative-cut V1: three questions. Opener, one job question, closer.
 * Never invent a fourth. Never drop the closer.
 */
export function proofQuestions(role: Role): Question[] | null {
  const opener = role.questions[0];
  const closer = role.questions.at(-1);
  if (!opener || !closer || opener.id === closer.id) return null;
  const middle = role.questions.slice(1, -1).find((question) => question.id !== opener.id && question.id !== closer.id);
  if (!middle) return null;
  return [opener, middle, closer];
}
