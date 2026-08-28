import Link from 'next/link';
import { overallFromAnswers, type AnswerFeedback, type UnscoredReason } from '@/lib/scoring';
import { t } from '@/lib/i18n';
import { isPendingFeedback, resolveUnscoredReason } from '@/lib/report-feedback';
import { ScoreRing } from './ScoreRing';
import { ReportRetryFeedback } from './ReportRetryFeedback';

export type FullReportData = {
  id: string;
  roleId: string;
  roleTitle: string;
  language: 'en' | 'ar';
  overallScore: number | null;
  startedAt: string;
  allowRescore?: boolean;
  answers: Array<{
    questionIndex: number;
    questionId: string;
    questionText: string;
    transcript: string;
    feedback: AnswerFeedback | null;
    scoringStatus?: 'pending' | 'scored' | 'unscored' | 'failed';
  }>;
};

const unscoredCopy: Record<UnscoredReason, {
  status: Parameters<typeof t>[1];
  reason: Parameters<typeof t>[1];
  action: 'answer' | 'feedback' | 'none';
}> = {
  answer_too_short: { status: 'reportNotScored', reason: 'reportReasonTooShort', action: 'answer' },
  transcript_unclear: { status: 'reportNotScored', reason: 'reportReasonTranscriptUnclear', action: 'answer' },
  feedback_could_not_be_verified: { status: 'reportFeedbackNotReadyBadge', reason: 'reportReasonVerificationFailed', action: 'feedback' },
  scoring_service_unavailable: { status: 'reportFeedbackNotReadyBadge', reason: 'reportReasonServiceUnavailable', action: 'feedback' },
  language_scoring_unavailable: { status: 'reportNotScored', reason: 'reportReasonLanguageUnavailable', action: 'none' },
  question_not_answered: { status: 'reportNotAnswered', reason: 'reportReasonNotAnswered', action: 'answer' },
  feedback_locked: { status: 'reportFeedbackNotReadyBadge', reason: 'reportReasonFeedbackLocked', action: 'none' },
  reason_not_recorded: { status: 'reportNotScored', reason: 'reportReasonNotRecorded', action: 'answer' },
};

