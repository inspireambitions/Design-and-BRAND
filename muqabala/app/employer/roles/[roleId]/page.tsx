import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DashboardDecisionActions } from '@/components/DashboardDecisionActions';
import { EmployerReviewPanelProvider, EmployerReviewTrigger } from '@/components/EmployerCandidatePanel';
import { RecruiterQuestions, type RecruiterQuestionRow } from '@/components/RecruiterQuestions';
import { ReminderPreview } from '@/components/ReminderPreview';
import { RoleDeadlineEditor } from '@/components/RoleDeadlineEditor';
import { RoleHelpPanel } from '@/components/RoleHelpPanel';
import { RoleNextActionControl } from '@/components/RoleNextActionControl';
import { packHealth } from '@/lib/employer-dashboard';
import { verifyStoredInterview } from '@/lib/interview-token';
import { pageCount, pageRange, positivePage } from '@/lib/pagination';
import { resolveAvailableRoleNextAction } from '@/lib/recruiter-suite';
import { configuredOrigin } from '@/lib/server/security';
import { createClient, currentUser } from '@/lib/supabase/server';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Submission = { id: string; candidate_name: string | null; role_title: string; submitted_at: string; employer_reviewed_at: string | null; employer_decision: string | null };
type RoleSearch = { candidateStatus?: string | string[]; candidatePage?: string | string[]; questionPage?: string | string[] };

const SUBMISSION_PAGE_SIZE = 50;
const QUESTION_PAGE_SIZE = 100;

function rolePageUrl(roleId: string, input: { candidateStatus?: 'unreviewed' | 'shortlisted'; candidatePage?: number; questionPage?: number }, anchor: string) {
  const params = new URLSearchParams();
  if (input.candidateStatus) params.set('candidateStatus', input.candidateStatus);
  if ((input.candidatePage ?? 1) > 1) params.set('candidatePage', String(input.candidatePage));
  if ((input.questionPage ?? 1) > 1) params.set('questionPage', String(input.questionPage));
  const query = params.toString();
  return `/employer/roles/${roleId}${query ? `?${query}` : ''}#${anchor}`;
}

function RetryState({ children }: { children: React.ReactNode }) {
  return <div className={styles.error} role="alert"><p>{children}</p><Link href="">Retry</Link></div>;
}

