import type { AnswerFeedback, CompetencyScore } from './scoring';

export type RetryComparison =
  | { compatible: false }
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

export function compareRetries(before: AnswerFeedback, after: AnswerFeedback): RetryComparison {
  const beforeIds = before.competencies.map((item) => item.id).sort();
  const afterIds = after.competencies.map((item) => item.id).sort();
  const compatible = before.questionId === after.questionId
    && before.status === 'scored'
    && after.status === 'scored'
    && before.source === after.source
    && Boolean(before.scoringVersion?.trim())
    && before.scoringVersion === after.scoringVersion
    && Boolean(before.rubricVersion?.trim())
    && before.rubricVersion === after.rubricVersion
    && JSON.stringify(beforeIds) === JSON.stringify(afterIds);
  if (!compatible) return { compatible: false };

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
