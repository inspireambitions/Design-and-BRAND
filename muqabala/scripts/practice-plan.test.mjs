import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Resend } from 'resend';

process.env.PRACTICE_PLAN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.PRACTICE_PLAN_TOKEN_SECRET = randomBytes(48).toString('base64');
process.env.PRACTICE_PLAN_HASH_KEY = randomBytes(48).toString('base64');

const { SevenDayPlanSchema, PracticePlanRequestSchema, normalizeEmail, maskEmail } = await import('../lib/practice-plan/schema.ts');
const { buildSevenDayPlan } = await import('../lib/practice-plan/plan.ts');
const { decryptJson, encryptJson, issueCompletionProof, issuePlanViewToken, keyedHash, tokenHash, verifyCompletionProof, verifyPlanViewToken } = await import('../lib/practice-plan/crypto.ts');
const { redactText, safeEvent } = await import('../lib/practice-plan/redaction.ts');
const { practicePlanEmail } = await import('../lib/practice-plan/email-template.ts');
const { MemoryEmailProvider, FailureInjectionEmailProvider, EmailProviderError } = await import('../lib/practice-plan/email-provider.ts');
const { statusAfterEvent } = await import('../lib/practice-plan/delivery-events.ts');
const { retryBackoffMs } = await import('../lib/practice-plan/worker.ts');
const { configuredOrigin } = await import('../lib/server/security.ts');

const feedback = {
  questionId: 'q1', score: 62, status: 'scored', headline: 'Needs a clearer result',
  competencies: [], strengths: ['You explained your own action.'],
  improvements: ['Add a verifiable result.'], coachTip: 'Finish with what changed.', source: 'ai',
};

test('preview deployments trust their own Vercel origin without changing production', () => {
  const previous = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
    APP_ORIGIN: process.env.APP_ORIGIN,
  };
  process.env.VERCEL_ENV = 'preview';
  process.env.VERCEL_URL = 'muqabala-preview.example.vercel.app';
  process.env.APP_ORIGIN = 'https://trymuqabala.com';
  assert.equal(configuredOrigin(), 'https://muqabala-preview.example.vercel.app');
  Object.entries(previous).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
});

test('request validation is strict and accepts only the delivery consent', () => {
  const valid = {
    sessionId: '11111111-1111-4111-8111-111111111111', sessionProof: 'x'.repeat(40),
    email: 'Person@EXAMPLE.COM', locale: 'en', clientRequestId: '22222222-2222-4222-8222-222222222222',
    consentVersion: 'practice-plan-delivery-v1',
  };
  assert.equal(PracticePlanRequestSchema.safeParse(valid).success, true);
  assert.equal(PracticePlanRequestSchema.safeParse({ ...valid, marketing: true }).success, false);
  assert.equal(PracticePlanRequestSchema.safeParse({ ...valid, consentVersion: 'newsletter-v1' }).success, false);
});

test('email normalisation preserves local-part casing and lowercases only the domain', () => {
  assert.equal(normalizeEmail('  Person@EXAMPLE.COM  '), 'Person@example.com');
  assert.equal(maskEmail('person@example.com'), 'p•••••@example.com');
});

test('plan is schema validated, ordered and tied to feedback without answer excerpts', () => {
  const plan = buildSevenDayPlan('en', 'Front Office Agent', [{ questionText: 'Tell me about a complaint.', feedback }]);
  assert.equal(SevenDayPlanSchema.parse(plan).days.length, 7);
  assert.deepEqual(plan.days.map((day) => day.day), [1, 2, 3, 4, 5, 6, 7]);
  assert.match(JSON.stringify(plan), /Add a verifiable result|Finish with what changed/);
  assert.doesNotMatch(JSON.stringify(plan), /private answer transcript/i);
});

test('Arabic plan and email use real RTL documents', () => {
  const plan = buildSevenDayPlan('ar', 'موظف استقبال', [{ questionText: 'سؤال', feedback }]);
  const email = practicePlanEmail('ar', plan, 'https://trymuqabala.com/practice-plan/safe-token');
  assert.match(email.html, /<html lang="ar" dir="rtl">/);
  assert.match(email.text, /اليوم 1/);
});

