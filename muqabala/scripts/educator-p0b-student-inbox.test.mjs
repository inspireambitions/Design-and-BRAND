import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentInbox } from '../lib/schools/student-inbox.ts';

const now = new Date('2026-09-16T12:00:00Z').getTime();

const publishedAssignment = {
  id: 'asgn-1',
  cohort_id: 'cohort-1',
  role_id: 'software-engineer',
  job_title: 'Full Stack Engineer',
  industry: 'technology',
  instructions: 'Focus on your final year project and system architecture decisions.',
  due_at: new Date(now + 3 * 86400000).toISOString(),
  max_attempts: 3,
  status: 'published',
};

const draftAssignment = {
  id: 'asgn-draft',
  cohort_id: 'cohort-1',
  role_id: 'cybersecurity-analyst',
  job_title: 'SOC Analyst',
  due_at: new Date(now + 7 * 86400000).toISOString(),
  status: 'draft',
};

test('filters out draft assignments and correctly places unstarted assignment in dueAssignments', () => {
  const { dueAssignments, completedAssignments } = buildStudentInbox({
    assignments: [publishedAssignment, draftAssignment],
    attempts: [],
    now,
  });

  assert.equal(dueAssignments.length, 1);
  assert.equal(dueAssignments[0].id, 'asgn-1');
  assert.equal(dueAssignments[0].roleTitle, 'Full Stack Engineer');
  assert.equal(dueAssignments[0].status, 'not_started');
  assert.equal(dueAssignments[0].attemptsUsed, 0);
  assert.equal(dueAssignments[0].attemptsRemaining, 3);
  assert.equal(dueAssignments[0].actionLabel, 'Start practice');
  assert.equal(completedAssignments.length, 0);
});

test('tracks draft in progress and provides continue action', () => {
  const attempts = [
    {
      id: 'att-1',
      assignment_id: 'asgn-1',
      status: 'draft',
      attempt_number: 1,
      feedback_status: 'pending',
    },
  ];

  const { dueAssignments } = buildStudentInbox({
    assignments: [publishedAssignment],
    attempts,
    now,
  });

  assert.equal(dueAssignments.length, 1);
  assert.equal(dueAssignments[0].status, 'draft_in_progress');
  assert.equal(dueAssignments[0].actionLabel, 'Continue draft');
});

test('places reviewed assignment in completed section with report link and remaining attempt tracking', () => {
  const attempts = [
    {
      id: 'att-submitted',
      assignment_id: 'asgn-1',
      status: 'submitted',
      attempt_number: 1,
      submitted_at: new Date(now - 86400000).toISOString(),
      feedback_status: 'ready',
      evidence_covered: 8,
    },
  ];

  const reviews = [
    {
      assignment_attempt_id: 'att-submitted',
      state: 'on_track',
      comment: 'Good articulation of technical tradeoffs.',
    },
  ];

  const { dueAssignments, completedAssignments } = buildStudentInbox({
    assignments: [publishedAssignment],
    attempts,
    reviews,
    now,
  });

  assert.equal(dueAssignments.length, 0);
  assert.equal(completedAssignments.length, 1);
  assert.equal(completedAssignments[0].status, 'reviewed_feedback_ready');
  assert.equal(completedAssignments[0].attemptsUsed, 1);
  assert.equal(completedAssignments[0].attemptsRemaining, 2);
  assert.equal(completedAssignments[0].actionLabel, 'View feedback & retry');
  assert.equal(completedAssignments[0].actionHref, '/schools/me/reports/att-submitted');
});

test('never includes any peer comparison or ranking properties in student cards', () => {
  const { dueAssignments, completedAssignments } = buildStudentInbox({
    assignments: [publishedAssignment],
    attempts: [],
    now,
  });

  const allCards = [...dueAssignments, ...completedAssignments];
  for (const card of allCards) {
    assert.equal('peers' in card, false);
    assert.equal('rank' in card, false);
    assert.equal('cohortAverage' in card, false);
    assert.equal('leaderboard' in card, false);
  }
});
