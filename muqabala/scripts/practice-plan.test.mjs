import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { register } from 'node:module';
import test from 'node:test';

register('./test-hooks/ts-paths.mjs', import.meta.url);

process.env.PRACTICE_PLAN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.PRACTICE_PLAN_TOKEN_SECRET = randomBytes(48).toString('base64');
process.env.PRACTICE_PLAN_HASH_KEY = randomBytes(48).toString('base64');

const { SevenDayPlanSchema, PracticePlanRequestSchema, normalizeEmail, maskEmail } = await import('../lib/practice-plan/schema.ts');
const { buildSevenDayPlan, buildPlanLinks, pickPlanQuestions, practiceDeepLink } = await import('../lib/practice-plan/plan.ts');
const { plainDash } = await import('../lib/practice-plan/sample-answer.ts');
const { decryptJson, encryptJson, issuePlanViewToken, keyedHash, tokenHash, verifyPlanViewToken } = await import('../lib/practice-plan/crypto.ts');
const { redactText, safeEvent } = await import('../lib/practice-plan/redaction.ts');
const { practicePlanEmail } = await import('../lib/practice-plan/email-template.ts');
const { MemoryEmailProvider, FailureInjectionEmailProvider, EmailProviderError, ResendEmailProvider } = await import('../lib/practice-plan/email-provider.ts');
const { statusAfterEvent } = await import('../lib/practice-plan/delivery-events.ts');
const { verifyResendWebhook, parseResendWebhook } = await import('../lib/practice-plan/webhook-signature.ts');
const { retryBackoffMs, providerIdempotencyKey } = await import('../lib/practice-plan/worker.ts');
const { getRole } = await import('../lib/roles/index.ts');

const ORIGIN = 'https://trymuqabala.com';
const role = getRole('front-office-agent');

const feedback = {
  questionId: 'angry_guest', score: 62, status: 'scored', headline: 'Needs a clearer result',
  competencies: [], strengths: ['You explained your own action.'],
  improvements: ['Add a verifiable result.'], coachTip: 'Finish with what changed.', source: 'ai',
};

const validRequest = {
  roleId: 'front-office-agent', questionId: 'angry_guest', email: 'Person@EXAMPLE.COM', locale: 'en', mode: 'speak',
  clientRequestId: '22222222-2222-4222-8222-222222222222',
  consentVersion: 'practice-plan-delivery-v2', consentSource: 'feedback_card',
};

test('request validation is strict, records the consent source and rejects extras', () => {
  assert.equal(PracticePlanRequestSchema.safeParse(validRequest).success, true);
  assert.equal(PracticePlanRequestSchema.safeParse({ ...validRequest, interviewId: '11111111-1111-4111-8111-111111111111' }).success, true);
  assert.equal(PracticePlanRequestSchema.safeParse({ ...validRequest, marketing: true }).success, false);
  assert.equal(PracticePlanRequestSchema.safeParse({ ...validRequest, consentSource: 'newsletter' }).success, false);
  assert.equal(PracticePlanRequestSchema.safeParse({ ...validRequest, consentVersion: 'practice-plan-delivery-v1' }).success, false);
  assert.equal(PracticePlanRequestSchema.safeParse({ ...validRequest, mode: 'phone' }).success, false);
  assert.equal(PracticePlanRequestSchema.safeParse({ ...validRequest, roleId: '../etc' }).success, false);
});

test('email normalisation preserves local-part casing and lowercases only the domain', () => {
  assert.equal(normalizeEmail('  Person@EXAMPLE.COM  '), 'Person@example.com');
  assert.equal(maskEmail('person@example.com'), 'p•••••@example.com');
});

test('plan is seven distinct role questions that skip the one already answered', () => {
  const plan = buildSevenDayPlan(role, { locale: 'en', mode: 'speak', focusQuestionId: 'angry_guest', feedback });
  assert.equal(SevenDayPlanSchema.parse(plan).days.length, 7);
  assert.deepEqual(plan.days.map((day) => day.day), [1, 2, 3, 4, 5, 6, 7]);
  const ids = plan.days.map((day) => day.questionId);
  assert.equal(new Set(ids).size, 7);
  assert.equal(ids.includes('angry_guest'), false);
  assert.equal(plan.focusQuestionId, 'angry_guest');
  assert.equal(plan.report.score, 62);
  assert.deepEqual(plan.report.improvements, ['Add a verifiable result.']);
  assert.ok(plan.sampleAnswer.length >= 4);
  assert.ok(plan.days.every((day) => day.tags.length <= 2));
  assert.doesNotMatch(JSON.stringify(plan), /\u2014/);
});

