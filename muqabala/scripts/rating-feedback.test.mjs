import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFeedbackEmail } from '../lib/feedback-email.ts';
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
  const parsed = RatingFeedbackSchema.safeParse(valid);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.publicConsent, false);
  assert.equal(RatingFeedbackSchema.safeParse({ ...valid, transcript: 'private candidate answer' }).success, false);
  assert.equal(RatingFeedbackSchema.safeParse({ ...valid, stars: 6 }).success, false);
  assert.equal(RatingFeedbackSchema.safeParse({ ...valid, questionsAnswered: 50 }).success, false);
});

test('private rating email is polished but clearly blocked from public use', () => {
  const rating = RatingFeedbackSchema.parse(valid);
  const email = buildFeedbackEmail({
    rating,
    roleLabel: 'Front Office Agent',
    receivedAt: '2026-08-23T16:24:02.964Z',
  });
  assert.match(email.subject, /New Muqabala rating/);
  assert.match(email.html, /Private feedback\. Do not publish/);
  assert.doesNotMatch(email.html, /Share-ready proof/);
});

test('only an explicitly approved rating receives a share-ready card', () => {
  const rating = RatingFeedbackSchema.parse({ ...valid, publicConsent: true });
  const email = buildFeedbackEmail({
    rating,
    roleLabel: '<script>unsafe</script>',
    receivedAt: '2026-08-23T16:24:02.964Z',
  });
  assert.match(email.subject, /Approved social proof/);
  assert.match(email.html, /Approved for anonymous sharing/);
  assert.match(email.html, /Share-ready proof/);
  assert.doesNotMatch(email.html, /<script>unsafe<\/script>/);
});

test('confidence labels are stable for the notification email', () => {
  assert.equal(confidenceLabel('more'), 'More ready');
  assert.equal(confidenceLabel('same'), 'About the same');
  assert.equal(confidenceLabel('less'), 'Less ready');
});
