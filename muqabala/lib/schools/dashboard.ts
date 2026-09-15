export type SchoolsCohortRow = {
  id: string;
  name: string;
  institution_id?: string;
  archived_at?: string | null;
};

export type SchoolsMemberRow = {
  cohort_id: string;
  student_user_id: string;
  status: string;
};

export type SchoolsAssignmentRow = {
  id: string;
  cohort_id: string;
  role_id: string;
  opens_at: string;
  due_at: string;
  published_at: string | null;
  created_at: string;
};

export type SchoolsAttemptRow = {
  id: string;
  assignment_id: string;
  student_user_id: string;
  attempt_number: number;
  submitted_at: string | null;
};

export type SchoolsReviewRow = { assignment_attempt_id: string };
export type SchoolsSupportRow = { cohort_id: string; status: string };

export type SchoolsCohortSummary = {
  id: string;
  name: string;
  activeStudents: number;
  focusAssignment: null | {
    id: string;
    roleId: string;
    dueAt: string;
  };
  submitted: number;
  notReviewed: number;
  nextAction: 'assign' | 'review' | 'progress' | 'open';
};

function activeAssignmentFor(
  cohortId: string,
  assignments: SchoolsAssignmentRow[],
  now: Date,
) {
  const at = now.getTime();
  return assignments
    .filter((assignment) => assignment.cohort_id === cohortId
      && assignment.published_at
      && new Date(assignment.opens_at).getTime() <= at
      && new Date(assignment.due_at).getTime() >= at)
    .sort((left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime()
      || new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] ?? null;
}

function openedAssignmentsFor(
  cohortId: string,
  assignments: SchoolsAssignmentRow[],
  now: Date,
) {
  const at = now.getTime();
  return assignments
    .filter((assignment) => assignment.cohort_id === cohortId
      && assignment.published_at
      && new Date(assignment.opens_at).getTime() <= at)
    .sort((left, right) => new Date(left.due_at).getTime() - new Date(right.due_at).getTime()
      || new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
}

function latestSubmissionsFor(
  assignmentId: string,
  attempts: SchoolsAttemptRow[],
  eligibleStudentIds?: Set<string>,
) {
  const latest = new Map<string, SchoolsAttemptRow>();
  for (const attempt of attempts) {
    if (attempt.assignment_id !== assignmentId
      || !attempt.submitted_at
      || (eligibleStudentIds && !eligibleStudentIds.has(attempt.student_user_id))) continue;
    const current = latest.get(attempt.student_user_id);
    if (!current || attempt.attempt_number > current.attempt_number
      || (attempt.attempt_number === current.attempt_number
        && new Date(attempt.submitted_at).getTime() > new Date(current.submitted_at!).getTime())) {
      latest.set(attempt.student_user_id, attempt);
    }
  }
  return [...latest.values()];
}

export function buildSchoolsCohortSummaries({
  cohorts,
  members,
  assignments,
  attempts,
  reviews,
  now = new Date(),
}: {
  cohorts: SchoolsCohortRow[];
  members: SchoolsMemberRow[];
  assignments: SchoolsAssignmentRow[];
  attempts: SchoolsAttemptRow[];
  reviews: SchoolsReviewRow[];
  now?: Date;
}): SchoolsCohortSummary[] {
  const reviewed = new Set(reviews.map((review) => review.assignment_attempt_id));
  return cohorts.map((cohort) => {
    const activeStudentIds = new Set(members
      .filter((member) => member.cohort_id === cohort.id && member.status === 'active')
      .map((member) => member.student_user_id));
    const activeStudents = activeStudentIds.size;
    const pendingReview = openedAssignmentsFor(cohort.id, assignments, now)
      .map((assignment) => ({
        assignment,
        latest: latestSubmissionsFor(assignment.id, attempts, activeStudentIds),
      }))
      .find(({ latest }) => latest.some((attempt) => !reviewed.has(attempt.id)));
    const assignment = pendingReview?.assignment ?? activeAssignmentFor(cohort.id, assignments, now);
    const latest = pendingReview?.latest
      ?? (assignment ? latestSubmissionsFor(assignment.id, attempts, activeStudentIds) : []);
    const notReviewed = latest.filter((attempt) => !reviewed.has(attempt.id)).length;
    const nextAction = !assignment ? 'assign'
      : notReviewed > 0 ? 'review'
        : latest.length < activeStudents ? 'progress'
          : 'open';
    return {
      id: cohort.id,
      name: cohort.name,
      activeStudents,
      focusAssignment: assignment ? { id: assignment.id, roleId: assignment.role_id, dueAt: assignment.due_at } : null,
      submitted: latest.length,
      notReviewed,
      nextAction,
    };
  });
}

export type SchoolsInstitutionSummary = {
  institutionId: string;
  activeCohorts: number;
  enrolledStudents: number;
  submitted: number;
  notSubmitted: number;
  awaitingReview: number;
  openSupport: number;
  activeAssignments: Array<{ id: string; cohortId: string; roleId: string; dueAt: string }>;
};

export function buildSchoolsInstitutionSummary({
  institutionId,
  cohorts,
  members,
  assignments,
  attempts,
  reviews,
  support,
  now = new Date(),
}: {
  institutionId: string;
  cohorts: SchoolsCohortRow[];
  members: SchoolsMemberRow[];
  assignments: SchoolsAssignmentRow[];
  attempts: SchoolsAttemptRow[];
  reviews: SchoolsReviewRow[];
  support: SchoolsSupportRow[];
  now?: Date;
}): SchoolsInstitutionSummary {
  const institutionCohorts = cohorts.filter((cohort) => cohort.institution_id === institutionId && !cohort.archived_at);
  const cohortIds = new Set(institutionCohorts.map((cohort) => cohort.id));
  const activeMembers = members.filter((member) => cohortIds.has(member.cohort_id) && member.status === 'active');
  const activeAssignments = institutionCohorts
    .map((cohort) => activeAssignmentFor(cohort.id, assignments, now))
    .filter((assignment): assignment is SchoolsAssignmentRow => Boolean(assignment));
  const reviewed = new Set(reviews.map((review) => review.assignment_attempt_id));
  let submitted = 0;
  let notSubmitted = 0;
  let awaitingReview = 0;
  for (const assignment of activeAssignments) {
    const eligibleStudentIds = new Set(activeMembers
      .filter((member) => member.cohort_id === assignment.cohort_id)
      .map((member) => member.student_user_id));
    const latest = latestSubmissionsFor(assignment.id, attempts, eligibleStudentIds);
    const eligible = eligibleStudentIds.size;
    submitted += latest.length;
    notSubmitted += Math.max(eligible - latest.length, 0);
  }
  for (const cohort of institutionCohorts) {
    const eligibleStudentIds = new Set(activeMembers
      .filter((member) => member.cohort_id === cohort.id)
      .map((member) => member.student_user_id));
    for (const assignment of openedAssignmentsFor(cohort.id, assignments, now)) {
      awaitingReview += latestSubmissionsFor(assignment.id, attempts, eligibleStudentIds)
        .filter((attempt) => !reviewed.has(attempt.id)).length;
    }
  }
  return {
    institutionId,
    activeCohorts: institutionCohorts.length,
    enrolledStudents: new Set(activeMembers.map((member) => member.student_user_id)).size,
    submitted,
    notSubmitted,
    awaitingReview,
    openSupport: support.filter((request) => cohortIds.has(request.cohort_id) && request.status !== 'closed').length,
    activeAssignments: activeAssignments.map((assignment) => ({
      id: assignment.id,
      cohortId: assignment.cohort_id,
      roleId: assignment.role_id,
      dueAt: assignment.due_at,
    })),
  };
}
