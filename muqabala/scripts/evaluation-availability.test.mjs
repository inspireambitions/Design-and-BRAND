import test from 'node:test';
import assert from 'node:assert/strict';
import { isLegacyUntimedEvaluation } from '../lib/evaluation-availability.ts';

const untimed = Array.from({ length: 14 }, () => ({ transcript_timing_version: null }));
test('a submitted interview from before timing capture retains its original review', () => {
  assert.equal(isLegacyUntimedEvaluation('2026-09-03T14:36:23.933139+00:00', untimed), true);
});
test('missing timings on a new interview remain a fault', () => {
  assert.equal(isLegacyUntimedEvaluation('2026-09-05T09:00:00Z', untimed), false);
});
test('empty, mixed, invalid-date and unknown-version data cannot be called legacy', () => {
  const before = '2026-09-03T14:00:00Z';
  assert.equal(isLegacyUntimedEvaluation(before, []), false);
  assert.equal(isLegacyUntimedEvaluation('invalid', untimed), false);
  assert.equal(isLegacyUntimedEvaluation(before, [...untimed, { transcript_timing_version: 'openai-whisper-segment-v1' }]), false);
  assert.equal(isLegacyUntimedEvaluation(before, [{ transcript_timing_version: 'unknown' }]), false);
});
