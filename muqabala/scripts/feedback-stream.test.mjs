import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeFeedbackStreamChunk,
  encodeFeedbackStreamEvent,
  extractPartialFeedback,
  partialFeedbackChanged,
} from '../lib/feedback-stream.ts';
import { FEEDBACK_JSON_SCHEMA } from '../lib/scoring-provider.ts';

const full = JSON.stringify({
  unscorable: false,
  unscorable_reason: 'none',
  headline: 'Clear story, missing result',
  strengths: ['You named the guest and the problem.', 'You said what you did first.'],
  improvements: ['Say how long the fix took.'],
  coach_tip: 'End with the result in one sentence.',
  competencies: [{ id: 'service', score: 7, evidence: 'I called housekeeping myself.' }],
});

test('the provider schema puts readable blocks before scores', () => {
  const keys = Object.keys(FEEDBACK_JSON_SCHEMA.properties);
  assert.deepEqual(keys.slice(0, 6), ['unscorable', 'unscorable_reason', 'headline', 'strengths', 'improvements', 'coach_tip']);
  assert.equal(keys.at(-1), 'competencies');
});

test('completed blocks are read while the object is still open', () => {
  const cut = full.indexOf('"improvements"');
  const partial = extractPartialFeedback(full.slice(0, cut));
  assert.equal(partial.headline, 'Clear story, missing result');
  assert.deepEqual(partial.strengths, ['You named the guest and the problem.', 'You said what you did first.']);
  assert.equal(partial.improvements, undefined);
  assert.equal(partial.coachTip, undefined);
});

test('an unfinished array or string is not surfaced', () => {
  const cut = full.indexOf('You said what');
  const partial = extractPartialFeedback(full.slice(0, cut));
  assert.equal(partial.headline, 'Clear story, missing result');
  assert.equal(partial.strengths, undefined);

  const openString = extractPartialFeedback('{"unscorable":false,"unscorable_reason":"none","headline":"Half a hea');
  assert.equal(openString.headline, undefined);
});

test('field names inside quoted text never count as keys', () => {
  const tricky = JSON.stringify({
    unscorable: false,
    unscorable_reason: 'none',
    headline: 'Your "strengths": [not] a field, and \\ escapes',
    strengths: ['Real strength'],
  }).slice(0, -1);
  const partial = extractPartialFeedback(tricky);
  assert.equal(partial.headline, 'Your "strengths": [not] a field, and \\ escapes');
  assert.deepEqual(partial.strengths, ['Real strength']);
});

test('Arabic text streams the same way', () => {
  const arabic = JSON.stringify({
    unscorable: false,
    unscorable_reason: 'none',
    headline: 'قصة واضحة تنقصها النتيجة',
    strengths: ['ذكرت ما فعلته أولاً.'],
  });
  const open = extractPartialFeedback(arabic.slice(0, arabic.indexOf('أولاً')));
  assert.equal(open.headline, 'قصة واضحة تنقصها النتيجة');
  assert.equal(open.strengths, undefined);
  const closed = extractPartialFeedback(arabic);
  assert.deepEqual(closed.strengths, ['ذكرت ما فعلته أولاً.']);
});

test('the whole object yields every readable block and nothing scored', () => {
  const partial = extractPartialFeedback(full);
  assert.deepEqual(partial, {
    headline: 'Clear story, missing result',
    strengths: ['You named the guest and the problem.', 'You said what you did first.'],
    improvements: ['Say how long the fix took.'],
    coachTip: 'End with the result in one sentence.',
  });
  assert.equal('competencies' in partial, false);
});

test('change detection only fires when a block lands', () => {
  assert.equal(partialFeedbackChanged({}, {}), false);
  assert.equal(partialFeedbackChanged({}, { headline: 'x' }), true);
  assert.equal(partialFeedbackChanged({ strengths: ['a'] }, { strengths: ['a'] }), false);
});

test('NDJSON events survive being split across chunks', () => {
  const first = encodeFeedbackStreamEvent({ type: 'partial', partial: { headline: 'One' } });
  const second = encodeFeedbackStreamEvent({
    type: 'error',
    status: 504,
    error: { code: 'scoring_timeout', message: 'Feedback is taking longer than usual.', retryable: true, retryAfterSeconds: 0 },
  });
  const wire = first + second;
  const chunkA = wire.slice(0, first.length + 10);
  const chunkB = wire.slice(first.length + 10);

  const a = decodeFeedbackStreamChunk(chunkA);
  assert.equal(a.events.length, 1);
  assert.equal(a.events[0].type, 'partial');
  const b = decodeFeedbackStreamChunk(a.remainder + chunkB);
  assert.equal(b.events.length, 1);
  assert.equal(b.events[0].type, 'error');
  assert.equal(b.remainder, '');
});
