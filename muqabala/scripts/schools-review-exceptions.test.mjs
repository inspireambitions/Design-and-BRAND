import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAttemptReviewExceptions } from '../lib/schools/review-exceptions.ts';

test('REVIEW EXCEPTIONS: Sparse answers detection', () => {
  const exceptions = detectAttemptReviewExceptions({
    answers: [
      'This is a very short answer with few words.',
      'This is a comprehensive response that contains more than thirty words to demonstrate how the candidate managed a complex situation with customers, colleagues, and external partners across multiple months of project execution.',
      '',
    ],
    totalPossible: 12,
    evidenceCovered: 8,
  });

  const sparseSignals = exceptions.filter((s) => s.type === 'sparse_answer');
  assert.equal(sparseSignals.length, 2, 'Detects both short and empty answers');
  assert.equal(sparseSignals[0].label, 'Sparse response on Question 1');
  assert.equal(sparseSignals[1].label, 'Sparse response on Question 3');
});

test('REVIEW EXCEPTIONS: Repeated fallbacks detection', () => {
  const exceptions = detectAttemptReviewExceptions({
    answers: [
      "I don't have a direct professional example for this question so I will explain a theoretical approach.",
      'In my internship I handled this directly.',
      "I do not have a direct example from employment, but during university...",
    ],
    totalPossible: 12,
    evidenceCovered: 6,
  });

  const fallbackSignal = exceptions.find((s) => s.type === 'repeated_fallback');
  assert.ok(fallbackSignal, 'Repeated fallback signal must trigger for 2+ questions');
  assert.equal(fallbackSignal.severity, 'attention');
  assert.ok(fallbackSignal.label.includes('2 questions'));
});

test('REVIEW EXCEPTIONS: Low evidence coverage threshold (<50%)', () => {
  const lowEvidence = detectAttemptReviewExceptions({
    answers: ['Sample long answer '.repeat(10), 'Sample long answer '.repeat(10), 'Sample long answer '.repeat(10)],
    totalPossible: 12,
    evidenceCovered: 4, // 4 < 6 (50%)
  });

  const signal = lowEvidence.find((s) => s.type === 'low_evidence');
  assert.ok(signal, 'Low evidence signal triggered');
  assert.equal(signal.severity, 'attention');

  const adequateEvidence = detectAttemptReviewExceptions({
    answers: ['Sample long answer '.repeat(10), 'Sample long answer '.repeat(10), 'Sample long answer '.repeat(10)],
    totalPossible: 12,
    evidenceCovered: 8, // 8 >= 6
  });
  assert.equal(adequateEvidence.find((s) => s.type === 'low_evidence'), undefined, 'No low evidence signal for >= 50%');
});

test('REVIEW EXCEPTIONS: Unreviewed near deadline', () => {
  const nearDeadline = detectAttemptReviewExceptions({
    answers: ['Valid '.repeat(35)],
    totalPossible: 4,
    evidenceCovered: 3,
    reviewed: false,
    dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 24h away
  });

  const signal = nearDeadline.find((s) => s.type === 'unreviewed_near_deadline');
  assert.ok(signal, 'Unreviewed near deadline triggered');
});
