import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  CANDIDATE_PAGE_SIZE,
  candidateEvidence,
  candidatePage,
  dashboardSummary,
  formatDuration,
  normaliseEmployerDecision,
  packHealth,
} from '../lib/employer-dashboard.ts';

const now = new Date('2026-08-29T12:00:00.000Z');

function pack(overrides = {}) {
  return {
    id: 'pack-1',
    expires_at: '2026-09-20T12:00:00.000Z',
    max_candidates: 100,
    starts_used: 20,
    ...overrides,
  };
}

test('work sample health has explicit active, closing, full and closed states', () => {
  assert.equal(packHealth(pack(), now), 'active');
  assert.equal(packHealth(pack({ expires_at: '2026-09-03T12:00:00.000Z' }), now), 'closing');
  assert.equal(packHealth(pack({ starts_used: 100 }), now), 'full');
  assert.equal(packHealth(pack({ expires_at: '2026-08-29T11:59:59.000Z' }), now), 'closed');
});

test('dashboard pulse reports real capacity and completed submissions', () => {
  const packs = [
    pack({ id: 'active', max_candidates: 100, starts_used: 20 }),
    pack({ id: 'closing', expires_at: '2026-09-02T12:00:00.000Z', max_candidates: 10, starts_used: 4 }),
    pack({ id: 'closed', expires_at: '2026-08-20T12:00:00.000Z', max_candidates: 50, starts_used: 50 }),
  ];
  const submissions = [
    { screening_pack_id: 'active', submitted_at: '2026-08-29T10:00:00.000Z' },
    { screening_pack_id: 'closing', submitted_at: '2026-08-21T10:00:00.000Z' },
  ];
  assert.deepEqual(dashboardSummary(packs, submissions, now), {
    openedLinks: 74,
    startedInterviews: 74,
    submittedThisWeek: 1,
    submittedTotal: 2,
    reviewedTotal: 0,
    waitingForReview: 2,
    shortlistedTotal: 0,
    notProceedingTotal: 0,
    activeLinks: 2,
    placesRemaining: 86,
    submissionRate: 3,
  });
});

test('dashboard journey uses employer decisions only when a person records them', () => {
  const submissions = [
    { screening_pack_id: 'active', submitted_at: '2026-08-29T10:00:00.000Z', employer_reviewed_at: '2026-08-29T11:00:00.000Z', employer_decision: 'shortlisted' },
    { screening_pack_id: 'active', submitted_at: '2026-08-29T10:30:00.000Z', employer_reviewed_at: '2026-08-29T11:30:00.000Z', employer_decision: 'not_proceeding' },
    { screening_pack_id: 'active', submitted_at: '2026-08-29T11:00:00.000Z', employer_reviewed_at: null, employer_decision: null },
  ];
  const summary = dashboardSummary([pack({ id: 'active', starts_used: 3 })], submissions, now);
  assert.equal(summary.reviewedTotal, 2);
  assert.equal(summary.waitingForReview, 1);
  assert.equal(summary.shortlistedTotal, 1);
  assert.equal(summary.notProceedingTotal, 1);
});

test('dashboard normalises review and legacy decision vocabularies', () => {
  assert.equal(normaliseEmployerDecision('shortlist'), 'shortlisted');
  assert.equal(normaliseEmployerDecision('shortlisted'), 'shortlisted');
  assert.equal(normaliseEmployerDecision('pass'), 'not_proceeding');
  assert.equal(normaliseEmployerDecision('not_proceeding'), 'not_proceeding');
  assert.equal(normaliseEmployerDecision('later'), null);

  const submissions = [
    { screening_pack_id: 'active', submitted_at: '2026-08-29T10:00:00.000Z', employer_reviewed_at: '2026-08-29T11:00:00.000Z', employer_decision: 'shortlist' },
    { screening_pack_id: 'active', submitted_at: '2026-08-29T10:30:00.000Z', employer_reviewed_at: '2026-08-29T11:30:00.000Z', employer_decision: 'pass' },
    { screening_pack_id: 'active', submitted_at: '2026-08-29T11:00:00.000Z', employer_reviewed_at: '2026-08-29T12:00:00.000Z', employer_decision: 'later' },
  ];
  const summary = dashboardSummary([pack({ id: 'active', starts_used: 3 })], submissions, now);
  assert.equal(summary.reviewedTotal, 3);
  assert.equal(summary.shortlistedTotal, 1);
  assert.equal(summary.notProceedingTotal, 1);
  assert.equal(summary.waitingForReview, 0);
});

