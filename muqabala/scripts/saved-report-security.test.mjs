import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { hashClaimEmail, hashClaimToken, newClaimToken } from '../lib/report-crypto.ts';
import { reportPayloadFromAttempt, SaveReportRequestSchema } from '../lib/saved-report.ts';

const feedback = {
  questionId: 'q1', score: 72, status: 'scored', headline: 'Clear action, add the result', source: 'ai',
  competencies: [{ id: 'ownership', label: 'Ownership', score: 7, evidence: 'I called the supplier myself.' }],
  strengths: ['You explained your own action.'], improvements: ['Add the result.'], coachTip: 'Finish with what changed.',
};

const attempt = {
  id: 'local-1', roleId: 'front-office-agent', roleTitle: 'Front Office Agent', startedAt: new Date().toISOString(), overallScore: 72,
  answers: [{ questionId: 'q1', questionText: 'Tell me about a guest problem.', transcript: 'TOP SECRET FULL ANSWER', feedback }],
};

test('the server-safe payload never contains the full answer transcript', () => {
  const payload = reportPayloadFromAttempt(attempt);
  assert.equal(JSON.stringify(payload).includes('TOP SECRET FULL ANSWER'), false);
  assert.equal('transcript' in payload.answers[0], false);
});

test('save requests reject unknown fields and oversized evidence', () => {
  const report = reportPayloadFromAttempt(attempt);
  assert.equal(SaveReportRequestSchema.safeParse({ email: 'person@example.com', report, website: '', transcript: 'leak' }).success, false);
  const oversized = structuredClone(report);
  oversized.answers[0].evidence = ['x'.repeat(181)];
  assert.equal(SaveReportRequestSchema.safeParse({ email: 'person@example.com', report: oversized, website: '' }).success, false);
});

test('claim tokens are random, URL safe and stored only as hashes', () => {
  const first = newClaimToken();
  const second = newClaimToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.notEqual(hashClaimToken(first), first);
  const tampered = `${first[0] === 'A' ? 'B' : 'A'}${first.slice(1)}`;
  assert.notEqual(hashClaimToken(tampered), hashClaimToken(first));
});

test('email matching is case insensitive and uses a keyed hash', () => {
  const old = process.env.REPORT_CLAIM_SECRET;
  process.env.REPORT_CLAIM_SECRET = 'test-only-secret-that-is-longer-than-32-characters';
  try {
    const lower = hashClaimEmail('person@example.com');
    assert.equal(lower, hashClaimEmail(' Person@Example.com '));
    assert.equal(lower.includes('person'), false);
  } finally {
    if (old === undefined) delete process.env.REPORT_CLAIM_SECRET;
    else process.env.REPORT_CLAIM_SECRET = old;
  }
});

test('migration enforces ownership, expiry and no anonymous table access', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260823132127_create_saved_reports.sql', import.meta.url), 'utf8');
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\).*owner_id/is);
  assert.match(sql, /revoke all.*anon, authenticated/is);
  assert.match(sql, /grant select, delete.*authenticated/is);
  assert.match(sql, /delete from public\.saved_reports[\s\S]*expires_at <= now\(\)/i);
});

test('magic-link email keeps the verified minimal Supabase template', async () => {
  const html = await readFile(new URL('../supabase/templates/magic-link.html', import.meta.url), 'utf8');
  assert.equal((html.match(/\{\{ \.ConfirmationURL \}\}/g) ?? []).length, 1);
  assert.match(html, /href="\{\{ \.ConfirmationURL \}\}"/);
  assert.doesNotMatch(html, /style\s*=/i);
  assert.doesNotMatch(html, /<script|<iframe|on\w+\s*=/i);

  for (const tag of html.match(/<[^>]+>/g) ?? []) {
    assert.equal((tag.match(/"/g) ?? []).length % 2, 0, `Unbalanced quotes in ${tag}`);
  }
});