export default async function EmployerRolePage({ params, searchParams }: { params: Promise<{ roleId: string }>; searchParams: Promise<RoleSearch> }) {
  const employer = await currentUser();
  const { roleId } = await params;
  if (!employer) redirect(`/sign-in?next=${encodeURIComponent(`/employer/roles/${roleId}`)}`);
  const client = await createClient();
  if (!client) return <main className={styles.page}><RetryState>Role data is temporarily unavailable.</RetryState></main>;

  const packResult = await client.from('screening_packs')
    .select('id,public_code,workplace,signed_token,expires_at,max_candidates,starts_used,reminders_enabled,location,timezone,published_facts')
    .eq('id', roleId)
    .eq('employer_id', employer.id)
    .maybeSingle();
  if (packResult.error) return <main className={styles.page}><nav className={styles.breadcrumb}><Link href="/employer">Hiring overview</Link></nav><RetryState>The role could not be loaded.</RetryState></main>;
  if (!packResult.data) notFound();
  const pack = packResult.data;
  const payload = verifyStoredInterview(pack.signed_token);
  if (!payload || payload.kind !== 'proof') return <main className={styles.page}><nav className={styles.breadcrumb}><Link href="/employer">Hiring overview</Link></nav><RetryState>The signed role details could not be verified.</RetryState></main>;

  const query = await searchParams;
  const requested = Array.isArray(query.candidateStatus) ? query.candidateStatus[0] : query.candidateStatus;
  const requestedStatus = requested === 'unreviewed' || requested === 'shortlisted' ? requested : undefined;
  const candidatePage = positivePage(query.candidatePage);
  const questionPage = positivePage(query.questionPage);
  const candidateRange = pageRange(candidatePage, SUBMISSION_PAGE_SIZE);
  const questionRange = pageRange(questionPage, QUESTION_PAGE_SIZE);
  let visibleSubmissionQuery = client.from('interviews')
    .select('id,candidate_name,role_title,submitted_at,employer_reviewed_at,employer_decision')
    .eq('screening_pack_id', roleId)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })
    .range(candidateRange.from, candidateRange.to);
  if (requestedStatus === 'unreviewed') visibleSubmissionQuery = visibleSubmissionQuery.is('employer_reviewed_at', null);
  if (requestedStatus === 'shortlisted') visibleSubmissionQuery = visibleSubmissionQuery.in('employer_decision', ['shortlist', 'shortlisted']);

  const [visibleResult, totalResult, unreviewedResult, shortlistResult, inviteResult, questionResult, unresolvedResult] = await Promise.all([
    visibleSubmissionQuery,
    client.from('interviews').select('id', { count: 'exact', head: true }).eq('screening_pack_id', roleId).not('submitted_at', 'is', null),
    client.from('interviews').select('id', { count: 'exact', head: true }).eq('screening_pack_id', roleId).not('submitted_at', 'is', null).is('employer_reviewed_at', null),
    client.from('interviews').select('id', { count: 'exact', head: true }).eq('screening_pack_id', roleId).not('submitted_at', 'is', null).in('employer_decision', ['shortlist', 'shortlisted']),
    client.from('role_invites').select('id', { count: 'exact', head: true }).eq('role_id', roleId),
    client.from('candidate_role_questions').select('id,role_id,candidate_email,question_text,answer_already_shown,reply_text,replied_at,resolved_at,created_at', { count: 'exact' }).eq('role_id', roleId).order('created_at', { ascending: false }).range(questionRange.from, questionRange.to),
    client.from('candidate_role_questions').select('id', { count: 'exact', head: true }).eq('role_id', roleId).is('resolved_at', null),
  ]);

  const submissionUnavailable = Boolean(visibleResult.error || totalResult.error || unreviewedResult.error || shortlistResult.error);
  const questionUnavailable = Boolean(questionResult.error || unresolvedResult.error);
  const submissions = submissionUnavailable ? [] : (visibleResult.data ?? []) as Submission[];
  const submissionCount = submissionUnavailable ? null : totalResult.count ?? 0;
  const unreviewedCount = submissionUnavailable ? null : unreviewedResult.count ?? 0;
  const shortlistCount = submissionUnavailable ? null : shortlistResult.count ?? 0;
  const inviteCount = inviteResult.error ? null : inviteResult.count ?? 0;
  const unresolvedCount = questionUnavailable ? null : unresolvedResult.count ?? 0;
  const questionCount = questionUnavailable ? null : questionResult.count ?? 0;
  const status = packHealth(pack);
  const action = resolveAvailableRoleNextAction({ roleId, state: status, submissionCount, unreviewedCount, shortlistCount });
  const invitationUrl = `${configuredOrigin()}/s/${pack.public_code}`;
  const timezone = pack.timezone || 'Asia/Dubai';
  const closing = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(new Date(pack.expires_at));
  const questions = questionUnavailable ? [] : (questionResult.data ?? []).map((question) => ({ ...question, roleTitle: payload.title })) as RecruiterQuestionRow[];
  const matchingSubmissionCount = requestedStatus === 'unreviewed' ? unreviewedCount : requestedStatus === 'shortlisted' ? shortlistCount : submissionCount;
  const candidateLastPage = pageCount(matchingSubmissionCount ?? 0, SUBMISSION_PAGE_SIZE);
  const questionLastPage = pageCount(questionCount ?? 0, QUESTION_PAGE_SIZE);
  const facts = pack.published_facts && typeof pack.published_facts === 'object' ? pack.published_facts as Record<string, unknown> : {};

  return <EmployerReviewPanelProvider><main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/employer">Hiring overview</Link><span>/</span><span dir="auto">{payload.title}</span></nav>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>{status === 'closing' ? 'Closing soon' : status[0].toUpperCase() + status.slice(1)}</p><h1 dir="auto">{payload.title}</h1><p><bdi dir="auto">{pack.workplace || 'Employer'}</bdi>{pack.location ? <> · <bdi dir="auto">{pack.location}</bdi></> : null}</p></div>
      <div className={styles.next}><strong>Next action</strong>{action ? <><RoleNextActionControl action={action} invitationUrl={invitationUrl} className={styles.primary} /><small>{action.supportingText}</small></> : <RetryState>Submission activity is unavailable, so no next action has been selected.</RetryState>}</div>
    </header>

    <section className={styles.facts} id="role-facts" aria-labelledby="role-facts-title"><div><h2 id="role-facts-title">Published role facts</h2><p>Candidate answers use only these published details.</p></div><dl><div><dt>Closing date</dt><dd>{closing} · {timezone}</dd></div><div><dt>Response format</dt><dd>{payload.questions.length} video questions · up to two minutes each</dd></div><div><dt>Location</dt><dd dir="auto">{pack.location || 'Not provided'}</dd></div><div><dt>Salary</dt><dd dir="auto">{typeof facts.salary === 'string' ? facts.salary : 'Not provided'}</dd></div><div><dt>Accommodation</dt><dd dir="auto">{typeof facts.accommodation === 'string' ? facts.accommodation : 'Not provided'}</dd></div><div><dt>Interview details</dt><dd dir="auto">{typeof facts.interviewDetails === 'string' ? facts.interviewDetails : 'Not provided'}</dd></div></dl></section>

    <section className={styles.section} id="invitation" aria-labelledby="invitation-title"><header><div><h2 id="invitation-title">Invitation</h2>{inviteCount === null ? <p>Invite activity is temporarily unavailable.</p> : <p>{inviteCount} identifiable invites · {pack.starts_used} starts · closes {closing}</p>}</div><Link href={`/employer/roles/${roleId}/candidates/add`}>Add candidates</Link></header><code>{invitationUrl}</code>{inviteCount === null && <RetryState>Invite activity could not be loaded.</RetryState>}<RoleDeadlineEditor roleId={roleId} expiresAt={pack.expires_at} timezone={timezone} /><div id="reminders"><ReminderPreview roleId={roleId} /></div></section>

    <section className={styles.section} id="candidate-questions" aria-labelledby="questions-title"><header><div><h2 id="questions-title">Candidate questions</h2>{unresolvedCount === null ? <p>Question activity is temporarily unavailable.</p> : <p>{unresolvedCount ? `${unresolvedCount} unresolved` : 'No unresolved questions'}. Replying and resolving are separate.</p>}</div>{!questionUnavailable && questions.length > 0 && <Link href="/employer/questions">Combined queue</Link>}</header>{questionUnavailable ? <RetryState>Candidate questions could not be loaded.</RetryState> : <><RecruiterQuestions questions={questions} />{questionLastPage > 1 && <nav className={styles.pagination} aria-label="Candidate question pages">{questionPage > 1 ? <Link href={rolePageUrl(roleId, { candidateStatus: requestedStatus, candidatePage, questionPage: questionPage - 1 }, 'candidate-questions')}>Newer questions</Link> : <span aria-disabled="true">Newer questions</span>}<span>Page {questionPage} of {questionLastPage}</span>{questionPage < questionLastPage ? <Link href={rolePageUrl(roleId, { candidateStatus: requestedStatus, candidatePage, questionPage: questionPage + 1 }, 'candidate-questions')}>Older questions</Link> : <span aria-disabled="true">Older questions</span>}</nav>}</>}</section>

    <section className={styles.section} id="submissions" aria-labelledby="submissions-title"><header><div><h2 id="submissions-title">Submissions</h2>{submissionUnavailable ? <p>Submission activity is temporarily unavailable.</p> : <p>{submissionCount} submitted · {unreviewedCount} awaiting review · {shortlistCount} shortlisted</p>}</div>{!submissionUnavailable && <nav aria-label="Filter submissions"><Link href={rolePageUrl(roleId, { questionPage }, 'submissions')} aria-current={!requestedStatus ? 'page' : undefined}>All</Link><Link href={rolePageUrl(roleId, { candidateStatus: 'unreviewed', questionPage }, 'submissions')} aria-current={requestedStatus === 'unreviewed' ? 'page' : undefined}>Awaiting review</Link><Link href={rolePageUrl(roleId, { candidateStatus: 'shortlisted', questionPage }, 'submissions')} aria-current={requestedStatus === 'shortlisted' ? 'page' : undefined}>Shortlist</Link></nav>}</header>{submissionUnavailable ? <RetryState>Submissions could not be loaded.</RetryState> : <div className={styles.submissions}>{submissions.map((submission) => <article key={submission.id}><div><strong dir="auto">{submission.candidate_name || 'Candidate'}</strong><p>Submitted {new Date(submission.submitted_at).toLocaleString('en-GB')} · {submission.employer_reviewed_at ? 'Reviewed' : 'Awaiting review'}</p></div><EmployerReviewTrigger interviewId={submission.id} candidateLabel={submission.candidate_name || 'Candidate'} className={styles.review}>Review submission</EmployerReviewTrigger><DashboardDecisionActions interviewId={submission.id} candidateLabel={submission.candidate_name || 'Candidate'} currentDecision={submission.employer_decision} /></article>)}{submissions.length === 0 && <p className={styles.empty}>No submissions match this filter.</p>}{candidateLastPage > 1 && <nav className={styles.pagination} aria-label="Submission pages">{candidatePage > 1 ? <Link href={rolePageUrl(roleId, { candidateStatus: requestedStatus, candidatePage: candidatePage - 1, questionPage }, 'submissions')}>Newer submissions</Link> : <span aria-disabled="true">Newer submissions</span>}<span>Page {candidatePage} of {candidateLastPage}</span>{candidatePage < candidateLastPage ? <Link href={rolePageUrl(roleId, { candidateStatus: requestedStatus, candidatePage: candidatePage + 1, questionPage }, 'submissions')}>Older submissions</Link> : <span aria-disabled="true">Older submissions</span>}</nav>}</div>}</section>

    <section className={styles.section} aria-labelledby="role-help-heading"><header><div><h2 id="role-help-heading">Role help</h2><p>Open a common role task.</p></div></header><RoleHelpPanel roleId={roleId} roleTitle={payload.title} unreviewed={unreviewedCount} unresolvedQuestions={unresolvedCount} expiresAt={pack.expires_at} timezone={timezone} /></section>
  </main></EmployerReviewPanelProvider>;
}
