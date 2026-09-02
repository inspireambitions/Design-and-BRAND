import Link from 'next/link';
import { after } from 'next/server';
import { notFound, redirect } from 'next/navigation';
import { buildReportSummary, usableReportSummary, type ReportAnswer } from '@/lib/report-summary';
import { REPORT_ANSWER_COLUMNS, refreshReportSummary } from '@/lib/server/report-summary';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';
import { CandidateReview } from '@/components/CandidateReview';
import { EmployerDeleteInterview } from '@/components/EmployerDeleteInterview';
import { employerVolumeEnabled } from '@/lib/employer-volume';
import { rankedCandidates } from '@/lib/server/employer-candidates';
import { EmployerReportVideo } from '@/components/EmployerReportVideo';
import { LoadTiming } from '@/components/LoadTiming';
import styles from '../../EmployerDashboard.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EmployerInterviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/employer/interviews/${id}`)}`);
  const client = await createClient();
  const { data: packs } = await client!.from('screening_packs').select('id,workplace').eq('employer_id', user.id);
  const packIds = (packs ?? []).map((pack) => pack.id as string);
  if (packIds.length === 0) notFound();

  // One row carries the header and, for submissions since report_summary was
  // introduced, every answer card. RLS still limits this to the employer's packs.
  const { data: interview } = await client!.from('interviews')
    .select('id,screening_pack_id,candidate_name,role_title,language,submitted_at,consented_at,report_summary,employer_reviewed_at')
    .eq('id', id)
    .in('screening_pack_id', packIds)
    .not('submitted_at', 'is', null)
    .maybeSingle();
  if (!interview) notFound();

  if (employerVolumeEnabled()) {
    // Volume flow: one candidate per screen, ranked within the role.
    const roleId = interview.screening_pack_id as string;
    const ranked = await rankedCandidates(client!, roleId);
    const index = ranked.findIndex((candidate) => candidate.interviewId === id);
    const current = ranked[index];
    if (!current) notFound();
    const nextCandidate = ranked.slice(index + 1).find((candidate) => !candidate.reviewedAt) ?? ranked[index + 1] ?? null;
    const [{ data: decisionRows }, { data: shareRows }] = await Promise.all([
      client!.from('employer_decisions').select('id,decision,note,created_at').eq('interview_id', id).order('created_at', { ascending: false }).limit(1),
      client!.from('candidate_shares').select('id,created_at,expires_at,revoked_at,response,responded_at').eq('interview_id', id).order('created_at', { ascending: false }),
    ]);
    const latest = decisionRows?.[0];
    const admin = createAdminClient();
    if (admin && !interview.employer_reviewed_at) {
      after(async () => {
        await admin.from('interviews').update({ employer_reviewed_at: new Date().toISOString() }).eq('id', id).is('employer_reviewed_at', null);
      });
    }
    return (
      <>
        <LoadTiming event="report_load_ms" />
        <CandidateReview
          interviewId={id}
          roleId={roleId}
          displayName={current.displayName}
          roleTitle={current.roleTitle}
          workplace={(packs ?? []).find((pack) => pack.id === roleId)?.workplace || 'Employer'}
          submittedAt={current.submittedAt}
          coverage={current.coverage}
          answers={current.answers}
          position={index + 1}
          total={ranked.length}
          nextId={nextCandidate?.interviewId ?? null}
          latestDecision={latest ? { id: latest.id, decision: latest.decision, note: latest.note, createdAt: latest.created_at } : null}
          shares={(shareRows ?? []).map((row) => ({
            id: row.id, createdAt: row.created_at, expiresAt: row.expires_at, revokedAt: row.revoked_at, response: row.response, respondedAt: row.responded_at,
          }))}
        />
      </>
    );
  }

  let answers: ReportAnswer[];
  const summary = usableReportSummary(interview.report_summary);
  if (summary) {
    answers = summary.answers;
  } else {
    // Older submissions, or AI notes that were still pending at submission.
    const { data: answerRows } = await client!.from('interview_answers')
      .select(REPORT_ANSWER_COLUMNS)
      .eq('interview_id', id)
      .order('question_index');
    answers = (answerRows ?? []) as unknown as ReportAnswer[];
    const admin = createAdminClient();
    if (admin && buildReportSummary(answers).scoring_settled) {
      after(async () => { await refreshReportSummary(admin, id); });
    }
  }
  const workplace = (packs ?? []).find((pack) => pack.id === interview.screening_pack_id)?.workplace || 'Employer';

  return (
    <div className={styles.page}>
      <LoadTiming event="report_load_ms" />
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>Muqabala</Link>
        <nav aria-label="Employer navigation"><Link href="/employer">All interviews</Link></nav>
      </header>
      <main className={styles.main}>
        <section className={styles.reportHeader}>
          <p className={styles.eyebrow}>Employer interview report</p>
          <h1>{interview.candidate_name || 'Candidate'}</h1>
          <div className={styles.reportMeta}>
            <span>{workplace}</span>
            <span>{interview.role_title}</span>
            <span>Submitted {new Date(interview.submitted_at).toLocaleString('en-GB')}</span>
          </div>
        </section>
        <div className={styles.notice}>
          AI-generated analysis is a screening aid, not a verified fact or an automatic decision. Review the candidate’s recorded evidence yourself.
        </div>
        <div className={styles.answers}>
          {answers.map((answer) => {
            const feedback = answer.feedback;
            return (
              <article className={styles.reportCard} id={`question-${answer.question_index + 1}`} key={answer.question_index}>
                <p className={styles.eyebrow}>Question {answer.question_index + 1}</p>
                <h2>{answer.question_text}</h2>

                <p className={styles.sectionLabel}>Candidate’s recorded evidence</p>
                {answer.video_path ? (
                  <EmployerReportVideo
                    interviewId={interview.id}
                    questionIndex={answer.question_index}
                    durationSeconds={answer.video_duration_seconds}
                    label={`question ${answer.question_index + 1}`}
                  />
                ) : (
                  <div className={styles.transcript}>The video is not available.</div>
                )}
                {answer.transcript ? (
                  <div className={styles.transcript} dir="auto">
                    {answer.transcript}
                    <small>Automatic transcript. It may contain errors. Use the recording as the source evidence.</small>
                  </div>
                ) : (
                  <div className={styles.transcript}>No reliable transcript was available. Review the video and audio directly.</div>
                )}

                <p className={styles.sectionLabel}>AI-generated analysis</p>
                {feedback?.status === 'scored' ? (
                  <div className={styles.analysis}>
                    <strong>{feedback.headline}</strong>
                    <span className={styles.score}>{feedback.score}/100</span>
                    {feedback.strengths.length > 0 && <><small>Strengths identified by AI</small><ul>{feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul></>}
                    {feedback.improvements.length > 0 && <><small>Concerns or gaps identified by AI</small><ul>{feedback.improvements.map((item) => <li key={item}>{item}</li>)}</ul></>}
                    <small>Generated from the automatic transcript. Verify every point against the recording.</small>
                  </div>
                ) : (
                  <div className={styles.analysis}>
                    {answer.scoring_status === 'pending'
                      ? 'AI analysis is still being prepared.'
                      : 'No reliable AI analysis was produced. Review the recording directly.'}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <div className={styles.reportControls}>
          <div className={styles.retentionCopy}>
            <strong>Kept for up to 90 days</strong>
            <span>Delete this interview sooner when you no longer need the recordings.</span>
          </div>
          <EmployerDeleteInterview interviewId={interview.id} />
        </div>
        <Link className={styles.back} href="/employer">Back to submitted interviews</Link>
      </main>
    </div>
  );
}
