import type { CandidateEvaluationReport, ReportBand } from '@/lib/evaluation-report';
import { formatPlaybackTime, formatReportDateTime, reportDecisionLabel } from '@/lib/evaluation-report';
import { EvidencePlayback } from './EvidencePlayback';
import styles from './EvaluationReportView.module.css';

const BAND_LABEL: Record<ReportBand, string> = {
  EVIDENCE_FOUND: 'Evidence found',
  PARTIAL: 'Partial',
  EVIDENCE_NOT_FOUND: 'Evidence not found',
};

export function EvaluationReportView({
  report,
  interactiveEvidence = false,
  sample = false,
}: {
  report: CandidateEvaluationReport;
  interactiveEvidence?: boolean;
  sample?: boolean;
}) {
  return (
    <article className={styles.report} data-report-id={report.report_id}>
      {sample && <div className={styles.sample}>Sample report</div>}
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Muqabala · Stored evidence report</p>
          <h1>{report.candidate_name}</h1>
          <p>{report.role_title} · {report.workplace}</p>
          {report.interviewer_of_record && <p className={styles.interviewer}>Interviewed by {report.interviewer_of_record}</p>}
        </div>
        <div className={styles.identity}>
          <span>Report</span><strong>{report.report_id}</strong>
          <span>Version</span><strong>{report.report_version}</strong>
        </div>
      </header>

      <dl className={styles.meta}>
        <div><dt>Interview started</dt><dd>{formatReportDateTime(report.interview_datetime)}</dd></div>
        <div><dt>Recorded time</dt><dd>{Math.floor(report.duration_seconds / 60)} min {report.duration_seconds % 60} sec</dd></div>
        <div><dt>Questions</dt><dd>{report.question_count}</dd></div>
        <div><dt>Seniority band</dt><dd>{report.seniority_band}</dd></div>
      </dl>

      <section className={styles.legend} aria-label="Evidence band key">
        {Object.entries(BAND_LABEL).map(([band, label]) => <span key={band} data-band={band}>{label}</span>)}
      </section>

      <section className={styles.competencies} aria-label="Competency evidence">
        {report.competencies.map((competency) => (
          <section className={styles.competency} key={competency.competency_id}>
            <div className={styles.competencyHead}>
              <span className={styles.number}>{String(competency.rubric_order).padStart(2, '0')}</span>
              <h2>{competency.name}</h2>
              <span className={styles.band} data-band={competency.band}>{BAND_LABEL[competency.band]}</span>
            </div>
            {competency.evidence_lines.length > 0 ? (
              <ul className={styles.evidenceList}>
                {competency.evidence_lines.map((line) => (
                  <li key={line.evidence_id}>
                    <p>{line.text}</p>
                    {interactiveEvidence ? (
                      <EvidencePlayback
                        interviewId={report.interview_id}
                        evidenceId={line.evidence_id}
                        questionNumber={line.question_number}
                        timestampSeconds={line.timestamp_seconds}
                      />
                    ) : (
                      <div className={styles.staticTicket}>
                        <strong>Q{line.question_number} {formatPlaybackTime(line.timestamp_seconds)}</strong>
                        <code>{line.evidence_id}</code>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className={styles.empty}>No stored evidence line for this competency.</p>}
            {competency.followup_question && (
              <div className={styles.followup}><span>Follow-up</span><p>{competency.followup_question}</p></div>
            )}
          </section>
        ))}
      </section>

      <section className={styles.lowerGrid}>
        <div>
          <h2>Employer notes</h2>
          {report.employer_notes.length ? (
            <ol className={styles.notes}>{report.employer_notes.map((note, index) => (
              <li key={`${note.created_at}-${index}`}>
                <p>{note.text}</p>
                <small>{note.author_name} · {formatReportDateTime(note.created_at)}</small>
              </li>
            ))}</ol>
          ) : <p className={styles.empty}>No employer note has been added.</p>}
        </div>
        <div className={styles.decision}>
          <h2>Decision record</h2>
          {report.decision ? (
            <>
              <strong>{reportDecisionLabel(report.decision.outcome)}</strong>
              <p>{report.decision.decided_by_name}</p>
              <small>{formatReportDateTime(report.decision.decided_at)}</small>
            </>
          ) : <p className={styles.empty}>No decision recorded.</p>}
        </div>
      </section>

      <footer className={styles.footer}>
        This summary records evidence heard in a structured interview against the employer&apos;s rubric. It contains no overall measure or ranking. The decision above was made by the named person. Every evidence line carries a recording time and stored evidence ID. The candidate may request a copy. Generated by Muqabala, format v{report.report_format_version}.
      </footer>
    </article>
  );
}
