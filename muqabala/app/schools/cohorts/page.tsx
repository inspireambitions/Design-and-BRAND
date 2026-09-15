import Link from 'next/link';
import { notFound } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';
import { buildSchoolsCohortSummaries } from '@/lib/schools/dashboard';

const date = (value: string) => new Date(value).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export default async function CohortsPage() {
  const { client, user } = await schoolsContext();
  const assignedResult = await client
    .from('schools_cohort_educators')
    .select('cohort_id')
    .eq('educator_user_id', user.id);
  if (assignedResult.error) throw new Error('Could not load your cohorts');
  if (!assignedResult.data?.length) notFound();

  const cohortIds = assignedResult.data.map((row) => row.cohort_id);
  const [cohortsResult, membersResult, assignmentsResult] = await Promise.all([
    client.from('schools_cohorts').select('id,name').in('id', cohortIds),
    client.from('schools_cohort_members').select('cohort_id,student_user_id,status').in('cohort_id', cohortIds).eq('status', 'active'),
    client.from('schools_assignments').select('id,cohort_id,role_id,opens_at,due_at,published_at,created_at').in('cohort_id', cohortIds).not('published_at', 'is', null),
  ]);
  if (cohortsResult.error || membersResult.error || assignmentsResult.error) {
    throw new Error('Could not load cohort progress');
  }

  const assignmentIds = assignmentsResult.data.map((assignment) => assignment.id);
  const attemptsResult = assignmentIds.length
    ? await client.from('schools_assignment_attempts')
      .select('id,assignment_id,student_user_id,attempt_number,submitted_at')
      .in('assignment_id', assignmentIds)
      .eq('status', 'submitted')
    : { data: [], error: null };
  if (attemptsResult.error) throw new Error('Could not load submitted work');
  const attemptIds = attemptsResult.data.map((attempt) => attempt.id);
  const reviewsResult = attemptIds.length
    ? await client.from('schools_reviews').select('assignment_attempt_id').in('assignment_attempt_id', attemptIds)
    : { data: [], error: null };
  if (reviewsResult.error) throw new Error('Could not load review progress');

  const rows = buildSchoolsCohortSummaries({
    cohorts: cohortsResult.data,
    members: membersResult.data,
    assignments: assignmentsResult.data,
    attempts: attemptsResult.data,
    reviews: reviewsResult.data,
  });

  return <>
    <header className="schools-page-heading">
      <p className="schools-eyebrow">Educator workspace</p>
      <h1>Your cohorts</h1>
      <p>See what needs your attention without opening every cohort.</p>
    </header>
    <section className="schools-dashboard-list" aria-label="Assigned cohorts">
      {rows.map((row) => {
        const actionHref = row.nextAction === 'assign'
          ? `/schools/cohorts/${row.id}/assign`
          : row.nextAction === 'review'
            ? `/schools/cohorts/${row.id}/review?assignment=${row.focusAssignment!.id}`
            : `/schools/cohorts/${row.id}`;
        const actionLabel = row.nextAction === 'assign'
          ? 'Create assignment'
          : row.nextAction === 'review'
            ? `Review ${row.notReviewed} awaiting review`
            : row.nextAction === 'progress'
              ? 'View progress'
              : 'Open cohort';
        return <article className="schools-card schools-dashboard-card" key={row.id}>
          <div className="schools-dashboard-card-heading">
            <div>
              <p className="schools-eyebrow">Cohort</p>
              <h2><Link href={`/schools/cohorts/${row.id}`}>{row.name}</Link></h2>
            </div>
            <Link className="schools-button" href={actionHref}>{actionLabel}</Link>
          </div>
          <dl className="schools-metric-grid">
            <div><dt>Active students</dt><dd>{row.activeStudents}</dd></div>
            <div><dt>Assignment in focus</dt><dd className="schools-metric-text">{row.focusAssignment?.roleId ?? 'None'}</dd></div>
            <div><dt>Due</dt><dd className="schools-metric-text">{row.focusAssignment ? date(row.focusAssignment.dueAt) : 'Not set'}</dd></div>
            <div><dt>Submitted</dt><dd>{row.submitted}</dd></div>
            <div><dt>Awaiting review</dt><dd>{row.notReviewed}</dd></div>
          </dl>
        </article>;
      })}
    </section>
  </>;
}
