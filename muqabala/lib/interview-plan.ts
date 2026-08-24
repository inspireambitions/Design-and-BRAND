import { roleFromToken, verifyInterview } from './interview-token';
import { buildCustomRole, CUSTOM_ROLE_ID, getRole, type Question, type Role } from './roles';

export function trustedInterviewPlan(input: {
  roleId: string;
  roleTitle: string;
  mode: 'guided' | 'mock';
  questions: Array<{ id: string }>;
  interviewToken?: string;
}): { role: Role; questions: Question[] } | null {
  const verified = input.interviewToken ? verifyInterview(input.interviewToken) : null;
  const role = verified
    ? roleFromToken(verified)
    : input.roleId === CUSTOM_ROLE_ID
      ? buildCustomRole(input.roleTitle)
      : getRole(input.roleId);
  if (!role || role.id !== input.roleId) return null;

  const expectedLength = input.mode === 'mock'
    ? 8
    : role.questions.length >= 8 ? 5 : role.questions.length;
  if (input.questions.length !== expectedLength) return null;
  if (input.mode === 'mock' && role.questions.length + (role.bank?.length ?? 0) < 8) return null;

  const opener = role.questions[0];
  const closer = role.questions.at(-1);
  if (!opener || !closer) return null;
  if (input.questions[0]?.id !== opener.id || input.questions.at(-1)?.id !== closer.id) return null;

  const allowed = new Map([...role.questions, ...(role.bank ?? [])].map((question) => [question.id, question]));
  const ids = input.questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) return null;
  const questions = ids.map((id) => allowed.get(id));
  if (questions.some((question) => !question)) return null;
  return { role, questions: questions as Question[] };
}
