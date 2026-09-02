import assert from 'node:assert/strict';
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
import { modelAnswerFor } from '../lib/flow/model-answers.ts';

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
