'use client';

import type { AnswerFeedback } from '@/lib/scoring';
import type { PartialFeedback } from '@/lib/feedback-stream';
import { useLang } from './LanguageProvider';
import { ScoreRing } from './ScoreRing';

function SkeletonLines({ lines }: { lines: number }) {
  return (
    <div className="skeleton-block" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={`skeleton-line${index === lines - 1 ? ' skeleton-line-short' : ''}`} />
      ))}
    </div>
  );
}

/**
 * While feedback streams, each block shows as soon as it is complete. Blocks
 * still generating show a skeleton, never a spinner, so the layout does not
 * jump when text lands.
 */
export function StreamingFeedbackCard({
  partial,
  attempt,
}: {
  partial: PartialFeedback;
  attempt?: number;
}) {
  const { t } = useLang();
  return (
    <div className="card stack feedback-streaming" aria-busy="true" aria-live="polite">
      <div>
        {partial.headline ? (
          <h3 style={{ fontSize: '1.2rem' }} dir="auto">{partial.headline}</h3>
        ) : (
          <SkeletonLines lines={1} />
        )}
        <div className="row" style={{ marginTop: '0.45rem', gap: '0.4rem' }}>
          {attempt && attempt > 1 && (
            <span className="chip chip-gold">
              {t('attemptNumber')} {attempt}
            </span>
          )}
          <span className="chip">{t('feedbackArriving')}</span>
        </div>
      </div>

      <div className="stream-block">
        <p className="eyebrow" style={{ marginBottom: 0 }}>{t('whatWorked')}</p>
        {partial.strengths ? (
          partial.strengths.length > 0 ? (
            <ul className="feedback-list">
              {partial.strengths.map((strength) => <li key={strength} dir="auto">{strength}</li>)}
            </ul>
          ) : null
        ) : (
          <SkeletonLines lines={3} />
        )}
      </div>

      <div className="stream-block">
        <p className="eyebrow" style={{ marginBottom: 0, color: 'var(--gold)' }}>{t('whatToImprove')}</p>
        {partial.improvements ? (
          partial.improvements.length > 0 ? (
            <ul className="feedback-list">
              {partial.improvements.map((improvement) => <li key={improvement} dir="auto">{improvement}</li>)}
            </ul>
          ) : null
        ) : (
          <SkeletonLines lines={3} />
        )}
      </div>

      {partial.coachTip ? (
        <div className="coach-tip" dir="auto">
          <strong>{t('biggestWin')}</strong>
          {partial.coachTip}
        </div>
      ) : (
        <div className="coach-tip">
          <strong>{t('biggestWin')}</strong>
          <SkeletonLines lines={2} />
        </div>
      )}
      <p className="tiny">{t('scoreStillChecking')}</p>
    </div>
  );
}

export function FeedbackCard({
  feedback,
  attempt,
}: {
  feedback: AnswerFeedback;
  attempt?: number;
}) {
  const { t } = useLang();

  return (
    <div className="card stack">
      <div>
        <h3 style={{ fontSize: '1.2rem' }} dir="auto">{feedback.headline}</h3>
        <div className="row" style={{ marginTop: '0.45rem', gap: '0.4rem' }}>
          {attempt && attempt > 1 && (
            <span className="chip chip-gold">
              {t('attemptNumber')} {attempt}
            </span>
          )}
          {feedback.source !== 'none' && (
            <span className="chip">
              {t('scoredBy')}{' '}
              {feedback.source === 'ai' ? t('scoredByAi') : t('scoredByStructure')}
            </span>
          )}
        </div>
      </div>

      {feedback.source === 'structure' && feedback.competencies.length > 0 && (
        <p className="notice notice-warn tiny" style={{ margin: 0 }}>
          {t('structureNotice')}
        </p>
      )}

      {feedback.strengths.length > 0 && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 0 }}>
            {t('whatWorked')}
          </p>
          <ul className="feedback-list">
            {feedback.strengths.map((strength) => (
              <li key={strength} dir="auto">{strength}</li>
            ))}
          </ul>
        </div>
      )}

      {feedback.improvements.length > 0 && (
        <div>
          <p className="eyebrow" style={{ marginBottom: 0, color: 'var(--gold)' }}>
            {t('whatToImprove')}
          </p>
          <ul className="feedback-list">
            {feedback.improvements.map((improvement) => (
              <li key={improvement} dir="auto">{improvement}</li>
            ))}
          </ul>
        </div>
      )}

      {feedback.coachTip && (
        <div className="coach-tip" dir="auto">
          <strong>{t('biggestWin')}</strong>
          {feedback.coachTip}
        </div>
      )}

      {feedback.status === 'scored' && (
        <details className="disclosure feedback-details">
          <summary>{t('seeFullFeedback')}</summary>
          <div className="stack" style={{ marginTop: '1rem' }}>
            <div className="score-head">
              <ScoreRing value={feedback.score} />
              <div>
                <p className="eyebrow">{t('practiceScore')}</p>
                <p className="tiny">{t('scoreEvidenceNote')}</p>
              </div>
            </div>
            {feedback.competencies.length > 0 && (
              <div>
                {feedback.competencies.map((competency) => (
                  <div key={competency.id} className="comp-row">
                    <span className="comp-name">{competency.label}</span>
                    <span className="comp-score">{competency.score}/10</span>
                    <div className="comp-bar meter" aria-hidden="true">
                      <div
                        className={`meter-fill ${
                          competency.score >= 8 ? '' : competency.score >= 6 ? 'gold' : 'crit'
                        }`}
                        style={{ width: `${competency.score * 10}%` }}
                      />
                    </div>
                    <p className="comp-evidence" dir="auto">{competency.evidence ?? t('noEvidence')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