test('candidate evidence is ordered and never invents a recording', () => {
  const result = candidateEvidence([
    { question_index: 2, scoring_status: 'pending', video_upload_status: 'pending', video_duration_seconds: null },
    { question_index: 0, scoring_status: 'scored', video_upload_status: 'uploaded', video_duration_seconds: 89 },
    { question_index: 1, scoring_status: 'scored', video_upload_status: 'uploaded', video_duration_seconds: 45 },
  ]);
  assert.deepEqual(result.answers.map((answer) => answer.question_index), [0, 1, 2]);
  assert.equal(result.recordingsReady, 2);
  assert.equal(result.notesReady, 2);
  assert.equal(result.notesPending, true);
  assert.equal(formatDuration(89), '1:29');
  assert.equal(formatDuration(null), 'Saved');
});

test('candidate list pages at twenty and clamps bad page values', () => {
  assert.equal(CANDIDATE_PAGE_SIZE, 20);
  assert.deepEqual(candidatePage(undefined, 45), { page: 1, from: 0, to: 19, hasPrevious: false, hasNext: true, lastPage: 3 });
  assert.deepEqual(candidatePage('2', 45), { page: 2, from: 20, to: 39, hasPrevious: true, hasNext: true, lastPage: 3 });
  assert.deepEqual(candidatePage('3', 45), { page: 3, from: 40, to: 59, hasPrevious: true, hasNext: false, lastPage: 3 });
  assert.equal(candidatePage('9', 45).page, 3);
  assert.equal(candidatePage('0', 45).page, 1);
  assert.equal(candidatePage('-4', 45).page, 1);
  assert.equal(candidatePage('abc', 45).page, 1);
  assert.equal(candidatePage(['2', '3'], 45).page, 2);
  assert.deepEqual(candidatePage('1', 0), { page: 1, from: 0, to: 19, hasPrevious: false, hasNext: false, lastPage: 1 });
});

test('dashboard paginates submissions and shows no video elements in the list', async () => {
  const source = await readFile(new URL('../app/employer/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /searchParams: Promise<\{ page\?: string \| string\[\] \}>/);
  assert.match(source, /candidatePage\(page, submissions\.length\)/);
  assert.match(source, /\.order\('submitted_at', \{ ascending: false \}\)\s*\.range\(paging\.from, paging\.to\)/);
  assert.match(source, /\.in\('interview_id', detailIds\)/);
  assert.match(source, /href=\{`\/employer\?page=\$\{paging\.page \+ 1\}#candidates`\}/);
  assert.doesNotMatch(source, /<video/);
  assert.doesNotMatch(source, /createSignedUrl/);
});

test('dashboard source keeps employer ownership and consent boundaries', async () => {
  const source = await readFile(new URL('../app/employer/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /\.eq\('employer_id', user\.id\)/);
  assert.match(source, /\.not\('submitted_at', 'is', null\)/);
  assert.doesNotMatch(source, /overall_score/);
  assert.doesNotMatch(source, /EmployerLinkActions[^\n]+signed_token/);
  assert.match(source, /verifyInterview\(pack\.signed_token\)/);
  assert.match(source, /Invite candidates/);
  assert.match(source, /Create interview link/);
  assert.match(source, /Recordings first\. AI notes are a second view\. You make the decision\./);
});
