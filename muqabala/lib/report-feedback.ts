import type { AnswerFeedback, UnscoredReason } from './scoring';

type ScoringStatus = 'pending' | 'scored' | 'unscored' | 'failed';

/**
 * Resolve the stored reason without asking the UI to interpret AI prose.
 * Text matching exists only for reports created before reason codes shipped.
 */
export function resolveUnscoredReason(
  feedback: AnswerFeedback | null | undefined,
  transcript = '',
  scoringStatus?: ScoringStatus,
): UnscoredReason | null {
  if (feedback?.status === 'scored' || scoringStatus === 'scored') return null;
  if (scoringStatus === 'pending') return null;
  if (feedback?.unscoredReason) return feedback.unscoredReason;
  if (!transcript.trim()) return 'question_not_answered';
  if (feedback?.source === 'none' || scoringStatus === 'failed') {
    return 'scoring_service_unavailable';
  }

  const copy = [feedback?.headline, ...(feedback?.improvements ?? [])].join(' ');
  if (/too short|enough of an answer|قصيرة|إجابة كافية/i.test(copy)) return 'answer_too_short';
  if (/disconnected|transcription|spoken answer|تفريغ|كلمات غير مترابطة/i.test(copy)) {
    return 'transcript_unclear';
  }
  if (/verify this feedback|Try getting feedback again|التحقق من هذه الملاحظات|حاول الحصول على الملاحظات/i.test(copy)) {
    return 'feedback_could_not_be_verified';
  }
  if (/Arabic|بالعربية غير متاح/i.test(copy)) return 'language_scoring_unavailable';
  return 'reason_not_recorded';
}

/** Feedback that failed integrity checks and can be regenerated. */
export function isRetryableFeedback(feedback: AnswerFeedback | null | undefined): boolean {
  if (!feedback) return false;
  if (
    feedback.unscoredReason === 'feedback_could_not_be_verified'
    || feedback.unscoredReason === 'scoring_service_unavailable'
  ) return true;
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