test('encryption, keyed hashing and scoped tokens round-trip without exposing payloads', () => {
  const value = { email: 'person@example.com', plan: { version: '1' } };
  const encrypted = encryptJson(value);
  assert.doesNotMatch(encrypted, /person@example/);
  assert.deepEqual(decryptJson(encrypted), value);
  assert.notEqual(keyedHash('person@example.com'), tokenHash('person@example.com'));
  const proof = issueCompletionProof('11111111-1111-4111-8111-111111111111');
  assert.equal(verifyCompletionProof(proof, '11111111-1111-4111-8111-111111111111'), true);
  assert.equal(verifyCompletionProof(`${proof}x`, '11111111-1111-4111-8111-111111111111'), false);
  const view = issuePlanViewToken('22222222-2222-4222-8222-222222222222', Date.now() + 60_000);
  assert.deepEqual(verifyPlanViewToken(view), { grantId: '22222222-2222-4222-8222-222222222222' });
});

test('redaction removes raw email and token-shaped values', () => {
  const output = redactText(`failed person@example.com ${'a'.repeat(48)}`);
  assert.doesNotMatch(output, /person@example|a{20}/);
  const event = safeEvent('test', { error: 'person@example.com', answer: 'private interview answer' });
  assert.deepEqual(event, { event: 'test', error: '[email]' });
  assert.doesNotMatch(JSON.stringify(event), /private interview answer/);
});

test('out-of-order delivery events never downgrade delivered or terminal states', () => {
  assert.equal(statusAfterEvent('sent', 'email.delivered'), 'delivered');
  assert.equal(statusAfterEvent('delivered', 'email.sent'), 'delivered');
  assert.equal(statusAfterEvent('delivered', 'email.delivery_delayed'), 'delivered');
  assert.equal(statusAfterEvent('sent', 'email.complained'), 'complained');
  assert.equal(statusAfterEvent('complained', 'email.delivered'), 'complained');
});

test('Resend verifies the exact raw webhook body and rejects tampering', () => {
  const key = randomBytes(32);
  const secret = `whsec_${key.toString('base64')}`;
  const id = 'msg_browser_safe_test';
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const payload = JSON.stringify({
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: { email_id: 'provider-message-id' },
  });
  const signature = `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')}`;
  const options = { headers: { id, timestamp, signature }, webhookSecret: secret };
  assert.equal(new Resend('re_test').webhooks.verify({ payload, ...options }).type, 'email.delivered');
  assert.throws(() => new Resend('re_test').webhooks.verify({ payload: `${payload} `, ...options }));
});

test('memory and failure-injection transports are deterministic', async () => {
  const memory = new MemoryEmailProvider();
  const message = { to: 'delivered@resend.dev', from: 'Muqabala <practice@example.com>', subject: 'Test', html: '<p>Test</p>', text: 'Test', idempotencyKey: 'practice-plan/id/v1' };
  assert.equal((await memory.send(message)).providerMessageId, 'memory-1');
  assert.equal(memory.messages.length, 1);
  await assert.rejects(() => new FailureInjectionEmailProvider('retryable').send(message), (error) => error instanceof EmailProviderError && error.kind === 'retryable');
});

test('queue retry backoff grows, adds bounded jitter and caps at six hours', () => {
  assert.equal(retryBackoffMs(1, 0), 60_000);
  assert.equal(retryBackoffMs(2, 0.5), 125_000);
  assert.equal(retryBackoffMs(20, 0), 21_600_000);
  assert.ok(retryBackoffMs(20, 0.9999) < 21_610_000);
});

test('email HTML and plain text snapshots remain stable', () => {
  const plan = buildSevenDayPlan('en', 'Front Office Agent', [{ questionText: 'Question', feedback }]);
  const email = practicePlanEmail('en', plan, 'https://trymuqabala.com/practice-plan/safe-token');
  const digest = createHash('sha256').update(`${email.subject}\n${email.html}\n${email.text}`).digest('hex');
  assert.equal(digest, '74bdc2b951defb324beacad049d7c4948a14e164bcdeb4e49946b8d92f71f479');
});

test('migration contains durable idempotency, outbox and tested retention function', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260830103114_practice_plan_delivery.sql', import.meta.url), 'utf8');
  assert.match(sql, /unique \(interview_id, plan_version\)/i);
  assert.match(sql, /create table public\.practice_plan_snapshots/i);
  assert.match(sql, /plan_request_id uuid not null unique references public\.practice_plan_requests/i);
  assert.match(sql, /provider_idempotency_key text not null unique/i);
  assert.match(sql, /event_id text primary key/i);
  assert.match(sql, /create_practice_plan_request/i);
  assert.match(sql, /transactional_outbox/i);
  assert.match(sql, /delete_expired_practice_plan_data/i);
});