function practiceQuestionHref(report: FullReportData, questionId: string): string {
  const language = `lang=${encodeURIComponent(report.language)}`;
  if (report.roleId === 'custom') {
    return `/practice/custom?template=${encodeURIComponent(report.id)}&focus=${encodeURIComponent(questionId)}&${language}`;
  }
  return `/practice/${encodeURIComponent(report.roleId)}?focus=${encodeURIComponent(questionId)}&${language}`;
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
  interviewId,
  roleId,
  allowRescore,
  questionIndex,
  questionId,
  questionText,
  transcript,
  feedback,
  scoringStatus,
}: {
  language: 'en' | 'ar';
  interviewId: string;
  roleId: string;
  allowRescore: boolean;
  questionIndex: number;
  questionId: string;
  questionText: string;
  transcript: string;
  feedback: AnswerFeedback | null;
  scoringStatus?: 'pending' | 'scored' | 'unscored' | 'failed';
}) {
  const tr = (key: Parameters<typeof t>[1]) => t(language, key);
  const scored = feedback?.status === 'scored';
  const feedbackRetryable = feedback ? isPendingFeedback(feedback) : false;
  const scoringPending = scoringStatus === 'pending' && !feedback;
  const unscoredReason = resolveUnscoredReason(feedback, transcript, scoringStatus);
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
          {scored && feedback!.source === 'structure' && (
            <span className="report-score-source">{tr('scoredByStructure')}</span>
          )}
          {!scored && feedback?.headline && !feedbackRetryable && !scoringPending && (
            <p className="report-question-headline" dir="auto">{feedback.headline}</p>
          )}
        </div>
        {scored && <ScoreRing value={feedback!.score} className="score-ring-sm" />}
      </div>

      <h2 className="report-question-text" dir="auto">{questionText}</h2>

      {!scored && unscoredReason && !feedbackRetryable && !scoringPending && (
        <div className={`report-unscored-inline report-unscored-${unscoredReason}`}>
          <span className="report-unscored-status">{tr(unscoredCopy[unscoredReason].status)}</span>
          <p>{tr(unscoredCopy[unscoredReason].reason)}</p>
          <p className="tiny">{tr('reportUnscoredZeroNote')}</p>
        </div>
      )}

      {scoringPending && (
        <div className="report-pending" role="status">
          <p className="report-pending-title">{tr('reportFeedbackPreparing')}</p>
          <p className="tiny">{tr('reportFeedbackPreparingBody')}</p>
        </div>
      )}

      {feedbackRetryable && (
        <div className="report-pending" role="status">
          <p className="report-pending-title">{tr('reportFeedbackPending')}</p>
          <p className="tiny">{tr('reportFeedbackPendingBody')}</p>
          {allowRescore && transcript && (
            <ReportRetryFeedback
              interviewId={interviewId}
              roleId={roleId}
              questionIndex={questionIndex}
              questionId={questionId}
              transcript={transcript}
              language={language}
            />
          )}
        </div>
      )}

      {feedback && !feedbackRetryable && (
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
  const reportScore = overallFromAnswers(
    report.answers.flatMap((answer) => answer.feedback ? [{ feedback: answer.feedback }] : []),
  );
  const pendingCount = report.answers.filter((answer) => answer.scoringStatus === 'pending').length;
  const unscoredAnswers = report.answers.flatMap((answer) => {
    const reason = resolveUnscoredReason(answer.feedback, answer.transcript, answer.scoringStatus);
    return reason ? [{ ...answer, reason }] : [];
  });
  const formattedDate = new Date(report.startedAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const allowRescore = report.allowRescore ?? false;

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
            {reportScore !== null && (
              <p className="report-band">{scoreBand(report.language, reportScore)}</p>
            )}
            {reportScore !== null && (
              <p className="report-score-basis">
                {tr('reportScoreBasis')
                  .replace('{scored}', String(scoredCount))
                  .replace('{total}', String(report.answers.length))}
              </p>
            )}
          </div>
          {reportScore !== null && (
            <div className="report-hero-score">
              <ScoreRing value={reportScore} />
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
            interviewId={report.id}
            roleId={report.roleId}
            allowRescore={allowRescore}
            questionIndex={answer.questionIndex}
            questionId={answer.questionId}
            questionText={answer.questionText}
            transcript={answer.transcript}
            feedback={answer.feedback}
            scoringStatus={answer.scoringStatus}
          />
        ))}
      </div>

      {unscoredAnswers.length > 0 && (
        <section className="card report-unscored-summary" aria-labelledby="report-unscored-title">
          <h2 id="report-unscored-title">
            {(unscoredAnswers.length === 1 ? tr('reportUnscoredOne') : tr('reportUnscoredMany'))
              .replace('{count}', String(unscoredAnswers.length))}
          </h2>
          <div className="report-unscored-list">
            {unscoredAnswers.map((answer) => {
              const copy = unscoredCopy[answer.reason];
              const canOpenPractice = report.roleId !== 'custom' || Boolean(report.allowRescore);
              return (
                <div className="report-unscored-row" key={answer.questionIndex}>
                  <div className="report-unscored-row-head">
                    <h3>{tr('question')} {answer.questionIndex + 1}</h3>
                    <span className={`report-unscored-status report-unscored-status-${copy.action}`}>
                      {tr(copy.status)}
                    </span>
                  </div>
                  <p>{tr(copy.reason)}</p>
                  {copy.action === 'feedback' && report.allowRescore && answer.transcript ? (
                    <ReportRetryFeedback
                      interviewId={report.id}
                      roleId={report.roleId}
                      questionIndex={answer.questionIndex}
                      questionId={answer.questionId}
                      transcript={answer.transcript}
                      language={report.language}
                    />
                  ) : (copy.action === 'answer' || copy.action === 'feedback') && canOpenPractice ? (
                    <Link className="btn btn-quiet report-unscored-action" href={practiceQuestionHref(report, answer.questionId)}>
                      {tr('reportTryQuestionAgain').replace('{number}', String(answer.questionIndex + 1))}
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="report-unscored-reassurance">{tr('reportUnscoredReassurance')}</p>
        </section>
      )}

      <footer className="report-footer tiny">
        <p>{tr('reportFooterNote')}</p>
        <p className="report-footer-brand">Muqabala · Inspire Ambitions</p>
      </footer>
    </article>
  );
}
