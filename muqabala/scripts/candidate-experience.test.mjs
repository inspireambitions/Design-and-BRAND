import assert from 'node:assert/strict';
import test from 'node:test';

import { rubricForQuestion } from '../lib/question-rubric.ts';
import { compareRetries } from '../lib/retry-comparison.ts';
import { containsArabicScript } from '../lib/scoring.ts';

const competency = (id, evidence = null) => ({ id, label: id, score: evidence ? 8 : 2, evidence });
const feedback = (overrides = {}) => ({
  questionId: 'q1', score: 70, status: 'scored', headline: 'Result',
  competencies: [competency('ownership')], strengths: [], improvements: ['Add the outcome.'],
  coachTip: 'Say what changed.', source: 'ai', scoringVersion: 'model-v1', rubricVersion: 'rubric-v1',
  ...overrides,
});

test('question rubric returns exact stored criteria in question order and fails closed', () => {
  const role = {
    competencies: [
      { id: 'a', label: 'A', labelAr: 'أ', anchor: 'Exact A' },
      { id: 'b', label: 'B', labelAr: 'ب', anchor: 'Exact B' },
    ],
  };
  assert.deepEqual(rubricForQuestion(role, { competencies: ['b', 'a'] }).map((item) => item.anchor), ['Exact B', 'Exact A']);
  assert.deepEqual(rubricForQuestion(role, { competencies: ['a', 'missing'] }), []);
  assert.deepEqual(rubricForQuestion(role, { competencies: ['a', 'a'] }), []);
});

test('retry comparison blocks missing or changed versions and mismatched questions', () => {
  assert.equal(compareRetries(feedback({ scoringVersion: undefined }), feedback({ scoringVersion: undefined })).compatible, false);
  assert.equal(compareRetries(feedback(), feedback({ rubricVersion: 'rubric-v2' })).compatible, false);
  assert.equal(compareRetries(feedback(), feedback({ questionId: 'q2' })).compatible, false);
});

test('retry comparison separates added, changed and still-missing evidence', () => {
  const before = feedback({ competencies: [competency('a'), competency('b', 'Old proof'), competency('c')] });
  const after = feedback({ competencies: [competency('a', 'New proof'), competency('b', 'Different proof'), competency('c')] });
  const result = compareRetries(before, after);
  assert.equal(result.compatible, true);
  assert.deepEqual(result.evidenceAdded.map((item) => item.id), ['a']);
  assert.deepEqual(result.evidenceChanged.map((item) => item.id), ['b']);
  assert.deepEqual(result.stillMissing.map((item) => item.id), ['c']);
});

test('mixed-script answers require multilingual understanding even when Latin text dominates', () => {
  assert.equal(containsArabicScript('I called the guest ثم شرحت الحل and fixed the booking'), true);
  assert.equal(containsArabicScript('I called the guest and fixed the booking'), false);
});
