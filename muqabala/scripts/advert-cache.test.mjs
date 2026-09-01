import assert from 'node:assert/strict';
import test from 'node:test';

// The cache must never reach a live Redis database from a test.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const {
  ADVERT_CACHE_VERSION,
  advertCacheConfigured,
  advertCacheKey,
  CachedInterviewSchema,
  normaliseAdvertText,
  readCachedInterview,
  writeCachedInterview,
} = await import('../lib/advert-cache.ts');

const advert = `Front Office Agent - Dubai
  We are looking for a Front Office Agent to join our 5* hotel.
Requirements:  Opera PMS, 2+ years' experience, flexible shifts.`;

test('normalisation ignores case', () => {
  assert.equal(normaliseAdvertText('FRONT Office AGENT'), normaliseAdvertText('front office agent'));
  assert.equal(normaliseAdvertText('Opera PMS'), 'opera pms');
});

test('normalisation collapses line breaks, tabs and repeated spaces to single spaces', () => {
  assert.equal(normaliseAdvertText('front\n\n office\t\tagent   dubai '), 'front office agent dubai');
  assert.equal(normaliseAdvertText('  front office agent  '), 'front office agent');
});

test('normalisation strips punctuation and symbols', () => {
  assert.equal(normaliseAdvertText('Hello, World!'), 'hello world');
  assert.equal(normaliseAdvertText('• Opera PMS; 2+ years\' experience (required).'), 'opera pms 2 years experience required');
  assert.equal(normaliseAdvertText(advert), normaliseAdvertText(advert.replace(/[-*:,.+']/g, ' ')));
});

test('Arabic text is unchanged apart from whitespace and punctuation', () => {
  const arabic = 'موظف استقبال في فندق خمس نجوم';
  assert.equal(normaliseAdvertText(arabic), arabic);
  assert.equal(normaliseAdvertText('  موظف   استقبال\nفي فندق  '), 'موظف استقبال في فندق');
  assert.equal(normaliseAdvertText('مطلوب موظف استقبال، خبرة سنتين؟'), 'مطلوب موظف استقبال خبرة سنتين');
});

test('the key is stable for the same normalised advert, model and version', () => {
  const options = { model: 'gpt-5.6-sol', version: ADVERT_CACHE_VERSION };
  const first = advertCacheKey(normaliseAdvertText(advert), options);
  const second = advertCacheKey(normaliseAdvertText(advert.toUpperCase().replace(/\n/g, '   ')), options);
  assert.equal(first, second);
  assert.match(first, /^advert:v1:[a-f0-9]{64}$/);
});

test('the key changes when the advert, the model or the version changes', () => {
  const normalised = normaliseAdvertText(advert);
  const base = advertCacheKey(normalised, { model: 'gpt-5.6-sol', version: ADVERT_CACHE_VERSION });
  assert.notEqual(base, advertCacheKey(`${normalised} night shift`, { model: 'gpt-5.6-sol', version: ADVERT_CACHE_VERSION }));
  assert.notEqual(base, advertCacheKey(normalised, { model: 'gpt-5.6-mini', version: ADVERT_CACHE_VERSION }));
  assert.notEqual(base, advertCacheKey(normalised, { model: 'gpt-5.6-sol', version: `${ADVERT_CACHE_VERSION}-next` }));
});

test('the key never contains the advert text', () => {
  const key = advertCacheKey(normaliseAdvertText(advert), { model: 'gpt-5.6-sol', version: ADVERT_CACHE_VERSION });
  assert.equal(key.includes('front'), false);
  assert.equal(key.includes('dubai'), false);
});

test('the cached shape accepts only a complete, validated interview', () => {
  const competency = { id: 'guest_service', label: 'Guest service', labelAr: 'خدمة الضيوف', anchor: 'Anchor', anchorAr: 'مرتكز' };
  const question = (index) => ({
    id: `jd_${index}`,
    text: 'Tell me about a time you helped a guest.',
    textAr: 'أخبرني عن موقف ساعدت فيه ضيفاً.',
    hint: 'Use a real example.',
    hintAr: 'استخدم مثالاً حقيقياً.',
    competencies: ['guest_service'],
    prepSeconds: 30,
    answerSeconds: 120,
  });
  const valid = {
    title: 'Front Office Agent',
    industry: 'Hospitality',
    competencies: [competency, { ...competency, id: 'accuracy' }, { ...competency, id: 'calm' }],
    questions: Array.from({ length: 8 }, (_, index) => question(index + 1)),
  };
  assert.equal(CachedInterviewSchema.safeParse(valid).success, true);
  assert.equal(CachedInterviewSchema.safeParse({ ...valid, questions: valid.questions.slice(0, 7) }).success, false);
  assert.equal(CachedInterviewSchema.safeParse({ ...valid, competencies: valid.competencies.slice(0, 2) }).success, false);
  assert.equal(CachedInterviewSchema.safeParse({ role: valid, tailored: false }).success, false);
});

test('without Upstash credentials the cache is silently absent', async () => {
  assert.equal(advertCacheConfigured(), false);
  const key = advertCacheKey('anything', { model: 'm', version: 'v' });
  assert.equal(await readCachedInterview(key), null);
  await writeCachedInterview(key, { title: '', industry: '', competencies: [], questions: [] });
  assert.equal(await readCachedInterview(key), null);
});
