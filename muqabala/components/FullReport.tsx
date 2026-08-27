import type { AnswerFeedback } from '@/lib/scoring';
import { t } from '@/lib/i18n';
import { ScoreRing } from './ScoreRing';

export type FullReportData = {
  id: string;
  roleTitle: string;
  language: 'en' | 'ar';
  overallScore: number | null;
  startedAt: string;
  answers: Array<{
    questionIndex: number;
    questionText: string;
    transcript: string;
    feedback: AnswerFeedback | null;
  }>;
};

function isPendingFeedback(feedback: AnswerFeedback): boolean {
  return (
    feedback.status === 'unscored'
    && feedback.improvements.some((item) =>
      item.includes('Try getting feedback again')
      || item.includes('حاول الحصول على الملاحظات'),
    )
  );
}

function scoreBand(lang: 'en' | 'ar', score: number): string {
  if (score >= 75) return t(lang, 'reportBandStrong');
  if (score >= 55) return t(lang, 'reportBandMid');
  if (score >= 35) return t(lang, 'reportBandLow');
  return t(lang, 'reportBandBuild');
}

function questionAccent(score: number | null): string {
  if (score === null) return 'report-question-neutral';
  if (score >= 75) return 'report-question-strong';
  if (score >= 55) return 'report-question-mid';
  if (score >= 35) return 'report-question-low';
  return 'report-question-build';
}

function ReportAnswer({
  language,
  questionIndex,
  questionText,
  transcript,
  feedback,
}: {
  language: 'en' | 'ar';
  questionIndex: number;
  questionText: string;
  transcript: string;
  feedback: AnswerFeedback | null;
}) {
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);
  const scored = feedback?.status === 'scored';
  const pending = feedback ? isPendingFeedback(feedback) : false;
  const accent = questionAccent(scored ? feedback!.score : null);

  return (
    <section className={`card report-question ${accent}`}>
      <div className="report-question-head">
        <div className="report-question-meta">
          <span className="report-question-badge">{tr('question')} {questionIndex + 1}</span>
          {scored && (
            <p className="report-question-headline" dir="auto">
              <strong>{feedback!.score}/100</strong>
              <span className="report-question-sep">·</span>
              {feedback!.headline}
            </p>
          )}
          {!scored && feedback?.headline && !pending && (
            <p className="report-question-headline" dir="auto">{feedback.headline}</p>
          )}
        </div>
        {scored && <ScoreRing value={feedback!.score} className="score-ring-sm" />}
      </div>

      <h2 className="report-question-text" dir="auto">{questionText}</h2>

      {pending && (
        <div className="report-pending" role="status">
          <p className="report-pending-title">{tr('reportFeedbackPending')}</p>
          <p className="tiny">{tr('reportFeedbackPendingBody')}</p>
        </div>
      )}

      {feedback && !pending && (
        <div className="report-feedback-grid">
          {feedback.strengths.length > 0 && (
            <div className="report-feedback-block report-feedback-good">
              <span className="report-block-label">{tr('whatWorked')}</span>
              <ul className="report-bullet-list">
                {feedback.strengths.map((item) => (
                  <li key={item} dir="auto">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {feedback.improvements.length > 0 && (
            <div className="report-feedback-block report-feedback-grow">
              <span className="report-block-label">{tr('whatToImprove')}</span>
              <ul className="report-bullet-list">
                {feedback.improvements.map((item) => (
                  <li key={item} dir="auto">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {feedback.coachTip && (
            <div className="coach-tip report-coach-tip" dir="auto">
              <strong>{tr('nextStep')}</strong>
              {feedback.coachTip}
            </div>
          )}

          {scored && feedback.competencies.length > 0 && (
            <details className="disclosure report-competencies">
              <summary>{tr('reportCompetencies')}</summary>
              <div className="stack-sm" style={{ marginTop: '0.75rem' }}>
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
                    {competency.evidence && (
                      <p className="comp-evidence" dir="auto">{competency.evidence}</p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {transcript && (
        <details className="disclosure report-transcript">
          <summary>{tr('reportViewAnswer')}</summary>
          <div className="answer-recap report-answer-body">
            <p dir="auto">{transcript}</p>
          </div>
        </details>
      )}
    </section>
  );
}

export function FullReport({ report }: { report: FullReportData }) {
  const tr = (key: Parameters<typeof t>[1]) => t(report.language, key);
  const locale = report.language === 'ar' ? 'ar-AE' : 'en-GB';
  const scoredCount = report.answers.filter((answer) => answer.feedback?.status === 'scored').length;
  const pendingCount = report.answers.filter(
    (answer) => answer.feedback && isPendingFeedback(answer.feedback),
  ).length;
  const formattedDate = new Date(report.startedAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <article className="report stack-lg" lang={report.language} dir={report.language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="card report-hero">
        <div className="report-hero-top">
          <div className="report-hero-copy">
            <div className="report-brand">
              <span className="report-brand-mark" aria-hidden="true">م</span>
              <span className="report-brand-name">Muqabala</span>
            </div>
            <p className="eyebrow report-eyebrow">{tr('reportEyebrow')}</p>
            <h1 className="report-title" dir="auto">{report.roleTitle}</h1>
            {report.overallScore !== null && (
              <p className="report-band">{scoreBand(report.language, report.overallScore)}</p>
            )}
          </div>
          {report.overallScore !== null && (
            <div className="report-hero-score">
              <ScoreRing value={report.overallScore} />
              <span className="report-overall-label">{tr('overall')}</span>
            </div>
          )}
        </div>

        <dl className="report-stat-grid">
          <div className="report-stat">
            <dt>{tr('reportStatDate')}</dt>
            <dd>{formattedDate}</dd>
          </div>
          <div className="report-stat">
            <dt>{tr('reportStatQuestions')}</dt>
            <dd>{report.answers.length}</dd>
          </div>
          <div className="report-stat">
            <dt>{tr('reportStatScored')}</dt>
            <dd>
              {scoredCount}/{report.answers.length}
              {pendingCount > 0 && (
                <span className="report-stat-note"> · {pendingCount} {tr('reportStatPending')}</span>
              )}
            </dd>
          </div>
        </dl>

        <p className="report-trust tiny">{tr('reportTrustNote')}</p>
      </header>

      <div className="report-questions stack">
        {report.answers.map((answer) => (
          <ReportAnswer
            key={answer.questionIndex}
            language={report.language}
            questionIndex={answer.questionIndex}
            questionText={answer.questionText}
            transcript={answer.transcript}
            feedback={answer.feedback}
          />
        ))}
      </div>

      <footer className="report-footer tiny">
        <p>{tr('reportFooterNote')}</p>
        <p className="report-footer-brand">Muqabala · Inspire Ambitions</p>
      </footer>
    </article>
  );
}
