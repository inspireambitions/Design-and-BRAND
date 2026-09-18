/**
 * Factual review-by-exception signals for educator workflows.
 * Strictly adheres to Muqabala assessment ethics:
 * - NO opaque AI overall scores
 * - NO peer ranking
 * - Factual behavioral signals only (sparse answers, fallbacks, evidence coverage, deadline pressure)
 */

export type ReviewExceptionSignal = {
  type: 'sparse_answer' | 'repeated_fallback' | 'low_evidence' | 'unreviewed_near_deadline';
  severity: 'advisory' | 'attention';
  label: string;
  detail: string;
};

export function detectAttemptReviewExceptions(input: {
  answers?: (string | null | undefined)[] | null;
  evidenceCovered?: number | null;
  totalPossible?: number | null;
  adaptiveTurns?: Array<{ questionNumber?: number; action?: string; answerText?: string }> | null;
  submittedAt?: string | null;
  dueAt?: string | null;
  reviewed?: boolean;
}): ReviewExceptionSignal[] {
  const signals: ReviewExceptionSignal[] = [];

  // 1. Sparse or short answers (< 30 words)
  const answers = input.answers || [];
  answers.forEach((ans, idx) => {
    const text = typeof ans === 'string' ? ans.trim() : '';
    const wordCount = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length;
    if (wordCount < 30) {
      signals.push({
        type: 'sparse_answer',
        severity: 'attention',
        label: `Sparse response on Question ${idx + 1}`,
        detail: wordCount === 0
          ? `Question ${idx + 1} has no written response.`
          : `Question ${idx + 1} contains only ${wordCount} words (less than 30-word threshold).`,
      });
    }
  });

  // 2. Repeated experience fallbacks
  let fallbackCount = 0;
  const fallbackIndices: number[] = [];

  // Check adaptive turns
  const turns = input.adaptiveTurns || [];
  turns.forEach((turn) => {
    if (turn.action === 'FALLBACK' || turn.action === 'NO_EXAMPLE') {
      const qNum = turn.questionNumber ?? 1;
      if (!fallbackIndices.includes(qNum)) {
        fallbackIndices.push(qNum);
        fallbackCount++;
      }
    }
  });

  // Check answers text for explicit fallback declarations
  answers.forEach((ans, idx) => {
    const text = typeof ans === 'string' ? ans.toLowerCase() : '';
    if (
      (text.includes("don't have a direct") ||
        text.includes("do not have a direct") ||
        text.includes("no direct professional example") ||
        text.includes("no direct example")) &&
      !fallbackIndices.includes(idx + 1)
    ) {
      fallbackIndices.push(idx + 1);
      fallbackCount++;
    }
  });

  if (fallbackCount >= 2) {
    signals.push({
      type: 'repeated_fallback',
      severity: 'attention',
      label: `Repeated experience fallbacks (${fallbackCount} questions)`,
      detail: `Candidate declared no direct professional experience across questions: ${fallbackIndices.join(', ')}. Recommend advising on academic/volunteer evidence alternatives.`,
    });
  } else if (fallbackCount === 1) {
    signals.push({
      type: 'repeated_fallback',
      severity: 'advisory',
      label: `Experience fallback used on Question ${fallbackIndices[0]}`,
      detail: `Candidate utilized experience fallback on Question ${fallbackIndices[0]}.`,
    });
  }

  // 3. Low evidence coverage (< 50% of criteria)
  if (
    typeof input.evidenceCovered === 'number' &&
    typeof input.totalPossible === 'number' &&
    input.totalPossible > 0
  ) {
    const threshold = Math.ceil(input.totalPossible * 0.5);
    if (input.evidenceCovered < threshold) {
      signals.push({
        type: 'low_evidence',
        severity: 'attention',
        label: `Low evidence coverage (${input.evidenceCovered}/${input.totalPossible})`,
        detail: `Observed evidence satisfies ${input.evidenceCovered} of ${input.totalPossible} criteria (below 50% threshold).`,
      });
    }
  }

  // 4. Unreviewed attempt near or past due date
  if (!input.reviewed && input.dueAt) {
    const dueTime = new Date(input.dueAt).getTime();
    const now = Date.now();
    const hoursToDue = (dueTime - now) / (3600 * 1000);
    if (hoursToDue <= 48) {
      signals.push({
        type: 'unreviewed_near_deadline',
        severity: hoursToDue <= 0 ? 'attention' : 'advisory',
        label: hoursToDue <= 0 ? 'Awaiting review past deadline' : 'Awaiting review near deadline',
        detail: hoursToDue <= 0
          ? 'Assignment deadline has passed. Candidate submission is awaiting educator review.'
          : `Assignment deadline is in ${Math.max(1, Math.round(hoursToDue))} hours. Submission awaits educator review.`,
      });
    }
  }

  return signals;
}
