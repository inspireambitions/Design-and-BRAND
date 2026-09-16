import Link from 'next/link';
import { schoolsContext } from '@/lib/schools/server';
import { schoolsHomeAction } from '@/lib/schools/home-action';
import {
  buildStudentInbox,
  type RawAssignment,
  type RawAttempt,
  type RawReview,
} from '@/lib/schools/student-inbox';

type StudentAttemptRow = RawAttempt & {
  feedback_opened_at?: string | null;
  comment_read_revision?: number | null;
  evidence_detail?: unknown;
};

type StudentReviewRow = RawReview & {
  revision?: number;
};

export default async function SchoolsHome() {
  const { client, user } = await schoolsContext();

  let assignments: RawAssignment[] = [];
  const { data: asgns, error: asgnError } = await client
    .from('schools_assignments')
    .select('id,cohort_id,role_id,industry,job_title,instructions,due_at,max_attempts,status,published_at')
    .order('due_at');

  if (asgnError) {
    const fallback = await client
      .from('schools_assignments')
      .select('id,role_id,due_at')
      .order('due_at');
    if (fallback.error) throw new Error('Could not load assignments');
    assignments = (fallback.data as RawAssignment[]) || [];
  } else {
    assignments = (asgns as RawAssignment[]) || [];
  }

  let attempts: StudentAttemptRow[] = [];
  const attRes = await client
    .from('schools_assignment_attempts')
    .select('id,assignment_id,status,attempt_number,submitted_at,feedback_status,feedback_opened_at,comment_read_revision,evidence_detail,evidence_covered')
    .eq('student_user_id', user.id)
    .order('attempt_number', { ascending: false });

  if (attRes.error) {
    const fallback = await client
      .from('schools_assignment_attempts')
      .select('id,assignment_id,status,attempt_number,feedback_status,feedback_opened_at,comment_read_revision,evidence_detail')
      .eq('student_user_id', user.id)
      .order('attempt_number', { ascending: false });
    attempts = (fallback.data as StudentAttemptRow[]) || [];
  } else {
    attempts = (attRes.data as StudentAttemptRow[]) || [];
  }

  const { data: reviewsData } = attempts.length
    ? await client
        .from('schools_reviews')
        .select('assignment_attempt_id,revision,comment,state')
        .in('assignment_attempt_id', attempts.map((a) => a.id))
    : { data: [] };

  const reviews = (reviewsData as StudentReviewRow[]) || [];

  const { dueAssignments, completedAssignments } = buildStudentInbox({
    assignments,
    attempts,
    reviews,
  });

  const hasAnyAssignments = dueAssignments.length > 0 || completedAssignments.length > 0;

  return (
    <>
      <h1>Your assignments</h1>
      <p>Your adviser can read what you submit. Drafts are private.</p>

      {!hasAnyAssignments && (
        <p>No assignments are available yet. Your institution will enrol you and publish practice assignments.</p>
      )}

      {dueAssignments.length > 0 && (
        <section aria-label="Assignments due or in progress" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#163e39' }}>
            Due &amp; In Progress ({dueAssignments.length})
          </h2>
          {dueAssignments.map((card) => {
            const attempt = attempts.find((a) => a.assignment_id === card.id);
            const review = reviews.find((r) => r.assignment_attempt_id === attempt?.id);
            const attemptParam = attempt ? {
              id: attempt.id,
              status: attempt.status,
              feedback_status: attempt.feedback_status,
              feedback_opened_at: attempt.feedback_opened_at ?? null,
              comment_read_revision: attempt.comment_read_revision ?? null,
              evidence_detail: attempt.evidence_detail,
            } : undefined;
            const legacyAction = schoolsHomeAction(card.id, card.dueAt, attemptParam, review ? { revision: review.revision ?? 1, comment: review.comment ?? '' } : undefined);
            const actionLabel = legacyAction.label.startsWith('Retry') || legacyAction.label.startsWith("Read your adviser's comment")
              ? legacyAction.label
              : card.actionLabel;
            const actionHref = legacyAction.label.startsWith('Retry') || legacyAction.label.startsWith("Read your adviser's comment")
              ? legacyAction.href
              : card.actionHref;

            return (
              <article
                className="schools-card"
                key={card.id}
                data-assignment-id={card.id}
                style={{
                  borderLeft: card.isOverdue ? '4px solid #b44e0d' : card.status === 'draft_in_progress' ? '4px solid #075c50' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    {card.industry && (
                      <span className="schools-state" style={{ marginRight: '8px', textTransform: 'capitalize' }}>
                        {card.industry}
                      </span>
                    )}
                    <span className={card.isOverdue ? 'schools-state-pending' : 'schools-state'}>
                      {card.relativeTime}
                    </span>
                    <h2 style={{ margin: '8px 0 4px' }}>{card.roleTitle}</h2>
                  </div>
                  {card.attemptsAllowed != null && (
                    <div style={{ fontSize: '0.875rem', color: '#42665b' }}>
                      Attempt {Math.min(card.attemptsUsed + (card.status === 'draft_in_progress' ? 1 : 0), card.attemptsAllowed)} of {card.attemptsAllowed}
                    </div>
                  )}
                </div>

                <p style={{ margin: '8px 0', fontSize: '0.925rem', color: '#42665b' }}>
                  Due {new Date(card.dueAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                </p>

                {card.instructions && (
                  <div
                    style={{
                      background: '#f8f6ef',
                      borderLeft: '3px solid #9eb8ac',
                      padding: '10px 14px',
                      margin: '12px 0',
                      borderRadius: '0 4px 4px 0',
                      fontSize: '0.9rem',
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: '#42665b', letterSpacing: '0.04em' }}>
                      Adviser Instructions
                    </strong>
                    <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{card.instructions}</p>
                  </div>
                )}

                <div style={{ marginTop: '16px' }}>
                  <Link className="schools-button" href={actionHref}>
                    {actionLabel}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {completedAssignments.length > 0 && (
        <section aria-label="Completed assignments" style={{ marginTop: '2.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#163e39' }}>
            Completed &amp; Reviewed ({completedAssignments.length})
          </h2>
          {completedAssignments.map((card) => {
            const attempt = attempts.find((a) => a.assignment_id === card.id);
            const review = reviews.find((r) => r.assignment_attempt_id === attempt?.id);
            const attemptParam = attempt ? {
              id: attempt.id,
              status: attempt.status,
              feedback_status: attempt.feedback_status,
              feedback_opened_at: attempt.feedback_opened_at ?? null,
              comment_read_revision: attempt.comment_read_revision ?? null,
              evidence_detail: attempt.evidence_detail,
            } : undefined;
            const legacyAction = schoolsHomeAction(card.id, card.dueAt, attemptParam, review ? { revision: review.revision ?? 1, comment: review.comment ?? '' } : undefined);
            const actionLabel = legacyAction.label.startsWith("Read your adviser's comment")
              ? legacyAction.label
              : card.actionLabel;
            const actionHref = legacyAction.label.startsWith("Read your adviser's comment")
              ? legacyAction.href
              : card.actionHref;

            return (
              <article className="schools-card" key={card.id} data-assignment-id={card.id} style={{ opacity: 0.9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    {card.industry && (
                      <span className="schools-state" style={{ marginRight: '8px', textTransform: 'capitalize' }}>
                        {card.industry}
                      </span>
                    )}
                    <span className="schools-state" style={{ background: '#e1eee3', color: '#164c36' }}>
                      {card.status === 'reviewed_feedback_ready' ? 'Feedback Ready' : 'Submitted'}
                    </span>
                    <h2 style={{ margin: '8px 0 4px' }}>{card.roleTitle}</h2>
                  </div>
                  {card.attemptsAllowed != null && (
                    <div style={{ fontSize: '0.875rem', color: '#42665b' }}>
                      {card.attemptsUsed} / {card.attemptsAllowed} attempts completed
                    </div>
                  )}
                </div>

                <p style={{ margin: '8px 0', fontSize: '0.925rem', color: '#42665b' }}>
                  Due date was {new Date(card.dueAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                </p>

                <div style={{ marginTop: '16px' }}>
                  <Link className="schools-button" href={actionHref}>
                    {actionLabel}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #c9d8d0' }}>
        <h3 style={{ fontSize: '1.1rem', margin: '0 0 8px' }}>Self-Directed Practice</h3>
        <p style={{ margin: '0 0 12px', fontSize: '0.925rem', color: '#42665b' }}>
          Looking for additional practice beyond your cohort assignments? Prepare for Gulf and international interviews across multiple industries.
        </p>
        <Link href="/practice" style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>
          Explore general interview practice tracks →
        </Link>
      </section>
    </>
  );
}
