#!/usr/bin/env node
/**
 * Scoring consistency measurement — one of the two launch gates.
 *
 * Runs a fixed corpus of answers through /api/score repeatedly and reports the
 * score spread per answer. The supervisory review's standard: if numeric scores
 * are shown to real users, the same answer must score within a tight band
 * across runs, and that number should be published.
 *
 * Usage:
 *   node scripts/measure-consistency.mjs                    # against localhost:3000
 *   node scripts/measure-consistency.mjs https://preview.example.com
 *   BASE_URL=https://your-app.vercel.app node scripts/measure-consistency.mjs
 *   RUNS=10 node scripts/measure-consistency.mjs            # more repeats per answer
 *
 * The LIVE gate — the one that must pass before testers see scores:
 *   EXPECT_AI=1 BASE_URL=https://your-app.vercel.app node scripts/measure-consistency.mjs
 *
 * Against the structure checker (no API key) spread must be 0 — it is
 * deterministic, so any variance there is a bug. Against the AI path this
 * produces the real consistency figure. Exit code 1 if any scored answer's
 * spread exceeds MAX_SPREAD, so it can run in CI.
 */

const BASE_URL = (process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const RUNS = Number(process.env.RUNS ?? 5);
/** Maximum acceptable max-min spread on the 0-100 scale, per answer. */
const MAX_SPREAD = Number(process.env.MAX_SPREAD ?? 10);
/**
 * EXPECT_AI=1 turns this into the LIVE gate: every result must come from the
 * AI path (source === "ai") and Arabic must actually be scored. Without it, a
 * provider outage would quietly route every request to the offline structure
 * checker — deterministic, spread 0 — and a broken deployment would "pass".
 * The offline fallback must never be able to green-light an AI benchmark.
 */
const EXPECT_AI = process.env.EXPECT_AI === '1';
/** Pace live calls below a new OpenRouter account's 10 RPM cap by default. */
const REQUEST_INTERVAL_MS = Number(process.env.REQUEST_INTERVAL_MS ?? (EXPECT_AI ? 7000 : 0));

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Fixed corpus. Do not "improve" these answers — their value is that they
 * never change, so runs are comparable across weeks and code versions.
 */
const CORPUS = [
  {
    id: 'en-strong',
    roleId: 'front-office-agent',
    questionId: 'angry_guest',
    lang: 'en',
    expect: 'high',
    transcript:
      'Last year at the Radisson in Dubai, a guest complained directly to me at the desk because his room was not ready at 2pm after a 14 hour flight. I apologised and took ownership immediately. I checked Opera and saw housekeeping had three rooms in progress, so I called the housekeeping supervisor myself and asked her to prioritise his category. I offered him refreshments in the lounge and gave him my direct extension so he did not have to queue again. I updated him every 10 minutes. The room was ready in 20 minutes. In the end he thanked me at check out and mentioned me by name in the guest survey.',
  },
  {
    id: 'en-medium',
    roleId: 'front-office-agent',
    questionId: 'angry_guest',
    lang: 'en',
    expect: 'medium',
    transcript:
      'A guest was upset because his booking was wrong. I checked the system and found the error was ours. I explained what happened and moved him to a better room at no charge. He left a good review.',
  },
  {
    id: 'en-weak',
    roleId: 'front-office-agent',
    questionId: 'angry_guest',
    lang: 'en',
    expect: 'low',
    transcript:
      'We always try to help the guests. Our team is very good at handling complaints and we do our best to make sure everyone is happy. We follow the hotel policy at all times and we care about service.',
  },
  {
    id: 'en-accented-strong',
    roleId: 'waiter',
    questionId: 'wrong_order',
    lang: 'en',
    expect: 'high',
    // Imperfect grammar, strong content. Must NOT score below en-weak —
    // that would mean fluency is being scored, which is a hard-rule violation.
    transcript:
      'One time in my restaurant in Doha, guest is telling me his biryani is wrong order, he already very angry because he waiting long time. I am apologise to him first and I take the plate back myself, not waiting for runner. I go to kitchen and tell chef make new one first priority, and I bring complimentary soup for guest while he wait. After ten minutes I bring correct order and check again after five minutes if everything good. In the end guest is happy, he shake my hand and next week he come back and ask for my section.',
  },
  {
    id: 'ar-strong',
    roleId: 'front-office-agent',
    questionId: 'angry_guest',
    lang: 'ar',
    expect: 'high',
    transcript:
      'في العام الماضي في فندق راديسون في دبي، اشتكى نزيل لي مباشرة لأن غرفته لم تكن جاهزة بعد رحلة طويلة. اعتذرت وتوليت المسؤولية فوراً. راجعت نظام أوبرا واتصلت بمشرفة التدبير المنزلي بنفسي وطلبت منها إعطاء الأولوية لغرفته. قدمت له المرطبات في الصالة وأعطيته رقم تحويلتي المباشر وكنت أطلعه على المستجدات كل عشر دقائق. كانت الغرفة جاهزة خلال عشرين دقيقة. في النهاية شكرني عند المغادرة وذكر اسمي في استبيان النزلاء.',
  },
];

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';', 1)[0]).join('; ');
}

