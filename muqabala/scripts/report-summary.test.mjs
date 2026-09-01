import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildReportSummary, usableReportSummary } from '../lib/report-summary.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function answer(overrides = {}) {
  return {
    question_index: 0,
    question_text: 'Tell us about a difficult guest.',
    transcript: 'A guest arrived late and the room was not ready.',
    feedback: { questionId: 'q1', score: 72, status: 'scored', headline: 'Calm under pressure', strengths: [], improvements: [] },
    scoring_status: 'scored',
    video_path: 'pack/interview/0-abc.webm',
    video_duration_seconds: 95,
    response_saved_at: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

test('report summary copies answers in question order with totals', () => {
  const summary = buildReportSummary([
    answer({ question_index: 2, video_duration_seconds: 40 }),
    answer({ question_index: 0 }),
    answer({ question_index: 1, video_path: null, video_duration_seconds: null, scoring_status: 'unscored', feedback: null }),
  ]);
  assert.equal(summary.version, 1);
  assert.deepEqual(summary.answers.map((item) => item.question_index), [0, 1, 2]);
  assert.equal(summary.answer_count, 3);
  assert.equal(summary.recordings_ready, 2);
  assert.equal(summary.total_duration_seconds, 135);
  assert.equal(summary.scoring_settled, true);
  assert.deepEqual(Object.keys(summary.answers[0]).sort(), [
    'feedback', 'question_index', 'question_text', 'response_saved_at',
    'scoring_status', 'transcript', 'video_duration_seconds', 'video_path',
  ]);
});

test('a summary with pending AI notes is not used for rendering', () => {
  const pending = buildReportSummary([answer(), answer({ question_index: 1, scoring_status: 'pending', feedback: null })]);
  assert.equal(pending.scoring_settled, false);
  assert.equal(usableReportSummary(pending), null);
  assert.equal(usableReportSummary(null), null);
  assert.equal(usableReportSummary('text'), null);
  assert.equal(usableReportSummary({ version: 99, answers: [], scoring_settled: true }), null);
  const settled = buildReportSummary([answer(), answer({ question_index: 1, scoring_status: 'failed', feedback: null })]);
  assert.equal(usableReportSummary(settled)?.answers.length, 2);
});

test('summary refresh is service-role only and never touches unsubmitted rows', () => {
  const server = read('lib/server/report-summary.ts');
  const page = read('app/employer/interviews/[id]/page.tsx');
  assert.match(server, /import 'server-only'/);
  assert.match(server, /update\(\{ report_summary: summary, report_summary_at/);
  assert.match(server, /\.not\('submitted_at', 'is', null\)/);
  assert.match(page, /after\(async \(\) => \{ await refreshReportSummary\(admin, id\); \}\)/);
  assert.doesNotMatch(server, /employer_decision|auto|reject/i);
});

test('performance migration adds only missing indexes and no policies', () => {
  const migration = read('supabase/migrations/20260901200000_performance_indexes_and_stats.sql');
  const earlier = [
    '20260823111300_account_reports_and_shares.sql',
    '20260823124825_add_report_shares_interview_index.sql',
    '20260823141546_secure_auth_claims.sql',
    '20260828120000_allow_screening_mode.sql',
    '20260828173000_employer_video_screening.sql',
    '20260901040619_screening_submission_notifications.sql',
    '20260901041607_index_screening_notification_ownership.sql',
    '20260901120000_screening_upload_recovery.sql',
    '20260901173004_employer_review_decisions.sql',
  ].map((file) => read(`supabase/migrations/${file}`)).join('\n');
  const names = [...migration.matchAll(/create (?:unique )?index if not exists (\w+)/g)].map((match) => match[1]);
  assert.ok(names.length >= 4);
  for (const name of names) assert.doesNotMatch(earlier, new RegExp(name), `${name} already exists`);
  assert.match(migration, /create extension if not exists pg_stat_statements;/);
  assert.match(migration, /-- from pg_stat_statements/);
  assert.match(migration, /mean_exec_time > 100/);
  assert.doesNotMatch(migration, /create policy|drop policy|disable row level security/);
});
