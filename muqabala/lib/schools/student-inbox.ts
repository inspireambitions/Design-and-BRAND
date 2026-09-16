import type { StudentAssignmentCard } from './types';

export type RawAssignment = {
  id: string;
  cohort_id: string;
  role_id: string;
  industry?: string | null;
  job_title?: string | null;
  instructions?: string | null;
  due_at: string;
  max_attempts?: number | null;
  status?: string;
  published_at?: string | null;
};

export type RawAttempt = {
  id: string;
  assignment_id: string;
  status: string;
  attempt_number: number;
  submitted_at?: string | null;
  feedback_status: string;
  evidence_covered?: number | null;
};

export type RawReview = {
  assignment_attempt_id: string;
  state: string;
  comment?: string | null;
};

export function formatRelativeDeadline(dueAtIso: string, now: number = Date.now()): { relativeTime: string; isOverdue: boolean } {
  const dueMs = new Date(dueAtIso).getTime();
  const diffMs = dueMs - now;
  const isOverdue = diffMs < 0;

  if (isOverdue) {
    const daysAgo = Math.floor(Math.abs(diffMs) / (86400000));
    return {
      relativeTime: daysAgo === 0 ? 'Due date passed today' : `Deadline passed ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`,
      isOverdue: true,
    };
  }

  const daysLeft = Math.ceil(diffMs / (86400000));
  if (daysLeft === 0) return { relativeTime: 'Due today', isOverdue: false };
  if (daysLeft === 1) return { relativeTime: 'Due tomorrow', isOverdue: false };
  return { relativeTime: `Due in ${daysLeft} days`, isOverdue: false };
}

export function buildStudentInbox({
  assignments,
  attempts,
  reviews = [],
  now = Date.now(),
}: {
  assignments: RawAssignment[];
  attempts: RawAttempt[];
  reviews?: RawReview[];
  now?: number;
}): {
  dueAssignments: StudentAssignmentCard[];
  completedAssignments: StudentAssignmentCard[];
} {
  const dueAssignments: StudentAssignmentCard[] = [];
  const completedAssignments: StudentAssignmentCard[] = [];

  for (const asgn of assignments) {
    // Only published assignments are visible to students; skip drafts
    if (asgn.status === 'draft') continue;

    const asgnAttempts = attempts.filter((a) => a.assignment_id === asgn.id)
      .sort((a, b) => a.attempt_number - b.attempt_number);

    const submittedAttempts = asgnAttempts.filter((a) => a.status === 'submitted' || Boolean(a.submitted_at));
    const activeDraft = asgnAttempts.find((a) => a.status === 'draft');

    const attemptsUsed = submittedAttempts.length;
    const attemptsAllowed = asgn.max_attempts ?? null;
    const attemptsRemaining = attemptsAllowed != null ? Math.max(0, attemptsAllowed - attemptsUsed) : null;
    const canAttemptMore = attemptsRemaining === null || attemptsRemaining > 0;

    const { relativeTime, isOverdue } = formatRelativeDeadline(asgn.due_at, now);
    const roleTitle = asgn.job_title || asgn.role_id;

    // Determine card status
    let status: StudentAssignmentCard['status'] = 'not_started';
    let actionLabel = 'Start practice';
    let actionHref = `/schools/me/${asgn.id}`;

    if (activeDraft) {
      status = 'draft_in_progress';
      actionLabel = 'Continue draft';
      actionHref = `/schools/me/${asgn.id}`;
    } else if (submittedAttempts.length > 0) {
      const latestSubmitted = submittedAttempts[submittedAttempts.length - 1];
      const hasReview = reviews.some((r) => r.assignment_attempt_id === latestSubmitted.id);

      if (hasReview || latestSubmitted.feedback_status === 'ready') {
        status = 'reviewed_feedback_ready';
        actionLabel = canAttemptMore && !isOverdue ? 'View feedback & retry' : 'View report & feedback';
        actionHref = `/schools/me/reports/${latestSubmitted.id}`;
      } else {
        status = 'submitted_awaiting_review';
        actionLabel = canAttemptMore && !isOverdue ? 'View submission & retry' : 'View submitted answers';
        actionHref = `/schools/me/reports/${latestSubmitted.id}`;
      }
    }

    const card: StudentAssignmentCard = {
      id: asgn.id,
      cohortId: asgn.cohort_id,
      roleTitle,
      industry: asgn.industry ?? null,
      instructions: asgn.instructions ?? null,
      dueAt: asgn.due_at,
      relativeTime,
      isOverdue,
      status,
      attemptsAllowed,
      attemptsUsed,
      attemptsRemaining,
      actionLabel,
      actionHref,
    };

    // An assignment is "due" if it has not been submitted yet OR if the student is actively drafting OR if student can retry and deadline has not passed
    if ((submittedAttempts.length === 0 || activeDraft) && !isOverdue) {
      dueAssignments.push(card);
    } else if (canAttemptMore && !isOverdue && status !== 'reviewed_feedback_ready') {
      dueAssignments.push(card);
    } else {
      completedAssignments.push(card);
    }
  }

  // Sort due assignments: overdue/soonest deadline first
  dueAssignments.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  // Sort completed assignments: latest deadline first
  completedAssignments.sort((a, b) => new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime());

  return { dueAssignments, completedAssignments };
}
