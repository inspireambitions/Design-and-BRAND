import Link from 'next/link';
import { redirect } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';
import { buildSchoolsCohortSummaries } from '@/lib/schools/dashboard';

type CohortDetailRow = {
  id: string;
  name: string;
  programme?: string | null;
  faculty?: string | null;
  campus?: string | null;
  programme_id?: string | null;
};

export default async function SchoolsHomePage() {
  const { client, user } = await schoolsContext();

  // Read user memberships
  const memberships = await client
    .from('schools_institution_members')
    .select('institution_id, role')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null);

  if (memberships.error) throw new Error('Could not load your institutional access');

  const isInstitutionAdmin = memberships.data?.some((m) => m.role === 'institution_admin');
  const isEducator = memberships.data?.some((m) => m.role === 'educator');

  // If user is purely a student without educator/admin role, redirect to student inbox
  if (!isInstitutionAdmin && !isEducator) {
    const students = await client
      .from('schools_cohort_members')
      .select('cohort_id')
      .eq('student_user_id', user.id)
      .eq('status', 'active')
      .limit(1);

    redirect(students.data?.length ? '/schools/me' : '/schools/access');
  }

  // Load cohorts assigned to educator or in institution if admin
  let cohortIds: string[] = [];
  if (isInstitutionAdmin) {
    const instId = memberships.data.find((m) => m.role === 'institution_admin')?.institution_id;
    const allCohorts = await client
      .from('schools_cohorts')
      .select('id')
      .eq('institution_id', instId)
      .is('archived_at', null);
    cohortIds = (allCohorts.data || []).map((c) => c.id);
  } else {
    const assignedResult = await client
      .from('schools_cohort_educators')
      .select('cohort_id')
      .eq('educator_user_id', user.id);
    cohortIds = (assignedResult.data || []).map((row) => row.cohort_id);
  }

  const [cohortsResult, membersResult, assignmentsResult, supportResult] = await Promise.all([
    cohortIds.length
      ? client.from('schools_cohorts').select('id,name,programme,faculty,campus,programme_id').in('id', cohortIds).is('archived_at', null)
      : { data: [], error: null },
    cohortIds.length
      ? client.from('schools_cohort_members').select('cohort_id,student_user_id,status,display_name').in('cohort_id', cohortIds).eq('status', 'active')
      : { data: [], error: null },
    cohortIds.length
      ? client.from('schools_assignments').select('id,cohort_id,role_id,job_title,industry,status,opens_at,due_at,published_at,created_at').in('cohort_id', cohortIds)
      : { data: [], error: null },
    cohortIds.length
      ? client.from('schools_support_requests').select('id,cohort_id,student_user_id,status,note,created_at').in('cohort_id', cohortIds).neq('status', 'closed')
      : { data: [], error: null },
  ]);

  if (cohortsResult.error || membersResult.error || assignmentsResult.error) {
    throw new Error('Could not load workspace intelligence');
  }

  const assignmentIds = (assignmentsResult.data || []).map((a) => a.id);
  const attemptsResult = assignmentIds.length
    ? await client
        .from('schools_assignment_attempts')
        .select('id,assignment_id,student_user_id,attempt_number,status,submitted_at')
        .in('assignment_id', assignmentIds)
        .eq('status', 'submitted')
    : { data: [], error: null };

  const attemptIds = (attemptsResult.data || []).map((a) => a.id);
  const reviewsResult = attemptIds.length
    ? await client.from('schools_reviews').select('assignment_attempt_id').in('assignment_attempt_id', attemptIds)
    : { data: [], error: null };

  const reviewedAttemptIds = new Set((reviewsResult.data || []).map((r) => r.assignment_attempt_id));
  const unreviewedAttempts = (attemptsResult.data || []).filter((a) => !reviewedAttemptIds.has(a.id));

  // Urgent attention metrics
  const pendingReviewCount = unreviewedAttempts.length;
  const openSupportRequests = supportResult.data || [];
  const openSupportCount = openSupportRequests.length;

  // Deadlines in next 48 hours
  const now = Date.now();
  const twoDaysMs = 48 * 60 * 60 * 1000;
  const closingSoonAssignments = (assignmentsResult.data || []).filter((a) => {
    if (!a.due_at || a.status === 'closed') return false;
    const dueTime = new Date(a.due_at).getTime();
    return dueTime > now && dueTime - now <= twoDaysMs;
  });

  const cohortMap = new Map<string, CohortDetailRow>();
  ((cohortsResult.data || []) as CohortDetailRow[]).forEach((c) => cohortMap.set(c.id, c));

  const summaries = buildSchoolsCohortSummaries({
    cohorts: cohortsResult.data || [],
    members: membersResult.data || [],
    assignments: (assignmentsResult.data || []).filter((a) => a.published_at),
    attempts: attemptsResult.data || [],
    reviews: reviewsResult.data || [],
  });

  const totalLearners = (membersResult.data || []).length;
  const hasCohorts = cohortIds.length > 0;
  const hasAssignments = (assignmentsResult.data || []).length > 0;

  return (
    <>
      <header className="schools-page-heading">
        <p className="schools-eyebrow">Institutional Workspace</p>
        <h1>Today’s Priorities</h1>
        <p>Action-first intelligence across your assigned cohorts and programmes.</p>
      </header>

      {/* 1. ATTENTION BRIEFING */}
      <section aria-label="Items needing attention today" style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
        }}>
          {/* Awaiting Review Card */}
          <div className="schools-card" style={{ margin: 0 }}>
            <p className="schools-eyebrow" style={{ margin: 0 }}>Human Review</p>
            <h2 style={{ fontSize: '1.2rem', margin: '6px 0' }}>
              {pendingReviewCount > 0
                ? `${pendingReviewCount} ${pendingReviewCount === 1 ? 'submission needs' : 'submissions need'} review`
                : 'All submissions reviewed'}
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#42665b', margin: '4px 0 12px' }}>
              {pendingReviewCount > 0
                ? 'Learners are waiting for adviser feedback on submitted evidence.'
                : 'No pending attempts waiting for feedback.'}
            </p>
            {pendingReviewCount > 0 ? (
              <Link className="schools-button" href={`/schools/cohorts/${unreviewedAttempts[0].assignment_id ? (assignmentsResult.data?.find(a => a.id === unreviewedAttempts[0].assignment_id)?.cohort_id || cohortIds[0]) : cohortIds[0]}`}>
                Review submissions →
              </Link>
            ) : (
              <span className="schools-state" style={{ background: '#e1eee3', color: '#164c36' }}>Queue Clear</span>
            )}
          </div>

          {/* Student Support Requests Card */}
          <div className="schools-card" style={{ margin: 0 }}>
            <p className="schools-eyebrow" style={{ margin: 0 }}>Learner Guidance</p>
            <h2 style={{ fontSize: '1.2rem', margin: '6px 0' }}>
              {openSupportCount > 0
                ? `${openSupportCount} ${openSupportCount === 1 ? 'support request' : 'support requests'} open`
                : 'Zero open support requests'}
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#42665b', margin: '4px 0 12px' }}>
              {openSupportCount > 0
                ? 'Students requested 1-on-1 advice or assistance with interview preparation.'
                : 'All learner support tickets resolved.'}
            </p>
            {openSupportCount > 0 ? (
              <Link className="schools-button" href={`/schools/cohorts/${openSupportRequests[0].cohort_id}/students/${openSupportRequests[0].student_user_id}`}>
                Respond to request →
              </Link>
            ) : (
              <span className="schools-state" style={{ background: '#e1eee3', color: '#164c36' }}>Up to date</span>
            )}
          </div>

          {/* Approaching Deadlines Card */}
          <div className="schools-card" style={{ margin: 0 }}>
            <p className="schools-eyebrow" style={{ margin: 0 }}>Assignment Deadlines</p>
            <h2 style={{ fontSize: '1.2rem', margin: '6px 0' }}>
              {closingSoonAssignments.length > 0
                ? `${closingSoonAssignments.length} ${closingSoonAssignments.length === 1 ? 'assignment closes' : 'assignments close'} in <48h`
                : 'No assignments closing in 48h'}
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#42665b', margin: '4px 0 12px' }}>
              {closingSoonAssignments.length > 0
                ? `${closingSoonAssignments[0].job_title || closingSoonAssignments[0].role_id} reaches submission deadline soon.`
                : 'Deadlines are comfortable across active cohorts.'}
            </p>
            {closingSoonAssignments.length > 0 && (
              <Link className="schools-button" href={`/schools/cohorts/${closingSoonAssignments[0].cohort_id}`}>
                View cohort progress →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 2. GUIDED ONBOARDING CHECKLIST (For new institutions or zero assignments) */}
      {(!hasCohorts || !hasAssignments) && (
        <section className="schools-card" style={{ background: '#f8fafc', borderColor: '#cbd5e1', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="schools-state" style={{ background: '#dbeafe', color: '#1e40af' }}>Getting Started</span>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Institutional Setup Checklist</h2>
          </div>
          <p style={{ color: '#475569', fontSize: '0.925rem', margin: '0 0 16px' }}>
            Follow these 4 steps to launch your first career-readiness practice track:
          </p>
          <ol style={{ paddingLeft: '1.25rem', margin: 0, color: '#334155', lineHeight: '1.8' }}>
            <li style={{ fontWeight: hasCohorts ? 'normal' : 'bold' }}>
              <strong>Organise Your Structure:</strong> Create institutional programmes or faculties (e.g. School of Business, Engineering).
            </li>
            <li style={{ fontWeight: hasCohorts ? 'normal' : 'bold' }}>
              <strong>Provision Cohorts:</strong> Group your learners into classes or academic years.
            </li>
            <li>
              <strong>Enrol Students:</strong> Upload a CSV student roster or share your 8-character enrolment code.
            </li>
            <li>
              <strong>Publish Assignment:</strong> Configure target industry, job description, competencies, and 3–8 tailored questions.
            </li>
          </ol>
          <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link className="schools-button" href="/schools/cohorts">
              {hasCohorts ? 'Manage Cohorts' : 'Create First Cohort'}
            </Link>
          </div>
        </section>
      )}

      {/* 3. ACTIVE COHORTS QUICK DIRECTORY */}
      <section style={{ marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Active Cohorts</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: '#42665b' }}>
              {totalLearners} {totalLearners === 1 ? 'student enrolled' : 'students enrolled'} across {summaries.length} {summaries.length === 1 ? 'cohort' : 'cohorts'}
            </p>
          </div>
          <Link className="schools-button" href="/schools/cohorts" style={{ padding: '8px 14px', fontSize: '0.9rem' }}>
            All Cohorts →
          </Link>
        </div>

        {summaries.length === 0 ? (
          <div className="schools-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
            <p style={{ margin: 0, color: '#42665b' }}>No cohorts assigned to your adviser profile yet.</p>
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>Your institution administrator can assign you to a cohort or you can create one.</p>
            <Link className="schools-button" href="/schools/cohorts" style={{ marginTop: '12px' }}>
              Open Cohorts Manager
            </Link>
          </div>
        ) : (
          <div className="schools-dashboard-list">
            {summaries.slice(0, 5).map((row) => {
              const detail = cohortMap.get(row.id);
              const actionHref = row.nextAction === 'assign'
                ? `/schools/cohorts/${row.id}/assign`
                : row.nextAction === 'review'
                  ? `/schools/cohorts/${row.id}/review?assignment=${row.focusAssignment!.id}`
                  : `/schools/cohorts/${row.id}`;
              const actionLabel = row.nextAction === 'assign'
                ? 'Create assignment'
                : row.nextAction === 'review'
                  ? `Review ${row.notReviewed} submitted`
                  : 'Open cohort';

              return (
                <article className="schools-card schools-dashboard-card" key={row.id}>
                  <div className="schools-dashboard-card-heading">
                    <div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="schools-eyebrow" style={{ margin: 0 }}>Cohort</span>
                        {detail?.programme && (
                          <span className="schools-state" style={{ background: '#dbeafe', color: '#1e40af', fontSize: '11px', padding: '2px 6px' }}>
                            {detail.programme}
                          </span>
                        )}
                        {detail?.faculty && (
                          <span className="schools-state" style={{ background: '#fef3c7', color: '#92400e', fontSize: '11px', padding: '2px 6px' }}>
                            {detail.faculty}
                          </span>
                        )}
                      </div>
                      <h3 style={{ margin: '4px 0' }}><Link href={`/schools/cohorts/${row.id}`}>{row.name}</Link></h3>
                    </div>
                    <Link className="schools-button" href={actionHref}>{actionLabel}</Link>
                  </div>
                  <dl className="schools-metric-grid">
                    <div><dt>Active students</dt><dd>{row.activeStudents}</dd></div>
                    <div><dt>In Focus</dt><dd className="schools-metric-text">{row.focusAssignment?.roleId ?? 'None'}</dd></div>
                    <div><dt>Submitted</dt><dd>{row.submitted}</dd></div>
                    <div><dt>Needs review</dt><dd>{row.notReviewed}</dd></div>
                    <div><dt>Completion</dt><dd>{row.activeStudents ? Math.round((row.submitted / row.activeStudents) * 100) : 0}%</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