test('plan without readable feedback still ships and never invents a report', () => {
  const plan = buildSevenDayPlan(role, { locale: 'en', mode: 'type', focusQuestionId: 'angry_guest' });
  assert.equal(plan.report, null);
  const email = practicePlanEmail(plan, 1, buildPlanLinks(ORIGIN, 'token', plan));
  assert.match(email.text, /Your full feedback is on the screen/);
});

test('a small role pads to seven days rather than failing', () => {
  const tiny = { ...role, questions: role.questions.slice(0, 3), bank: [] };
  const picked = pickPlanQuestions(tiny, tiny.questions[0].id);
  assert.equal(picked.length, 7);
});

test('deep links carry focus, mode and language, and day links pass through the landing page', () => {
  const plan = buildSevenDayPlan(role, { locale: 'ar', mode: 'video', focusQuestionId: 'angry_guest' });
  const link = new URL(practiceDeepLink(ORIGIN, plan, 'overbooking'));
  assert.equal(link.pathname, '/practice/front-office-agent');
  assert.equal(link.searchParams.get('focus'), 'overbooking');
  assert.equal(link.searchParams.get('mode'), 'video');
  assert.equal(link.searchParams.get('lang'), 'ar');
  const links = buildPlanLinks(ORIGIN, 'abc.def', plan);
  assert.equal(links.days.length, 7);
  assert.equal(new URL(links.days[2]).searchParams.get('day'), '3');
  assert.match(links.days[0], /\/practice-plan\/abc\.def\?day=1$/);
  const whatsapp = new URL(links.whatsapp);
  assert.equal(whatsapp.host, 'wa.me');
  assert.equal(whatsapp.pathname, '/');
  const text = whatsapp.searchParams.get('text');
  for (const dayLink of links.days) assert.ok(text.includes(dayLink), `WhatsApp text carries ${dayLink}`);
  assert.doesNotMatch(links.whatsapp, /phone=/);
});

test('day one email carries report, sample answer, all seven links and the WhatsApp offer; later days carry one question', () => {
  const plan = buildSevenDayPlan(role, { locale: 'en', mode: 'speak', focusQuestionId: 'angry_guest', feedback });
  const links = buildPlanLinks(ORIGIN, 'tok', plan);
  const first = practicePlanEmail(plan, 1, links);
  assert.match(first.subject, /Keep this feedback/);
  assert.match(first.html, /<html lang="en" dir="ltr">/);
  assert.match(first.html, /Get these on WhatsApp instead/);
  assert.match(first.html, /Add a verifiable result\./);
  for (const link of links.days) assert.ok(first.html.includes(link));
  assert.ok(first.text.includes(links.whatsapp));
  const fourth = practicePlanEmail(plan, 4, links);
  assert.match(fourth.subject, /^Day 4 of 7: /);
  assert.ok(fourth.html.includes(links.days[3]));
  assert.ok(!fourth.html.includes(links.days[4]));
  assert.doesNotMatch(fourth.html, /WhatsApp/);
  assert.throws(() => practicePlanEmail(plan, 8, links));
  for (const day of [1, 2, 3, 4, 5, 6, 7]) {
    const rendered = practicePlanEmail(plan, day, links);
    assert.doesNotMatch(rendered.html, /\u2014/, `day ${day} html has no em dash`);
    assert.doesNotMatch(rendered.text, /\u2014/, `day ${day} text has no em dash`);
  }
});

test('Arabic plan and emails are real RTL documents with Arabic copy throughout', () => {
  const plan = buildSevenDayPlan(getRole('nurse'), { locale: 'ar', mode: 'type', focusQuestionId: 'deteriorating', feedback });
  const links = buildPlanLinks(ORIGIN, 'tok', plan);
  const first = practicePlanEmail(plan, 1, links);
  assert.match(first.html, /<html lang="ar" dir="rtl">/);
  assert.match(first.subject, /احتفظ بهذه الملاحظات/);
  assert.match(first.text, /واتساب/);
  assert.match(first.text, /اليوم 1/);
  const later = practicePlanEmail(plan, 5, links);
  assert.match(later.subject, /^اليوم 5 من 7/);
  assert.match(later.html, /dir="rtl"/);
  assert.doesNotMatch(later.text, /Day \d|Hint:|About \d+ minutes/);
});

test('catalogue dashes are rewritten before they reach an email', () => {
  assert.equal(plainDash('Gives concrete details \u2014 numbers, systems, outcomes.'), 'Gives concrete details: numbers, systems, outcomes.');
  assert.equal(plainDash('Show the move \u2014 the pace, the diversity.'), 'Show the move: the pace, the diversity.');
  assert.equal(plainDash('One \u2014 Two'), 'One, Two');
});

