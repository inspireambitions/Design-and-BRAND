#!/usr/bin/env node
/**
 * Live semantic scoring gate.
 *
 * The same evidence must not earn extra marks because generic sentences were
 * added around it, and concise real evidence must beat fluent general claims.
 * This uses the complete stored-interview contract so the production scoring
 * route is measured rather than a private helper.
 */

const BASE_URL = (process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const MAX_PADDING_GAIN = Number(process.env.MAX_PADDING_GAIN ?? 3);
const MIN_SUBSTANCE_MARGIN = Number(process.env.MIN_SUBSTANCE_MARGIN ?? 12);
const REQUEST_INTERVAL_MS = Number(process.env.REQUEST_INTERVAL_MS ?? 1500);

const conciseEvidence =
  'Last month at a hotel in Deira, an angry guest complained because his room was not ready. I apologised, checked Opera, called the housekeeping supervisor, and updated him every ten minutes. The room was ready in twenty minutes, and in the end he thanked me at checkout.';

const padding =
  ' Customer service is always very important in hospitality. I believe every guest deserves excellent service and every employee should be professional, positive, hardworking and committed. Communication, teamwork, quality and service are important in every successful five star hotel.';

const fluentGeneralClaims =
  'Customer service is the foundation of hospitality and I always believe in exceeding guest expectations. I am passionate, professional, hardworking and committed to quality. I communicate well, support my team and follow hotel policies. I understand the importance of empathy, service recovery, attention to detail and a positive attitude. Every guest should feel valued and respected, so I always aim to provide excellent five star service and create memorable experiences.';

const imperfectEvidence =
  'One time guest angry because room not ready after long flight. I am apologise, check Opera, call housekeeping supervisor myself and update guest each ten minutes. Room ready after twenty minutes. I give water while waiting and in the end guest thank me at checkout.';

const cases = [
  { id: 'concise-evidence', transcript: conciseEvidence },
  { id: 'same-evidence-with-padding', transcript: `${padding}${conciseEvidence}${padding}` },
  { id: 'fluent-general-claims', transcript: fluentGeneralClaims },
  { id: 'imperfect-english-evidence', transcript: imperfectEvidence },
];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';', 1)[0]).join('; ');
}

async function score(item) {
  const create = await fetch(`${BASE_URL}/api/interviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE_URL },
    body: JSON.stringify({
      roleId: 'front-office-agent',
      roleTitle: 'Front Office Agent',
      language: 'en',
      mode: 'guided',
      focusQuestionId: 'angry_guest',
      questions: [{
        id: 'angry_guest',
        text: 'How did you handle an angry guest who complained directly to you?',
        textAr: 'كيف تعاملت مع نزيل غاضب اشتكى لك مباشرة؟',
        competencies: ['customer_focus', 'ownership', 'problem_solving', 'evidence'],
        hint: '',
        hintAr: '',
        prepSeconds: 30,
        answerSeconds: 120,
      }],
    }),
  });
  if (create.status !== 201) throw new Error(`${item.id}: interview start returned HTTP ${create.status}`);
  const interview = await create.json();
  const response = await fetch(`${BASE_URL}/api/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE_URL,
      Cookie: cookieHeader(create),
      'X-Scoring-Session': `substance-${item.id}-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      roleId: 'front-office-agent',
      questionId: 'angry_guest',
      questionIndex: 0,
      interviewId: interview.id,
      transcript: item.transcript,
      lang: 'en',
    }),
  });
  if (!response.ok) throw new Error(`${item.id}: scoring returned HTTP ${response.status}`);
  const body = await response.json();
  const feedback = body.feedback;
  if (feedback?.status !== 'scored' || feedback?.source !== 'ai') {
    throw new Error(`${item.id}: expected a scored AI response`);
  }
  return feedback.score;
}

const scores = {};
let failed = false;

for (const item of cases) {
  try {
    scores[item.id] = await score(item);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    failed = true;
  }
  if (item !== cases.at(-1)) await wait(REQUEST_INTERVAL_MS);
}

if (!failed) {
  const paddingGain = scores['same-evidence-with-padding'] - scores['concise-evidence'];
  const substanceMargin = scores['concise-evidence'] - scores['fluent-general-claims'];
  const languageMargin = scores['imperfect-english-evidence'] - scores['fluent-general-claims'];
  if (paddingGain > MAX_PADDING_GAIN) failed = true;
  if (substanceMargin < MIN_SUBSTANCE_MARGIN) failed = true;
  if (languageMargin < MIN_SUBSTANCE_MARGIN) failed = true;

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    scores,
    checks: {
      paddingGain: { actual: paddingGain, maximum: MAX_PADDING_GAIN },
      conciseEvidenceMargin: { actual: substanceMargin, minimum: MIN_SUBSTANCE_MARGIN },
      imperfectEnglishMargin: { actual: languageMargin, minimum: MIN_SUBSTANCE_MARGIN },
    },
    result: failed ? 'FAIL' : 'PASS',
  }, null, 2));
}

process.exit(failed ? 1 : 0);
