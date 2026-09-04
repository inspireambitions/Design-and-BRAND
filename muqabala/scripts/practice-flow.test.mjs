import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ANSWER_MODE_STORAGE_KEY,
  availableAnswerMode,
  defaultAnswerMode,
  initialAnswerMode,
  readStarGuide,
  readStoredAnswerMode,
  recordingLimitSeconds,
  storeAnswerMode,
  storeStarGuide,
} from '../lib/flow/answer-mode.ts';
import { limitBlock, limitSentences, splitSentences } from '../lib/flow/feedback-copy.ts';
import { diffAddedWords, hasAddedWords, tokenise } from '../lib/flow/answer-diff.ts';
import { compareRetries } from '../lib/retry-comparison.ts';
import { hasScoredImprovement } from '../lib/retry-comparison.ts';
import { modelAnswerFor } from '../lib/flow/model-answers.ts';
import { structureCheck } from '../lib/scoring.ts';

/** Question ids of the two hospitality roles, kept in step with lib/roles/hospitality.ts. */
const HOSPITALITY_QUESTIONS = {
  'front-office-agent': ['intro', 'angry_guest', 'overbooking', 'systems', 'why_gulf'],
  waiter: ['intro', 'wrong_order', 'upselling', 'busy_shift', 'why_gulf'],
};

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

test('answer mode defaults to Type on a phone and Speak on a desktop', () => {
  assert.equal(defaultAnswerMode({ isMobile: true }), 'type');
  assert.equal(defaultAnswerMode({ isMobile: false }), 'speak');
});

test('answer mode is remembered in storage and ignores junk values', () => {
  const storage = memoryStorage();
  assert.equal(readStoredAnswerMode(storage), null);
  assert.equal(storeAnswerMode(storage, 'video'), true);
  assert.equal(storage.getItem(ANSWER_MODE_STORAGE_KEY), 'video');
  assert.equal(readStoredAnswerMode(storage), 'video');
  storage.setItem(ANSWER_MODE_STORAGE_KEY, 'dance');
  assert.equal(readStoredAnswerMode(storage), null);
  assert.equal(readStoredAnswerMode(null), null);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
  assert.equal(readStoredAnswerMode(broken), null);
  assert.equal(storeAnswerMode(broken, 'type'), false);
});

test('a remembered mode the device cannot run steps down, never up', () => {
  assert.equal(availableAnswerMode('video', { speak: true, video: false }), 'speak');
  assert.equal(availableAnswerMode('video', { speak: false, video: false }), 'type');
  assert.equal(availableAnswerMode('speak', { speak: false, video: true }), 'type');
  assert.equal(availableAnswerMode('type', { speak: true, video: true }), 'type');
  assert.equal(
    initialAnswerMode({ stored: 'video', device: { isMobile: false }, availability: { speak: true, video: true } }),
    'video',
  );
  assert.equal(
    initialAnswerMode({ stored: null, device: { isMobile: false }, availability: { speak: false, video: false } }),
    'type',
  );
});

test('recording limit is two minutes or the question allowance, plus any extra time', () => {
  assert.equal(recordingLimitSeconds(120), 120);
  assert.equal(recordingLimitSeconds(300), 120);
  assert.equal(recordingLimitSeconds(90), 90);
  assert.equal(recordingLimitSeconds(90, 60), 150);
  assert.equal(recordingLimitSeconds(0), 1);
});

test('STAR guide preference is off by default and survives a round trip', () => {
  const storage = memoryStorage();
  assert.equal(readStarGuide(storage), false);
  storeStarGuide(storage, true);
  assert.equal(readStarGuide(storage), true);
  storeStarGuide(storage, false);
  assert.equal(readStarGuide(storage), false);
});

test('limitSentences keeps at most two sentences in English and Arabic', () => {
  assert.deepEqual(splitSentences('You named the guest. You gave a time. You said the outcome.'), [
    'You named the guest.',
    'You gave a time.',
    'You said the outcome.',
  ]);
  assert.equal(
    limitSentences('You named the guest. You gave a time. You said the outcome.', 2),
    'You named the guest. You gave a time.',
  );
  assert.equal(limitSentences('Rated 4.5 out of 5. Then a second one. Third!', 2), 'Rated 4.5 out of 5. Then a second one.');
  assert.equal(limitSentences('ذكرت اسم النزيل. حددت الوقت؟ ثم قلت النتيجة.', 2), 'ذكرت اسم النزيل. حددت الوقت؟');
  assert.equal(limitSentences('No closing mark at all', 2), 'No closing mark at all');
  assert.equal(
    limitSentences('Say: "I fixed it in eight minutes." Then stop. And another.', 2),
    'Say: "I fixed it in eight minutes." Then stop.',
  );
  assert.equal(limitSentences('   ', 2), '');
  assert.equal(limitSentences('One. Two.', 0), '');
});

