import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { DashboardDecisionActions } from '@/components/DashboardDecisionActions';
import { EmployerReviewPanelProvider, EmployerReviewTrigger } from '@/components/EmployerCandidatePanel';
import { RecruiterQuestions, type RecruiterQuestionRow } from '@/components/RecruiterQuestions';
import { ReminderPreview } from '@/components/ReminderPreview';
import { RoleHelpPanel } from '@/components/RoleHelpPanel';
import { RoleNextActionControl } from '@/components/RoleNextActionControl';
import { normaliseEmployerDecision, packHealth } from '@/lib/employer-dashboard';
import { verifyInterview } from '@/lib/interview-token';
import { resolveRoleNextAction } from '@/lib/recruiter-suite';
import { configuredOrigin } from '@/lib/server/security';
import { createClient, currentUser } from '@/lib/supabase/server';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Submission = { id: string; candidate_name: string | null; role_title: string; submitted_at: string; employer_reviewed_at: string | null; employer_decision: string | null };

export default async function EmployerRolePage({ params, searchParams }: { params: Promise<{ roleId: string }>; searchParams: Promise<{ candidateStatus?: string | string[] }> }) {
  const employer = await currentUser();
  const { roleId } = await params;
  if (!employer) redirect(`/sign-in?next=${encodeURIComponent(`/employer/roles/${roleId}`)}`);
  const client = await createClient();
  if (!client) notFound();
  const { data: pack } = await client.from('screening_packs')
    .select('id,public_code,workplace,signed_token,expires_at,max_candidates,starts_used,reminders_enabled,location,timezone,published_facts')
    .eq('id', roleId)
    .eq('employer_id', employer.id)
    .maybeSingle();
  if (!pack) notFound();
  const payload = verifyInterview(pack.signed_token);
  if (!payload || payload.kind !== 'proof') notFound();

  const [{ data: submissionRows }, { data: inviteRows }, { data: questionRows }] = await Promise.all([
    client.from('interviews').select('id,candidate_name,role_title,submitted_at,employer_reviewed_at,employer_decision').eq('screening_pack_id', roleId).not('submitted_at', 'is', null).order('submitted_at', { ascending: false }),
    client.from('role_invites').select('id,status').eq('role_id', roleId),
    client.from('candidate_role_questions').select('id,role_id,candidate_email,question_text,answer_already_shown,reply_text,replied_at,resolved_at,created_at').eq('role_id', roleId).order('created_at', { ascending: false }),
  ]);
  const submissions = (submissionRows ?? []) as Submission[];
  const unresolvedQuestions = (questionRows ?? []).filter((question) => !question.resolved_at);
  const unreviewed = submissions.filter((submission) => !submission.employer_reviewed_at);
  const shortlisted = submissions.filter((submission) => normaliseEmployerDecision(submission.employer_decision) === 'shortlisted');
  const status = packHealth(pack);
  const action = resolveRoleNextAction({ roleId, state: status, submissionCount: submissions.length, unreviewedCount: unreviewed.length, shortlistCount: shortlisted.length });
  const invitationUrl = `${configuredOrigin()}/s/${pack.public_code}`;
  const query = await searchParams;
  const requestedStatus = Array.isArray(query.candidateStatus) ? query.candidateStatus[0] : query.candidateStatus;
  const visibleSubmissions = requestedStatus === 'unreviewed' ? unreviewed : requestedStatus === 'shortlisted' ? shortlisted : submissions;
  const timezone = pack.timezone || 'Asia/Dubai';
  const closing = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: timezone }).format(new Date(pack.expires_at));
  const questions = (questionRows ?? []).map((question) => ({ ...question, roleTitle: payload.title })) as RecruiterQuestionRow[];
  const facts = pack.published_facts && typeof pack.published_facts === 'object' ? pack.published_facts as Record<string, unknown> : {};

  return <EmployerReviewPanelProvider><main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/employer">Hiring overview</Link><span>/</span><span dir="auto">{payload.title}</span></nav>
    <header className={styles.hero}>
      <div><p className={styles.eyebrow}>{status === 'closing' ? 'Closing soon' : status[0].toUpperCase() + status.slice(1)}</p><h1 dir="auto">{payload.title}</h1><p><bdi dir="auto">{pack.workplace || 'Employer'}</bdi>{pack.location ? <> · <bdi dir="auto">{pack.location}</bdi></> : null}</p></div>
      <div className={styles.next}><strong>Next action</strong><RoleNextActionControl action={action} invitationUrl={invitationUrl} className={styles.primary} /><small>{action.supportingText}</small></div>
    </header>

    <section className={styles.facts} id="role-facts" aria-labelledby="role-facts-title"><div><h2 id="role-facts-title">Published role facts</h2><p>These are the only employer facts available to candidate question answers.</p></div><dl><div><dt>Closing date</dt><dd>{closing} · {timezone}</dd></div><div><dt>Response format</dt><dd>{payload.questions.length} video questions · up to two minutes each</dd></div><div><dt>Location</dt><dd dir="auto">{pack.location || 'Not provided'}</dd></div><div><dt>Salary</dt><dd dir="auto">{typeof facts.salary === 'string' ? facts.salary : 'Not provided'}</dd></div><div><dt>Accommodation</dt><dd dir="auto">{typeof facts.accommodation === 'string' ? facts.accommodation : 'Not provided'}</dd></div><div><dt>Interview details</dt><dd dir="auto">{typeof facts.interviewDetails === 'string' ? facts.interviewDetails : 'Not provided'}</dd></div></dl></section>

    <section className={styles.section} id="invitation" aria-labelledby="invitation-title"><header><div><h2 id="invitation-title">Invitation</h2><p>{inviteRows?.length || 0} identifiable invites · {pack.starts_used} starts · closes {closing}</p></div><Link href={`/employer/roles/${roleId}/candidates/add`}>Add candidates</Link></header><code>{invitationUrl}</code><div id="reminders"><ReminderPreview roleId={roleId} /></div></section>

    <section className={styles.section} id="candidate-questions" aria-labelledby="questions-title"><header><div><h2 id="questions-title">Candidate questions</h2><p>{unresolvedQuestions.length ? `${unresolvedQuestions.length} unresolved` : 'No unresolved questions'}. Replying and resolving are separate.</p></div>{questions.length > 0 && <Link href="/employer/questions">Combined queue</Link>}</header><RecruiterQuestions questions={questions} /></section>

    <section className={styles.section} id="submissions" aria-labelledby="submissions-title"><header><div><h2 id="submissions-title">Submissions</h2><p>{submissions.length} submitted · {unreviewed.length} awaiting review · {shortlisted.length} shortlisted</p></div><nav aria-label="Filter submissions"><Link href={`/employer/roles/${roleId}#submissions`} aria-current={!requestedStatus ? 'page' : undefined}>All</Link><Link href={`/employer/roles/${roleId}?candidateStatus=unreviewed#submissions`} aria-current={requestedStatus === 'unreviewed' ? 'page' : undefined}>Awaiting review</Link><Link href={`/employer/roles/${roleId}?candidateStatus=shortlisted#submissions`} aria-current={requestedStatus === 'shortlisted' ? 'page' : undefined}>Shortlist</Link></nav></header><div className={styles.submissions}>{visibleSubmissions.map((submission) => <article key={submission.id}><div><strong dir="auto">{submission.candidate_name || 'Candidate'}</strong><p>Submitted {new Date(submission.submitted_at).toLocaleString('en-GB')} · {submission.employer_reviewed_at ? 'Reviewed' : 'Awaiting review'}</p></div><EmployerReviewTrigger interviewId={submission.id} candidateLabel={submission.candidate_name || 'Candidate'} className={styles.review}>Review submission</EmployerReviewTrigger><DashboardDecisionActions interviewId={submission.id} candidateLabel={submission.candidate_name || 'Candidate'} currentDecision={submission.employer_decision} /></article>)}{visibleSubmissions.length === 0 && <p className={styles.empty}>No submissions match this filter.</p>}</div></section>

    <section className={styles.section} aria-labelledby="role-help-heading"><header><div><h2 id="role-help-heading">Role help</h2><p>Optional shortcuts. The complete workflow remains available through the sections above.</p></div></header><RoleHelpPanel roleId={roleId} roleTitle={payload.title} unreviewed={unreviewed.length} unresolvedQuestions={unresolvedQuestions.length} expiresAt={pack.expires_at} timezone={timezone} /></section>
  </main></EmployerReviewPanelProvider>;
}
