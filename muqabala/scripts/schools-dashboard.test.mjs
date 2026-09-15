import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadSchoolsAdminParticipation } from '../lib/schools/admin-participation.ts';
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
  { id: 'attempt-removed', assignment_id: 'assignment-current', student_user_id: 'student-3', attempt_number: 1, submitted_at: '2026-09-14T09:30:00Z' },
];

test('educator cohort summary counts students and latest submitted attempts', () => {
  const rows = buildSchoolsCohortSummaries({ cohorts, members, assignments, attempts, reviews: [{ assignment_attempt_id: 'attempt-1' }], now });
  assert.deepEqual(rows[0], {
    id: 'cohort-a',
    name: 'Level 3 Careers',
    activeStudents: 2,
    focusAssignment: { id: 'assignment-current', roleId: 'Current role', dueAt: '2026-09-20T00:00:00Z' },
    submitted: 1,
    notReviewed: 1,
    nextAction: 'review',
  });
  assert.equal(rows[1].focusAssignment, null);
  assert.equal(rows[1].nextAction, 'assign');
});

test('educator cohort summary keeps overdue submissions in the review queue', () => {
  const overdue = {
    id: 'assignment-overdue', cohort_id: 'cohort-b', role_id: 'Past role',
    opens_at: '2026-09-01T00:00:00Z', due_at: '2026-09-10T00:00:00Z',
    published_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z',
  };
  const rows = buildSchoolsCohortSummaries({
    cohorts: [cohorts[1]], members, assignments: [overdue],
    attempts: [{ id: 'attempt-overdue', assignment_id: overdue.id, student_user_id: 'student-1', attempt_number: 1, submitted_at: '2026-09-09T00:00:00Z' }],
    reviews: [], now,
  });
  assert.equal(rows[0].nextAction, 'review');
  assert.equal(rows[0].notReviewed, 1);
  assert.deepEqual(rows[0].focusAssignment, { id: overdue.id, roleId: 'Past role', dueAt: overdue.due_at });
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

test('institution summary includes overdue review work but excludes removed students', () => {
  const overdue = {
    id: 'assignment-overdue', cohort_id: 'cohort-a', role_id: 'Past role',
    opens_at: '2026-09-01T00:00:00Z', due_at: '2026-09-10T00:00:00Z',
    published_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z',
  };
  const summary = buildSchoolsInstitutionSummary({
    institutionId: 'institution-a', cohorts, members, assignments: [overdue],
    attempts: [
      { id: 'active-overdue', assignment_id: overdue.id, student_user_id: 'student-1', attempt_number: 1, submitted_at: '2026-09-09T00:00:00Z' },
      { id: 'removed-overdue', assignment_id: overdue.id, student_user_id: 'student-3', attempt_number: 1, submitted_at: '2026-09-09T00:00:00Z' },
    ],
    reviews: [], support: [], now,
  });
  assert.equal(summary.awaitingReview, 1);
  assert.equal(summary.submitted, 0);
  assert.equal(summary.notSubmitted, 0);
});

test('institution admin dashboard reads only server-side participation metadata', async () => {
  const source = await readFile(new URL('../app/schools/admin/page.tsx', import.meta.url), 'utf8');
  const attemptProjection = source.match(/admin\.from\('schools_assignment_attempts'\)\s*\.select\('([^']+)'\)/);
  assert.ok(attemptProjection, 'institution admins need a server-side aggregate source because answer-row RLS stays closed');
  assert.equal(attemptProjection[1], 'id,assignment_id,student_user_id,attempt_number,submitted_at');
  assert.match(source, /admin\.from\('schools_reviews'\)\.select\('assignment_attempt_id'\)/);
  assert.doesNotMatch(attemptProjection[1], /answers|evidence|feedback|comment/i);
});

test('institution admin participation is membership-gated and institution-scoped', async () => {
  const calls = [];
  const source = {
    cohorts: async (ids) => { calls.push(['cohorts', ids]); return [cohorts[0], { ...cohorts[1], institution_id: 'institution-b' }]; },
    members: async (ids) => { calls.push(['members', ids]); return [...members, { cohort_id: 'cohort-foreign', student_user_id: 'other', status: 'active' }]; },
    assignments: async (ids) => { calls.push(['assignments', ids]); return [...assignments, { ...assignments[0], id: 'foreign-assignment', cohort_id: 'cohort-foreign' }]; },
    support: async (ids) => { calls.push(['support', ids]); return [{ cohort_id: 'cohort-a', status: 'open' }, { cohort_id: 'cohort-foreign', status: 'open' }]; },
    submittedAttempts: async (ids) => { calls.push(['submittedAttempts', ids]); return [...attempts, { ...attempts[0], id: 'foreign-attempt', assignment_id: 'foreign-assignment' }]; },
    reviews: async (ids) => { calls.push(['reviews', ids]); return [{ assignment_attempt_id: 'attempt-2' }, { assignment_attempt_id: 'foreign-attempt' }]; },
  };
  const participation = await loadSchoolsAdminParticipation({ acceptedInstitutionIds: ['institution-a'], source });
  assert.deepEqual(participation?.cohorts.map((cohort) => cohort.id), ['cohort-a']);
  assert.equal(participation?.members.every((member) => member.cohort_id === 'cohort-a'), true);
  assert.equal(participation?.assignments.every((assignment) => assignment.cohort_id === 'cohort-a'), true);
  assert.equal(participation?.attempts.every((attempt) => ['assignment-later', 'assignment-current'].includes(attempt.assignment_id)), true);
  assert.deepEqual(participation?.reviews, [{ assignment_attempt_id: 'attempt-2' }]);
  assert.deepEqual(calls.map(([name]) => name), ['cohorts', 'members', 'assignments', 'support', 'submittedAttempts', 'reviews']);

  const deniedCalls = [];
  const deniedSource = Object.fromEntries(Object.keys(source).map((name) => [name, async () => { deniedCalls.push(name); return []; }]));
  const denied = await loadSchoolsAdminParticipation({ acceptedInstitutionIds: [], source: deniedSource });
  assert.equal(denied, null);
  assert.deepEqual(deniedCalls, []);
});
