import type { AnswerFeedback } from './scoring';

/** Feedback that failed integrity checks and can be regenerated. */
export function isRetryableFeedback(feedback: AnswerFeedback | null | undefined): boolean {
  if (!feedback) return false;
  return (
    feedback.status === 'unscored'
    && feedback.improvements.some((item) =>
      item.includes('Try getting feedback again')
      || item.includes('حاول الحصول على الملاحظات'),
    )
  );
}

export function isPendingFeedback(feedback: AnswerFeedback): boolean {
  return isRetryableFeedback(feedback);
}
