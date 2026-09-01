import assert from 'node:assert/strict';
import test from 'node:test';

// The interview pack limiter is checked without Upstash credentials, the same
// way rate-limit.test.mjs checks the other local brakes.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const {
  EMAIL_CONSENT_KEY,
  readEmailConsent,
  recordEmailConsent,
  recordEmailDeclined,
  shouldAskForEmail,
} = await import('../lib/landing/email-consent.ts');
const { parseInterviewPackRequest } = await import('../lib/landing/interview-pack.ts');
const { looksLikeEmail } = await import('../lib/landing/email-check.ts');
const { advertUsable, looksLikeUrl } = await import('../lib/landing/advert-text.ts');
const { toRoleCards, popularRoleCards } = await import('../lib/landing/role-cards.ts');
const { HERO_DRAFT_KEY, saveHeroDraft, takeHeroDraft } = await import('../lib/hero-draft.ts');
const { limitInterviewPack } = await import('../lib/rate-limit.ts');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

function blockedStorage() {
  const fail = () => { throw new Error('blocked'); };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

test('the email ask is shown when nothing has been decided', () => {
  assert.equal(shouldAskForEmail({ local: memoryStorage(), session: memoryStorage() }), true);
  assert.equal(shouldAskForEmail({ local: null, session: null }), true);
  assert.equal(shouldAskForEmail({ local: blockedStorage(), session: blockedStorage() }), true);
});

test('consent is stored under muqabala.emailConsent.v1 with an ISO timestamp and source', () => {
  const local = memoryStorage();
  const now = new Date('2026-09-01T10:00:00.000Z');
  assert.equal(recordEmailConsent(local, 'advert_pack', now), true);
  assert.deepEqual(JSON.parse(local.getItem(EMAIL_CONSENT_KEY)), {
    consent: { at: '2026-09-01T10:00:00.000Z', source: 'advert_pack' },
  });
  assert.deepEqual(readEmailConsent(local), { at: '2026-09-01T10:00:00.000Z', source: 'advert_pack' });
  assert.equal(shouldAskForEmail({ local, session: memoryStorage() }), false);
});

test('a decline is remembered for the session only', () => {
  const local = memoryStorage();
  const session = memoryStorage();
  assert.equal(recordEmailDeclined(session, new Date('2026-09-01T10:00:00.000Z')), true);
  assert.deepEqual(JSON.parse(session.getItem(EMAIL_CONSENT_KEY)), { declinedAt: '2026-09-01T10:00:00.000Z' });
  assert.equal(shouldAskForEmail({ local, session }), false);
  assert.equal(readEmailConsent(local), null);
  // A new tab has an empty sessionStorage, so the ask comes back.
  assert.equal(shouldAskForEmail({ local, session: memoryStorage() }), true);
});

test('corrupt or foreign consent records are ignored rather than trusted', () => {
  const local = memoryStorage();
  local.setItem(EMAIL_CONSENT_KEY, 'not json');
  assert.equal(readEmailConsent(local), null);
  assert.equal(shouldAskForEmail({ local, session: memoryStorage() }), true);
  local.setItem(EMAIL_CONSENT_KEY, JSON.stringify({ consent: { at: 'yesterday', source: 'advert_pack' } }));
  assert.equal(readEmailConsent(local), null);
  local.setItem(EMAIL_CONSENT_KEY, JSON.stringify({ consent: { at: '2026-09-01T10:00:00.000Z', source: 'newsletter' } }));
  assert.equal(readEmailConsent(local), null);
});

test('blocked storage never throws out of the consent helpers', () => {
  assert.equal(recordEmailConsent(blockedStorage(), 'advert_pack'), false);
  assert.equal(recordEmailDeclined(blockedStorage()), false);
  assert.equal(readEmailConsent(blockedStorage()), null);
});

test('interview pack requests need a real email and a known source', () => {
  assert.deepEqual(parseInterviewPackRequest({ email: ' Aisha@Example.com ', source: 'advert_pack' }), {
    email: 'aisha@example.com',
    source: 'advert_pack',
  });
  assert.equal(parseInterviewPackRequest({ email: 'not-an-email', source: 'advert_pack' }), null);
  assert.equal(parseInterviewPackRequest({ email: 'aisha@example.com', source: 'newsletter' }), null);
  assert.equal(parseInterviewPackRequest({ email: 'aisha@example.com' }), null);
  assert.equal(parseInterviewPackRequest({ email: 'aisha@example.com', source: 'advert_pack', extra: 1 }), null);
  assert.equal(parseInterviewPackRequest(null), null);
  assert.equal(parseInterviewPackRequest({ email: `${'a'.repeat(250)}@example.com`, source: 'advert_pack' }), null);
});

test('the browser-side email check catches obvious typos only', () => {
  assert.equal(looksLikeEmail('aisha@example.com'), true);
  assert.equal(looksLikeEmail('  aisha@example.com  '), true);
  assert.equal(looksLikeEmail('aisha@example'), false);
  assert.equal(looksLikeEmail('aisha example.com'), false);
  assert.equal(looksLikeEmail(''), false);
});

test('local interview pack limit allows 5 requests per address and blocks the sixth', async () => {
  const request = (ip) => new Request('https://trymuqabala.com/api/interview-pack', {
    method: 'POST',
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
  });
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await limitInterviewPack(request('203.0.113.80'))).limited, false);
  }
  const blocked = await limitInterviewPack(request('203.0.113.80'));
  assert.equal(blocked.limited, true);
  assert.ok(blocked.retryAfterSeconds > 0);
  assert.equal((await limitInterviewPack(request('203.0.113.81'))).limited, false);
});

