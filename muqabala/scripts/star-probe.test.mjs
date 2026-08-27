import assert from 'node:assert/strict';
import test from 'node:test';
import { isRetryableFeedback } from '../lib/report-feedback.ts';
import {
  STAR_PROBE_SCORE_THRESHOLD,
  combineProbeTranscript,
  nextStarProbe,
  probeQuestion,
} from '../lib/star-probe.ts';

const weakFeedback = {
  questionId: 'q1',
  score: 27,
  status: 'scored',
  headline: 'Relevant duties, unclear motivation',
  competencies: [],
  strengths: ['You named kitchen duties'],
  improvements: [
    'Retell the situation in four clear parts: challenge, responsibility, actions and result.',
    'Add concrete details such as guest numbers or deadlines.',
  ],
  coachTip: 'Use STAR and prepare one clear sentence for each part.',
  source: 'ai',
};

test('nextStarProbe returns situation when STAR structure is missing', () => {
  assert.equal(nextStarProbe(weakFeedback), 'situation');
});

test('nextStarProbe returns null for strong scores', () => {
  assert.equal(
    nextStarProbe({ ...weakFeedback, score: STAR_PROBE_SCORE_THRESHOLD }),
    null,
  );
});

test('nextStarProbe defaults to action when no pattern matches', () => {
  assert.equal(
    nextStarProbe({
      ...weakFeedback,
      improvements: ['Be more specific.'],
      coachTip: 'Add one clear example.',
    }),
    'action',
  );
});

test('probeQuestion returns bilingual follow-ups', () => {
  assert.match(probeQuestion('action', 'en'), /personally/i);
  assert.match(probeQuestion('action', 'ar'), /شخصياً/);
});

test('combineProbeTranscript joins base and follow-up', () => {
  const combined = combineProbeTranscript(
    'Guest was upset.',
    'What did you do?',
    'I checked the booking.',
    'Follow-up',
  );
  assert.match(combined, /Guest was upset/);
  assert.match(combined, /I checked the booking/);
});

test('isRetryableFeedback detects integrity failure copy', () => {
  assert.equal(isRetryableFeedback({
    questionId: 'q1',
    score: 0,
    status: 'unscored',
    headline: 'We could not verify this feedback safely.',
    competencies: [],
    strengths: [],
    improvements: ['Your answer is saved. Try getting feedback again.'],
    coachTip: '',
    source: 'ai',
  }), true);
});
