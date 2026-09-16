import test from 'node:test';
import assert from 'node:assert/strict';

function checkInstitutionAccess({
  user,
  userInstitutionId,
  userRole,
  targetInstitutionId,
  targetCohortEducatorIds = [],
}) {
  // Founder check
  if (userRole === 'founder') return { allowed: true };

  // Tenant boundary: cannot cross institution
  if (userInstitutionId !== targetInstitutionId) {
    return { allowed: false, error: 'Access denied: cross-institution access prohibited' };
  }

  // Student boundary: cannot access educator or admin surfaces
  if (userRole === 'student') {
    return { allowed: false, error: 'Access denied: student cannot access institutional management' };
  }

  // Admin has access to all cohorts in their institution
  if (userRole === 'institution_admin') {
    return { allowed: true };
  }

  // Educator has access to assigned cohorts
  if (userRole === 'educator') {
    if (targetCohortEducatorIds.length === 0 || targetCohortEducatorIds.includes(user.id)) {
      return { allowed: true };
    }
    return { allowed: false, error: 'Access denied: educator not assigned to this cohort' };
  }

  return { allowed: false, error: 'Access denied: unauthorized role' };
}

function checkStudentAttemptRead({
  requestingUserId,
  requestingUserRole,
  requestingUserInstitutionId,
  attemptStudentUserId,
  attemptInstitutionId,
  attemptStatus,
  cohortEducatorIds,
}) {
  // Cross-institution check
  if (requestingUserInstitutionId !== attemptInstitutionId) {
    return { allowed: false, error: 'Access denied: cross-institution attempt access prohibited' };
  }

  // Student can only read their own attempts
  if (requestingUserRole === 'student') {
    if (requestingUserId === attemptStudentUserId) {
      return { allowed: true };
    }
    return { allowed: false, error: 'Access denied: students cannot view peer attempts' };
  }

  // Educator can only read submitted attempts of assigned cohorts
  if (requestingUserRole === 'educator') {
    if (!cohortEducatorIds.includes(requestingUserId)) {
      return { allowed: false, error: 'Access denied: educator not assigned to cohort' };
    }
    if (attemptStatus !== 'submitted') {
      return { allowed: false, error: 'Access denied: drafts are private to students' };
    }
    return { allowed: true };
  }

  // Admin cannot read private draft attempts either
  if (requestingUserRole === 'institution_admin') {
    if (attemptStatus !== 'submitted') {
      return { allowed: false, error: 'Access denied: drafts are private to students' };
    }
    return { allowed: true };
  }

  return { allowed: false, error: 'Access denied' };
}

const instA = 'e0000000-0000-4000-a000-000000000001';
const instB = 'e0000000-0000-4000-a000-000000000002';

const educatorA = { id: 'u00000000-0000-4000-a000-000000000001' };
const studentA = { id: 'u00000000-0000-4000-a000-000000000002' };
const peerStudentA = { id: 'u00000000-0000-4000-a000-000000000003' };

test('denies cross-institution programme access from Institution A to Institution B', () => {
  const result = checkInstitutionAccess({
    user: educatorA,
    userInstitutionId: instA,
    userRole: 'educator',
    targetInstitutionId: instB,
  });

  assert.equal(result.allowed, false);
  assert(result.error.includes('cross-institution'));
});

test('denies cross-institution cohort access from Institution A to Institution B', () => {
  const result = checkInstitutionAccess({
    user: educatorA,
    userInstitutionId: instA,
    userRole: 'educator',
    targetInstitutionId: instB,
    targetCohortEducatorIds: [educatorA.id],
  });

  assert.equal(result.allowed, false);
  assert(result.error.includes('cross-institution'));
});

test('strictly denies students from accessing educator management or analytics', () => {
  const result = checkInstitutionAccess({
    user: studentA,
    userInstitutionId: instA,
    userRole: 'student',
    targetInstitutionId: instA,
  });

  assert.equal(result.allowed, false);
  assert(result.error.includes('student cannot access institutional management'));
});

test('students cannot view peer attempts or peer metrics', () => {
  const result = checkStudentAttemptRead({
    requestingUserId: studentA.id,
    requestingUserRole: 'student',
    requestingUserInstitutionId: instA,
    attemptStudentUserId: peerStudentA.id,
    attemptInstitutionId: instA,
    attemptStatus: 'submitted',
    cohortEducatorIds: [educatorA.id],
  });

  assert.equal(result.allowed, false);
  assert(result.error.includes('students cannot view peer attempts'));
});

test('drafts remain private to students; educators cannot read drafts before submission', () => {
  const result = checkStudentAttemptRead({
    requestingUserId: educatorA.id,
    requestingUserRole: 'educator',
    requestingUserInstitutionId: instA,
    attemptStudentUserId: studentA.id,
    attemptInstitutionId: instA,
    attemptStatus: 'draft',
    cohortEducatorIds: [educatorA.id],
  });

  assert.equal(result.allowed, false);
  assert(result.error.includes('drafts are private to students'));
});

test('educator can read submitted attempts within assigned cohort', () => {
  const result = checkStudentAttemptRead({
    requestingUserId: educatorA.id,
    requestingUserRole: 'educator',
    requestingUserInstitutionId: instA,
    attemptStudentUserId: studentA.id,
    attemptInstitutionId: instA,
    attemptStatus: 'submitted',
    cohortEducatorIds: [educatorA.id],
  });

  assert.equal(result.allowed, true);
});
