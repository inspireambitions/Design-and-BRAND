'use client';

import type { AnswerFeedback } from '@/lib/scoring';
import { useLang } from './LanguageProvider';
import { ScoreRing } from './ScoreRing';

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
