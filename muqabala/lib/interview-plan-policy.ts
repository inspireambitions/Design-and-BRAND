export type InterviewMode = 'guided' | 'mock' | 'screening';

export function matchesTrustedQuestionSequence(
  mode: InterviewMode,
  questionIds: readonly string[],
  openerId: string,
  closerId: string,
): boolean {
  const expectedLength = mode === 'mock' ? 8 : mode === 'screening' ? 3 : 1;
  if (questionIds.length !== expectedLength) return false;
  if (questionIds[0] !== openerId) return false;
  if ((mode === 'mock' || mode === 'screening') && questionIds.at(-1) !== closerId) return false;
  return true;
}
