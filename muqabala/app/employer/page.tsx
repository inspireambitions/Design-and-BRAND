import Link from 'next/link';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Clock,
  EnvelopeSimple,
  LinkSimple,
  Play,
  Plus,
  VideoCamera,
  Warning,
} from '@phosphor-icons/react/dist/ssr';
import { DashboardDecisionActions } from '@/components/DashboardDecisionActions';
import { EmployerLinkActions } from '@/components/EmployerLinkActions';
import { SignOutButton } from '@/components/SignOutButton';
import {
  candidatePage,
  dashboardSummary,
  employerDecisionLabel,
  normaliseEmployerDecision,
  packHealth,
  type DashboardAnswer,
  type EmployerDecisionValue,
} from '@/lib/employer-dashboard';
import { employerVolumeEnabled, whatsAppEnabled } from '@/lib/employer-volume';
import { reminderOutcome, reminderOutcomeLine } from '@/lib/employer-volume/reminders';
import { DEFAULT_MINUTES_PER_CV, actionLabel, responseRateLine, timeSavedLine } from '@/lib/employer-volume/strip';
import { loadRoleStrip } from '@/lib/server/employer-role-strip';
import { RoleCardTools } from '@/components/RoleCardTools';
import { verifyInterview } from '@/lib/interview-token';
import { configuredOrigin } from '@/lib/server/security';
import { processScreeningNotifications } from '@/lib/server/screening-notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';
import { reviewInterview, setMinutesPerCv, setRemindersEnabled } from './actions';
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
  reminders_enabled?: boolean | null;
  minutes_per_cv?: number | null;
};

type InviteRow = {
  id: string;
  role_id: string;
  status: string;
  channel: string;
  first_reminder_at: string | null;
  second_reminder_at: string | null;
  completion_reminder_at: string | null;
  submitted_at: string | null;
};

// Every submission, light columns only: drives the counts and the queue order.
type SubmissionIndex = {
  id: string;
  screening_pack_id: string;
  submitted_at: string;
  employer_reviewed_at: string | null;
  employer_decision: EmployerDecisionValue | null;
};

// One page of submissions with the columns a candidate row needs.
type Submission = SubmissionIndex & {
  candidate_name: string | null;
  role_title: string;
};

const SUBMISSION_INDEX_COLUMNS = 'id,screening_pack_id,submitted_at,employer_reviewed_at,employer_decision';
const SUBMISSION_ROW_COLUMNS = `${SUBMISSION_INDEX_COLUMNS},candidate_name,role_title`;

type Answer = DashboardAnswer & { interview_id: string };

type TechnicalAttempt = {
  id: string;
  screening_pack_id: string;
  started_at: string;
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
  full: 'Full',
  closed: 'Closed',
} as const;

function statusClass(status: keyof typeof packStatusCopy) {
  return {
    active: styles.statusActive,
    closing: styles.statusClosing,
    full: styles.statusClosed,
    closed: styles.statusClosed,
  }[status];
}

function initials(value: string | null | undefined) {
  const words = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 1) return `${words[0]?.[0] || ''}${words.at(-1)?.[0] || ''}`.toUpperCase();
  return (words[0]?.slice(0, 2) || 'HR').toUpperCase();
}

function relativeTime(value: string, now = Date.now()) {
  const elapsed = Math.max(0, now - Date.parse(value));
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function daysUntil(value: string) {
  return Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 86_400_000));
}

function formatCloseDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' });
}

function currentDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai',
  });
}

function decisionCopy(submission: SubmissionIndex) {
  return employerDecisionLabel(submission.employer_decision)
    ?? (submission.employer_reviewed_at ? 'Reviewed' : 'Waiting for review');
}

