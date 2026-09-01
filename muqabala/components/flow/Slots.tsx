'use client';

/**
 * Integration slots for features owned by other parts of the practice brief.
 * Each renders nothing today; the parent replaces these with the real
 * components (readiness score, keep-my-feedback capture, question tags) and the
 * interview flow already passes the props they need.
 */
import type { AnswerFeedback } from '@/lib/scoring';
import type { Question } from '@/lib/roles';

export type ReadinessSlotProps = {
  roleId: string;
  /** Feedback for every completed question so far, in order. */
  feedback: AnswerFeedback[];
  lang: 'en' | 'ar';
};

/** Readiness score, shown on the results screen. Owned by the readiness agent. */
export function ReadinessSlot(_props: ReadinessSlotProps) {
  return null;
}

export type KeepFeedbackSlotProps = {
  roleId: string;
  serverAttemptId: string | null;
  lang: 'en' | 'ar';
};

/** Email capture under the first feedback. Owned by the email capture agent. */
export function KeepFeedbackSlot(_props: KeepFeedbackSlotProps) {
  return null;
}

export type QuestionTagsSlotProps = {
  question: Question;
  lang: 'en' | 'ar';
};

/** Question tags shown with the question text. Owned by the question tags agent. */
export function QuestionTagsSlot(_props: QuestionTagsSlotProps) {
  return null;
}