async function scoreOnce(item) {
  const create = await fetch(`${BASE_URL}/api/interviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({
      roleId: item.roleId,
      roleTitle: item.roleId === 'waiter' ? 'Waiter' : 'Front Office Agent',
      language: item.lang,
      mode: 'guided',
      focusQuestionId: item.questionId,
      questions: [{ id: item.questionId }],
    }),
  });
  if (create.status !== 201) throw new Error(`Interview start HTTP ${create.status} for ${item.id}`);
  const interview = await create.json();
  const response = await fetch(`${BASE_URL}/api/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE_URL,
      Cookie: cookieHeader(create),
      'X-Scoring-Session': `consistency-${item.id}-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      roleId: item.roleId,
      questionId: item.questionId,
      questionIndex: 0,
      interviewId: interview.id,
      transcript: item.transcript,
      lang: item.lang,
    }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${item.id}`);
  const { feedback } = await response.json();
  return feedback;
}

function stats(scores) {
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  return { mean, min, max, spread: max - min, sd: Math.sqrt(variance) };
}

const results = [];
let failed = false;

for (const item of CORPUS) {
  const scores = [];
  const statuses = new Set();
  const sources = new Set();

  for (let i = 0; i < RUNS; i += 1) {
    try {
      const feedback = await scoreOnce(item);
      statuses.add(feedback.status);
      sources.add(feedback.source);
      if (feedback.status === 'scored') scores.push(feedback.score);
    } catch (error) {
      console.error(`  ${item.id} run ${i + 1}: ${error.message}`);
      failed = true;
    }
    if (REQUEST_INTERVAL_MS > 0 && (i < RUNS - 1 || item !== CORPUS[CORPUS.length - 1])) {
      await wait(REQUEST_INTERVAL_MS);
    }
  }

  const row = { id: item.id, expect: item.expect, statuses: [...statuses], sources: [...sources] };
  if (scores.length > 0) {
    Object.assign(row, stats(scores), { runs: scores.length });
    if (row.spread > MAX_SPREAD) failed = true;
  }

  if (EXPECT_AI) {
    // Item-level live-gate checks: no fallback results, and no declined Arabic.
    if (!row.sources.every((src) => src === 'ai') || row.sources.length === 0) {
      console.error(`  FAIL: ${item.id} was served by [${row.sources.join(',') || 'nothing'}], expected the AI path only.`);
      failed = true;
    }
    if (row.statuses.includes('unscored')) {
      console.error(`  FAIL: ${item.id} came back unscored on the AI path — the corpus contains only scoreable answers.`);
      failed = true;
    }
  }
  results.push(row);
}

console.log(`\nScoring consistency — ${BASE_URL} — ${RUNS} runs per answer — mode: ${EXPECT_AI ? 'LIVE AI GATE' : 'offline structure check'}\n`);
console.log(
  'answer'.padEnd(22),
  'expect'.padEnd(8),
  'source'.padEnd(11),
  'mean'.padStart(6),
  'min'.padStart(5),
  'max'.padStart(5),
  'spread'.padStart(7),
  'sd'.padStart(6),
);
for (const r of results) {
  if (r.mean === undefined) {
    console.log(r.id.padEnd(22), r.expect.padEnd(8), r.sources.join(',').padEnd(11), ` unscored (${r.statuses.join(',')})`);
  } else {
    console.log(
      r.id.padEnd(22),
      r.expect.padEnd(8),
      r.sources.join(',').padEnd(11),
      r.mean.toFixed(1).padStart(6),
      String(r.min).padStart(5),
      String(r.max).padStart(5),
      String(r.spread).padStart(7),
      r.sd.toFixed(1).padStart(6),
    );
  }
}

// Ranking sanity: content quality must order the scores, and the accented
// strong answer must never fall below the fluent weak one.
const byId = Object.fromEntries(results.filter((r) => r.mean !== undefined).map((r) => [r.id, r.mean]));
if (byId['en-strong'] !== undefined && byId['en-weak'] !== undefined && byId['en-strong'] <= byId['en-weak']) {
  console.error('\nFAIL: strong answer did not outscore weak answer.');
  failed = true;
}
if (byId['en-accented-strong'] !== undefined && byId['en-weak'] !== undefined && byId['en-accented-strong'] <= byId['en-weak']) {
  console.error('\nFAIL: accented strong answer scored at or below fluent weak answer — fluency is leaking into the score.');
  failed = true;
}

console.log(
  failed
    ? `\nRESULT: FAIL (spread > ${MAX_SPREAD}, ranking violation, wrong source, unscored answer, or request errors)`
    : `\nRESULT: PASS (all spreads ≤ ${MAX_SPREAD}, ranking sane${EXPECT_AI ? ', all answers served by the AI path, Arabic scored' : ''})`,
);
process.exit(failed ? 1 : 0);