test('limitBlock joins list items and still stops at two sentences', () => {
  assert.equal(limitBlock(['Named the system', 'Gave the wait time.', 'Said thank you.']), 'Named the system. Gave the wait time.');
  assert.equal(limitBlock(['  ', 'Only one']), 'Only one.');
  assert.equal(limitBlock([]), '');
});

test('tokenise keeps every character so the answer reads back unchanged', () => {
  const text = 'I called Opera, then the duty manager.';
  assert.equal(tokenise(text).map((token) => token.text).join(''), text);
  const arabic = 'اتصلت بالمدير ثم عوّضت النزيل.';
  assert.equal(tokenise(arabic, 'ar').map((token) => token.text).join(''), arabic);
});

test('diffAddedWords highlights only words missing from the first answer', () => {
  const segments = diffAddedWords(
    'I spoke to the guest and fixed it.',
    'I spoke to the guest, offered a free breakfast and fixed it in ten minutes.',
  );
  assert.equal(segments.map((segment) => segment.text).join(''),
    'I spoke to the guest, offered a free breakfast and fixed it in ten minutes.');
  const added = segments.filter((segment) => segment.added).map((segment) => segment.text);
  assert.deepEqual(added, ['offered a free breakfast', 'in ten minutes']);
  assert.equal(hasAddedWords(segments), true);
});

test('diffAddedWords is case and punctuation blind and handles Arabic diacritics', () => {
  const same = diffAddedWords('Guest was Angry.', 'guest was angry');
  assert.equal(hasAddedWords(same), false);
  const arabic = diffAddedWords('كان النزيل غاضباً', 'كان النزيل غاضبا فاعتذرت فوراً');
  assert.deepEqual(arabic.filter((segment) => segment.added).map((segment) => segment.text), ['فاعتذرت فوراً']);
  assert.equal(hasAddedWords(diffAddedWords('', '')), false);
});

test('diffAddedWords keeps hyphenated additions in one readable highlight', () => {
  const segments = diffAddedWords('I worked at a hotel.', 'I worked at a four-star hotel.');
  assert.deepEqual(segments.filter((segment) => segment.added).map((segment) => segment.text), ['four-star']);
});

const competency = (id, evidence = null) => ({ id, label: id, score: evidence ? 8 : 2, evidence });
const feedback = (overrides = {}) => ({
  questionId: 'q1', score: 70, status: 'scored', headline: 'Result',
  competencies: [competency('ownership')], strengths: [], improvements: ['Add the outcome.'],
  coachTip: 'Say what changed.', source: 'ai', scoringVersion: 'model-v1', rubricVersion: 'rubric-v1',
  ...overrides,
});

test('retry comparison names the real reason it cannot compare', () => {
  assert.deepEqual(compareRetries(feedback({ status: 'unscored' }), feedback()), { compatible: false, reason: 'unscored' });
  assert.deepEqual(compareRetries(feedback(), feedback({ rubricVersion: 'rubric-v2' })), { compatible: false, reason: 'version_changed' });
  assert.deepEqual(compareRetries(feedback(), feedback({ scoringVersion: 'model-v2' })), { compatible: false, reason: 'version_changed' });
  assert.deepEqual(compareRetries(feedback(), feedback({ source: 'structure' })), { compatible: false, reason: 'version_changed' });
  assert.deepEqual(compareRetries(feedback({ scoringVersion: undefined }), feedback()), { compatible: false, reason: 'version_unknown' });
  assert.deepEqual(compareRetries(feedback(), feedback({ questionId: 'q2' })), { compatible: false, reason: 'different_question' });
  assert.deepEqual(
    compareRetries(feedback(), feedback({ competencies: [competency('ownership'), competency('evidence')] })),
    { compatible: false, reason: 'different_rubric' },
  );
  assert.equal(compareRetries(feedback(), feedback()).compatible, true);
});

