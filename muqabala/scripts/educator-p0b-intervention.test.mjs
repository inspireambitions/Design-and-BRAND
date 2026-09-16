import test from 'node:test';
import assert from 'node:assert/strict';
import { detectInterventionSignals } from '../lib/schools/intervention.ts';

const now = new Date('2026-09-16T12:00:00Z').getTime();

const members = [
  { student_user_id: 's1', display_name: 'Fatima Al-Nuaimi', student_identifier: 'STD-101' },
  { student_user_id: 's2', display_name: 'Tariq Mansoor', student_identifier: 'STD-102' },
  { student_user_id: 's3', display_name: 'Sara Chen', student_identifier: 'STD-103' },
];

const assignment = {
  id: 'asgn-1',
  role_id: 'financial-analyst',
  job_title: 'Junior Financial Analyst',
  due_at: new Date(now + 24 * 3600 * 1000).toISOString(), // due in 24 hours
  status: 'published',
};

test('detects deadline_unstarted for students with 0 attempts near deadline', () => {
  const attempts = [];
  const signals = detectInterventionSignals({
    cohortId: 'c1',
    members,
    assignments: [assignment],
    attempts,
    now,
  });

  const unstarted = signals.filter((s) => s.category === 'deadline_unstarted');
  assert.equal(unstarted.length, 3);
  assert.equal(unstarted[0].severity, 'urgent');
  assert(unstarted[0].humanReason.includes('due in 24 hours'));
  assert(unstarted[0].evidenceBasis.includes('0 attempts recorded'));
});

test('detects stalled_draft when draft is older than 48 hours', () => {
  const attempts = [
    {
      id: 'att-1',
      assignment_id: 'asgn-1',
      student_user_id: 's1',
      attempt_number: 1,
      status: 'draft',
      created_at: new Date(now - 50 * 3600 * 1000).toISOString(), // 50h ago
    },
  ];

  const signals = detectInterventionSignals({
    cohortId: 'c1',
    members: [members[0]],
    assignments: [assignment],
    attempts,
    now,
  });

  const stalled = signals.find((s) => s.category === 'stalled_draft');
  assert(stalled);
  assert.equal(stalled.severity, 'advisory');
  assert(stalled.humanReason.includes('open for 50 hours'));
});

test('detects low_evidence on submitted attempt with fewer than 50% elements (3 questions)', () => {
  const attempts = [
    {
      id: 'att-2',
      assignment_id: 'asgn-1',
      student_user_id: 's2',
      attempt_number: 1,
      status: 'submitted',
      submitted_at: new Date(now - 10 * 3600 * 1000).toISOString(),
      evidence_covered: 3,
    },
  ];

  const signals = detectInterventionSignals({
    cohortId: 'c1',
    members: [members[1]],
    assignments: [assignment],
    attempts,
    now,
  });

  const lowEv = signals.find((s) => s.category === 'low_evidence');
  assert(lowEv);
  assert.equal(lowEv.severity, 'urgent');
  assert(lowEv.evidenceBasis.includes('covered 3 rubric evidence element(s) (threshold: < 6 of 12)'));
});

test('detects low_evidence dynamically on 8-question assignment (threshold < 16)', () => {
  const assignment8Q = {
    ...assignment,
    id: 'asgn-8q',
    question_count: 8,
  };
  const attempts = [
    {
      id: 'att-8q-1',
      assignment_id: 'asgn-8q',
      student_user_id: 's2',
      attempt_number: 1,
      status: 'submitted',
      submitted_at: new Date(now - 10 * 3600 * 1000).toISOString(),
      evidence_covered: 14, // 14 < 16 (threshold is 16 of 32)
    },
  ];

  const signals = detectInterventionSignals({
    cohortId: 'c1',
    members: [members[1]],
    assignments: [assignment8Q],
    attempts,
    now,
  });

  const lowEv = signals.find((s) => s.category === 'low_evidence');
  assert(lowEv);
  assert.equal(lowEv.severity, 'urgent');
  assert(lowEv.evidenceBasis.includes('covered 14 rubric evidence element(s) (threshold: < 16 of 32)'));
});

test('detects stagnant_attempts when second attempt shows no evidence improvement', () => {
  const attempts = [
    {
      id: 'att-3a',
      assignment_id: 'asgn-1',
      student_user_id: 's3',
      attempt_number: 1,
      status: 'submitted',
      submitted_at: new Date(now - 48 * 3600 * 1000).toISOString(),
      evidence_covered: 5,
    },
    {
      id: 'att-3b',
      assignment_id: 'asgn-1',
      student_user_id: 's3',
      attempt_number: 2,
      status: 'submitted',
      submitted_at: new Date(now - 12 * 3600 * 1000).toISOString(),
      evidence_covered: 4, // dropped from 5 to 4
    },
  ];

  const signals = detectInterventionSignals({
    cohortId: 'c1',
    members: [members[2]],
    assignments: [assignment],
    attempts,
    now,
  });

  const stagnant = signals.find((s) => s.category === 'stagnant_attempts');
  assert(stagnant);
  assert.equal(stagnant.severity, 'advisory');
  assert(stagnant.evidenceBasis.includes('Attempt 1: 5 element(s); Attempt 2: 4 element(s)'));
});

test('detects active support requests without medical or psychological diagnosis', () => {
  const supportRequests = [
    {
      student_user_id: 's1',
      status: 'open',
      note: 'Need help choosing an example for question 2',
      created_at: new Date(now - 2 * 3600 * 1000).toISOString(),
    },
  ];

  const signals = detectInterventionSignals({
    cohortId: 'c1',
    members: [members[0]],
    assignments: [assignment],
    attempts: [],
    supportRequests,
    now,
  });

  const support = signals.find((s) => s.category === 'support_requested');
  assert(support);
  assert.equal(support.severity, 'urgent');
  assert(support.evidenceBasis.includes('Need help choosing an example for question 2'));
  // Ensure no diagnostic terms appear in output
  assert(!JSON.stringify(signals).toLowerCase().includes('diagnosis'));
  assert(!JSON.stringify(signals).toLowerCase().includes('rank'));
});
