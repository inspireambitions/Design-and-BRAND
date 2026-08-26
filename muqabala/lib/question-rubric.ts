import type { Competency, Question, Role } from './roles';

/** Resolve exactly the criteria the server will score, or show none if the
 * question is malformed. A partial rubric would mislead the candidate. */
export function rubricForQuestion(role: Role, question: Question): Competency[] {
  const ids = question.competencies;
  if (ids.length === 0 || new Set(ids).size !== ids.length) return [];
  const byId = new Map(role.competencies.map((competency) => [competency.id, competency]));
  const rubric = ids.map((id) => byId.get(id));
  return rubric.every((competency): competency is Competency => Boolean(competency)) ? rubric : [];
}