test('retry comparison exposes score deltas and email capture waits for a scored improvement', () => {
  const before = feedback({
    score: 60,
    competencies: [competency('communication', 'Some proof'), competency('customer_focus', 'Some proof')],
  });
  before.competencies[0].score = 7;
  before.competencies[1].score = 5;
  const after = feedback({
    score: 95,
    competencies: [competency('communication', 'Stronger proof'), competency('customer_focus', 'Stronger proof')],
  });
  after.competencies[0].score = 9;
  after.competencies[1].score = 10;
  const result = compareRetries(before, after);
  assert.equal(result.compatible, true);
  assert.deepEqual(result.scoreDelta, { before: 60, after: 95 });
  assert.deepEqual(result.criterionDeltas, [
    { id: 'communication', label: 'communication', before: 7, after: 9 },
    { id: 'customer_focus', label: 'customer_focus', before: 5, after: 10 },
  ]);
  assert.equal(hasScoredImprovement(before, after), true);
  assert.equal(hasScoredImprovement(feedback({ status: 'unscored' }), after), false);
  assert.equal(hasScoredImprovement(after, before), false);
});

test('the setup and answer fields protect accessibility and fast typed input', () => {
  const flow = readFileSync(new URL('../components/InterviewFlow.tsx', import.meta.url), 'utf8');
  const selector = readFileSync(new URL('../components/flow/AnswerModeSelector.tsx', import.meta.url), 'utf8');
  assert.match(flow, /aria-labelledby="interview-mode-mock-title interview-mode-mock-body"/);
  assert.match(flow, /aria-labelledby="interview-mode-guided-title interview-mode-guided-body"/);
  assert.match(flow, /aria-labelledby="extra-time-title extra-time-body"/);
  assert.match(selector, /aria-labelledby=\{`\$\{idPrefix\}-title \$\{idPrefix\}-body`\}/);
  assert.match(flow, /onChoose=\{setAnswerMethod\}/);
  assert.match(flow, /t\('startPracticeButton'\)/);
  assert.doesNotMatch(flow, /<textarea[\s\S]{0,400}value=\{transcript\}/);
  assert.match(flow, /<textarea[\s\S]{0,400}defaultValue=\{transcript\}[\s\S]{0,300}onInput=/);
  assert.match(flow, /addEventListener\('popstate', onPopState\)/);
  assert.match(flow, /addEventListener\('beforeunload', onBeforeUnload\)/);
  assert.match(flow, /window\.confirm\(t\('leavePracticeConfirm'\)\)/);
});

test('an unscored answer shows no zero readiness dial or share card', () => {
  const readiness = readFileSync(new URL('../components/ReadinessScore.tsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../components/ReadinessPanel.tsx', import.meta.url), 'utf8');
  const share = readFileSync(new URL('../components/ShareProgressCard.tsx', import.meta.url), 'utf8');
  assert.match(readiness, /snapshot\.questionsPractised === 0/);
  assert.match(readiness, /readinessNotScored/);
  assert.match(panel, /snapshot\.questionsPractised > 0/);
  assert.match(share, /snapshot\.questionsPractised === 0/);
});

test('answer length is not scored and concise evidence beats fluent padding', () => {
  const question = { id: 'angry_guest' };
  const substantive = structureCheck(question,
    'Last month at a hotel in Deira, an angry guest complained because his room was not ready. I apologised, checked Opera, called housekeeping, and updated him every ten minutes. The room was ready in twenty minutes, and in the end he thanked me at checkout.');
  const padded = structureCheck(question,
    'Customer service is very important in every hotel. I am hardworking and passionate about hospitality. Guests are always important and teamwork is important. We always try our best and follow every policy. I believe communication, service, quality, professionalism and a positive attitude are important. I always want every guest to be happy, comfortable and satisfied. In hospitality we must smile, listen, understand, communicate, support the team, solve problems and provide excellent five star service at all times for every guest.');
  assert.equal(substantive.status, 'scored');
  assert.ok(substantive.score > padded.score, `${substantive.score} should beat ${padded.score}`);
  assert.doesNotMatch(JSON.stringify(substantive.competencies), /Answer length/);

  const route = readFileSync(new URL('../app/api/score/route.ts', import.meta.url), 'utf8');
  assert.match(route, /Answer length is not a scoring criterion/);
  assert.match(route, /A longer answer must receive the same score as a shorter answer/);
  assert.match(route, /coach-content-rubric-2026-09-04/);
});

