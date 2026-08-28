import { roleFromToken, verifyInterview } from './interview-token';
import { matchesFocusedQuestionSequence, matchesTrustedQuestionSequence, type InterviewMode } from './interview-plan-policy';
import { buildCustomRole, CUSTOM_ROLE_ID, getRole, type Question, type Role } from './roles';

export function trustedInterviewPlan(input: {
  roleId: string;
  roleTitle: string;
  mode: InterviewMode;
  questions: Array<{ id: string }>;
  interviewToken?: string;
  focusQuestionId?: string;
}): { role: Role; questions: Question[] } | null {
  const verified = input.interviewToken ? verifyInterview(input.interviewToken) : null;
  // Practice and proof never mix: a Coach token cannot start a work sample,
  // and a work-sample pack cannot be scored as practice.
  if (input.mode === 'screening') {
    if (!verified || verified.kind !== 'proof' || verified.questions.length !== 3) return null;
  } else if (verified?.kind === 'proof') {
    return null;
  }
  const role = verified
    ? roleFromToken(verified)
    : input.roleId === CUSTOM_ROLE_ID
      ? buildCustomRole(input.roleTitle)
      : getRole(input.roleId);
  if (!role || role.id !== input.roleId) return null;

  if (input.mode === 'mock' && role.questions.length + (role.bank?.length ?? 0) < 8) return null;

  const opener = role.questions[0];
  const closer = role.questions.at(-1);
  if (!opener || !closer) return null;
  const ids = input.questions.map((question) => question.id);
  const allowed = new Map([...role.questions, ...(role.bank ?? [])].map((question) => [question.id, question]));
  if (input.focusQuestionId) {
    if (!matchesFocusedQuestionSequence(input.mode, ids, input.focusQuestionId, new Set(allowed.keys()))) return null;
  } else if (!matchesTrustedQuestionSequence(input.mode, ids, opener.id, closer.id)) {
    return null;
  }

  if (new Set(ids).size !== ids.length) return null;
  const questions = ids.map((id) => allowed.get(id));
  if (questions.some((question) => !question)) return null;
  return { role, questions: questions as Question[] };
}
