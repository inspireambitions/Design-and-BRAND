import Link from 'next/link';
import { notFound } from 'next/navigation';
import { schoolsContext } from '@/lib/schools/server';

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id: cohortId, studentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(cohortId) || !/^[0-9a-f-]{36}$/i.test(studentId)) {
    notFound();
  }

  const { client, user } = await schoolsContext();

  // Authorisation check: user must be an assigned educator or institution admin
  const { data: assigned } = await client
    .from('schools_cohort_educators')
    .select('cohort_id')
    .eq('cohort_id', cohortId)
    .eq('educator_user_id', user.id)
    .maybeSingle();

  if (!assigned) {
    const { data: cohortInst } = await client
      .from('schools_cohorts')
      .select('institution_id')
      .eq('id', cohortId)
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

  // Load cohort, student membership, and programme context
  const { data: cohort } = await client
    .from('schools_cohorts')
    .select('id,name,faculty,campus,programme,programme_id')
    .eq('id', cohortId)
    .maybeSingle();

  if (!cohort) notFound();

  const { data: member } = await client
    .from('schools_cohort_members')
    .select('student_user_id,display_name,student_identifier,status,joined_at')
    .eq('cohort_id', cohortId)
    .eq('student_user_id', studentId)
    .maybeSingle();

  if (!member) notFound();

  // Load assignments for this cohort
  const { data: assignments } = await client
    .from('schools_assignments')
    .select('id,role_id,job_title,industry,due_at,max_attempts,instructions,version')
    .eq('cohort_id', cohortId)
    .order('due_at');

  const assignmentIds = assignments?.map((a) => a.id) || [];

  // Load student attempts
  const { data: attempts } = assignmentIds.length
    ? await client
        .from('schools_assignment_attempts')
        .select('id,assignment_id,attempt_number,status,feedback_status,evidence_covered,submitted_at,created_at')
        .in('assignment_id', assignmentIds)
        .eq('student_user_id', studentId)
        .order('attempt_number', { ascending: true })
    : { data: [] };

  const attemptIds = attempts?.map((a) => a.id) || [];

  // Load reviews for these attempts
  const { data: reviews } = attemptIds.length
    ? await client
        .from('schools_reviews')
        .select('assignment_attempt_id,state,comment,created_at')
        .in('assignment_attempt_id', attemptIds)
    : { data: [] };

  // Load support requests for this student
  const { data: supportRequests } = await client
    .from('schools_support_requests')
    .select('id,status,note,created_at,owner_educator_id')
    .eq('cohort_id', cohortId)
    .eq('student_user_id', studentId)
    .order('created_at', { ascending: false });

  const stateLabels: Record<string, string> = {
    on_track: 'On Track',
    needs_more: 'Needs More Evidence',
    discuss: 'Discuss in 1-on-1',
  };

  return (
    <>
      <nav aria-label="Breadcrumb" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        <Link href="/schools/cohorts">Cohorts</Link> &gt;{' '}
        <Link href={`/schools/cohorts/${cohortId}`}>{cohort.name}</Link> &gt;{' '}
        <span>{member.display_name}</span>
      </nav>

      <header className="schools-page-heading">
        <p className="schools-eyebrow">Learner Profile</p>
        <h1>{member.display_name}</h1>
        <p style={{ color: '#4b5563' }}>
          {member.student_identifier && <span>Student ID: <strong>{member.student_identifier}</strong> | </span>}
          Cohort: <strong>{cohort.name}</strong>
          {cohort.programme && <span> | Programme: <strong>{cohort.programme}</strong></span>}
          {cohort.faculty && <span> | Faculty: <strong>{cohort.faculty}</strong></span>}
        </p>
      </header>

      {/* Support Thread Section */}
      {supportRequests && supportRequests.length > 0 && (
        <section className="schools-card" style={{ borderColor: '#fcd34d' }}>
          <h2>Adviser Support Requests</h2>
          <ul>
            {supportRequests.map((s) => (
              <li key={s.id} style={{ marginBottom: '0.5rem' }}>
                <span style={{
                  padding: '0.15rem 0.4rem',
                  borderRadius: '4px',
                  background: s.status === 'open' ? '#fee2e2' : '#f3f4f6',
                  color: s.status === 'open' ? '#991b1b' : '#374151',
                  fontSize: '0.8em',
                  fontWeight: 600,
                  marginRight: '0.5rem',
                }}>
                  {s.status.toUpperCase()}
                </span>
                <span>{s.note || 'Student requested adviser guidance.'}</span>
                <span style={{ fontSize: '0.8em', color: '#6b7280', display: 'block' }}>
                  Requested {new Date(s.created_at).toLocaleDateString('en-GB')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Assignment Progress & Attempt Progression */}
      <h2>Assigned Interviews & Attempt Progression</h2>

      {(!assignments || assignments.length === 0) && (
        <p>No assignments have been assigned to this cohort yet.</p>
      )}

      {assignments?.map((asgn) => {
        const asgnAttempts = (attempts || []).filter((a) => a.assignment_id === asgn.id);
        const submitted = asgnAttempts.filter((a) => a.status === 'submitted' || a.submitted_at);
        const draft = asgnAttempts.find((a) => a.status === 'draft');
        const roleTitle = asgn.job_title || asgn.role_id;

        return (
          <article className="schools-card" key={asgn.id} style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="schools-eyebrow">{asgn.industry ? asgn.industry.toUpperCase() : 'CAREER TRACK'}</p>
                <h3>{roleTitle}</h3>
                <p style={{ fontSize: '0.9rem', color: '#666' }}>
                  Due: {new Date(asgn.due_at).toLocaleDateString('en-GB')} | Allowed Attempts: {asgn.max_attempts ?? 'Unlimited'}
                </p>
                {asgn.instructions && (
                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#4b5563' }}>
                    Instructions: &ldquo;{asgn.instructions}&rdquo;
                  </p>
                )}
              </div>
              <span style={{
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: submitted.length > 0 ? '#d1fae5' : draft ? '#fef3c7' : '#f3f4f6',
                color: submitted.length > 0 ? '#065f46' : draft ? '#92400e' : '#4b5563',
              }}>
                {submitted.length > 0 ? `${submitted.length} Attempt(s) Submitted` : draft ? 'Draft in Progress' : 'Not Started'}
              </span>
            </div>

            {/* Attempt Progression History */}
            {asgnAttempts.length > 0 ? (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
                <h4>Attempt History & Development</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '0.35rem' }}>Attempt</th>
                        <th style={{ padding: '0.35rem' }}>Status</th>
                        <th style={{ padding: '0.35rem' }}>Submitted</th>
                        <th style={{ padding: '0.35rem' }}>Observed Evidence</th>
                        <th style={{ padding: '0.35rem' }}>Adviser Review</th>
                        <th style={{ padding: '0.35rem' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asgnAttempts.map((att, index) => {
                        const review = (reviews || []).find((r) => r.assignment_attempt_id === att.id);
                        const prev = index > 0 ? asgnAttempts[index - 1] : null;
                        const hasProgression = prev && typeof att.evidence_covered === 'number' && typeof prev.evidence_covered === 'number';
                        const delta = hasProgression ? att.evidence_covered! - prev.evidence_covered! : null;

                        return (
                          <tr key={att.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.35rem' }}><strong>Attempt {att.attempt_number}</strong></td>
                            <td style={{ padding: '0.35rem' }}>{att.status === 'submitted' ? 'Submitted' : 'Draft'}</td>
                            <td style={{ padding: '0.35rem' }}>
                              {att.submitted_at ? new Date(att.submitted_at).toLocaleDateString('en-GB') : '-'}
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              {att.status === 'submitted' ? (
                                <span>
                                  {att.evidence_covered != null ? `${att.evidence_covered} element(s)` : 'Awaiting feedback'}
                                  {delta !== null && (
                                    <span style={{
                                      marginLeft: '0.35rem',
                                      color: delta > 0 ? '#059669' : delta < 0 ? '#b91c1c' : '#6b7280',
                                      fontWeight: 600,
                                    }}>
                                      ({delta > 0 ? `+${delta}` : delta === 0 ? 'no change' : delta})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>Draft (Private)</span>
                              )}
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              {review ? (
                                <span>
                                  <strong>{stateLabels[review.state] || review.state}</strong>
                                  {review.comment && (
                                    <span style={{ display: 'block', color: '#6b7280', fontSize: '0.8em' }}>
                                      &ldquo;{review.comment}&rdquo;
                                    </span>
                                  )}
                                </span>
                              ) : att.status === 'submitted' ? (
                                <span style={{ color: '#d97706' }}>Awaiting review</span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td style={{ padding: '0.35rem' }}>
                              {att.status === 'submitted' ? (
                                <Link
                                  href={`/schools/cohorts/${cohortId}/review?attempt=${att.id}`}
                                  className="schools-button"
                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                >
                                  Review Attempt
                                </Link>
                              ) : (
                                <span style={{ color: '#9ca3af', fontSize: '0.8em' }}>Private</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem' }}>
                No attempts recorded yet for this assignment.
              </p>
            )}
          </article>
        );
      })}

      <div style={{ marginTop: '1.5rem' }}>
        <Link href={`/schools/cohorts/${cohortId}`} className="schools-button">
          &larr; Back to Cohort
        </Link>
      </div>
    </>
  );
}
