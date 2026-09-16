import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCohortProgress } from '../lib/schools/dashboard.ts';

test('calculates core cohort progress metrics accurately', () => {
  const cohortId = 'c0000000-0000-0000-0000-000000000001';
  const assignmentId = 'a0000000-0000-0000-0000-000000000001';

  // 10 enrolled students
  const members = Array.from({ length: 10 }, (_, i) => ({
    cohort_id: cohortId,
    student_user_id: `u${i + 1}`,
    status: 'active',
  }));

  // 8 students attempted, total 14 attempts. 6 submitted, 2 drafted.
  const attempts = [
    // Student 1: 2 attempts, submitted
    { id: 'att1', assignment_id: assignmentId, student_user_id: 'u1', attempt_number: 1, submitted_at: '2026-09-10T10:00:00Z', status: 'submitted', evidence_detail: { 'Situation': true, 'Action': true, 'Outcome': false } },
    { id: 'att2', assignment_id: assignmentId, student_user_id: 'u1', attempt_number: 2, submitted_at: '2026-09-11T10:00:00Z', status: 'submitted', evidence_detail: { 'Situation': true, 'Action': true, 'Outcome': true } },

    // Student 2: 1 attempt, submitted
    { id: 'att3', assignment_id: assignmentId, student_user_id: 'u2', attempt_number: 1, submitted_at: '2026-09-10T11:00:00Z', status: 'submitted', evidence_detail: { 'Situation': true, 'Action': false, 'Outcome': false } },

    // Student 3: 3 attempts, submitted
    { id: 'att4', assignment_id: assignmentId, student_user_id: 'u3', attempt_number: 1, submitted_at: '2026-09-10T12:00:00Z', status: 'submitted', evidence_detail: { 'Situation': false, 'Action': true } },
    { id: 'att5', assignment_id: assignmentId, student_user_id: 'u3', attempt_number: 2, submitted_at: '2026-09-11T12:00:00Z', status: 'submitted', evidence_detail: { 'Situation': true, 'Action': true } },
    { id: 'att6', assignment_id: assignmentId, student_user_id: 'u3', attempt_number: 3, submitted_at: '2026-09-12T12:00:00Z', status: 'submitted', evidence_detail: { 'Situation': true, 'Action': true, 'Outcome': true } },

    // Students 4, 5, 6: 1 attempt each, submitted
    { id: 'att7', assignment_id: assignmentId, student_user_id: 'u4', attempt_number: 1, submitted_at: '2026-09-10T14:00:00Z', status: 'submitted', evidence_detail: { 'Situation': true, 'Action': true } },
    { id: 'att8', assignment_id: assignmentId, student_user_id: 'u5', attempt_number: 1, submitted_at: '2026-09-10T15:00:00Z', status: 'submitted', evidence_detail: { 'Situation': true, 'Action': true } },
    { id: 'att9', assignment_id: assignmentId, student_user_id: 'u6', attempt_number: 1, submitted_at: '2026-09-10T16:00:00Z', status: 'submitted', evidence_detail: { 'Situation': true, 'Action': false } },

    // Students 7, 8: drafts only (participating but not submitted)
    { id: 'att10', assignment_id: assignmentId, student_user_id: 'u7', attempt_number: 1, submitted_at: null, status: 'draft' },
    { id: 'att11', assignment_id: assignmentId, student_user_id: 'u7', attempt_number: 2, submitted_at: null, status: 'draft' },
    { id: 'att12', assignment_id: assignmentId, student_user_id: 'u8', attempt_number: 1, submitted_at: null, status: 'draft' },
    { id: 'att13', assignment_id: assignmentId, student_user_id: 'u8', attempt_number: 2, submitted_at: null, status: 'draft' },
    { id: 'att14', assignment_id: assignmentId, student_user_id: 'u8', attempt_number: 3, submitted_at: null, status: 'draft' },
  ];

  const metrics = calculateCohortProgress({
    cohortId,
    members,
    attempts,
    targetAssignmentId: assignmentId,
  });

  assert.equal(metrics.enrolledStudents, 10);
  assert.equal(metrics.participatingStudents, 8);
  assert.equal(metrics.submittedStudents, 6);
  assert.equal(metrics.incompleteStudents, 4);
  assert.equal(metrics.totalAttempts, 14);
  assert.equal(metrics.participationRate, 80.0); // 8/10
  assert.equal(metrics.completionRate, 60.0);    // 6/10
  assert.equal(metrics.averageAttemptsPerStudent, 1.8); // 14 / 8 = 1.75 -> 1.8

  // Competency aggregation
  const situation = metrics.competencyCoverage.find((c) => c.element === 'Situation');
  assert.ok(situation);
  assert.equal(situation.presentCount, 8); // 8 attempts had Situation present
  assert.equal(situation.totalEvaluated, 9);
});

test('handles empty cohorts cleanly without division by zero', () => {
  const metrics = calculateCohortProgress({
    cohortId: 'c-empty',
    members: [],
    attempts: [],
  });

  assert.equal(metrics.enrolledStudents, 0);
  assert.equal(metrics.participatingStudents, 0);
  assert.equal(metrics.submittedStudents, 0);
  assert.equal(metrics.incompleteStudents, 0);
  assert.equal(metrics.participationRate, 0);
  assert.equal(metrics.completionRate, 0);
  assert.equal(metrics.averageAttemptsPerStudent, 0);
  assert.deepEqual(metrics.competencyCoverage, []);
});

test('never exposes student peer ranking in metrics object', () => {
  const metrics = calculateCohortProgress({
    cohortId: 'c-privacy',
    members: [{ cohort_id: 'c-privacy', student_user_id: 's1', status: 'active' }],
    attempts: [{ id: 'a1', assignment_id: 'as1', student_user_id: 's1', attempt_number: 1, submitted_at: '2026-09-10T10:00:00Z', status: 'submitted' }],
  });

  // Verify no student rankings, sorted student arrays, or relative ranks are in metrics
  assert.equal('studentRankings' in metrics, false);
  assert.equal('leaderboard' in metrics, false);
  assert.equal('scores' in metrics, false);
});
