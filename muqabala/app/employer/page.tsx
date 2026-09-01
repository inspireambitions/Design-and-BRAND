import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle,
  ClockCountdown,
  LinkSimple,
  PlayCircle,
  Plus,
  UsersThree,
  VideoCamera,
} from '@phosphor-icons/react/dist/ssr';
import { EmployerLinkActions } from '@/components/EmployerLinkActions';
import { SignOutButton } from '@/components/SignOutButton';
import {
  candidateEvidence,
  dashboardSummary,
  formatDuration,
  packHealth,
  type DashboardAnswer,
} from '@/lib/employer-dashboard';
import { verifyInterview } from '@/lib/interview-token';
import { configuredOrigin } from '@/lib/server/security';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';
import styles from './EmployerDashboard.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Pack = {
  id: string;
  public_code: string;
  workplace: string;
  signed_token: string;
  created_at: string;
  expires_at: string;
  max_candidates: number;
  starts_used: number;
};

type Submission = {
  id: string;
  screening_pack_id: string;
  candidate_name: string | null;
  role_title: string;
  submitted_at: string;
};

type Answer = DashboardAnswer & {
  interview_id: string;
};

type TechnicalAttempt = {
  id: string;
  screening_pack_id: string;
  submitted_at: string | null;
};

type TechnicalAnswer = {
  interview_id: string;
  video_upload_status: string;
  updated_at: string;
};

const packStatusCopy = {
  active: 'Active',
  closing: 'Closing soon',
  full: 'All places used',
  closed: 'Closed',
} as const;

function statusClass(status: keyof typeof packStatusCopy) {
  return {
    active: styles.statusActive,
    closing: styles.statusClosing,
    full: styles.statusFull,
    closed: styles.statusClosed,
  }[status];
}

function firstName(value: string | null) {
  const name = value?.trim();
  return name ? name.split(/\s+/)[0] : 'Candidate';
}

