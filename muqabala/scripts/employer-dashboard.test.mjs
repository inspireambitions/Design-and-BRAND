import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  candidateEvidence,
  dashboardSummary,
  formatDuration,
  packHealth,
} from '../lib/employer-dashboard.ts';

const now = new Date('2026-08-29T12:00:00.000Z');

function pack(overrides = {}) {
  return {
    id: 'pack-1',
    expires_at: '2026-09-20T12:00:00.000Z',
    closed_at: null,
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
  assert.equal(packHealth(pack({ closed_at: '2026-08-28T10:00:00.000Z' }), now), 'closed');
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
    submittedThisWeek: 1,
    activeLinks: 2,
    placesRemaining: 86,
    submissionRate: 3,
  });
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

test('dashboard source keeps employer ownership and consent boundaries', async () => {
  const source = await readFile(new URL('../app/employer/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /\.eq\('employer_id', user\.id\)/);
  assert.match(source, /select\('id,public_code,workplace,signed_token,created_at,expires_at,closed_at,max_candidates,starts_used'\)/);
  assert.match(source, /pack\.closed_at \|\| pack\.expires_at/);
  assert.match(source, /\.not\('submitted_at', 'is', null\)/);
  assert.doesNotMatch(source, /overall_score/);
  assert.doesNotMatch(source, /EmployerLinkActions[^\n]+signed_token/);
  assert.match(source, /verifyInterview\(pack\.signed_token\)/);
});
