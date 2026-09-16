import Link from 'next/link';
import { notFound } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';
import { SchoolsEnrolmentPanel } from '@/components/schools/EnrolmentPanel';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCohortProgress, type AttemptWithEvidence } from '@/lib/schools/dashboard';
import { detectInterventionSignals } from '@/lib/schools/intervention';
import { InterventionQueue } from '@/components/schools/InterventionQueue';
import { RosterUpload } from '@/components/schools/RosterUpload';

export default async function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { client, user } = await schoolsContext();

  // Authorisation check: assigned educator or institution admin
  const { data: assigned } = await client
    .from('schools_cohort_educators')
    .select('cohort_id')
    .eq('cohort_id', id)
    .eq('educator_user_id', user.id)
    .maybeSingle();

  if (!assigned) {
    const { data: cohortInst } = await client
      .from('schools_cohorts')
      .select('institution_id')
      .eq('id', id)
      .maybeSingle();

    if (!cohortInst) notFound();

    const { data: isAdmin } = await client
      .from('schools_institution_members')
      .select('id')
      .eq('institution_id', cohortInst.institution_id)
      .eq('user_id', user.id)
      .eq('role', 'institution_admin')
      .maybeSingle();

    if (!isAdmin) notFound();
  }

  const admin = createAdminClient();
  const settings = admin
    ? await admin.from('schools_cohorts').select('enrolment_open,enrolment_code').eq('id', id).maybeSingle()
    : { data: null };

  const { data: cohort } = await client
    .from('schools_cohorts')
    .select('id,name,campus,faculty,programme,programme_id')
    .eq('id', id)
    .maybeSingle();

  if (!cohort) notFound();

  // Load cohort members
  const { data: members } = await client
    .from('schools_cohort_members')
    .select('cohort_id,student_user_id,display_name,student_identifier,status')
    .eq('cohort_id', id)
    .eq('status', 'active');

  // Load cohort assignments
  const { data: assignments } = await client
    .from('schools_assignments')
    .select('id,role_id,job_title,industry,due_at,status,instructions,max_attempts,created_at')
    .eq('cohort_id', id)
    .order('created_at', { ascending: false });

  const activeAssignment = assignments?.[0];
  const assignmentIds = assignments?.map((a) => a.id) || [];

  // Load attempts for all assignments in this cohort
  const { data: attempts } = assignmentIds.length
    ? await client
        .from('schools_assignment_attempts')
        .select('id,assignment_id,student_user_id,attempt_number,status,submitted_at,created_at,evidence_covered,evidence_detail')
        .in('assignment_id', assignmentIds)
    : { data: [] };

  const attemptIds = (attempts || []).map((a) => a.id);

  // Load reviews
  const { data: reviews } = attemptIds.length
    ? await client
        .from('schools_reviews')
        .select('assignment_attempt_id,state,comment,revision')
        .in('assignment_attempt_id', attemptIds)
    : { data: [] };

  // Load support requests
  const { data: support } = await client
    .from('schools_support_requests')
    .select('student_user_id,status,note,created_at')
    .eq('cohort_id', id)
    .neq('status', 'closed');

  // Compute aggregate cohort progress metrics (Strictly NO peer ranking)
  const cohortMetrics = calculateCohortProgress({
    cohortId: id,
    members: members || [],
    attempts: (attempts || []) as unknown as AttemptWithEvidence[],
    targetAssignmentId: activeAssignment?.id,
  });

  // Compute evidence-based intervention signals
  const interventionSignals = detectInterventionSignals({
    cohortId: id,
    members: members || [],
    assignments: assignments || [],
    attempts: attempts || [],
    supportRequests: support || [],
  });

  const labels: Record<string, string> = {
    not_reviewed: 'Not reviewed',
    discuss: 'Discuss',
    needs_more: 'Needs more',
    on_track: 'On track',
    not_submitted: 'Not submitted',
  };

  const order = ['not_reviewed', 'discuss', 'needs_more', 'on_track', 'not_submitted'];

  // Prepare student list
  const rows = (members || []).map((member) => {
    const studentAttempts = (attempts || []).filter(
      (a) => a.student_user_id === member.student_user_id && (!activeAssignment || a.assignment_id === activeAssignment.id)
    ).sort((a, b) => b.attempt_number - a.attempt_number);

    const submitted = studentAttempts.filter((a) => a.status === 'submitted');
    const latest = submitted[0];
    const state = latest
      ? reviews?.find((r) => r.assignment_attempt_id === latest.id)?.state || 'not_reviewed'
      : 'not_submitted';

    return {
      ...member,
      submitted: submitted.length,
      latest,
      state,
      support: support?.find((s) => s.student_user_id === member.student_user_id)?.status || 'None',
    };
  }).sort(
    (a, b) => order.indexOf(a.state) - order.indexOf(b.state) || a.display_name.localeCompare(b.display_name, 'en-GB')
  );

  const notReviewedCount = rows.filter((r) => r.state === 'not_reviewed').length;

  return (
    <>
      <nav aria-label="Breadcrumb" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        <Link href="/schools/cohorts">Cohorts</Link> &gt; <span>{cohort.name}</span>
      </nav>

      <header className="schools-page-heading">
        <p className="schools-eyebrow">
          {cohort.programme ? `${cohort.programme} ` : ''}
          {cohort.faculty ? `• ${cohort.faculty}` : ''}
        </p>
        <h1>{cohort.name}</h1>
        {activeAssignment && (
          <p style={{ color: '#4b5563' }}>
            Current Assignment: <strong>{activeAssignment.job_title || activeAssignment.role_id}</strong>
            {activeAssignment.industry ? ` (${activeAssignment.industry})` : ''} • Due{' '}
            {new Date(activeAssignment.due_at).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
          </p>
        )}
      </header>

      {/* Cohort Progress & Completion Intelligence */}
      <section className="schools-card" aria-label="Cohort Progress Intelligence">
        <h2>Cohort Progress Overview</h2>
        <dl className="schools-metric-grid">
          <div>
            <dt>Enrolled Learners</dt>
            <dd>{cohortMetrics.enrolledStudents}</dd>
          </div>
          <div>
            <dt>Participating</dt>
            <dd>{cohortMetrics.participatingStudents}</dd>
          </div>
          <div>
            <dt>Completed</dt>
            <dd>{cohortMetrics.submittedStudents}</dd>
          </div>
          <div>
            <dt>Completion Rate</dt>
            <dd style={{ color: '#059669', fontWeight: 600 }}>{cohortMetrics.completionRate}%</dd>
          </div>
          <div>
            <dt>Total Attempts</dt>
            <dd>{cohortMetrics.totalAttempts}</dd>
          </div>
          <div>
            <dt>Avg Attempts / Learner</dt>
            <dd>{cohortMetrics.averageAttemptsPerStudent}</dd>
          </div>
        </dl>
      </section>

      {/* Intervention & Support Queue */}
      <InterventionQueue cohortId={id} signals={interventionSignals} />

      {/* Primary Actions */}
      <div style={{ margin: '1.25rem 0', display: 'flex', gap: '0.75rem' }}>
        {notReviewedCount > 0 && activeAssignment && (
          <Link className="schools-button" href={`/schools/cohorts/${id}/review?assignment=${activeAssignment.id}`}>
            Review {notReviewedCount} Awaiting Review
          </Link>
        )}
        <Link className="schools-button" href={`/schools/cohorts/${id}/assign`}>
          Create New Assignment
        </Link>
      </div>

      {/* Roster & Students Table with Drill-down */}
      <section className="schools-card" aria-label="Learners in Cohort">
        <h2>Learners in this Cohort ({rows.length})</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th scope="col" style={{ padding: '0.5rem' }}>Learner</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Student ID</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Submitted Attempts</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Adviser Status</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Support Status</th>
                <th scope="col" style={{ padding: '0.5rem' }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student_user_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <th scope="row" style={{ padding: '0.5rem', fontWeight: 500 }}>
                    <Link href={`/schools/cohorts/${id}/students/${row.student_user_id}`}>
                      {row.display_name}
                    </Link>
                  </th>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                    {row.student_identifier || '-'}
                  </td>
                  <td style={{ padding: '0.5rem' }}>{row.submitted}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <span style={{
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      background: row.state === 'on_track' ? '#d1fae5' : row.state === 'not_reviewed' ? '#fef3c7' : '#f3f4f6',
                      color: row.state === 'on_track' ? '#065f46' : row.state === 'not_reviewed' ? '#92400e' : '#374151',
                    }}>
                      {labels[row.state]}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <Link href={`/schools/cohorts/${id}/support/${row.student_user_id}`}>
                      {row.support === 'None' ? 'Request support' : row.support}
                    </Link>
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <Link
                      href={`/schools/cohorts/${id}/students/${row.student_user_id}`}
                      className="schools-button"
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                    >
                      Progress
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Roster CSV Import Component */}
      <RosterUpload cohortId={id} />

      {/* Enrolment Access Codes Panel */}
      {settings.data && (
        <SchoolsEnrolmentPanel
          cohortId={id}
          students={members || []}
          initialOpen={settings.data.enrolment_open}
          initialCode={settings.data.enrolment_code}
        />
      )}

      {/* Assignments History */}
      <h2>Cohort Assignments</h2>
      {assignments?.map((a) => (
        <article className="schools-card" key={a.id} style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3>{a.job_title || a.role_id}</h3>
              <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.25rem 0' }}>
                {a.industry && <span>Industry: <strong>{a.industry}</strong> • </span>}
                Due {new Date(a.due_at).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
              </p>
              {a.instructions && (
                <p style={{ fontSize: '0.85rem', color: '#4b5563', fontStyle: 'italic' }}>
                  Instructions: {a.instructions}
                </p>
              )}
            </div>
            <span style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: a.status === 'draft' ? '#f3f4f6' : '#d1fae5',
              color: a.status === 'draft' ? '#4b5563' : '#065f46',
            }}>
              {(a.status || 'published').toUpperCase()}
            </span>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Link className="schools-button" href={`/schools/cohorts/${id}/review?assignment=${a.id}`}>
              Review Submitted Answers
            </Link>
          </div>
        </article>
      ))}
    </>
  );
}