export default async function EmployerDashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/employer');

  const client = await createClient();
  const { data: packRows } = await client!.from('screening_packs')
    .select('id,public_code,workplace,signed_token,created_at,expires_at,max_candidates,starts_used')
    .eq('employer_id', user.id)
    .order('created_at', { ascending: false });
  const packs = (packRows ?? []) as Pack[];
  const packIds = packs.map((pack) => pack.id);

  const admin = createAdminClient();
  const { data: technicalInterviewRows } = admin && packIds.length
    ? await admin.from('interviews')
        .select('id,screening_pack_id,submitted_at')
        .in('screening_pack_id', packIds)
    : { data: [] };
  const technicalAttempts = (technicalInterviewRows ?? []) as TechnicalAttempt[];
  const incompleteIds = technicalAttempts.filter((attempt) => !attempt.submitted_at).map((attempt) => attempt.id);
  const { data: technicalAnswerRows } = admin && incompleteIds.length
    ? await admin.from('interview_answers')
        .select('interview_id,video_upload_status,updated_at')
        .in('interview_id', incompleteIds)
        .eq('video_upload_status', 'pending')
    : { data: [] };
  const technicalAnswers = (technicalAnswerRows ?? []) as TechnicalAnswer[];
  const staleBefore = Date.now() - 10 * 60 * 1_000;
  const interruptedInterviewIds = new Set(
    technicalAnswers
      .filter((answer) => Date.parse(answer.updated_at) <= staleBefore)
      .map((answer) => answer.interview_id),
  );

  const { data: interviewRows } = packIds.length
    ? await client!.from('interviews')
        .select('id,screening_pack_id,candidate_name,role_title,submitted_at')
        .in('screening_pack_id', packIds)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
    : { data: [] };
  const submissions = (interviewRows ?? []) as Submission[];
  const submissionIds = submissions.map((submission) => submission.id);

  const { data: answerRows } = submissionIds.length
    ? await client!.from('interview_answers')
        .select('interview_id,question_index,scoring_status,video_upload_status,video_duration_seconds')
        .in('interview_id', submissionIds)
        .order('question_index')
    : { data: [] };
  const answers = (answerRows ?? []) as Answer[];
  const summary = dashboardSummary(packs, submissions);
  const origin = configuredOrigin();
  const latestSubmissions = submissions.slice(0, 6);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Muqabala home">
          <span className={styles.brandMark} aria-hidden="true">م</span>
          <span>Muqabala</span>
          <span className={styles.workspaceName}>Evidence Desk</span>
        </Link>
        <nav aria-label="Employer navigation">
          <Link href="/for-employers" className={styles.createLink}>
            <Plus aria-hidden="true" weight="bold" />
            Create work sample
          </Link>
          <SignOutButton />
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Employer dashboard</p>
          <h1>Review real answers.</h1>
          <p>Start with the recordings. Use AI notes as a second view. You make the decision.</p>
        </section>

        <section className={styles.pulse} aria-label="Hiring pulse">
          <article>
            <span><VideoCamera aria-hidden="true" />Recent submissions</span>
            <strong>{summary.submittedThisWeek}</strong>
            <small>Ready in the last seven days</small>
          </article>
          <article>
            <span><LinkSimple aria-hidden="true" />Active work samples</span>
            <strong>{summary.activeLinks}</strong>
            <small>Still accepting candidates</small>
          </article>
          <article>
            <span><UsersThree aria-hidden="true" />Places remaining</span>
            <strong>{summary.placesRemaining}</strong>
            <small>Across active links</small>
          </article>
          <article>
            <span><CheckCircle aria-hidden="true" />Completion rate</span>
            <strong>{summary.submissionRate}%</strong>
            <small>Started interviews submitted</small>
          </article>
        </section>

        <Link href="/for-employers" className={styles.mobileCreate}>
          <Plus aria-hidden="true" weight="bold" /> Create work sample
        </Link>

        <section className={styles.section} aria-labelledby="latest-submissions">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>Candidate evidence</p>
              <h2 id="latest-submissions">Latest submissions</h2>
            </div>
            <p>Three answers. One clear place to review them.</p>
          </div>

          {latestSubmissions.length === 0 ? (
            <div className={styles.emptyState}>
              <VideoCamera aria-hidden="true" />
              <div>
                <h3>No submitted interviews yet</h3>
                <p>When a candidate submits with consent, their recordings will appear here.</p>
              </div>
              <Link href="/for-employers">Create a work sample <ArrowRight aria-hidden="true" /></Link>
            </div>
          ) : (
            <div className={styles.reviewQueue}>
              {latestSubmissions.map((submission) => {
                const pack = packs.find((item) => item.id === submission.screening_pack_id);
                const evidence = candidateEvidence(answers.filter((answer) => answer.interview_id === submission.id));
                const candidate = firstName(submission.candidate_name);
                return (
                  <article className={styles.candidateCard} key={submission.id}>
                    <div className={styles.candidateIdentity}>
                      <span className={styles.avatar} aria-hidden="true">{candidate.slice(0, 1).toUpperCase()}</span>
                      <div>
                        <h3>{candidate}</h3>
                        <p>{submission.role_title} · {pack?.workplace || 'Employer'}</p>
                        <small>Submitted {new Date(submission.submitted_at).toLocaleString('en-GB')}</small>
                      </div>
                    </div>

                    <div className={styles.evidenceStrip} aria-label={`${evidence.recordingsReady} of 3 recorded answers ready`}>
                      {[0, 1, 2].map((questionIndex) => {
                        const answer = evidence.answers.find((item) => item.question_index === questionIndex);
                        const isReady = answer?.video_upload_status === 'uploaded';
                        return (
                          <span className={isReady ? styles.evidenceReady : styles.evidenceMissing} key={questionIndex}>
                            {isReady ? <PlayCircle aria-hidden="true" weight="fill" /> : <ClockCountdown aria-hidden="true" />}
                            Q{questionIndex + 1}
                            <small>{isReady ? formatDuration(answer.video_duration_seconds) : 'Missing'}</small>
                          </span>
                        );
                      })}
                    </div>

                    <div className={styles.analysisStatus}>
                      <span className={evidence.notesReady === 3 ? styles.analysisReady : styles.analysisWaiting}>
                        {evidence.notesReady === 3 ? 'AI notes ready' : evidence.notesPending ? 'AI notes processing' : 'AI notes incomplete'}
                      </span>
                      <small>Check every note against the recording.</small>
                    </div>

                    <Link className={styles.candidateAction} href={`/employer/interviews/${submission.id}`}>
                      Review evidence <ArrowRight aria-hidden="true" />
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.section} aria-labelledby="work-samples">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>Link health</p>
              <h2 id="work-samples">Your work samples</h2>
            </div>
            <p>See what is active, filling up or closing soon.</p>
          </div>

          {packs.length === 0 ? (
            <div className={styles.emptyState}>
              <LinkSimple aria-hidden="true" />
              <div>
                <h3>No work samples yet</h3>
                <p>Create one secure link and send it to the candidates you choose.</p>
              </div>
              <Link href="/for-employers">Create a work sample <ArrowRight aria-hidden="true" /></Link>
            </div>
          ) : (
            <div className={styles.packGrid}>
              {packs.map((pack) => {
                const status = packHealth(pack);
                const packSubmissions = submissions.filter((item) => item.screening_pack_id === pack.id);
                const verified = verifyInterview(pack.signed_token);
                const roleTitle = verified?.title || packSubmissions[0]?.role_title || 'Role work sample';
                const completionRate = pack.starts_used > 0 ? Math.round((packSubmissions.length / pack.starts_used) * 100) : 0;
                const interrupted = technicalAttempts.filter(
                  (attempt) => attempt.screening_pack_id === pack.id && interruptedInterviewIds.has(attempt.id),
                ).length;
                const url = `${origin}/s/${pack.public_code}`;
                return (
                  <article className={styles.packCard} key={pack.id}>
                    <div className={styles.packTitle}>
                      <div>
                        <h3>{roleTitle}</h3>
                        <p>{pack.workplace || 'Employer work sample'}</p>
                      </div>
                      <span className={`${styles.packStatus} ${statusClass(status)}`}>{packStatusCopy[status]}</span>
                    </div>
                    <dl className={styles.packFacts}>
                      <div><dt>Started</dt><dd>{pack.starts_used}</dd></div>
                      <div><dt>Submitted</dt><dd>{packSubmissions.length}</dd></div>
                      <div><dt>Upload interrupted</dt><dd>{interrupted}</dd></div>
                      <div><dt>Completion</dt><dd>{completionRate}%</dd></div>
                    </dl>
                    <p className={styles.expiry}>
                      <ClockCountdown aria-hidden="true" />
                      {status === 'closed'
                        ? `Closed ${new Date(pack.expires_at).toLocaleDateString('en-GB')}`
                        : `Closes ${new Date(pack.expires_at).toLocaleDateString('en-GB')}`}
                    </p>
                    {status === 'closed' || status === 'full' ? (
                      <p className={styles.closedNote}>This link no longer accepts new candidates.</p>
                    ) : (
                      <EmployerLinkActions url={url} />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
