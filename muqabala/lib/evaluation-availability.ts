// Hosted timed_interview_evidence migration. Earlier submissions did not
// capture segment timestamps; they retain the original recording review.
const TIMED_EVIDENCE_AVAILABLE_AT = Date.parse('2026-09-03T18:09:10Z');

export function isLegacyUntimedEvaluation(
  submittedAt: string,
  answers: readonly { transcript_timing_version: string | null }[],
): boolean {
  const submitted = Date.parse(submittedAt);
  return Number.isFinite(submitted) && submitted < TIMED_EVIDENCE_AVAILABLE_AT
    && answers.length > 0 && answers.every(answer => answer.transcript_timing_version === null);
}

export class LegacyEvaluationUnavailableError extends Error {
  constructor() {
    super('legacy_untimed_evaluation');
    this.name = 'LegacyEvaluationUnavailableError';
  }
}
