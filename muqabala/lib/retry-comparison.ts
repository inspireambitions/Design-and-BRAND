import type { AnswerFeedback, CompetencyScore } from './scoring';

/**
 * Why two attempts cannot be compared. Each reason has its own wording on
 * screen: only `version_changed` may say that the scoring system changed.
 */
export type IncompatibleReason =
  | 'unscored'
  | 'different_question'
  | 'version_changed'
  | 'version_unknown'
  | 'different_rubric';

export type RetryComparison =
  | { compatible: false; reason: IncompatibleReason }
  | {
      compatible: true;
      evidenceAdded: CompetencyScore[];
      evidenceChanged: CompetencyScore[];
      stillMissing: CompetencyScore[];
    };

function evidence(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function version(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function incompatibleReason(before: AnswerFeedback, after: AnswerFeedback): IncompatibleReason | null {
  if (before.status !== 'scored' || after.status !== 'scored') return 'unscored';
  if (before.questionId !== after.questionId) return 'different_question';
  const beforeScoring = version(before.scoringVersion);
  const afterScoring = version(after.scoringVersion);
  const beforeRubric = version(before.rubricVersion);
  const afterRubric = version(after.rubricVersion);
  if (!beforeScoring || !afterScoring || !beforeRubric || !afterRubric) return 'version_unknown';
  if (beforeScoring !== afterScoring || beforeRubric !== afterRubric || before.source !== after.source) {
    return 'version_changed';
  }
  const beforeIds = before.competencies.map((item) => item.id).sort();
  const afterIds = after.competencies.map((item) => item.id).sort();
  if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) return 'different_rubric';
  return null;
}

export function compareRetries(before: AnswerFeedback, after: AnswerFeedback): RetryComparison {
  const reason = incompatibleReason(before, after);
  if (reason) return { compatible: false, reason };

  const previous = new Map(before.competencies.map((item) => [item.id, evidence(item.evidence)]));
  const evidenceAdded = after.competencies.filter((item) => !previous.get(item.id) && evidence(item.evidence));
  const evidenceChanged = after.competencies.filter((item) => {
    const earlier = previous.get(item.id);
    const latest = evidence(item.evidence);
    return Boolean(earlier && latest && earlier !== latest);
  });
  const stillMissing = after.competencies.filter((item) => !evidence(item.evidence));
  return { compatible: true, evidenceAdded, evidenceChanged, stillMissing };
}
