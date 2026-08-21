#!/usr/bin/env node
/**
 * Transcription-robustness benchmark — the second launch gate.
 *
 * The fairness risk with accents runs in a chain:
 *   accent → worse speech recognition → garbled transcript → lower score.
 *
 * The first link needs real audio from real speakers and cannot be measured
 * here. The second link can, and it is the one the product controls: given a
 * transcript that recognition has mangled, does the scorer still judge the
 * substance, or does it quietly punish the mangling?
 *
 * This runs one strong answer through recognition-error patterns typical of
 * second-language speakers in this product's actual candidate pool, and fails
 * if the score collapses. A candidate who told a good story must not lose marks
 * because the microphone heard "wass" instead of "was".
 *
 * Usage:
 *   node scripts/measure-transcription-robustness.mjs
 *   BASE_URL=https://your-app.vercel.app node scripts/measure-transcription-robustness.mjs
 *
 * This does NOT prove the product is fair across accents. It proves the
 * scorer does not amplify recognition errors. Publishing per-accent word error
 * rates still needs recordings from real speakers.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const RUNS = Number(process.env.RUNS ?? 3);
/** How far a degraded transcript may fall below the clean one, out of 100. */
const MAX_DROP = Number(process.env.MAX_DROP ?? 15);

const ROLE = 'front-office-agent';
const QUESTION = 'angry_guest';

/**
 * One story, told once. Every variant below is the SAME answer as recognition
 * might have transcribed it — never a worse answer. Any score gap is therefore
 * the scorer reacting to transcription noise, which is exactly what must not
 * happen.
 */
const CLEAN =
  'Last year at the Radisson in Dubai, a guest complained directly to me because his room was not ready at two in the afternoon after a fourteen hour flight. I apologised and took ownership immediately. I checked Opera and saw housekeeping had three rooms in progress, so I called the housekeeping supervisor myself and asked her to prioritise his category. I offered him refreshments in the lounge and gave him my direct extension so he did not have to queue again. I updated him every ten minutes. The room was ready in twenty minutes. In the end he thanked me at check out.';

const VARIANTS = [
  {
    id: 'clean',
    label: 'clean transcript (baseline)',
    text: CLEAN,
  },
  {
    id: 'dropped-articles',
    label: 'articles dropped',
    // Recognition frequently loses "the"/"a" for speakers whose first language
    // has no articles — common across South Asian and Slavic backgrounds.
    text: CLEAN.replace(/\b(the|a) /g, '').replace(/\bin end\b/, 'in end'),
  },
  {
    id: 'phonetic-pf-vw',
    label: 'p/f and v/w confusions',
    text: CLEAN.replace(/\bv/g, 'w').replace(/\bf/g, 'p').replace(/prioritise/g, 'priorotise'),
  },
  {
    id: 'th-stopping',
    label: 'th heard as t or d',
    text: CLEAN.replace(/\bth/g, 't').replace(/\bThe/g, 'De'),
  },
  {
    id: 'missing-plurals-tense',
    label: 'plural and tense endings lost',
    text: CLEAN.replace(/rooms/g, 'room')
      .replace(/minutes/g, 'minute')
      .replace(/apologised/g, 'apologise')
      .replace(/checked/g, 'check')
      .replace(/called/g, 'call')
      .replace(/offered/g, 'offer')
      .replace(/updated/g, 'update')
      .replace(/thanked/g, 'thank'),
  },
  {
    id: 'run-on-no-punctuation',
    label: 'no sentence boundaries detected',
    // Live dictation often returns one unbroken stream.
    text: CLEAN.replace(/[.,]/g, ''),
  },
  {
    id: 'filler-and-repair',
    label: 'fillers and self-corrections kept in',
    text: CLEAN.replace(/I apologised/, 'um I apologise I mean I apologised').replace(
      /I checked Opera/,
      'I check I checked Opera you know',
    ),
  },
  {
    id: 'proper-nouns-mangled',
    label: 'names and systems misheard',
    text: CLEAN.replace(/Radisson/g, 'Radison').replace(/Opera/g, 'Opara').replace(/Dubai/g, 'Dubay'),
  },
];

/** The fluent but vague answer. No degraded variant may fall to this level. */
const WEAK =
  'We always try to help the guests. Our team is very good at handling complaints and we do our best to make sure everyone is happy. We follow the hotel policy at all times and we care about service.';

let clientSeq = 0;
async function score(transcript) {
  clientSeq += 1;
  const res = await fetch(`${BASE_URL}/api/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // A distinct client per request: this benchmark makes enough calls to
      // trip the per-client rate limit on itself otherwise.
      'x-forwarded-for': `198.51.100.${clientSeq % 250}`,
    },
    body: JSON.stringify({ roleId: ROLE, questionId: QUESTION, transcript, lang: 'en' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { feedback } = await res.json();
  return feedback;
}

async function meanScore(transcript) {
  const scores = [];
  let source = 'unknown';
  let status = 'unknown';
  for (let i = 0; i < RUNS; i += 1) {
    const fb = await score(transcript);
    source = fb.source;
    status = fb.status;
    if (fb.status === 'scored') scores.push(fb.score);
  }
  return {
    mean: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    source,
    status,
  };
}

console.log(`\nTranscription robustness — ${BASE_URL} — ${RUNS} runs per variant\n`);

const baseline = await meanScore(CLEAN);
if (baseline.mean === null) {
  console.error('Baseline answer was not scored; cannot measure robustness.');
  process.exit(1);
}
const weak = await meanScore(WEAK);

console.log('variant'.padEnd(34), 'source'.padEnd(11), 'mean'.padStart(6), 'drop'.padStart(6));
let failed = false;

for (const variant of VARIANTS) {
  const r = await meanScore(variant.text);
  if (r.mean === null) {
    console.log(variant.label.padEnd(34), r.source.padEnd(11), '  unscored');
    failed = true;
    continue;
  }
  const drop = baseline.mean - r.mean;
  const bad = drop > MAX_DROP || (weak.mean !== null && r.mean <= weak.mean);
  if (bad) failed = true;
  console.log(
    `${bad ? 'FAIL ' : '     '}${variant.label}`.padEnd(34),
    r.source.padEnd(11),
    r.mean.toFixed(1).padStart(6),
    (drop >= 0 ? `-${drop.toFixed(1)}` : `+${(-drop).toFixed(1)}`).padStart(6),
  );
}

console.log(
  `\nbaseline ${baseline.mean.toFixed(1)} · fluent-but-vague answer ${
    weak.mean === null ? 'unscored' : weak.mean.toFixed(1)
  } · tolerance ${MAX_DROP} points`,
);
console.log(
  failed
    ? '\nRESULT: FAIL — recognition noise is costing candidates marks they should not lose.\n'
    : '\nRESULT: PASS — mangled transcripts still score on their substance.\n',
);
console.log(
  'Note: this measures the scorer only. Publishing per-accent word error rates\n' +
    'still requires recordings from real speakers in each accent group.\n',
);

process.exit(failed ? 1 : 0);
