'use client';

import { useEffect, useState } from 'react';
import type { Question, Role } from '@/lib/roles';
import { focusedQuestionFromRole } from '@/lib/focused-question';
import { drawInterview, drawMockQuestions } from '@/lib/interview-draw';
import { loadAttempts } from '@/lib/storage';
import { InterviewFlow } from './InterviewFlow';

/**
 * Client shell for a catalogue interview: counts this device's completed
 * attempts for the role and draws that attempt's question set, so practising
 * again gives fresh questions.
 *
 * The draw happens once, before render, and never changes mid-interview. If
 * storage is blocked (private mode, in-app browsers) the count is simply 0 and
 * the candidate gets the curated first set — never an error.
 */
export function PracticeInterview({ role, focusQuestionId, initialLanguage }: { role: Role; focusQuestionId?: string; initialLanguage?: 'en' | 'ar' }) {
  const focusedQuestion = focusedQuestionFromRole(role, focusQuestionId);
  // Start with a complete set on the first paint. This makes the realistic
  // eight-question interview the default without waiting for local storage.
  const [drawn, setDrawn] = useState<Role>(() => drawInterview(role, 0));
  const [mockQuestions, setMockQuestions] = useState<Question[] | null>(() =>
    drawMockQuestions(role, 0),
  );

  useEffect(() => {
    let completed = 0;
    try {
      completed = loadAttempts().filter((a) => a.roleId === role.id).length;
    } catch {
      completed = 0;
    }
    setDrawn(drawInterview(role, completed));
    setMockQuestions(drawMockQuestions(role, completed));
    // The role prop is static per page; draw exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusQuestionId, role.id]);

  // Render immediately with the authored role so the page server-renders in
  // full (first paint, previews, and the deployed-copy tests all depend on
  // that), then swap in the drawn variant as soon as the attempt count is
  // read. The swap happens at the check stage, where no question text is on
  // screen, and the opener is identical in every variant — so it is invisible.
  return <InterviewFlow role={drawn} mockQuestions={mockQuestions ?? undefined} initialLanguage={initialLanguage} focusQuestionId={focusQuestionId} focusedQuestion={focusedQuestion} />;
}
