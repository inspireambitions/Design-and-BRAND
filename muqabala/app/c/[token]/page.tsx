import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShareResponse } from '@/components/ShareResponse';
import { coverageFor } from '@/lib/employer-volume/coverage';
import { employerVolumeEnabled } from '@/lib/employer-volume';
import { usableReportSummary, type ReportAnswer } from '@/lib/report-summary';
import { REPORT_ANSWER_COLUMNS } from '@/lib/server/report-summary';
import { isOpaqueToken, tokenHash } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import styles from './share.module.css';

export const metadata: Metadata = {
  title: 'Candidate answers',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

function Closed() {
  return (
    <main className={[styles.page, 'employer-light-theme'].join(' ')}>
      <div className={styles.card}>
        <h1>This link has closed</h1>
        <p>The person who shared it has closed it, or it has expired.</p>
      </div>
    </main>
  );
}

export default async function SharedCandidatePage({ params }: { params: Promise<{ token: string }> }) {
  if (!employerVolumeEnabled()) notFound();
  const { token } = await params;
  if (!isOpaqueToken(token)) notFound();
  const admin = createAdminClient();
  if (!admin) notFound();

  const { data: share } = await admin
    .from('candidate_shares')
    .select('id,interview_id,expires_at,revoked_at,response,responded_at')
    .eq('token_hash', tokenHash(token))
    .maybeSingle();
  if (!share) notFound();
  if (share.revoked_at || new Date(share.expires_at).getTime() <= Date.now()) return <Closed />;

  const { data: interview } = await admin
    .from('interviews')
    .select('id,candidate_name,role_title,invite_id,report_summary,role_snapshot,submitted_at')
    .eq('id', share.interview_id)
    .not('submitted_at', 'is', null)
    .maybeSingle();
  if (!interview) return <Closed />;

  const summary = usableReportSummary(interview.report_summary);
  let answers: ReportAnswer[] = summary?.answers ?? [];
  if (!summary) {
    const { data: rows } = await admin.from('interview_answers').select(REPORT_ANSWER_COLUMNS).eq('interview_id', interview.id).order('question_index');
    answers = (rows ?? []) as unknown as ReportAnswer[];
  }
  let displayName = interview.candidate_name?.trim() || 'Candidate';
  if (!interview.candidate_name && interview.invite_id) {
    const { data: invite } = await admin.from('role_invites').select('candidate_ref').eq('id', interview.invite_id).maybeSingle();
    if (invite?.candidate_ref) displayName = invite.candidate_ref as string;
  }
  const snapshot = interview.role_snapshot as { competencies?: { id: string; label: string; labelAr?: string }[] } | null;
  const coverage = coverageFor(snapshot?.competencies, answers);

  // Signed playback links last 15 minutes, the same as the employer report.
  const videos = await Promise.all(answers.map(async (answer) => {
    if (!answer.video_path) return null;
    const { data } = await admin.storage.from('screening-videos').createSignedUrl(answer.video_path, 15 * 60);
    return data?.signedUrl ?? null;
  }));

  return (
    <main className={[styles.page, 'employer-light-theme'].join(' ')}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>{interview.role_title}</p>
        <h1>{displayName}</h1>
        <ul className={styles.rubric} aria-label="Rubric coverage">
          {coverage.items.map((item) => (
            <li key={item.id} className={item.covered ? styles.tick : styles.cross}>
              <span aria-hidden="true">{item.covered ? '\u2713' : '\u2717'}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
        <p className={styles.small}>Ticks show which rubric items the candidate gave evidence for. They are not a score. A person on the hiring team makes the decision.</p>

        <ol className={styles.answers}>
          {answers.map((answer, index) => (
            <li key={answer.question_index}>
              <h2>{answer.question_text}</h2>
              {videos[index] && (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video controls preload="none" playsInline src={videos[index] ?? undefined} className={styles.video} />
              )}
              <p dir="auto">{answer.transcript || 'No reliable transcript. Play the recording.'}</p>
            </li>
          ))}
        </ol>

        <ShareResponse token={token} response={share.response as 'recommend' | 'not_this_one' | null} />
      </div>
    </main>
  );
}
