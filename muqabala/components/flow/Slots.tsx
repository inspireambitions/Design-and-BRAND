'use client';

/**
 * Where the practice brief's companion features join the interview flow: the
 * readiness score and share card on the results screen, the keep-my-feedback
 * card under the first feedback, and the Gulf question tags under the question.
 */
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnswerFeedback, Attempt } from '@/lib/scoring';
import { overallFromAnswers } from '@/lib/scoring';
import type { Question } from '@/lib/roles';
import type { AnswerMode } from '@/lib/flow/answer-mode';
import { QuestionTags } from '../QuestionTags';

const ReadinessScore = dynamic(() => import('../ReadinessScore').then((m) => m.ReadinessScore), { ssr: false });
const ShareProgressCard = dynamic(() => import('../ShareProgressCard').then((m) => m.ShareProgressCard), { ssr: false });
const KeepFeedbackCard = dynamic(() => import('../KeepFeedbackCard').then((m) => m.KeepFeedbackCard), { ssr: false });

export type ReadinessSlotProps = {
  roleId: string;
  /** Feedback for every completed question so far, in order. */
  feedback: AnswerFeedback[];
  /** Transcripts and question ids matching `feedback`, so the sitting counts before it is saved. */
  answers?: Attempt['answers'];
  roleTitle?: string;
  lang: 'en' | 'ar';
};

/**
 * Readiness after this sitting, counted up from the value the candidate had
 * before it, then the share card for the new number.
 */
export function ReadinessSlot({ roleId, answers = [], roleTitle }: ReadinessSlotProps) {
  const sitting = useMemo<Attempt[]>(() => {
    if (!answers.length) return [];
    return [{
      id: `${roleId}-sitting`,
      roleId,
      roleTitle: roleTitle ?? roleId,
      startedAt: new Date().toISOString(),
      overallScore: overallFromAnswers(answers),
      answers,
    }];
  }, [answers, roleId, roleTitle]);
  // The value before this sitting is read once, so the count-up starts there
  // even after local history has been updated. The readiness maths lives in
  // the lazily loaded module so the role catalogue stays out of the practice bundle.
  const previousRef = useRef<number | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void import('../ReadinessScore').then((m) => {
      if (cancelled) return;
      previousRef.current = m.readinessBeforeSitting(roleId);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [roleId]);
  if (!answers.length || !ready) return null;
  return (
    <div className="stack">
      <ReadinessScore roleId={roleId} size="compact" previous={previousRef.current} extraAttempts={sitting} />
      <ShareProgressCard roleId={roleId} />
    </div>
  );
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
