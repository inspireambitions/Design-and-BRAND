import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { AnswerFeedback } from '@/lib/scoring';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';
import styles from '../../EmployerDashboard.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Answer = {
  question_index: number;
  question_text: string;
  transcript: string;
  feedback: AnswerFeedback | null;
  scoring_status: 'pending' | 'scored' | 'unscored' | 'failed';
  video_path: string | null;
  video_duration_seconds: number | null;
  response_saved_at: string | null;
};

export default async function EmployerInterviewReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  const { id } = await params;
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/employer/interviews/${id}`)}`);
  const client = await createClient();
  const { data: packs } = await client!.from('screening_packs').select('id,workplace').eq('employer_id', user.id);
  const packIds = (packs ?? []).map((pack) => pack.id as string);
  if (packIds.length === 0) notFound();

  const { data: interview } = await client!.from('interviews')
    .select('id,screening_pack_id,candidate_name,role_title,language,submitted_at,consented_at,overall_score')
    .eq('id', id)
    .in('screening_pack_id', packIds)
    .not('submitted_at', 'is', null)
    .maybeSingle();
  if (!interview) notFound();
  const { data: answerRows } = await client!.from('interview_answers')
    .select('question_index,question_text,transcript,feedback,scoring_status,video_path,video_duration_seconds,response_saved_at')
    .eq('interview_id', id)
    .order('question_index');
  const answers = (answerRows ?? []) as Answer[];
  const admin = createAdminClient();
  if (!admin) throw new Error('Employer video storage is not configured.');
  const videoUrls = await Promise.all(answers.map(async (answer) => {
    if (!answer.video_path) return null;
    const { data } = await admin.storage.from('screening-videos').createSignedUrl(answer.video_path, 15 * 60);
    return data?.signedUrl ?? null;
  }));
  const workplace = (packs ?? []).find((pack) => pack.id === interview.screening_pack_id)?.workplace || 'Employer';

  return (
    <div className={styles.page}>
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
          {answers.map((answer, answerIndex) => {
            const feedback = answer.feedback;
            return (
              <article className={styles.reportCard} id={`question-${answer.question_index + 1}`} key={answer.question_index}>
                <p className={styles.eyebrow}>Question {answer.question_index + 1}</p>
                <h2>{answer.question_text}</h2>

                <p className={styles.sectionLabel}>Candidate’s recorded evidence</p>
                {videoUrls[answerIndex] ? (
                  <video className={styles.video} controls playsInline preload="metadata" src={videoUrls[answerIndex] ?? undefined}>
                    Your browser cannot play this video.
                  </video>
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
        <Link className={styles.back} href="/employer">Back to submitted interviews</Link>
      </main>
    </div>
  );
}
