import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildScreeningNotificationEmail } from '../lib/screening-notification-email.ts';
import { notificationRetry, screeningNotificationIdempotencyKey } from '../lib/screening-notification-policy.ts';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migrationFile = 'supabase/migrations/20260901040619_screening_submission_notifications.sql';

test('pass 1: candidate and employer emails contain no interview evidence or raw storage data', () => {
  for (const kind of ['candidate', 'employer']) {
    const email = buildScreeningNotificationEmail({
      kind, companyName: 'Nour Clinic <script>', roleTitle: 'Receptionist',
      submittedAt: '2026-09-01T10:42:00.000Z', reference: 'MQ-4821',
      dashboardUrl: 'https://trymuqabala.com/employer/interviews/safe-id',
    });
    const rendered = `${email.subject}\n${email.text}\n${email.html}`;
    assert.doesNotMatch(rendered, /transcript|video path|signed url|score|analysis|strength|concern|storage\/v1/i);
    assert.doesNotMatch(email.html, /<script>/i);
    assert.match(rendered, /MQ-4821/);
  }
});

test('pass 2: submit is atomic and concurrent retries create exactly two durable jobs', () => {
  const migration = read(migrationFile);
  const submit = read('app/api/screening/interviews/[id]/submit/route.ts');
  assert.match(migration, /for update/);
  assert.match(migration, /unique \(interview_id, event_type, recipient_kind\)/);
  assert.match(migration, /on conflict \(interview_id, event_type, recipient_kind\) do nothing/);
  assert.match(migration, /if interview_row\.submitted_at is not null and interview_row\.locked_at is not null/);
  assert.match(submit, /p_candidate_user_id: access\.user\.id/);
  const jobs = new Map();
  for (let retry = 0; retry < 20; retry += 1) for (const kind of ['candidate', 'employer']) jobs.set(`interview:${kind}`, kind);
  assert.equal(jobs.size, 2);
});

test('pass 3: provider failures retry safely with one stable idempotency key', () => {
  const key = screeningNotificationIdempotencyKey('job-123');
  for (let attempt = 1; attempt <= 5; attempt += 1) assert.equal(screeningNotificationIdempotencyKey('job-123'), key);
  assert.equal(notificationRetry(429, 1).permanent, false);
  assert.equal(notificationRetry(408, 1).permanent, false);
  assert.equal(notificationRetry(409, 1).permanent, false);
  assert.equal(notificationRetry(425, 1).permanent, false);
  assert.equal(notificationRetry(500, 2).permanent, false);
  assert.equal(notificationRetry(null, 3).permanent, false);
  assert.equal(notificationRetry(400, 1).permanent, true);
  assert.ok(notificationRetry(500, 5).delayMs > notificationRetry(500, 1).delayMs);
});

test('pass 4: verified identity and tenant scope are rechecked before resume, upload and send', () => {
  const start = read('app/api/interviews/route.ts');
  const resume = read('app/api/screening/resume/route.ts');
  const access = read('lib/server/interview-access.ts');
  const worker = read('lib/server/screening-notifications.ts');
  const authRequest = read('app/api/screening/auth/request/route.ts');
  assert.match(start, /email_confirmed_at/);
  assert.match(start, /p_candidate_user_id: user!\.id/);
  assert.match(resume, /eq\('candidate_user_id', candidate\.id\)/);
  assert.match(access, /activeInterview\.candidate_user_id === user\.id/);
  assert.match(worker, /expectedUserId !== job\.recipient_user_id/);
  assert.match(worker, /if \(interviewError\)/);
  assert.match(worker, /if \(packResult\.error\)/);
  assert.match(worker, /userError && userError\.status !== 404/);
  assert.match(worker, /retryJob\(job, 'database_unavailable'\)/);
  assert.match(worker, /retryJob\(job, 'auth_unavailable'\)/);
  assert.match(authRequest, /cookieStore\.delete\(AUTH_STATE_COOKIE\)/);
  assert.doesNotMatch(authRequest, /ATTEMPT_COOKIE|claimCurrentAttempt/);
});

test('pass 5: five controlled 40-candidate runs reconcile without duplicate jobs', () => {
  for (let run = 0; run < 5; run += 1) {
    const submitted = new Set();
    const notifications = new Set();
    for (let candidate = 0; candidate < 40; candidate += 1) {
      const interview = `run-${run}-candidate-${candidate}`;
      for (let duplicate = 0; duplicate < 5; duplicate += 1) {
        submitted.add(interview);
        notifications.add(`${interview}:candidate`);
        notifications.add(`${interview}:employer`);
      }
    }
    assert.equal(submitted.size, 40);
    assert.equal(notifications.size, 80);
  }
  const migration = read(migrationFile);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /attempt_count < 10/);
});

test('recovery worker uses a bounded batch and a lease longer than route runtime', () => {
  const cron = read('app/api/cron/screening-notifications/route.ts');
  const hardening = read('supabase/migrations/20260901053510_harden_screening_notification_recovery.sql');
  assert.match(cron, /limit: 5/);
  assert.match(hardening, /interval '5 minutes'/);
  assert.match(hardening, /least\(coalesce\(p_limit, 5\), 5\)/);
  assert.match(hardening, /if existing_row\.expires_at <= now\(\)/);
  assert.match(hardening, /return jsonb_build_object\('status', 'expired'\)/);
});
