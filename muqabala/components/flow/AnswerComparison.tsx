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
  lang,
  labelFor,
}: {
  firstTranscript: string;
  firstFeedback: AnswerFeedback;
  newTranscript: string;
  newFeedback: AnswerFeedback;
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
  const separator = lang === 'ar' ? '، ' : ', ';

  let summary: string;
  if (!comparison.compatible) {
    summary = comparison.reason === 'unscored'
      ? t('comparisonUnscored')
      : comparison.reason === 'version_changed'
        ? t('comparisonVersionChanged')
        : t('comparisonUnavailable');
  } else {
    const added = comparison.evidenceAdded.map((item) => labelFor(item.id, item.label));
    const missing = comparison.stillMissing.map((item) => labelFor(item.id, item.label));
    const addedLine = added.length
      ? t('youAdded').replace('{items}', added.join(separator))
      : t('keptSameEvidence');
    const missingLine = missing.length
      ? t('stillMissingLine').replace('{items}', missing.join(separator))
      : t('nothingMissingNow');
    summary = `${addedLine} ${missingLine}`;
  }

  return (
    <section className="card stack answer-comparison" aria-labelledby="answer-comparison-title">
      <div>
        <p className="eyebrow">{t('answerComparison')}</p>
        <h3 id="answer-comparison-title" style={{ fontSize: '1.2rem' }}>{t('compareYourAnswers')}</h3>
        {hasAddedWords(segments) && (
          <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('diffLegend')}</p>
        )}
      </div>
      <div className="comparison-grid comparison-answers">
        <div className="answer-recap">
          <span className="rate-label">{t('firstAnswer')}</span>
          <p dir="auto">{firstTranscript}</p>
        </div>
        <div className="answer-recap answer-recap-new">
          <span className="rate-label">{t('newAnswer')}</span>
          <p dir="auto">
            {segments.map((segment, index) =>
              segment.added ? (
                <mark key={index} className="diff-added">
                  <span className="sr-only">{t('diffAddedLabel')} </span>
                  {segment.text}
                </mark>
              ) : (
                <span key={index}>{segment.text}</span>
              ),
            )}
          </p>
        </div>
      </div>
      <p className={`comparison-summary${comparison.compatible ? '' : ' muted'}`} role="status">
        {summary}
      </p>
    </section>
  );
}
