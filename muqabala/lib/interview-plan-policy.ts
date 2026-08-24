export function matchesTrustedQuestionSequence(
  mode: 'guided' | 'mock',
  questionIds: readonly string[],
  openerId: string,
  closerId: string,
): boolean {
  const expectedLength = mode === 'mock' ? 8 : 1;
  if (questionIds.length !== expectedLength) return false;
  if (questionIds[0] !== openerId) return false;
  if (mode === 'mock' && questionIds.at(-1) !== closerId) return false;
  return true;
}