test('an advert is usable when it is text of at least 120 characters, not a link', () => {
  assert.equal(looksLikeUrl('https://example.com/jobs/123'), true);
  assert.equal(looksLikeUrl('www.example.com/jobs'), true);
  assert.equal(looksLikeUrl('Front office agent needed'), false);
  assert.equal(advertUsable('https://example.com/jobs/123'), false);
  assert.equal(advertUsable('Too short'), false);
  assert.equal(advertUsable('We are hiring a front office agent for a five star hotel in Dubai. '.repeat(3)), true);
});

test('role cards carry only the landing fields and keep the popular order', () => {
  const roles = [
    { id: 'b', title: 'B', titleAr: 'ب', industry: 'Retail', industryAr: 'تجزئة', blurb: 'b', blurbAr: 'ب', level: 'Mid', competencies: [], questions: [{}, {}, {}], bank: [{}] },
    { id: 'a', title: 'A', titleAr: 'أ', industry: 'Care', industryAr: 'رعاية', blurb: 'a', blurbAr: 'أ', level: 'Entry', competencies: [], questions: [{}, {}] },
    { id: 'c', title: 'C', titleAr: 'ج', industry: 'Care', industryAr: 'رعاية', blurb: 'c', blurbAr: 'ج', level: 'Senior', competencies: [], questions: [{}] },
  ];
  const cards = toRoleCards(roles, ['a', 'missing', 'b']);
  assert.deepEqual(Object.keys(cards[0]).sort(), [
    'blurb', 'blurbAr', 'id', 'industry', 'industryAr', 'popularRank', 'questionCount', 'title', 'titleAr',
  ]);
  assert.equal(cards[0].questionCount, 3);
  assert.deepEqual(popularRoleCards(cards).map((card) => card.id), ['a', 'b']);
  // The slim card must not smuggle the question bank across.
  assert.equal('questions' in cards[0], false);
  assert.equal('bank' in cards[0], false);
});

test('the hero draft is a one-shot handoff between /practice and /practice/custom', () => {
  const session = memoryStorage();
  assert.equal(saveHeroDraft({ jobTitle: 'Waiter', jobText: 'advert text' }, session), true);
  assert.ok(session.getItem(HERO_DRAFT_KEY));
  assert.deepEqual(takeHeroDraft(session), { jobTitle: 'Waiter', jobText: 'advert text' });
  assert.equal(session.getItem(HERO_DRAFT_KEY), null);
  assert.equal(takeHeroDraft(session), null);
  assert.equal(saveHeroDraft({ jobTitle: '', jobText: 'x' }, blockedStorage()), false);
  assert.equal(takeHeroDraft(blockedStorage()), null);
  assert.equal(takeHeroDraft(null), null);
});

test('landing strings exist in both languages and follow the house rules', async () => {
  const { STRINGS } = await import('../lib/i18n.ts');
  const landingKeys = Object.keys(STRINGS.en).filter((key) => key.startsWith('landing'));
  assert.ok(landingKeys.length >= 15);
  for (const key of landingKeys) {
    assert.equal(typeof STRINGS.ar[key], 'string', `${key} is missing in Arabic`);
    assert.ok(STRINGS.ar[key].length > 0, `${key} is empty in Arabic`);
    assert.equal(STRINGS.en[key].includes('\u2014'), false, `${key} uses an em dash`);
    assert.equal(/\bpractice\b/i.test(STRINGS.en[key]) && /\b(to|we|you|they) practice\b/i.test(STRINGS.en[key]), false, `${key} uses practice as a verb`);
  }
  assert.equal(STRINGS.en.landingPasteHeading, 'Paste the job advert you are preparing for');
  assert.equal(STRINGS.en.landingPasteSubline, 'Or pick a role below.');
  assert.equal(STRINGS.ar.landingPasteHeading, 'الصق إعلان الوظيفة الذي تستعد له');
  assert.equal(STRINGS.ar.landingPasteSubline, 'أو اختر وظيفة أدناه.');
  assert.equal(STRINGS.en.landingPackHeading, 'Where should we send your interview pack for this job?');
  assert.equal(STRINGS.en.landingPackSend, 'Send my pack');
  assert.equal(STRINGS.en.landingPackShowHere, 'Show it here instead');
});