test('the rubric stays visible while answering and reviewing, and retry copy uses the real attempt', () => {
  const flow = readFileSync(new URL('../components/InterviewFlow.tsx', import.meta.url), 'utf8');
  const comparison = readFileSync(new URL('../components/flow/AnswerComparison.tsx', import.meta.url), 'utf8');
  assert.equal((flow.match(/\{rubricPreview\}/g) ?? []).length, 3);
  assert.match(flow, /typedAnswerReviewTitle/);
  assert.match(comparison, /replace\('\{attempt\}', String\(attempt\)\)/);
  assert.doesNotMatch(comparison, /diffAddedLabel/);
  assert.match(comparison, /criterionDeltas/);
});

test('practice supports desktop video when browser recording APIs exist', async () => {
  const { buildDeviceCapabilities, videoCaptureSupported, videoModeSupported } = await import('../lib/device-capabilities.ts');
  const desktopChrome = buildDeviceCapabilities({
    isMobile: false,
    speechSupported: true,
    recordingSupported: true,
    mediaDevicesSupported: true,
  });
  assert.equal(videoModeSupported(desktopChrome), true);
  assert.equal(videoCaptureSupported(desktopChrome), true);
});

test('the email ask appears only after a scored improvement and model answers use rubric labels', () => {
  const flow = readFileSync(new URL('../components/InterviewFlow.tsx', import.meta.url), 'utf8');
  const model = readFileSync(new URL('../components/flow/ModelAnswer.tsx', import.meta.url), 'utf8');
  assert.match(flow, /hasScoredImprovement\(previousTry\?\.feedback, feedback\)/);
  assert.doesNotMatch(flow, /attemptCount === 1 && practiceSitting/);
  assert.match(model, /criteria: Array<Pick<Competency/);
  assert.doesNotMatch(model, /modelRelevance|modelEvidence|modelStructure|modelClarity/);
});

test('front office questions use clean candidate-facing grammar', () => {
  const hospitality = readFileSync(new URL('../lib/roles/hospitality.ts', import.meta.url), 'utf8');
  assert.match(hospitality, /How did you handle an angry guest who complained directly to you\?/);
  assert.doesNotMatch(hospitality, /Tell me about a time an angry guest complained directly to you\?/);
});

test('model answers exist for every front office and waiter question in both languages', () => {
  for (const [roleId, questionIds] of Object.entries(HOSPITALITY_QUESTIONS)) {
    for (const id of questionIds) {
      for (const lang of ['en', 'ar']) {
        const answer = modelAnswerFor(roleId, { id }, lang);
        assert.ok(answer, `${roleId}/${id}/${lang}`);
        const text = [answer.relevance, answer.evidence, answer.structure, answer.clarity].join(' ');
        const words = text.split(/\s+/).filter(Boolean).length;
        assert.ok(words >= 80 && words <= 120, `${roleId}/${id}/${lang} has ${words} words`);
        assert.doesNotMatch(text, /\u2014/);
      }
    }
  }
  assert.equal(modelAnswerFor('waiter', { id: 'not_a_question' }, 'en'), null);
  const custom = { id: 'x', modelAnswer: { relevance: 'a', evidence: 'b', structure: 'c', clarity: 'd' } };
  assert.equal(modelAnswerFor('custom', custom, 'en').relevance, 'a');
  assert.equal(modelAnswerFor('custom', custom, 'ar').relevance, 'a');
});

test('the full interview is offered on the start screen and is the default when eight questions exist', () => {
  const flow = readFileSync(new URL('../components/InterviewFlow.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(flow, /\{mode === 'mock' && mockQuestions && mockQuestions\.length > 0 && \(/, 'the Full interview card must not depend on mock already being selected');
  assert.match(flow, /\{mockQuestions && mockQuestions\.length > 0 && \(\s*<button/, 'Full interview card renders whenever a full set exists');
  assert.match(flow, /!focusQuestionId && mockQuestions && mockQuestions\.length >= 8 \? 'mock' : 'guided'/, 'full interview is the default; a single-question plan link stays guided');
});
