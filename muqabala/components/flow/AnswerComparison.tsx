'use client';

import { useMemo } from 'react';
import type { AnswerFeedback } from '@/lib/scoring';
import { compareRetries } from '@/lib/retry-comparison';
import { diffAddedWords, hasAddedWords } from '@/lib/flow/answer-diff';
import { useLang } from '../LanguageProvider';

/**
 * First answer beside the new one, with the words the candidate added marked,
 * and one plain line naming which rubric element that added and which is
 * still missing. Loaded on demand: most sittings never reach a second attempt.
 */
export function AnswerComparison({
  firstTranscript,
  firstFeedback,
  newTranscript,
  newFeedback,
  attempt,
  lang,
  labelFor,
}: {
  firstTranscript: string;
  firstFeedback: AnswerFeedback;
  newTranscript: string;
  newFeedback: AnswerFeedback;
  attempt: number;
  lang: 'en' | 'ar';
  /** Competency label in the interview language, falling back to the scorer's label. */
  labelFor: (id: string, fallback: string) => string;
}) {
  const { t } = useLang();
  const segments = useMemo(
    () => diffAddedWords(firstTranscript, newTranscript, lang),
    [firstTranscript, newTranscript, lang],
  );
  const comparison = useMemo(() => compareRetries(firstFeedback, newFeedback), [firstFeedback, newFeedback]);

  let summary: string;
  if (!comparison.compatible) {
    summary = comparison.reason === 'unscored' && firstFeedback.status !== 'scored' && newFeedback.status === 'scored'
      ? t('comparisonNowScored').replace('{score}', String(newFeedback.score))
      : comparison.reason === 'unscored'
        ? t('comparisonLatestUnscored')
      : comparison.reason === 'version_changed'
        ? t('comparisonVersionChanged')
        : t('comparisonUnavailable');
  } else {
    const scoreLine = comparison.scoreDelta.before === comparison.scoreDelta.after
      ? t('scoreStayed').replace('{score}', String(comparison.scoreDelta.after))
      : `${t('practiceScore')} ${comparison.scoreDelta.before} → ${comparison.scoreDelta.after}.`;
    const criterionLines = comparison.criterionDeltas.map((item) => (
      `${labelFor(item.id, item.label)} ${item.before}/10 → ${item.after}/10.`
    ));
    summary = criterionLines.length
      ? [scoreLine, ...criterionLines].join(' ')
      : `${scoreLine} ${t('criterionScoresUnchanged')}`;
  }

  return (
    <section className="card stack answer-comparison" aria-labelledby="answer-comparison-title">
      <div>
        <p className="eyebrow">{t('answerComparison')}</p>
        <h3 id="answer-comparison-title" style={{ fontSize: '1.2rem' }}>{t('compareYourAnswers')}</h3>
        {hasAddedWords(segments) && (
          <p className="tiny" style={{ marginTop: '0.35rem' }}>
            {t('diffLegend').replace('{attempt}', String(attempt))}
          </p>
        )}
      </div>
      <div className="comparison-grid comparison-answers">
        <div className="answer-recap">
          <span className="rate-label">{t('previousAnswerLabel')}</span>
          <p dir="auto">{firstTranscript}</p>
        </div>
        <div className="answer-recap answer-recap-new">
          <span className="rate-label">{t('attemptNumber')} {attempt}</span>
          <p dir="auto">
            <span className="sr-only">{newTranscript}</span>
            <span aria-hidden="true">
              {segments.map((segment, index) =>
                segment.added ? (
                  <mark key={index} className="diff-added">{segment.text}</mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                ),
              )}
            </span>
          </p>
        </div>
      </div>
      <p className={`comparison-summary${comparison.compatible ? '' : ' muted'}`} role="status">
        {summary}
      </p>
    </section>
  );
}
