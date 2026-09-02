#!/usr/bin/env node
/**
 * Arabic feedback parity gate. Manual, never run in CI.
 *
 * Posts the same answers to /api/score twice, once with lang=en and once with
 * lang=ar, and compares what the candidate gets back: feedback length in
 * characters and how many rubric competencies received written evidence.
 * Arabic must be at least MIN_RATIO of the English length and must cover at
 * least as many competencies, otherwise the gate fails.
 *
 * Usage:
 *   BASE_URL=https://your-deployment.vercel.app npm run gate:arabic-parity
 *   MIN_RATIO=0.8 BASE_URL=... node scripts/feedback-parity.mjs
 *
 * Exit code 1 on any failing answer, or when either language was not scored
 * by the AI path (the offline structure checker is English only, so a
 * provider outage would otherwise look like an Arabic shortfall).
 */

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const MIN_RATIO = Number(process.env.MIN_RATIO ?? 0.7);
const REQUEST_INTERVAL_MS = Number(process.env.REQUEST_INTERVAL_MS ?? 7_000);

const CORPUS = [
  {
    id: 'front-office-complaint',
    roleId: 'front-office-agent',
    questionId: 'angry_guest',
    transcript: 'A guest came to the desk at midnight very angry because his room had not been cleaned. I apologised, listened without interrupting, and checked Opera for another room on the same floor. I moved him to a clean upgraded room within ten minutes, sent a fruit plate, and logged the incident for housekeeping. The next morning he thanked me at checkout and later left a positive review that mentioned my name.',
  },
  {
    id: 'nurse-deteriorating',
    roleId: 'nurse',
    questionId: 'deteriorating',
    transcript: 'On a night shift a post-operative patient became short of breath and his oxygen saturation dropped to 88 percent. I sat him upright, started oxygen at two litres, repeated his observations and calculated an early warning score of six. I called the doctor using the SBAR format and stayed with the patient until he arrived. The patient was moved to a higher care bed within twenty minutes and recovered fully.',
  },
  {
    id: 'receptionist-visitor',
    roleId: 'receptionist',
    questionId: 'visitor_no_appointment',
    transcript: 'A supplier arrived without an appointment and insisted on seeing the finance manager. I greeted him, explained that the manager was in a meeting, and offered to take his details and the reason for the visit. I messaged the manager on Teams, and she agreed to a ten-minute slot after her meeting. The supplier waited in reception with coffee and the manager thanked me for not interrupting her.',
  },
];

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function score(item, lang) {
  const response = await fetch(`${BASE_URL}/api/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleId: item.roleId, questionId: item.questionId, transcript: item.transcript, lang }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${item.id} (${lang})`);
  const { feedback } = await response.json();
  if (!feedback) throw new Error(`No feedback for ${item.id} (${lang})`);
  return feedback;
}

function measure(feedback) {
  const text = [
    feedback.headline ?? '',
    ...(feedback.strengths ?? []),
    ...(feedback.improvements ?? []),
    feedback.coachTip ?? '',
    ...(feedback.competencies ?? []).map((competency) => competency.evidence ?? ''),
  ].join(' ');
  const covered = (feedback.competencies ?? []).filter((competency) => typeof competency.evidence === 'string' && competency.evidence.trim().length > 0).length;
  return { chars: text.replace(/\s+/g, ' ').trim().length, covered, total: (feedback.competencies ?? []).length, source: feedback.source, status: feedback.status };
}

let failed = false;
const rows = [];

for (const item of CORPUS) {
  try {
    const english = measure(await score(item, 'en'));
    await wait(REQUEST_INTERVAL_MS);
    const arabic = measure(await score(item, 'ar'));
    await wait(REQUEST_INTERVAL_MS);
    const ratio = english.chars > 0 ? arabic.chars / english.chars : 0;
    const problems = [];
    if (english.source !== 'ai' || arabic.source !== 'ai') problems.push('not scored by the AI path');
    if (english.status !== 'scored' || arabic.status !== 'scored') problems.push('one language was not scored');
    if (ratio < MIN_RATIO) problems.push(`Arabic is ${(ratio * 100).toFixed(0)}% of English by characters (minimum ${(MIN_RATIO * 100).toFixed(0)}%)`);
    if (arabic.covered < english.covered) problems.push(`Arabic covers ${arabic.covered} competencies, English ${english.covered}`);
    if (problems.length) failed = true;
    rows.push({ id: item.id, en_chars: english.chars, ar_chars: arabic.chars, ratio: Number(ratio.toFixed(2)), en_covered: `${english.covered}/${english.total}`, ar_covered: `${arabic.covered}/${arabic.total}`, result: problems.length ? problems.join('; ') : 'ok' });
  } catch (error) {
    failed = true;
    rows.push({ id: item.id, result: error instanceof Error ? error.message : String(error) });
  }
}

console.log(`Arabic feedback parity against ${BASE_URL} (minimum ratio ${MIN_RATIO})`);
console.table(rows);
if (failed) {
  console.error('Arabic feedback parity gate FAILED.');
  process.exit(1);
}
console.log('Arabic feedback parity gate passed.');
