import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTrustedQuestionSequence } from '../lib/interview-plan-policy.ts';

const opener = 'opening-question';
const closer = 'closing-question';

test('Quick Practice accepts exactly the trusted opening question', () => {
  assert.equal(matchesTrustedQuestionSequence('guided', [opener], opener, closer), true);
});

test('Quick Practice rejects the old five-question plan', () => {
  assert.equal(
    matchesTrustedQuestionSequence('guided', [opener, 'q2', 'q3', 'q4', closer], opener, closer),
    false,
  );
});

test('Quick Practice rejects a substituted question', () => {
  assert.equal(matchesTrustedQuestionSequence('guided', ['other-question'], opener, closer), false);
});
