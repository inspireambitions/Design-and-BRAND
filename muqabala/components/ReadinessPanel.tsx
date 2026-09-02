'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo } from 'react';
import type { Attempt } from '@/lib/scoring';
import { overallFromAnswers } from '@/lib/scoring';
import { ReadinessScore, readinessBeforeSitting, useReadiness } from './ReadinessScore';

const ShareProgressCard = dynamic(() => import('./ShareProgressCard').then((m) => m.ShareProgressCard), { ssr: false });

/**
 * The number the candidate last saw for each role in this page session, so a
 * retry counts up from the figure on screen rather than from the saved history.
 */
const lastShown = new Map<string, number>();

export function ReadinessPanel({
  roleId,
  roleTitle,
  answers,
  share = false,
}: {
  roleId: string;
  roleTitle: string;
  /** Answers from the sitting so far, including the one just scored. */
  answers: Attempt['answers'];
  /** Show the shareable card under the score. Results screens only. */
  share?: boolean;
}) {
  const sitting = useMemo<Attempt[]>(() => {
    if (!answers.length) return [];
    return [{
      id: `${roleId}-sitting`,
      roleId,
      roleTitle,
      startedAt: new Date().toISOString(),
      overallScore: overallFromAnswers(answers),
      answers,
    }];
  }, [answers, roleId, roleTitle]);
  const snapshot = useReadiness(roleId, sitting);
  const previous = lastShown.get(roleId) ?? readinessBeforeSitting(roleId);

  useEffect(() => {
    if (snapshot) lastShown.set(roleId, snapshot.score);
  }, [roleId, snapshot]);

  if (!snapshot) return null;
  return (
    <div className="stack">
      <ReadinessScore roleId={roleId} size="compact" previous={previous} extraAttempts={sitting} />
      {share && <ShareProgressCard roleId={roleId} extraAttempts={sitting} />}
    </div>
  );
}
