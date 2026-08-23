import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFeedbackEmail } from '../lib/feedback-email.ts';
import { confidenceLabel, RatingFeedbackSchema } from '../lib/rating-feedback.ts';
import { createFeedbackShareToken, verifyFeedbackShareToken } from '../lib/feedback-share.ts';

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
  assert.equal(RatingFeedbackSchema.safeParse({ ...valid, suggestion: 'Clear and useful.' }).success, true);
  assert.equal(RatingFeedbackSchema.safeParse({ ...valid, suggestion: 'x'.repeat(601) }).success, false);
});

test('written suggestions remain private and are escaped in the email', () => {
  const rating = RatingFeedbackSchema.parse({
    ...valid,
    suggestion: '<script>Make the first screen simpler.</script>',
  });
  const email = buildFeedbackEmail({
    rating,
    roleLabel: 'Front Office Agent',
    receivedAt: '2026-08-23T16:24:02.964Z',
  });
  assert.match(email.subject, /New Muqabala suggestion/);
  assert.match(email.html, /Private written suggestion/);
  assert.match(email.html, /Make the first screen simpler/);
  assert.doesNotMatch(email.html, /<script>Make the first screen simpler/);
  assert.doesNotMatch(email.html, /Share-ready proof/);
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
    shareUrls: {
      square: 'https://trymuqabala.com/api/feedback/share-card?format=square',
      wide: 'https://trymuqabala.com/api/feedback/share-card?format=wide',
    },
  });
  assert.match(email.subject, /Approved social proof/);
  assert.match(email.html, /Approved for anonymous sharing/);
  assert.match(email.html, /Muqabala user feedback/);
  assert.doesNotMatch(email.html, /Candidate signal/);
  assert.match(email.html, /Share-ready proof/);
  assert.match(email.html, /Square image/);
  assert.match(email.html, /Wide image/);
  assert.doesNotMatch(email.html, /<script>unsafe<\/script>/);
});

test('share-card data is signed and tampering is rejected', () => {
  process.env.REPORT_CLAIM_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
  const payload = {
    v: 1,
    stars: 5,
    confidence: 'more',
    questions: 8,
    role: 'Front Office Agent',
    score: 78,
  };
  const token = createFeedbackShareToken(payload);
  assert.deepEqual(verifyFeedbackShareToken(token.data, token.signature), payload);
  assert.equal(verifyFeedbackShareToken(`${token.data}x`, token.signature), null);
  assert.equal(verifyFeedbackShareToken(token.data, `${token.signature.slice(0, -1)}x`), null);
});

test('confidence labels are stable for the notification email', () => {
  assert.equal(confidenceLabel('more'), 'More ready');
  assert.equal(confidenceLabel('same'), 'About the same');
  assert.equal(confidenceLabel('less'), 'Less ready');
});