export default async function EmployerDashboardPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/employer');
  after(async () => { await processScreeningNotifications({ limit: 5 }); });

  const client = await createClient();
  const volume = employerVolumeEnabled();
  const { data: packRows } = await client!.from('screening_packs')
    .select(`id,public_code,workplace,signed_token,created_at,expires_at,max_candidates,starts_used${volume ? ',reminders_enabled,minutes_per_cv' : ''}`)
    .eq('employer_id', user.id)
    .order('created_at', { ascending: false });
  const packs = (packRows ?? []) as unknown as Pack[];
  const packIds = packs.map((pack) => pack.id);
  const { data: inviteRows } = volume && packIds.length
    ? await client!.from('role_invites')
        .select('id,role_id,status,channel,first_reminder_at,second_reminder_at,completion_reminder_at,submitted_at')
        .in('role_id', packIds)
    : { data: [] };
  const invites = (inviteRows ?? []) as InviteRow[];
  const strips = new Map<string, Awaited<ReturnType<typeof loadRoleStrip>>>();
  if (volume) {
    for (const pack of packs.slice(0, 4)) strips.set(pack.id, await loadRoleStrip(client!, pack.id));
  }
  const whatsApp = whatsAppEnabled();

  const admin = createAdminClient();
  const { data: technicalInterviewRows } = admin && packIds.length
    ? await admin.from('interviews').select('id,screening_pack_id,started_at,submitted_at').in('screening_pack_id', packIds)
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
  const interruptedInterviewIds = new Set(technicalAnswers
    .filter((answer) => Date.parse(answer.updated_at) <= staleBefore)
    .map((answer) => answer.interview_id));

  const { data: interviewRows } = packIds.length
    ? await client!.from('interviews')
        .select(SUBMISSION_INDEX_COLUMNS)
        .in('screening_pack_id', packIds)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
    : { data: [] };
  const submissions = (interviewRows ?? []) as SubmissionIndex[];
  const { page } = await searchParams;
  const paging = candidatePage(page, submissions.length);
  const { data: pageRows } = packIds.length && submissions.length
    ? await client!.from('interviews')
        .select(SUBMISSION_ROW_COLUMNS)
        .in('screening_pack_id', packIds)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
        .range(paging.from, paging.to)
    : { data: [] };
  const pageSubmissions = (pageRows ?? []) as Submission[];

  const readyToReview = submissions.filter((submission) => !submission.employer_reviewed_at);
  const queueIds = readyToReview.slice(0, 3).map((submission) => submission.id);
  const missingQueueIds = queueIds.filter((queueId) => !pageSubmissions.some((submission) => submission.id === queueId));
  const { data: queueRows } = missingQueueIds.length
    ? await client!.from('interviews').select(SUBMISSION_ROW_COLUMNS).in('id', missingQueueIds)
    : { data: [] };
  const detailRows = [...pageSubmissions, ...((queueRows ?? []) as Submission[])];
  const queue = queueIds.flatMap((queueId) => detailRows.filter((submission) => submission.id === queueId));

  // Answers are only fetched for the rows on screen, never for every submission.
  const detailIds = [...new Set(detailRows.map((submission) => submission.id))];
  const { data: answerRows } = detailIds.length
    ? await client!.from('interview_answers')
        .select('interview_id,question_index,scoring_status,video_upload_status,video_duration_seconds')
        .in('interview_id', detailIds)
        .order('question_index')
    : { data: [] };
  const answers = (answerRows ?? []) as Answer[];

  const summary = dashboardSummary(packs, submissions);
  const origin = configuredOrigin();
  const startedLastDay = technicalAttempts.filter((attempt) => Date.parse(attempt.started_at) >= Date.now() - 86_400_000).length;
  const unfinished = Math.max(0, technicalAttempts.length - submissions.length);
  const interrupted = interruptedInterviewIds.size;
  const closingWithoutCandidates = packs.find((pack) => packHealth(pack) === 'closing'
    && !submissions.some((submission) => submission.screening_pack_id === pack.id));
  const needsTodayCount = Number(Boolean(closingWithoutCandidates)) + Number(readyToReview.length > 0) + Number(interrupted > 0);
  const displayName = String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'HR');

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Muqabala home">
          <span className={styles.brandMark} aria-hidden="true"><VideoCamera weight="fill" /></span>
          <span>Muqabala</span>
          <span className={styles.workspaceName}>Evidence Desk</span>
        </Link>
        <nav aria-label="Employer navigation">
          <Link href="/for-employers" className={styles.createLink}><Plus aria-hidden="true" weight="bold" />Create interview link</Link>
          <SignOutButton className={styles.avatarButton}>{initials(displayName)}</SignOutButton>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.intro}>
          <div><h1>Your hiring, this week.</h1><p>Every role, from shared link to decision, in one glance.</p></div>
          <time>{currentDate()}</time>
        </section>

        <section className={styles.journeyCard} aria-labelledby="journey-heading">
          <div className={styles.cardHeading}><p id="journey-heading">The journey</p><span>This week · all roles</span></div>
          <div className={styles.journey}>
            <article><strong>{summary.openedLinks}</strong><h2>Opened the link</h2><p>From {packs.length} shared {packs.length === 1 ? 'link' : 'links'}</p></article>
            <ArrowRight aria-hidden="true" />
            <article><strong>{technicalAttempts.length}</strong><h2>Started answering</h2><p>{startedLastDay} in the last 24 hours</p></article>
            <ArrowRight aria-hidden="true" />
            <article className={styles.journeyAccent}><strong>{summary.submittedTotal}</strong><h2>Submitted</h2><p>{unfinished} started but did not finish</p></article>
            <ArrowRight aria-hidden="true" />
            <article><strong>{summary.reviewedTotal}</strong><h2>Reviewed by you</h2><p className={styles.attention}>{summary.waitingForReview} waiting for review</p></article>
            <ArrowRight aria-hidden="true" />
            <article><strong>{summary.shortlistedTotal}</strong><h2>Shortlisted</h2><p>{summary.notProceedingTotal} not proceeding</p></article>
          </div>
        </section>

        <div className={styles.dashboardGrid}>
          <section className={styles.panel} aria-labelledby="needs-heading">
            <div className={styles.panelHeading}><h2 id="needs-heading">What needs you today</h2><span>{needsTodayCount} {needsTodayCount === 1 ? 'item' : 'items'}</span></div>
            <div className={styles.taskList}>
              {closingWithoutCandidates && (() => {
                const role = verifyInterview(closingWithoutCandidates.signed_token)?.title || 'Work sample';
                const url = `${origin}/s/${closingWithoutCandidates.public_code}`;
                return (
                  <article className={styles.taskWarning}>
                    <Clock aria-hidden="true" /><div><strong>{role} closes {daysUntil(closingWithoutCandidates.expires_at) <= 1 ? 'tomorrow' : 'soon'}</strong><p>No candidates yet. Invite candidates before the link expires.</p></div>
                    <a href={`mailto:?subject=${encodeURIComponent(`${role} interview invitation`)}&body=${encodeURIComponent(url)}`}><EnvelopeSimple aria-hidden="true" /> Invite candidates</a>
                  </article>
                );
              })()}
              {readyToReview.length > 0 && (
                <article className={styles.taskPrimary}>
                  <VideoCamera aria-hidden="true" /><div><strong>{readyToReview.length} new {readyToReview.length === 1 ? 'interview is' : 'interviews are'} ready to review</strong><p>Oldest has been waiting {relativeTime(readyToReview[readyToReview.length - 1].submitted_at)}.</p></div>
                  <form action={reviewInterview}><input type="hidden" name="interviewId" value={readyToReview[0].id} /><button type="submit">Start reviewing</button></form>
                </article>
              )}
              {interrupted > 0 && (
                <article className={styles.taskNeutral}>
                  <Warning aria-hidden="true" /><div><strong>Upload interrupted</strong><p>{interrupted} {interrupted === 1 ? 'candidate lost' : 'candidates lost'} connection during an answer.</p></div><Link href="/for-employers">Invite to retry</Link>
                </article>
              )}
              {needsTodayCount === 0 && <div className={styles.calmState}><Check aria-hidden="true" weight="bold" /><span><strong>You are up to date</strong><small>There is nothing waiting for action.</small></span></div>}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="ready-heading">
            <div className={styles.panelHeading}><h2 id="ready-heading">Ready to review</h2><a href="#candidates">View all {readyToReview.length}</a></div>
            <div className={styles.candidateList}>
              {queue.map((submission) => {
                const pack = packs.find((item) => item.id === submission.screening_pack_id);
                const candidateAnswers = answers.filter((answer) => answer.interview_id === submission.id && answer.video_upload_status === 'uploaded');
                const duration = Math.max(1, Math.ceil(candidateAnswers.reduce((total, answer) => total + (answer.video_duration_seconds || 0), 0) / 60));
                return (
                  <article className={styles.candidateRow} key={submission.id}>
                    <span className={styles.avatar} aria-hidden="true">{initials(submission.candidate_name)}</span>
                    <div><h3>{submission.candidate_name || 'Candidate'} · {submission.role_title}</h3><p>{pack?.workplace || 'Employer'} · submitted {relativeTime(submission.submitted_at)} · {candidateAnswers.length} answers, {duration} min</p></div>
                    <form action={reviewInterview}><input type="hidden" name="interviewId" value={submission.id} /><button className={styles.watchButton} type="submit"><Play aria-hidden="true" weight="fill" /> Watch recording</button></form>
                    <DashboardDecisionActions
                      interviewId={submission.id}
                      candidateLabel={submission.candidate_name || 'candidate'}
                      currentDecision={submission.employer_decision}
                    />
                  </article>
                );
              })}
              {queue.length === 0 && <div className={styles.calmState}><Check aria-hidden="true" weight="bold" /><span><strong>No interviews are waiting</strong><small>New submissions will appear here.</small></span></div>}
            </div>
            <p className={styles.evidenceNote}>Recordings first. AI notes are a second view. You make the decision.</p>
          </section>
        </div>

        <section className={styles.rolesPanel} id="roles" aria-labelledby="roles-heading">
          <div className={styles.rolesHeading}>
            <h2 id="roles-heading">Your roles</h2>
            <div className={styles.roleFilters} aria-label="Role counts"><span className={styles.filterActive}>Active · {packs.filter((pack) => ['active', 'closing'].includes(packHealth(pack))).length}</span><span>Closed · {packs.filter((pack) => ['closed', 'full'].includes(packHealth(pack))).length}</span><span>All · {packs.length}</span></div>
          </div>
          <div className={styles.roleTable} role="table" aria-label="Employer work samples">
            <div className={styles.roleTableHead} role="row"><span role="columnheader">Role</span><span role="columnheader">Journey</span><span role="columnheader">Status</span><span role="columnheader">Closes</span><span role="columnheader">Next step</span></div>
            {packs.slice(0, 4).map((pack) => {
              const status = packHealth(pack);
              const packSubmissions = submissions.filter((submission) => submission.screening_pack_id === pack.id);
              const role = verifyInterview(pack.signed_token)?.title
                || detailRows.find((submission) => submission.screening_pack_id === pack.id)?.role_title
                || 'Role work sample';
              const shortlisted = packSubmissions.filter((submission) => normaliseEmployerDecision(submission.employer_decision) === 'shortlisted').length;
              const unreviewed = packSubmissions.filter((submission) => !submission.employer_reviewed_at).length;
              const url = `${origin}/s/${pack.public_code}`;
              const nextInterview = packSubmissions.find((item) => !item.employer_reviewed_at);
              const roleInvites = invites.filter((invite) => invite.role_id === pack.id);
              const reminders = reminderOutcome(roleInvites);
              const remindersOn = pack.reminders_enabled !== false;
              return (
                <article className={styles.roleRow} role="row" key={pack.id}>
                  <div role="cell">
                    <strong>{role}</strong><small>{pack.workplace || 'Employer'}</small>
                    {volume && (
                      <div className={styles.reminderRow}>
                        <form action={setRemindersEnabled}>
                          <input type="hidden" name="roleId" value={pack.id} />
                          <input type="hidden" name="enabled" value={remindersOn ? 'false' : 'true'} />
                          <button type="submit" role="switch" aria-checked={remindersOn} className={styles.reminderToggle}>
                            <span aria-hidden="true" />Reminders {remindersOn ? 'on' : 'off'}
                          </button>
                        </form>
                        {reminders.reminded > 0 && <small>{reminderOutcomeLine(reminders)}</small>}
                      </div>
                    )}
                    {volume && strips.get(pack.id) && (() => {
                      const { strip, invites: roleInvitesForRate } = strips.get(pack.id)!;
                      const minutes = typeof pack.minutes_per_cv === 'number' ? pack.minutes_per_cv : DEFAULT_MINUTES_PER_CV;
                      return (
                        <div className={styles.strip}>
                          <dl className={styles.stripNumbers}>
                            {([['Invited', strip.invited], ['Answered', strip.answered], ['Full coverage', strip.fullCoverage], ['Shortlisted', strip.shortlisted], ['Decided', strip.decided]] as const).map(([label, value]) => (
                              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                            ))}
                          </dl>
                          {strip.unreviewed > 0 && nextInterview
                            ? <form action={reviewInterview}><input type="hidden" name="interviewId" value={nextInterview.id} /><button type="submit" className={styles.stripAction}>{actionLabel(strip)}</button></form>
                            : <Link href={`/employer/roles/${pack.id}/candidates/add`} className={styles.stripAction}>{actionLabel(strip)}</Link>}
                          <form action={setMinutesPerCv} className={styles.timeSaved}>
                            <span>{timeSavedLine(strip, minutes)}</span>
                            <input type="hidden" name="roleId" value={pack.id} />
                            <label>
                              <span>at</span>
                              <input type="number" name="minutes" min={0} max={120} defaultValue={minutes} aria-label="Minutes per CV" />
                              <span>min per CV</span>
                            </label>
                            <button type="submit">Save</button>
                          </form>
                          {whatsApp && <small>{responseRateLine(roleInvitesForRate)}</small>}
                          <RoleCardTools roleId={pack.id} roleTitle={role} />
                        </div>
                      );
                    })()}
                  </div>
                  <div role="cell" className={styles.roleJourney}><progress max={Math.max(1, pack.starts_used)} value={packSubmissions.length} aria-label={`${packSubmissions.length} of ${pack.starts_used} started interviews submitted`} /><small>{pack.starts_used} started · {packSubmissions.length} submitted{shortlisted ? ` · ${shortlisted} shortlisted` : ''}</small></div>
                  <div role="cell"><span className={`${styles.packStatus} ${statusClass(status)}`}>{packStatusCopy[status]}</span></div>
                  <div role="cell" className={status === 'closing' ? styles.closingDate : undefined}>{status === 'closing' && daysUntil(pack.expires_at) <= 1 ? 'Tomorrow' : formatCloseDate(pack.expires_at)}</div>
                  <div role="cell" className={styles.roleActions}>
                    {unreviewed > 0 && nextInterview ? (
                      <form action={reviewInterview}><input type="hidden" name="interviewId" value={nextInterview.id} /><button type="submit">Review {unreviewed} new</button></form>
                    ) : ['active', 'closing'].includes(status) && packSubmissions.length === 0 ? (
                      volume
                        ? <Link href={`/employer/roles/${pack.id}/candidates/add`}><EnvelopeSimple aria-hidden="true" /> Add candidates</Link>
                        : <><a href={`mailto:?subject=${encodeURIComponent(`${role} interview invitation`)}&body=${encodeURIComponent(url)}`}><EnvelopeSimple aria-hidden="true" /> Invite candidates</a><EmployerLinkActions url={url} /></>
                    ) : packSubmissions.length > 0 ? <span className={styles.allReviewed}>All reviewed</span> : <span className={styles.allReviewed}>Link closed</span>}
                    {volume && ['active', 'closing'].includes(status) && packSubmissions.length > 0 && (
                      <Link href={`/employer/roles/${pack.id}/candidates/add`}>Add candidates</Link>
                    )}
                  </div>
                </article>
              );
            })}
            {packs.length === 0 && <div className={styles.emptyRoles}><LinkSimple aria-hidden="true" /><span><strong>No roles yet</strong><small>Create your first interview link to begin.</small></span><Link href="/for-employers">Create interview link</Link></div>}
          </div>
          {packs.length > 4 && <p className={styles.moreRoles}>{packs.length - 4} more {packs.length - 4 === 1 ? 'role' : 'roles'} <a href="#roles">Show all</a></p>}
        </section>

        <section className={styles.rolesPanel} id="candidates" aria-labelledby="candidates-heading">
          <div className={styles.rolesHeading}>
            <h2 id="candidates-heading">All candidates</h2>
            <div className={styles.roleFilters} aria-label="Candidate counts">
              <span className={styles.filterActive}>Submitted · {submissions.length}</span>
              <span>Waiting · {readyToReview.length}</span>
              {paging.lastPage && paging.lastPage > 1 && <span>Page {paging.page} of {paging.lastPage}</span>}
            </div>
          </div>
          <div className={styles.candidateList}>
            {pageSubmissions.map((submission) => {
              const pack = packs.find((item) => item.id === submission.screening_pack_id);
              const candidateAnswers = answers.filter((answer) => answer.interview_id === submission.id && answer.video_upload_status === 'uploaded');
              const duration = Math.max(1, Math.ceil(candidateAnswers.reduce((total, answer) => total + (answer.video_duration_seconds || 0), 0) / 60));
              return (
                <article className={styles.candidateRow} key={submission.id}>
                  <span className={styles.avatar} aria-hidden="true">{initials(submission.candidate_name)}</span>
                  <div>
                    <h3>{submission.candidate_name || 'Candidate'} · {submission.role_title}</h3>
                    <p>{pack?.workplace || 'Employer'} · submitted {relativeTime(submission.submitted_at)} · {candidateAnswers.length} answers, {duration} min · {decisionCopy(submission)}</p>
                  </div>
                  {submission.employer_reviewed_at
                    ? <Link className={styles.watchButton} href={`/employer/candidates/${submission.id}/evaluation`}>View evaluation</Link>
                    : <form action={reviewInterview}><input type="hidden" name="interviewId" value={submission.id} /><button className={styles.watchButton} type="submit"><Play aria-hidden="true" weight="fill" /> Watch recording</button></form>}
                  <DashboardDecisionActions
                    interviewId={submission.id}
                    candidateLabel={submission.candidate_name || 'candidate'}
                    currentDecision={submission.employer_decision}
                  />
                </article>
              );
            })}
            {pageSubmissions.length === 0 && <div className={styles.calmState}><Check aria-hidden="true" weight="bold" /><span><strong>No submitted interviews yet</strong><small>Candidates appear here once they submit and consent.</small></span></div>}
          </div>
          {(paging.hasPrevious || paging.hasNext) && (
            <nav className={styles.pagination} aria-label="Candidate pages">
              {paging.hasPrevious ? <Link href={`/employer?page=${paging.page - 1}#candidates`}>Newer</Link> : <span aria-disabled="true">Newer</span>}
              <span>Page {paging.page} of {paging.lastPage}</span>
              {paging.hasNext ? <Link href={`/employer?page=${paging.page + 1}#candidates`}>Older</Link> : <span aria-disabled="true">Older</span>}
            </nav>
          )}
        </section>
      </main>
    </div>
  );
}
