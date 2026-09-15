import Link from 'next/link';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Check,
  LinkSimple,
  Play,
  Plus,
  VideoCamera,
} from '@phosphor-icons/react/dist/ssr';
import { DashboardDecisionActions } from '@/components/DashboardDecisionActions';
import { AttentionBriefing } from '@/components/AttentionBriefing';
import { EmployerReviewPanelProvider, EmployerReviewTrigger } from '@/components/EmployerCandidatePanel';
import { SignOutButton } from '@/components/SignOutButton';
import {
  candidatePage,
  dashboardSummary,
  dashboardRolePage,
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
import { RoleNextActionControl } from '@/components/RoleNextActionControl';
import { verifyInterview } from '@/lib/interview-token';
import { configuredOrigin } from '@/lib/server/security';
import { buildAttentionItems, filterCandidateSubmissions, resolveRoleNextAction } from '@/lib/recruiter-suite';
import { processScreeningNotifications } from '@/lib/server/screening-notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, currentUser } from '@/lib/supabase/server';
import { setMinutesPerCv, setRemindersEnabled } from './actions';
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
  timezone?: string | null;
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

export default async function EmployerDashboardPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; roles?: string | string[]; rolePage?: string | string[]; candidateStatus?: string | string[] }> }) {
  const user = await currentUser();
  if (!user) redirect('/sign-in?next=/employer');
  after(async () => { await processScreeningNotifications({ limit: 5 }); });

  const client = await createClient();
  const volume = employerVolumeEnabled();
  const { data: packRows, error: packError } = await client!.from('screening_packs')
    .select(`id,public_code,workplace,signed_token,created_at,expires_at,max_candidates,starts_used,timezone${volume ? ',reminders_enabled,minutes_per_cv' : ''}`)
    .eq('employer_id', user.id)
    .order('created_at', { ascending: false });
  const packs = (packRows ?? []) as unknown as Pack[];
  const { page, roles, rolePage, candidateStatus } = await searchParams;
  const requestedCandidateStatus = Array.isArray(candidateStatus) ? candidateStatus[0] : candidateStatus;
  const candidateFilter = requestedCandidateStatus === 'unreviewed' || requestedCandidateStatus === 'shortlisted' ? requestedCandidateStatus : 'all';
  const roleList = dashboardRolePage(packs, roles, rolePage);
  const packIds = packs.map((pack) => pack.id);
  const { data: inviteRows, error: inviteError } = volume && packIds.length
    ? await client!.from('role_invites')
        .select('id,role_id,status,channel,first_reminder_at,second_reminder_at,completion_reminder_at,submitted_at')
        .in('role_id', packIds)
    : { data: [], error: null };
  const invites = (inviteRows ?? []) as InviteRow[];
  const strips = new Map<string, Awaited<ReturnType<typeof loadRoleStrip>>>();
  if (volume) {
    for (const pack of roleList.rows) strips.set(pack.id, await loadRoleStrip(client!, pack.id));
  }
  const whatsApp = whatsAppEnabled();

  const admin = createAdminClient();
  const { data: technicalInterviewRows } = admin && packIds.length
    ? await admin.from('interviews').select('id,screening_pack_id,started_at,submitted_at').in('screening_pack_id', packIds)
    : { data: [] };
  const technicalAttempts = (technicalInterviewRows ?? []) as TechnicalAttempt[];
  const incompleteIds = technicalAttempts.filter((attempt) => !attempt.submitted_at).map((attempt) => attempt.id);
  const { data: technicalAnswerRows, error: technicalAnswerError } = admin && incompleteIds.length
    ? await admin.from('interview_answers')
        .select('interview_id,video_upload_status,updated_at')
        .in('interview_id', incompleteIds)
        .eq('video_upload_status', 'pending')
    : { data: [], error: null };
  const technicalAnswers = (technicalAnswerRows ?? []) as TechnicalAnswer[];
  const staleBefore = Date.now() - 10 * 60 * 1_000;
  const interruptedInterviewIds = new Set(technicalAnswers
    .filter((answer) => Date.parse(answer.updated_at) <= staleBefore)
    .map((answer) => answer.interview_id));
  const { data: interviewRows, error: interviewError } = packIds.length
    ? await client!.from('interviews')
        .select(SUBMISSION_INDEX_COLUMNS)
        .in('screening_pack_id', packIds)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
    : { data: [], error: null };
  const submissions = (interviewRows ?? []) as SubmissionIndex[];
  const candidateSubmissions = filterCandidateSubmissions(submissions, candidateFilter);
  const paging = candidatePage(page, candidateSubmissions.length);
  const dashboardUrl = (candidatePageNumber: number, roleFilter = roleList.filter, rolePageNumber = roleList.paging.page, anchor = 'roles') =>
    `/employer?page=${candidatePageNumber}&roles=${roleFilter}&rolePage=${rolePageNumber}${candidateFilter !== 'all' ? `&candidateStatus=${candidateFilter}` : ''}#${anchor}`;
  const pageIds = candidateSubmissions.slice(paging.from, paging.to + 1).map((submission) => submission.id);
  const { data: pageRows } = packIds.length && pageIds.length
    ? await client!.from('interviews')
        .select(SUBMISSION_ROW_COLUMNS)
        .in('id', pageIds)
        .not('submitted_at', 'is', null)
        .order('submitted_at', { ascending: false })
    : { data: [] };
  const loadedPageRows = (pageRows ?? []) as Submission[];
  const pageSubmissions = pageIds.flatMap((id) => loadedPageRows.filter((submission) => submission.id === id));

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
  const { data: candidateQuestionRows, error: candidateQuestionError } = packIds.length
    ? await client!.from('candidate_role_questions').select('id,role_id').in('role_id', packIds).is('resolved_at', null)
    : { data: [], error: null };
  const attention = buildAttentionItems({
    pendingSubmissions: readyToReview.length,
    unresolvedQuestions: candidateQuestionRows?.length ?? 0,
    interruptedUploads: interruptedInterviewIds.size,
    closingRoles: packs.map((pack) => ({
      id: pack.id,
      title: verifyInterview(pack.signed_token)?.title || 'Role work sample',
      expiresAt: pack.expires_at,
      timezone: pack.timezone || 'Asia/Dubai',
    })),
  });
  const attentionFailed = Boolean(packError || interviewError || technicalAnswerError || candidateQuestionError || inviteError);
  const dashboardCoreFailed = Boolean(packError || interviewError);
  const startedLastDay = technicalAttempts.filter((attempt) => Date.parse(attempt.started_at) >= Date.now() - 86_400_000).length;
  const unfinished = Math.max(0, technicalAttempts.length - submissions.length);
  const displayName = String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'HR');

  return (
    <EmployerReviewPanelProvider>
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
          <div><h1>Your hiring overview.</h1><p>Every role, from shared link to decision, in one glance.</p></div>
          <time>{currentDate()}</time>
        </section>

        {!dashboardCoreFailed && <section className={styles.journeyCard} aria-labelledby="journey-heading">
          <div className={styles.cardHeading}><p id="journey-heading">The journey</p><span>All time · all roles</span></div>
          <div className={styles.journey}>
            <article><strong>{technicalAttempts.length}</strong><h2>Started answering</h2><p>{startedLastDay} in the last 24 hours</p></article>
            <ArrowRight aria-hidden="true" />
            <article className={styles.journeyAccent}><strong>{summary.submittedTotal}</strong><h2>Submitted</h2><p>{unfinished} started but did not finish</p></article>
            <ArrowRight aria-hidden="true" />
            <article><strong>{summary.reviewedTotal}</strong><h2>Reviewed by you</h2><p className={styles.attention}>{summary.waitingForReview} waiting for review</p></article>
            <ArrowRight aria-hidden="true" />
            <article><strong>{summary.shortlistedTotal}</strong><h2>Shortlisted</h2><p>{summary.notProceedingTotal} not proceeding</p></article>
          </div>
        </section>}

        <AttentionBriefing items={attention.items} total={attention.total} failed={attentionFailed} />

        {!dashboardCoreFailed && <>
        <div className={styles.dashboardGrid}>
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
                    <EmployerReviewTrigger interviewId={submission.id} candidateLabel={submission.candidate_name || 'candidate'} className={styles.watchButton}><Play aria-hidden="true" weight="fill" /> Watch recording</EmployerReviewTrigger>
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
            <nav className={styles.roleFilters} aria-label="Filter roles">
              {(['active', 'closed', 'all'] as const).map((filter) => <Link key={filter} href={dashboardUrl(paging.page, filter, 1)} aria-current={roleList.filter === filter ? 'page' : undefined} className={roleList.filter === filter ? styles.filterActive : undefined}>{filter === 'active' ? 'Active' : filter === 'closed' ? 'Closed or full' : 'All'} · {roleList.counts[filter]}</Link>)}
            </nav>
          </div>
          <div className={styles.roleTable} role="table" aria-label="Employer work samples">
            <div className={styles.roleTableHead} role="row"><span role="columnheader">Role</span><span role="columnheader">Journey</span><span role="columnheader">Status</span><span role="columnheader">Closes</span><span role="columnheader">Next step</span></div>
            {roleList.rows.map((pack) => {
              const status = packHealth(pack);
              const packSubmissions = submissions.filter((submission) => submission.screening_pack_id === pack.id);
              const role = verifyInterview(pack.signed_token)?.title
                || detailRows.find((submission) => submission.screening_pack_id === pack.id)?.role_title
                || 'Role work sample';
              const shortlisted = packSubmissions.filter((submission) => normaliseEmployerDecision(submission.employer_decision) === 'shortlisted').length;
              const packAttempts = technicalAttempts.filter((attempt) => attempt.screening_pack_id === pack.id).length;
              const unreviewed = packSubmissions.filter((submission) => !submission.employer_reviewed_at).length;
              const url = `${origin}/s/${pack.public_code}`;
              const nextInterview = packSubmissions.find((item) => !item.employer_reviewed_at);
              const roleInvites = invites.filter((invite) => invite.role_id === pack.id);
              const reminders = reminderOutcome(roleInvites);
              const remindersOn = pack.reminders_enabled !== false;
              const nextAction = resolveRoleNextAction({ roleId: pack.id, state: status, submissionCount: packSubmissions.length, unreviewedCount: unreviewed, shortlistCount: shortlisted });
              return (
                <article className={styles.roleRow} role="row" key={pack.id}>
                  <div role="cell">
                    <strong><Link href={`/employer/roles/${pack.id}`}>{role}</Link></strong><small>{pack.workplace || 'Employer'}</small>
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
                            ? <EmployerReviewTrigger interviewId={nextInterview.id} candidateLabel={detailRows.find((item) => item.id === nextInterview.id)?.candidate_name || 'candidate'} className={styles.stripAction}>{actionLabel(strip)}</EmployerReviewTrigger>
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
                  <div role="cell" className={styles.roleJourney}><progress max={Math.max(1, packAttempts)} value={packSubmissions.length} aria-label={`${packSubmissions.length} of ${packAttempts} started interviews submitted`} /><small>{packAttempts} started · {packSubmissions.length} submitted{shortlisted ? ` · ${shortlisted} shortlisted` : ''}</small></div>
                  <div role="cell"><span className={`${styles.packStatus} ${statusClass(status)}`}>{packStatusCopy[status]}</span></div>
                  <div role="cell" className={status === 'closing' ? styles.closingDate : undefined}>{status === 'closing' && daysUntil(pack.expires_at) <= 1 ? 'Tomorrow' : formatCloseDate(pack.expires_at)}</div>
                  <div role="cell" className={styles.roleActions}>
                    <RoleNextActionControl action={nextAction} invitationUrl={url} className={styles.roleReviewButton} />
                    <small>{nextAction.supportingText}</small>
                    {volume && ['active', 'closing'].includes(status) && packSubmissions.length > 0 && (
                      <Link href={`/employer/roles/${pack.id}/candidates/add`}>Add candidates</Link>
                    )}
                  </div>
                </article>
              );
            })}
            {packs.length === 0 && <div className={styles.emptyRoles}><LinkSimple aria-hidden="true" /><span><strong>No roles yet</strong><small>Create your first interview link to begin.</small></span><Link href="/for-employers">Create interview link</Link></div>}
            {packs.length > 0 && roleList.total === 0 && <p className={styles.moreRoles}>No roles match this filter. <Link href={dashboardUrl(paging.page, 'all', 1)}>View all roles</Link></p>}
          </div>
          {roleList.paging.lastPage && roleList.paging.lastPage > 1 && <nav className={styles.moreRoles} aria-label="Role pages">
            {roleList.paging.hasPrevious && <Link href={dashboardUrl(paging.page, roleList.filter, roleList.paging.page - 1)}>Previous roles</Link>}
            {' '}Page {roleList.paging.page} of {roleList.paging.lastPage}{' '}
            {roleList.paging.hasNext && <Link href={dashboardUrl(paging.page, roleList.filter, roleList.paging.page + 1)}>Next roles</Link>}
          </nav>}
        </section>

        <section className={styles.rolesPanel} id="candidates" aria-labelledby="candidates-heading">
          <div className={styles.rolesHeading}>
            <h2 id="candidates-heading">Candidate submissions</h2>
            <nav className={styles.roleFilters} aria-label="Filter candidate submissions">
              <Link href="/employer#candidates" aria-current={candidateFilter === 'all' ? 'page' : undefined} className={candidateFilter === 'all' ? styles.filterActive : undefined}>All · {submissions.length}</Link>
              <Link href="/employer?candidateStatus=unreviewed#candidates" aria-current={candidateFilter === 'unreviewed' ? 'page' : undefined} className={candidateFilter === 'unreviewed' ? styles.filterActive : undefined}>Awaiting review · {readyToReview.length}</Link>
              <Link href="/employer?candidateStatus=shortlisted#candidates" aria-current={candidateFilter === 'shortlisted' ? 'page' : undefined} className={candidateFilter === 'shortlisted' ? styles.filterActive : undefined}>Shortlisted · {summary.shortlistedTotal}</Link>
              {paging.lastPage && paging.lastPage > 1 && <span>Page {paging.page} of {paging.lastPage}</span>}
            </nav>
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
                  <EmployerReviewTrigger interviewId={submission.id} candidateLabel={submission.candidate_name || 'candidate'} className={styles.watchButton}>
                    {!submission.employer_reviewed_at ? <><Play aria-hidden="true" weight="fill" /> Watch recording</> : undefined}
                  </EmployerReviewTrigger>
                  <DashboardDecisionActions
                    interviewId={submission.id}
                    candidateLabel={submission.candidate_name || 'candidate'}
                    currentDecision={submission.employer_decision}
                  />
                </article>
              );
            })}
            {pageSubmissions.length === 0 && <div className={styles.calmState}><Check aria-hidden="true" weight="bold" /><span><strong>No submissions match this filter</strong><small>Candidates appear here only after they submit and consent.</small></span></div>}
          </div>
          {(paging.hasPrevious || paging.hasNext) && (
            <nav className={styles.pagination} aria-label="Candidate pages">
              {paging.hasPrevious ? <Link href={dashboardUrl(paging.page - 1, roleList.filter, roleList.paging.page, 'candidates')}>Newer</Link> : <span aria-disabled="true">Newer</span>}
              <span>Page {paging.page} of {paging.lastPage}</span>
              {paging.hasNext ? <Link href={dashboardUrl(paging.page + 1, roleList.filter, roleList.paging.page, 'candidates')}>Older</Link> : <span aria-disabled="true">Older</span>}
            </nav>
          )}
        </section>
        </>}
      </main>
    </div>
    </EmployerReviewPanelProvider>
  );
}
