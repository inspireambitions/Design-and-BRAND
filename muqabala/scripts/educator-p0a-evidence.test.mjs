import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSchoolsFeedback, calculateEvidence, schoolsFeedbackSchema } from '../lib/schools/evidence.ts';

const rubric = Array.from({ length: 4 }, (_, i) => ({
  id: 'elem_' + i,
  label: 'Element ' + i,
  description: 'Evidence description for element ' + i,
}));

function makeProviderPayload(count) {
  return {
    questions: Array.from({ length: count }, (_, questionIndex) => ({
      questionIndex,
      improvement: 'Provide concrete examples and metrics.',
      elements: Array.from({ length: 4 }, (_, i) => ({
        id: 'elem_' + i,
        present: i === 0,
        firstExcerpt: i === 0 ? 0 : null,
        lastExcerpt: i === 0 ? 0 : null,
        confidence: 'high',
      })),
    })),
  };
}

test('resolves and calculates evidence for 3, 5, and 8 questions successfully', () => {
  for (const count of [3, 5, 8]) {
    const answer = 'Led team sprint planning. Delivered feature ahead of time.';
    const answers = Array(count).fill(answer);
    const rubrics = Array(count).fill(rubric);
    const raw = makeProviderPayload(count);

    const feedback = resolveSchoolsFeedback(raw, answers);
    assert.equal(feedback.questions.length, count);

    const validated = calculateEvidence(feedback, answers, rubrics);
    assert.equal(validated.covered, count); // 1 element present per question
    assert.equal(validated.detail.length, count);
  }
});

test('rejects evidence schemas with fewer than 3 or more than 8 questions', () => {
  assert.throws(() => schoolsFeedbackSchema.parse(makeProviderPayload(2)));
  assert.throws(() => schoolsFeedbackSchema.parse(makeProviderPayload(9)));
});

test('calculateEvidence rejects mismatch between answers and rubrics count', () => {
  const count = 4;
  const raw = makeProviderPayload(count);
  const answers = Array(count).fill('Sample answer text.');
  const rubrics = Array(count - 1).fill(rubric);
  const feedback = resolveSchoolsFeedback(raw, answers);

  assert.throws(
    () => calculateEvidence(feedback, answers, rubrics),
    /Between 3 and 8 answers and matching rubrics are required/
  );
});
