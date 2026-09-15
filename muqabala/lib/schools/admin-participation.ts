import type {
  SchoolsAssignmentRow,
  SchoolsAttemptRow,
  SchoolsCohortRow,
  SchoolsMemberRow,
  SchoolsReviewRow,
  SchoolsSupportRow,
} from '@/lib/schools/dashboard';

type InstitutionCohortRow = SchoolsCohortRow & { institution_id: string };

export type SchoolsAdminParticipationSource = {
  cohorts: (institutionIds: string[]) => Promise<InstitutionCohortRow[]>;
  members: (cohortIds: string[]) => Promise<SchoolsMemberRow[]>;
  assignments: (cohortIds: string[]) => Promise<SchoolsAssignmentRow[]>;
  support: (cohortIds: string[]) => Promise<SchoolsSupportRow[]>;
  submittedAttempts: (assignmentIds: string[]) => Promise<SchoolsAttemptRow[]>;
  reviews: (attemptIds: string[]) => Promise<SchoolsReviewRow[]>;
};

export type SchoolsAdminParticipation = {
  cohorts: InstitutionCohortRow[];
  members: SchoolsMemberRow[];
  assignments: SchoolsAssignmentRow[];
  support: SchoolsSupportRow[];
  attempts: SchoolsAttemptRow[];
  reviews: SchoolsReviewRow[];
};

export async function loadSchoolsAdminParticipation({
  acceptedInstitutionIds,
  source,
}: {
  acceptedInstitutionIds: string[];
  source: SchoolsAdminParticipationSource;
}): Promise<SchoolsAdminParticipation | null> {
  const institutionIds = [...new Set(acceptedInstitutionIds)];
  if (!institutionIds.length) return null;

  const allowedInstitutions = new Set(institutionIds);
  const cohorts = (await source.cohorts(institutionIds))
    .filter((cohort) => allowedInstitutions.has(cohort.institution_id));
  const cohortIds = cohorts.map((cohort) => cohort.id);
  if (!cohortIds.length) {
    return { cohorts, members: [], assignments: [], support: [], attempts: [], reviews: [] };
  }

  const allowedCohorts = new Set(cohortIds);
  const [memberRows, assignmentRows, supportRows] = await Promise.all([
    source.members(cohortIds),
    source.assignments(cohortIds),
    source.support(cohortIds),
  ]);
  const members = memberRows.filter((member) => allowedCohorts.has(member.cohort_id));
  const assignments = assignmentRows.filter((assignment) => allowedCohorts.has(assignment.cohort_id));
  const support = supportRows.filter((request) => allowedCohorts.has(request.cohort_id));
  const assignmentIds = assignments.map((assignment) => assignment.id);
  const allowedAssignments = new Set(assignmentIds);
  const attempts = assignmentIds.length
    ? (await source.submittedAttempts(assignmentIds))
      .filter((attempt) => allowedAssignments.has(attempt.assignment_id))
    : [];
  const attemptIds = attempts.map((attempt) => attempt.id);
  const allowedAttempts = new Set(attemptIds);
  const reviews = attemptIds.length
    ? (await source.reviews(attemptIds))
      .filter((review) => allowedAttempts.has(review.assignment_attempt_id))
    : [];

  return { cohorts, members, assignments, support, attempts, reviews };
}
