import type { AnswerFeedback } from '@/lib/scoring';
import { t } from '@/lib/i18n';

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

export function FullReport({ report }: { report: FullReportData }) {
  const tr = (key: Parameters<typeof t>[1]) => t(report.language, key);
  const locale = report.language === 'ar' ? 'ar-AE' : 'en-GB';
  return (
    <div className="stack-lg" lang={report.language} dir={report.language === 'ar' ? 'rtl' : 'ltr'}>
      <section className="card stack-sm">
        <p className="eyebrow">{tr('reportEyebrow')}</p>
        <h1>{report.roleTitle}</h1>
        {report.overallScore !== null && <p style={{ fontSize: '1.4rem' }}><strong>{report.overallScore}/100</strong> {tr('overall')}</p>}
        <p className="tiny">{new Date(report.startedAt).toLocaleDateString(locale)}</p>
      </section>
      {report.answers.map((answer) => (
        <section className="card stack-sm" key={answer.questionIndex}>
          <p className="eyebrow">{tr('question')} {answer.questionIndex + 1}</p>
          <h2 style={{ fontSize: '1.15rem' }}>{answer.questionText}</h2>
          <div className="answer-recap"><span className="rate-label">{tr('yourAnswer')}</span><p>{answer.transcript || '—'}</p></div>
          {answer.feedback && <>
            {answer.feedback.status === 'scored' && <p><strong>{answer.feedback.score}/100</strong> · {answer.feedback.headline}</p>}
            {answer.feedback.strengths.length > 0 && <div><span className="rate-label">{tr('whatWorked')}</span><ul className="feedback-list">{answer.feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>}
            {answer.feedback.improvements.length > 0 && <div><span className="rate-label">{tr('whatToImprove')}</span><ul className="feedback-list">{answer.feedback.improvements.map((item) => <li key={item}>{item}</li>)}</ul></div>}
            {answer.feedback.coachTip && <div className="coach-tip"><strong>{tr('nextStep')}</strong>{answer.feedback.coachTip}</div>}
          </>}
        </section>
      ))}
    </div>
  );
}
