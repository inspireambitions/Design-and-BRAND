import assert from 'node:assert/strict';
import test from 'node:test';

import { computeReadiness, READINESS_COVERED_MIN_SCORE } from '../lib/readiness.ts';

const competencies = [
  { id: 'communication', label: 'Communication', labelAr: 'التواصل', anchor: 'a' },
  { id: 'ownership', label: 'Ownership', labelAr: 'تحمّل المسؤولية', anchor: 'b' },
  { id: 'evidence', label: 'Specific evidence', labelAr: 'أدلة محددة', anchor: 'c' },
];

function question(id, ids) {
  return { id, text: id, textAr: id, competencies: ids, prepSeconds: 30, answerSeconds: 120, hint: '', hintAr: '' };
}

const role = {
  id: 'front-office-agent',
  title: 'Front office agent',
  titleAr: 'موظف استقبال',
  industry: 'Hospitality',
  industryAr: 'الضيافة',
  level: 'Entry',
  blurb: '',
  blurbAr: '',
  competencies,
  // 2 + 3 + 1 = 6 rubric items across the core set.
  questions: [
    question('intro', ['communication', 'ownership']),
    question('guest', ['communication', 'ownership', 'evidence']),
    question('why_gulf', ['evidence']),
  ],
  bank: [question('bank_1', ['ownership', 'evidence'])],
};

function comp(id, score, evidence = 'Quoted line from the answer.') {
  return { id, label: id, score, evidence };
}

function feedback(questionId, score, comps, status = 'scored') {
  return {
    questionId,
    score,
    status,
    headline: 'h',
    competencies: comps,
    strengths: [],
    improvements: [],
    coachTip: '',
    source: 'ai',
  };
}

function attempt(id, startedAt, answers, roleId = role.id) {
  return {
    id,
    roleId,
    roleTitle: role.title,
    startedAt,
    overallScore: null,
    answers: answers.map((fb) => ({ questionId: fb.questionId, questionText: 'q', transcript: 'said things', feedback: fb })),
  };
}

test('no attempts gives zero readiness and every competency not yet covered', () => {
  const result = computeReadiness([], role);
  assert.equal(result.score, 0);
  assert.equal(result.questionsPractised, 0);
  assert.equal(result.questionsTotal, 3);
  assert.deepEqual(result.coverage, [
    { competencyId: 'communication', label: 'Communication', labelAr: 'التواصل', covered: false },
    { competencyId: 'ownership', label: 'Ownership', labelAr: 'تحمّل المسؤولية', covered: false },
    { competencyId: 'evidence', label: 'Specific evidence', labelAr: 'أدلة محددة', covered: false },
  ]);
});

test('unanswered questions count as uncovered rubric items', () => {
  const attempts = [
    attempt('a1', '2026-09-01T10:00:00Z', [
      feedback('intro', 80, [comp('communication', 8), comp('ownership', 7)]),
    ]),
  ];
  const result = computeReadiness(attempts, role);
  // 2 of 6 items covered.
  assert.equal(result.score, 33);
  assert.equal(result.questionsPractised, 1);
  assert.equal(result.questionsTotal, 3);
  assert.equal(result.coverage.find((c) => c.competencyId === 'communication').covered, true);
  assert.equal(result.coverage.find((c) => c.competencyId === 'evidence').covered, false);
});

test('a competency is covered only with non-empty evidence and a score of six or more', () => {
  const attempts = [
    attempt('a1', '2026-09-01T10:00:00Z', [
      feedback('guest', 70, [
        comp('communication', READINESS_COVERED_MIN_SCORE),
        comp('ownership', READINESS_COVERED_MIN_SCORE - 1),
        comp('evidence', 9, null),
      ]),
    ]),
  ];
  const result = computeReadiness(attempts, role);
  // Only communication counts: 1 of 6.
  assert.equal(result.score, 17);
  assert.deepEqual(result.coverage.map((c) => c.covered), [true, false, false]);
});

test('whitespace-only evidence does not count', () => {
  const attempts = [attempt('a1', '2026-09-01T10:00:00Z', [feedback('why_gulf', 90, [comp('evidence', 9, '   ')])])];
  assert.equal(computeReadiness(attempts, role).score, 0);
});

test('unscored attempts contribute nothing, not even to questions practised', () => {
  const attempts = [
    attempt('a1', '2026-09-01T10:00:00Z', [
      feedback('intro', 0, [comp('communication', 9), comp('ownership', 9)], 'unscored'),
    ]),
  ];
  const result = computeReadiness(attempts, role);
  assert.equal(result.score, 0);
  assert.equal(result.questionsPractised, 0);
});

test('weighted to the best attempt per question, not the latest', () => {
  const attempts = [
    // Newest first, as storage returns them. The newer attempt scored lower.
    attempt('a2', '2026-09-02T10:00:00Z', [feedback('intro', 40, [comp('communication', 4), comp('ownership', 4)])]),
    attempt('a1', '2026-09-01T10:00:00Z', [feedback('intro', 85, [comp('communication', 9), comp('ownership', 8)])]),
  ];
  const result = computeReadiness(attempts, role);
  assert.equal(result.score, 33);
  assert.equal(result.questionsPractised, 1);
});

