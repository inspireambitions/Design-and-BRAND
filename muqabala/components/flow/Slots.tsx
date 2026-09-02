'use client';

/**
 * Where the practice brief's companion features join the interview flow: the
 * readiness score and share card on the results screen, the keep-my-feedback
 * card under the first feedback, and the Gulf question tags under the question.
 */
import dynamic from 'next/dynamic';
import type { Attempt } from '@/lib/scoring';
import type { Question } from '@/lib/roles';
import type { AnswerMode } from '@/lib/flow/answer-mode';
import { QuestionTags } from '../QuestionTags';

const KeepFeedbackCard = dynamic(() => import('../KeepFeedbackCard').then((m) => m.KeepFeedbackCard), { ssr: false });

export type ReadinessSlotProps = {
  roleId: string;
  roleTitle: string;
  /** Answers from the sitting so far, including the one just scored. */
  answers: Attempt['answers'];
  /** Show the share card under the score. Results screens only. */
  share?: boolean;
};

const ReadinessPanel = dynamic(() => import('../ReadinessPanel').then((m) => m.ReadinessPanel), { ssr: false });

/**
 * Readiness for this role, counted up from the number the candidate last saw.
 * At the top of every feedback screen, and with the share card on the results.
 */
export function ReadinessSlot({ roleId, roleTitle, answers, share = false }: ReadinessSlotProps) {
  if (!answers.length) return null;
  return <ReadinessPanel roleId={roleId} roleTitle={roleTitle} answers={answers} share={share} />;
}

export type KeepFeedbackSlotProps = {
  roleId: string;
  questionId: string;
  serverAttemptId: string | null;
  mode: AnswerMode;
  lang: 'en' | 'ar';
};

/** Email capture under the first full feedback. Self-gating: shown once per session at most. */
export function KeepFeedbackSlot({ roleId, questionId, serverAttemptId, mode, lang }: KeepFeedbackSlotProps) {
  return (
    <KeepFeedbackCard
      roleId={roleId}
      questionId={questionId}
      interviewId={serverAttemptId ?? undefined}
      lang={lang}
      source="feedback_card"
      mode={mode}
      onDone={() => undefined}
    />
  );
}

export type QuestionTagsSlotProps = {
  question: Question;
  lang: 'en' | 'ar';
};

/** Editorial Gulf tags under the question text. */
export function QuestionTagsSlot({ question, lang }: QuestionTagsSlotProps) {
  return <QuestionTags tags={question.tags} lang={lang} />;
}
