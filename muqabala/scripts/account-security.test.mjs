import test from 'node:test';
import assert from 'node:assert/strict';
import { reportProjection } from '../lib/interviews.ts';
import { clearSensitiveLocalData } from '../lib/storage.ts';

const interview = {
  id: '00000000-0000-4000-8000-000000000001', user_id: null,
  role_id: 'front-office-agent', role_title: 'Front Office Agent', language: 'en', mode: 'mock',
  status: 'completed', current_question: 7, question_snapshot: [], overall_score: 82, saved: false,
  started_at: '2026-08-23T00:00:00.000Z', updated_at: '2026-08-23T00:00:00.000Z',
  completed_at: '2026-08-23T00:00:00.000Z', expires_at: '2026-08-30T00:00:00.000Z',
};

const feedback = (questionId, score, index) => ({
  questionId, score, status: 'scored', headline: 'Clear answer', competencies: [],
  strengths: [`Specific example ${index}`], improvements: [`Private improvement ${index}`], coachTip: `Private next step ${index}.`, source: 'ai',
});

const answers = Array.from({ length: 8 }, (_, index) => ({
  question_index: index, question_id: `q${index + 1}`, question_text: `Question ${index + 1}`,
  transcript: `Private answer ${index + 1}`, feedback: feedback(`q${index + 1}`, 70 + index, index + 1), scoring_status: 'scored',
}));

test('anonymous report exposes only Question 1 and no overall score', () => {
  const report = reportProjection(interview, answers, false);
  assert.equal(report.unlocked, false);
  assert.equal(report.answers.length, 1);
  assert.equal(report.answers[0].questionText, 'Question 1');
  assert.equal(report.overallScore, null);
  assert.equal(report.lockedQuestionCount, 7);
  assert.equal(JSON.stringify(report).includes('Private answer 2'), false);
  assert.equal(JSON.stringify(report).includes('Private improvement 2'), false);
  assert.equal(JSON.stringify(report).includes('Private next step 2'), false);
});

test('verified owner receives the full report', () => {
  const report = reportProjection(interview, answers, true);
  assert.equal(report.unlocked, true);
  assert.equal(report.answers.length, 8);
  assert.equal(report.overallScore, 82);
});

test('sign-out clears local transcripts and drafts but keeps language choice', () => {
  const values = new Map([
    ['muqabala.attempts.v1', 'sensitive history'],
    ['muqabala.draft.v1.front-office-agent', 'unfinished transcript'],
    ['muqabala.interview.legacy', 'legacy transcript'],
    ['muqabala.lang.v1', 'ar'],
  ]);
  global.window = {
    localStorage: {
      get length() { return values.size; },
      key(index) { return [...values.keys()][index] ?? null; },
      removeItem(key) { values.delete(key); },
    },
  };
  clearSensitiveLocalData();
  assert.equal(values.has('muqabala.attempts.v1'), false);
  assert.equal(values.has('muqabala.draft.v1.front-office-agent'), false);
  assert.equal(values.has('muqabala.interview.legacy'), false);
  assert.equal(values.get('muqabala.lang.v1'), 'ar');
  delete global.window;
});
