'use client';

import type { AnswerFeedback } from '@/lib/scoring';
import type { PartialFeedback } from '@/lib/feedback-stream';
import { limitBlock, limitSentences } from '@/lib/flow/feedback-copy';
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
 * One of the three fixed feedback blocks. The text is cut to two sentences on
 * render so a long model reply can never turn the card into an essay. An
 * empty block keeps its heading so the card always has the same shape.
 */
function FeedbackBlock({
  heading,
  text,
  tone,
  loading = false,
  emptyText,
}: {
  heading: string;
  text: string;
  tone: 'plain' | 'gold' | 'tip';
  loading?: boolean;
  emptyText?: string;
}) {
  if (tone === 'tip') {
    return (
      <div className="coach-tip feedback-block" dir="auto">
        <strong className="feedback-heading feedback-heading-tip">{heading}</strong>
        {loading ? <SkeletonLines lines={2} /> : text || <span className="muted">{emptyText}</span>}
      </div>
    );
  }
  return (
    <div className="feedback-block">
      <p className={`feedback-heading${tone === 'gold' ? ' feedback-heading-gold' : ''}`}>
        {heading}
      </p>
      {loading ? (
        <SkeletonLines lines={2} />
      ) : text ? (
        <p className="feedback-text" dir="auto">{text}</p>
      ) : (
        <p className="feedback-text muted">{emptyText}</p>
      )}
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

      <FeedbackBlock
        heading={t('whatWorked')}
        tone="plain"
        loading={!partial.strengths}
        text={limitBlock(partial.strengths ?? [])}
        emptyText={t('feedbackBlockEmpty')}
      />
      <FeedbackBlock
        heading={t('whatToImprove')}
        tone="gold"
        loading={!partial.improvements}
        text={limitBlock(partial.improvements ?? [])}
        emptyText={t('feedbackBlockEmpty')}
      />
      <FeedbackBlock
        heading={t('biggestWin')}
        tone="tip"
        loading={!partial.coachTip}
        text={limitSentences(partial.coachTip ?? '')}
        emptyText={t('feedbackBlockEmpty')}
      />
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
  const scored = feedback.status === 'scored';
  const worked = limitBlock(feedback.strengths);
  const missing = limitBlock(feedback.improvements);
  const sayNext = limitSentences(feedback.coachTip);

  return (
    <div className="card stack">
      {scored ? (
        <div className="score-head">
          <ScoreRing value={feedback.score} />
          <div>
            <p className="eyebrow">{t('practiceScore')}</p>
            <p className="tiny">{t('scoreEvidenceNote')}</p>
          </div>
        </div>
      ) : <p className="eyebrow">{t('readinessNotScored')}</p>}
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

      {/* Scored answers always show the same three blocks. An answer the
          system declined to judge shows only the blocks that carry words. */}
      {(scored || worked) && (
        <FeedbackBlock heading={t('whatWorked')} tone="plain" text={worked} emptyText={t('feedbackBlockEmpty')} />
      )}
      {(scored || missing) && (
        <FeedbackBlock heading={t('whatToImprove')} tone="gold" text={missing} emptyText={t('feedbackBlockEmpty')} />
      )}
      {(scored || sayNext) && (
        <FeedbackBlock heading={t('biggestWin')} tone="tip" text={sayNext} emptyText={t('feedbackBlockEmpty')} />
      )}

      {scored && (
        <details className="disclosure feedback-details">
          <summary>{t('seeFullFeedback')}</summary>
          <div className="stack" style={{ marginTop: '1rem' }}>
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