test('a lower-scoring attempt cannot add coverage the best attempt lacks', () => {
  const attempts = [
    attempt('a2', '2026-09-02T10:00:00Z', [feedback('intro', 60, [comp('communication', 2), comp('ownership', 9)])]),
    attempt('a1', '2026-09-01T10:00:00Z', [feedback('intro', 75, [comp('communication', 8), comp('ownership', 3)])]),
  ];
  const result = computeReadiness(attempts, role);
  assert.equal(result.score, 17);
  assert.equal(result.coverage.find((c) => c.competencyId === 'ownership').covered, false);
});

test('ties on score go to the attempt that covers more of the rubric', () => {
  const attempts = [
    attempt('a2', '2026-09-02T10:00:00Z', [feedback('intro', 70, [comp('communication', 7), comp('ownership', 3)])]),
    attempt('a1', '2026-09-01T10:00:00Z', [feedback('intro', 70, [comp('communication', 7), comp('ownership', 7)])]),
  ];
  assert.equal(computeReadiness(attempts, role).score, 33);
  // Order of the list must not change the answer.
  assert.equal(computeReadiness([...attempts].reverse(), role).score, 33);
});

test('ties on score and coverage go to the most recent attempt', () => {
  const older = attempt('a1', '2026-09-01T10:00:00Z', [feedback('intro', 70, [comp('communication', 7), comp('ownership', 3)])]);
  const newer = attempt('a2', '2026-09-02T10:00:00Z', [feedback('intro', 70, [comp('ownership', 8), comp('communication', 2)])]);
  const forward = computeReadiness([newer, older], role);
  const backward = computeReadiness([older, newer], role);
  assert.deepEqual(forward, backward);
  assert.equal(forward.coverage.find((c) => c.competencyId === 'ownership').covered, true);
  assert.equal(forward.coverage.find((c) => c.competencyId === 'communication').covered, false);
});

test('identical timestamps still resolve deterministically by list order', () => {
  const same = '2026-09-01T10:00:00Z';
  const first = attempt('a1', same, [feedback('intro', 70, [comp('communication', 7), comp('ownership', 3)])]);
  const second = attempt('a2', same, [feedback('intro', 70, [comp('ownership', 8), comp('communication', 2)])]);
  const result = computeReadiness([first, second], role);
  assert.equal(result.coverage.find((c) => c.competencyId === 'communication').covered, true);
  assert.equal(computeReadiness([first, second], role).score, computeReadiness([first, second], role).score);
});

test('attempts for other roles are ignored', () => {
  const attempts = [
    attempt('a1', '2026-09-01T10:00:00Z', [feedback('intro', 90, [comp('communication', 9), comp('ownership', 9)])], 'nurse'),
  ];
  assert.equal(computeReadiness(attempts, role).score, 0);
});

test('answered bank questions join the set; unanswered bank questions do not', () => {
  const attempts = [
    attempt('a1', '2026-09-01T10:00:00Z', [feedback('bank_1', 80, [comp('ownership', 8), comp('evidence', 8)])]),
  ];
  const result = computeReadiness(attempts, role);
  assert.equal(result.questionsTotal, 4);
  assert.equal(result.questionsPractised, 1);
  // 2 of 8 items.
  assert.equal(result.score, 25);
});

test('answers to questions outside the role are ignored', () => {
  const attempts = [attempt('a1', '2026-09-01T10:00:00Z', [feedback('mystery', 95, [comp('communication', 9)])])];
  const result = computeReadiness(attempts, role);
  assert.equal(result.score, 0);
  assert.equal(result.questionsPractised, 0);
  assert.equal(result.questionsTotal, 3);
});

test('structure-checker dimensions never count as rubric coverage', () => {
  const attempts = [
    attempt('a1', '2026-09-01T10:00:00Z', [
      { ...feedback('intro', 88, [comp('situation', 9), comp('own_actions', 9)]), source: 'structure' },
    ]),
  ];
  const result = computeReadiness(attempts, role);
  assert.equal(result.score, 0);
  assert.equal(result.questionsPractised, 1);
});

test('full coverage gives 100 and every competency covered with Arabic labels intact', () => {
  const attempts = [
    attempt('a1', '2026-09-01T10:00:00Z', [
      feedback('intro', 90, [comp('communication', 9), comp('ownership', 9)]),
      feedback('guest', 90, [comp('communication', 9), comp('ownership', 9), comp('evidence', 9)]),
      feedback('why_gulf', 90, [comp('evidence', 9)]),
    ]),
  ];
  const result = computeReadiness(attempts, role);
  assert.equal(result.score, 100);
  assert.equal(result.questionsPractised, 3);
  assert.deepEqual(
    result.coverage.map((c) => [c.labelAr, c.covered]),
    [['التواصل', true], ['تحمّل المسؤولية', true], ['أدلة محددة', true]],
  );
});

test('a malformed rubric contributes no items rather than a partial one', () => {
  const broken = { ...role, questions: [question('dup', ['communication', 'communication']), question('why_gulf', ['evidence'])] };
  const attempts = [attempt('a1', '2026-09-01T10:00:00Z', [feedback('why_gulf', 90, [comp('evidence', 9)])])];
  const result = computeReadiness(attempts, broken);
  assert.equal(result.questionsTotal, 2);
  assert.equal(result.score, 100);
});

test('is pure: input attempts are not mutated', () => {
  const attempts = [attempt('a1', '2026-09-01T10:00:00Z', [feedback('intro', 80, [comp('communication', 8), comp('ownership', 7)])])];
  const snapshot = JSON.stringify(attempts);
  computeReadiness(attempts, role);
  assert.equal(JSON.stringify(attempts), snapshot);
});
