import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confidenceLabel, RatingFeedbackSchema } from '../lib/rating-feedback.ts';

const valid = {
  attemptId: 'front-desk-1724412345678',
  roleId: 'front-desk',
  stars: 5,
  confidence: 'more',
  overallScore: 74,
  questionsAnswered: 8,
  language: 'en',
};

test('anonymous rating accepts only the bounded fields needed for the email', () => {
  assert.equal(RatingFeedbackSchema.safeParse(valid).success, true);
  assert.equal(RatingFeedbackSchema.safeParse({ ...valid, transcript: 'private candidate answer' }).success, false);
  assert.equal(RatingFeedbackSchema.safeParse({ ...valid, stars: 6 }).success, false);
  assert.equal(RatingFeedbackSchema.safeParse({ ...valid, questionsAnswered: 50 }).success, false);
});

test('confidence labels are stable for the notification email', () => {
  assert.equal(confidenceLabel('more'), 'More ready');
  assert.equal(confidenceLabel('same'), 'About the same');
  assert.equal(confidenceLabel('less'), 'Less ready');
});