test('encryption, keyed hashing and scoped tokens round-trip without exposing payloads', () => {
  const value = { email: 'person@example.com', plan: { version: '2' } };
  const encrypted = encryptJson(value);
  assert.doesNotMatch(encrypted, /person@example/);
  assert.deepEqual(decryptJson(encrypted), value);
  assert.notEqual(keyedHash('person@example.com'), tokenHash('person@example.com'));
  const view = issuePlanViewToken('22222222-2222-4222-8222-222222222222', Date.now() + 60_000);
  assert.deepEqual(verifyPlanViewToken(view), { grantId: '22222222-2222-4222-8222-222222222222' });
  assert.equal(verifyPlanViewToken(`${view}x`), null);
  assert.equal(verifyPlanViewToken(issuePlanViewToken('x', Date.now() - 1)), null);
});

test('redaction removes raw email and token-shaped values', () => {
  const output = redactText(`failed person@example.com ${'a'.repeat(48)}`);
  assert.doesNotMatch(output, /person@example|a{20}/);
  const event = safeEvent('test', { error: 'person@example.com', answer: 'private interview answer' });
  assert.deepEqual(event, { event: 'test', error: '[email]' });
});

test('out-of-order delivery events never downgrade delivered or terminal states', () => {
  assert.equal(statusAfterEvent('sent', 'email.delivered'), 'delivered');
  assert.equal(statusAfterEvent('delivered', 'email.sent'), 'delivered');
  assert.equal(statusAfterEvent('delivered', 'email.delivery_delayed'), 'delivered');
  assert.equal(statusAfterEvent('sent', 'email.complained'), 'complained');
  assert.equal(statusAfterEvent('complained', 'email.delivered'), 'complained');
});

test('Resend webhook signatures are verified over the exact raw body with a bounded clock skew', () => {
  const key = randomBytes(32);
  const secret = `whsec_${key.toString('base64')}`;
  const id = 'msg_browser_safe_test';
  const now = Date.now();
  const timestamp = Math.floor(now / 1_000).toString();
  const payload = JSON.stringify({ type: 'email.delivered', created_at: new Date(now).toISOString(), data: { email_id: 'provider-message-id' } });
  const signature = `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')}`;
  assert.equal(verifyResendWebhook(payload, { id, timestamp, signature }, secret, now), true);
  assert.equal(verifyResendWebhook(`${payload} `, { id, timestamp, signature }, secret, now), false);
  assert.equal(verifyResendWebhook(payload, { id, timestamp, signature: 'v1,AAAA' }, secret, now), false);
  assert.equal(verifyResendWebhook(payload, { id, timestamp, signature }, secret, now + 10 * 60_000), false);
  assert.equal(verifyResendWebhook(payload, { id, timestamp, signature: `v1,bogus ${signature}` }, secret, now), true);
  assert.equal(parseResendWebhook(payload).data.email_id, 'provider-message-id');
  assert.equal(parseResendWebhook('not json'), null);
});

test('memory, failure-injection and REST transports behave deterministically', async () => {
  const memory = new MemoryEmailProvider();
  const message = { to: 'delivered@resend.dev', from: 'Muqabala <plan@example.com>', subject: 'Test', html: '<p>Test</p>', text: 'Test', idempotencyKey: providerIdempotencyKey('id', 1) };
  assert.equal((await memory.send(message)).providerMessageId, 'memory-1');
  assert.equal(memory.messages.length, 1);
  await assert.rejects(() => new FailureInjectionEmailProvider('retryable').send(message), (error) => error instanceof EmailProviderError && error.kind === 'retryable');

  const calls = [];
  const okFetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ id: 're_123' }), { status: 200 });
  };
  const resend = new ResendEmailProvider('re_test', okFetch);
  assert.deepEqual(await resend.send(message), { providerMessageId: 're_123' });
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'practice-plan/id/day-1');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer re_test');
  const rateLimited = new ResendEmailProvider('re_test', async () => new Response('{}', { status: 429 }));
  await assert.rejects(() => rateLimited.send(message), (error) => error.kind === 'retryable' && error.safeCode === 'resend_429');
  const rejected = new ResendEmailProvider('re_test', async () => new Response('{}', { status: 422 }));
  await assert.rejects(() => rejected.send(message), (error) => error.kind === 'permanent');
});

test('queue retry backoff grows, adds bounded jitter and caps at six hours', () => {
  assert.equal(retryBackoffMs(1, 0), 60_000);
  assert.equal(retryBackoffMs(2, 0.5), 120_000 + 5_000);
  assert.equal(retryBackoffMs(20, 0), 6 * 60 * 60_000);
  assert.ok(retryBackoffMs(3, 0.9999) < 240_000 + 10_000);
});
