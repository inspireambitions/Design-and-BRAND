'use client';

import type { AnswerFeedback } from '@/lib/scoring';
import { compareRetries } from '@/lib/retry-comparison';
import { useLang } from './LanguageProvider';

/**
 * Side by side view of a retried answer against the first attempt. Loaded on
 * demand because most interviews never reach a retry.
 */
export function RetryComparison({
  previousTranscript,
  previousFeedback,
  transcript,
  feedback,
}: {
  previousTranscript: string;
  previousFeedback: AnswerFeedback;
  transcript: string;
  feedback: AnswerFeedback;
}) {
  const { t } = useLang();
  const comparison = compareRetries(previousFeedback, feedback);

  return (
    <div className="card stack">
      <div>
        <p className="eyebrow">{t('answerComparison')}</p>
        <h3 style={{ fontSize: '1.2rem' }}>{t('compareYourAnswers')}</h3>
        <p className="tiny" style={{ marginTop: '0.35rem' }}>{t('comparisonNoClaim')}</p>
      </div>
      <div className="comparison-grid">
        <div className="answer-recap">
          <span className="rate-label">{t('firstAnswer')}</span>
          <p dir="auto">{previousTranscript}</p>
        </div>
        <div className="answer-recap">
          <span className="rate-label">{t('latestAnswer')}</span>
          <p dir="auto">{transcript}</p>
        </div>
      </div>
      <div>
        <p className="eyebrow">{t('previousAdvice')}</p>
        {previousFeedback.improvements.length > 0 && (
          <ul className="feedback-list">
            {previousFeedback.improvements.map((item, adviceIndex) => (
              <li key={`${adviceIndex}-${item}`} dir="auto">{item}</li>
            ))}
          </ul>
        )}
        {previousFeedback.coachTip && (
          <p className="coach-tip" dir="auto">{previousFeedback.coachTip}</p>
        )}
      </div>
      {!comparison.compatible ? (
        <p className="notice notice-warn tiny">{t('comparisonVersionChanged')}</p>
      ) : !comparison.evidenceAdded.length && !comparison.evidenceChanged.length
        && !comparison.stillMissing.length ? (
        <p className="tiny">{t('noEvidenceChange')}</p>
      ) : (
        <div className="comparison-grid">
          <div>
            <p className="eyebrow">{t('evidenceAdded')}</p>
            <ul className="feedback-list">
              {comparison.evidenceAdded.length > 0
                ? comparison.evidenceAdded.map((item) => <li key={item.id} dir="auto">{item.evidence}</li>)
                : <li>{t('noEvidenceAdded')}</li>}
            </ul>
          </div>
          <div>
            <p className="eyebrow">{t('stillMissing')}</p>
            <ul className="feedback-list">
              {comparison.stillMissing.length > 0
                ? comparison.stillMissing.map((item) => <li key={item.id}>{item.label}</li>)
                : <li>{t('nothingStillMissing')}</li>}
            </ul>
          </div>
          {comparison.evidenceChanged.length > 0 && (
            <div>
              <p className="eyebrow">{t('evidenceChanged')}</p>
              <ul className="feedback-list">
                {comparison.evidenceChanged.map((item) => <li key={item.id} dir="auto">{item.evidence}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
