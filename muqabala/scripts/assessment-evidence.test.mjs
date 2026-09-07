import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { precheckAnswer } from '../lib/universal-interview/sanitise.ts';
import { coverageFor, orderCandidates, coverageMarks } from '../lib/employer-volume/coverage.ts';
import { shortlistText, shortlistHtml, pickShortlistRows } from '../lib/employer-volume/shortlist-message.ts';
import { exportCsv } from '../lib/employer-volume/strip.ts';

registerHooks({
  load(url, context, nextLoad) {
    return nextLoad(url, url.endsWith('.json') ? { ...context, importAttributes: { type: 'json' } } : context);
  },
});
const { employerBrainAnswerFeedback } = await import('../lib/universal-interview/employer.ts');
const competencies = [{ id: 'service', label: 'Service' }, { id: 'ownership', label: 'Ownership' }];
function feedbackFor(evidence) {
  return employerBrainAnswerFeedback({
    state: { evidence_ledger: [evidence], discovery: [], screening: { competency_id_map: {} }, prompt_version: 'test' },
    question: { target_competencies: ['service', 'ownership'] }, questionId: 'test', evidenceStart: 0,
  });
}
const entry = (competencies) => ({ summary: 'I checked the reservation.', competencies, criteria: { action: 'PRESENT', result: 'MISSING' } });

test('quoted uncertainty and uncertainty followed by an example still reach extraction', () => {
  for (const answer of [
    "The guest said I don't know where my booking is. I checked the reference and restored it.",
    "I don't know. But last week I checked an incorrect invoice and fixed the charge.",
    'That exact situation never happened to me, but I handled a similar booking error.',
  ]) assert.equal(precheckAnswer(answer).kind, 'NONE');
  for (const answer of ["I don't know", 'I do not know.', 'No example', 'Never happened to me.']) {
    assert.equal(precheckAnswer(answer).kind, 'NO_EXAMPLE');
  }
});

test('absent extracted competencies never become positive employer coverage', () => {
  const feedback = feedbackFor(entry({}));
  assert.equal(feedback.status, 'scored');
  assert.equal(feedback.score, 0);
  assert.ok(feedback.competencies.every((item) => item.evidence === null && item.score === 0));
  const coverage = coverageFor(competencies, [{ feedback }]);
  assert.equal(coverage.covered, 0);
  assert.equal(coverage.analysisComplete, true);
  assert.deepEqual(coverage.items.map((item) => item.status), ['missing', 'missing']);
});

test('partial extraction does not lend its evidence to an unsupported target', () => {
  const feedback = feedbackFor(entry({ service: 'STRONG' }));
  const coverage = coverageFor(competencies, [{ feedback }]);
  assert.equal(feedback.competencies[1].evidence, null);
  assert.equal(coverage.covered, 1);
  assert.equal(coverage.full, false);
});

test('failed or missing analysis remains unknown in coverage and exports', () => {
  const feedback = feedbackFor({ ...entry({}), summary: 'extraction failed' });
  assert.equal(feedback.status, 'unscored');
  assert.equal(feedback.unscoredReason, 'scoring_service_unavailable');
  for (const answers of [[{ feedback }], [{ feedback: null }], []]) {
    const coverage = coverageFor(competencies, answers);
    assert.equal(coverage.analysisComplete, false);
    assert.ok(coverage.items.every((item) => item.status === 'unavailable'));
    assert.equal(coverageMarks(coverage), '? ?');
  }
});

test('an incomplete cohort uses submission order without disadvantaging model failure', () => {
  const full = coverageFor(competencies, [{ feedback: feedbackFor(entry({ service: 'STRONG', ownership: 'STRONG' })) }]);
  const unknown = coverageFor(competencies, []);
  const missing = coverageFor(competencies, [{ feedback: feedbackFor(entry({})) }]);
  const candidates = [
    { id: 'full', coverage: full, submittedAt: '2026-09-03T00:00:00Z' },
    { id: 'unknown', coverage: unknown, submittedAt: '2026-09-01T00:00:00Z' },
    { id: 'missing', coverage: missing, submittedAt: '2026-09-02T00:00:00Z' },
  ];
  assert.deepEqual(orderCandidates(candidates).map((item) => item.id), ['unknown', 'missing', 'full']);
  assert.deepEqual(pickShortlistRows(candidates).map((item) => item.id), ['unknown', 'missing', 'full']);
  assert.deepEqual(orderCandidates(candidates.filter((item) => item.id !== 'unknown')).map((item) => item.id), ['full', 'missing']);
});

test('email and CSV preserve unknown analysis rather than exporting a negative mark', () => {
  const coverage = coverageFor(competencies, []);
  const input = { employerName: 'Example', roleTitle: 'Example role', invited: 1, answered: 1, fullCoverage: 0,
    rows: [{ displayName: 'Example candidate', coverage, firstAnswer: 'Example answer', openUrl: 'https://example.com' }] };
  assert.match(shortlistText(input), /Example candidate  \? \?/);
  assert.match(shortlistHtml(input), /aria-label="analysis unavailable"/);
  assert.doesNotMatch(shortlistHtml(input), /aria-label="not covered"/);
  assert.match(exportCsv([{ rubric: ['Unknown', false, true] }]), /Unknown,false,true/);
});
