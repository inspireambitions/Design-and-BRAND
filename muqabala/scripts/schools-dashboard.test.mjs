import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSchoolsCohortSummaries, buildSchoolsInstitutionSummary } from '../lib/schools/dashboard.ts';

const now = new Date('2026-09-14T10:00:00Z');
const cohorts = [
  { id: 'cohort-a', name: 'Level 3 Careers', institution_id: 'institution-a', archived_at: null },
  { id: 'cohort-b', name: 'Graduates', institution_id: 'institution-a', archived_at: null },
  { id: 'cohort-old', name: 'Archived', institution_id: 'institution-a', archived_at: '2026-09-01T00:00:00Z' },
];
const members = [
  { cohort_id: 'cohort-a', student_user_id: 'student-1', status: 'active' },
  { cohort_id: 'cohort-a', student_user_id: 'student-2', status: 'active' },
  { cohort_id: 'cohort-a', student_user_id: 'student-3', status: 'removed' },
  { cohort_id: 'cohort-b', student_user_id: 'student-1', status: 'active' },
];
const assignments = [
  { id: 'assignment-later', cohort_id: 'cohort-a', role_id: 'Later role', opens_at: '2026-09-14T00:00:00Z', due_at: '2026-09-30T00:00:00Z', published_at: '2026-09-13T00:00:00Z', created_at: '2026-09-13T00:00:00Z' },
  { id: 'assignment-current', cohort_id: 'cohort-a', role_id: 'Current role', opens_at: '2026-09-13T00:00:00Z', due_at: '2026-09-20T00:00:00Z', published_at: '2026-09-13T00:00:00Z', created_at: '2026-09-13T00:00:00Z' },
  { id: 'assignment-draft', cohort_id: 'cohort-b', role_id: 'Private draft', opens_at: '2026-09-13T00:00:00Z', due_at: '2026-09-20T00:00:00Z', published_at: null, created_at: '2026-09-13T00:00:00Z' },
];
const attempts = [
  { id: 'attempt-1', assignment_id: 'assignment-current', student_user_id: 'student-1', attempt_number: 1, submitted_at: '2026-09-14T08:00:00Z' },
  { id: 'attempt-2', assignment_id: 'assignment-current', student_user_id: 'student-1', attempt_number: 2, submitted_at: '2026-09-14T09:00:00Z' },
];

test('educator cohort summary counts students and latest submitted attempts', () => {
  const rows = buildSchoolsCohortSummaries({ cohorts, members, assignments, attempts, reviews: [{ assignment_attempt_id: 'attempt-1' }], now });
  assert.deepEqual(rows[0], {
    id: 'cohort-a',
    name: 'Level 3 Careers',
    activeStudents: 2,
    activeAssignment: { id: 'assignment-current', roleId: 'Current role', dueAt: '2026-09-20T00:00:00Z' },
    submitted: 1,
    notReviewed: 1,
    nextAction: 'review',
  });
  assert.equal(rows[1].activeAssignment, null);
  assert.equal(rows[1].nextAction, 'assign');
});

test('institution summary contains participation counts only', () => {
  const summary = buildSchoolsInstitutionSummary({
    institutionId: 'institution-a', cohorts, members, assignments, attempts,
    reviews: [{ assignment_attempt_id: 'attempt-2' }],
    support: [
      { cohort_id: 'cohort-a', status: 'open' },
      { cohort_id: 'cohort-old', status: 'open' },
    ],
    now,
  });
  assert.equal(summary.activeCohorts, 2);
  assert.equal(summary.enrolledStudents, 2);
  assert.equal(summary.submitted, 1);
  assert.equal(summary.notSubmitted, 1);
  assert.equal(summary.awaitingReview, 0);
  assert.equal(summary.openSupport, 1);
  assert.deepEqual(summary.activeAssignments.map((assignment) => assignment.id), ['assignment-current']);
  assert.equal(JSON.stringify(summary).includes('answers'), false);
});
