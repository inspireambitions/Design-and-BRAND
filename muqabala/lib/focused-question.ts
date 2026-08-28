import type { Question, Role } from './roles';

export function focusedQuestionFromRole(role: Role, questionId?: string): Question | undefined {
  if (!questionId) return undefined;
  return [...role.questions, ...(role.bank ?? [])].find((question) => question.id === questionId);
}
