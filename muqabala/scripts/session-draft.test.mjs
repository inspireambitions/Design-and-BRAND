import assert from 'node:assert/strict';
import test from 'node:test';

import {
  discardInterviewDraft,
  interviewDraftKey,
  loadLatestCustomInterviewDraft,
  loadInterviewDraft,
  purgeExpiredInterviewDrafts,
  saveInterviewDraft,
  SESSION_DRAFT_MAX_AGE_MS,
} from '../lib/session-draft.ts';

class MemoryStorage {
  constructor(values = []) {
    this.values = new Map(values);
  }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}

const question = {
  id: 'q1',
  text: 'Tell me about a difficult guest.',
  textAr: 'حدثني عن ضيف صعب.',
  competencies: ['service'],
  prepSeconds: 30,
  answerSeconds: 120,
  hint: 'Use a real example.',
  hintAr: 'استخدم مثالاً حقيقياً.',
};

const feedback = {
  questionId: 'q1',
  score: 78,
  status: 'scored',
  headline: 'Clear example',
  competencies: [{ id: 'service', label: 'Service', score: 8, evidence: 'I called the guest.' }],
  strengths: ['You took ownership.'],
  improvements: ['Add the result.'],
  coachTip: 'State what changed.',
  source: 'ai',
};

function draft(overrides = {}) {
  return {
    roleId: 'front-office-agent',
    tailored: false,
    fellBack: false,
    language: 'ar',
    stage: 'review',
    questionIndex: 0,
    mode: 'guided',
    answerMethod: 'video',
    transcript: 'I called the guest and fixed the booking.',
    transcriptConfirmed: true,
    feedback: null,
    answers: [],
    previousTry: null,
    attemptCount: 2,
    serverAttemptId: 'attempt-1',
    reportGateRequired: true,
    reportUnlocked: false,
    questionSnapshot: [question],
    ...overrides,
  };
}

test('round trip preserves the resumable interview state and pinned language', () => {
  const storage = new MemoryStorage();
  const now = Date.parse('2026-08-24T12:00:00.000Z');
  assert.equal(saveInterviewDraft(storage, draft(), now), true);
  const restored = loadInterviewDraft(storage, {
    roleId: 'front-office-agent', fallbackLanguage: 'en', fallbackQuestions: [question], now,
  });
  assert.equal(restored.language, 'ar');
  assert.equal(restored.stage, 'review');
  assert.equal(restored.answerMethod, 'video');
  assert.equal(restored.transcriptConfirmed, true);
  assert.equal(restored.attemptCount, 2);
});

test('a shared persistent store survives a new service instance', () => {
  const values = new Map();
  const first = new MemoryStorage();
  first.values = values;
  const second = new MemoryStorage();
  second.values = values;
  saveInterviewDraft(first, draft());
  assert.equal(loadInterviewDraft(second, {
    roleId: 'front-office-agent', fallbackLanguage: 'en', fallbackQuestions: [question],
  }).transcript, draft().transcript);
});

test('recording resumes safely at review when words exist and prep when they do not', () => {
  const withWords = new MemoryStorage();
  saveInterviewDraft(withWords, draft({ stage: 'record' }));
  assert.equal(loadInterviewDraft(withWords, {
    roleId: 'front-office-agent', fallbackLanguage: 'en', fallbackQuestions: [question],
  }).stage, 'review');

  const empty = new MemoryStorage();
  saveInterviewDraft(empty, draft({ stage: 'record', transcript: '' }));
  assert.equal(loadInterviewDraft(empty, {
    roleId: 'front-office-agent', fallbackLanguage: 'en', fallbackQuestions: [question],
  }).stage, 'prep');
});

test('expired, malformed and future-version drafts are removed', () => {
  const now = Date.parse('2026-08-24T12:00:00.000Z');
  for (const raw of [
    '{broken',
    JSON.stringify({ version: 99 }),
  ]) {
    const storage = new MemoryStorage();
    const key = interviewDraftKey('front-office-agent');
    storage.setItem(key, raw);
    assert.equal(loadInterviewDraft(storage, {
      roleId: 'front-office-agent', fallbackLanguage: 'en', fallbackQuestions: [question], now,
    }), null);
    assert.equal(storage.getItem(key), null);
  }

  const expired = new MemoryStorage();
  saveInterviewDraft(expired, draft(), now - SESSION_DRAFT_MAX_AGE_MS - 1);
  assert.equal(loadInterviewDraft(expired, {
    roleId: 'front-office-agent', fallbackLanguage: 'en', fallbackQuestions: [question], now,
  }), null);
});

test('opening Muqabala purges expired drafts for roles the candidate did not revisit', () => {
  const storage = new MemoryStorage();
  const now = Date.parse('2026-08-24T12:00:00.000Z');
  saveInterviewDraft(storage, draft({ roleId: 'housekeeper' }), now - SESSION_DRAFT_MAX_AGE_MS - 1);
  saveInterviewDraft(storage, draft({ roleId: 'waiter' }), now);
  purgeExpiredInterviewDrafts(storage, now);
  assert.equal(storage.getItem(interviewDraftKey('housekeeper')), null);
  assert.notEqual(storage.getItem(interviewDraftKey('waiter')), null);
});

test('legacy drafts migrate once without silently changing the answer', () => {
  const storage = new MemoryStorage();
  storage.setItem('muqabala.draft.v1.front-office-agent', JSON.stringify({
    index: 0,
    mode: 'guided',
    transcript: 'My unfinished answer',
    answers: [],
    updatedAt: new Date().toISOString(),
  }));
  const restored = loadInterviewDraft(storage, {
    roleId: 'front-office-agent', fallbackLanguage: 'ar', fallbackQuestions: [question],
  });
  assert.equal(restored.version, 2);
  assert.equal(restored.language, 'ar');
  assert.equal(restored.transcript, 'My unfinished answer');
  assert.equal(restored.stage, 'review');
  assert.equal(storage.getItem('muqabala.draft.v1.front-office-agent'), null);
});

test('serialisation allowlists data and never stores media objects or object URLs', () => {
  const storage = new MemoryStorage();
  const hostile = draft();
  hostile.playbackUrl = 'blob:private-recording';
  hostile.mediaStream = { secretTrack: 'camera-track' };
  hostile.chunks = ['private-audio'];
  hostile.srcObject = { secret: true };
  hostile.questionSnapshot[0].playbackUrl = 'blob:nested-question-media';
  hostile.feedback = { ...feedback, mediaStream: { secret: 'nested-feedback-media' } };
  hostile.answers = [{
    questionId: 'q1', questionText: question.text, transcript: 'Finished answer',
    feedback: { ...feedback, chunks: ['nested-answer-media'] },
  }];
  saveInterviewDraft(storage, hostile);
  const raw = storage.getItem(interviewDraftKey('front-office-agent'));
  assert.equal(raw.includes('blob:private-recording'), false);
  assert.equal(raw.includes('playbackUrl'), false);
  assert.equal(raw.includes('mediaStream'), false);
  assert.equal(raw.includes('private-audio'), false);
  assert.equal(raw.includes('srcObject'), false);
  assert.equal(raw.includes('nested-question-media'), false);
  assert.equal(raw.includes('nested-feedback-media'), false);
  assert.equal(raw.includes('nested-answer-media'), false);
});

test('discard is idempotent, removes only the matching draft and leaves language preference', () => {
  const storage = new MemoryStorage([['muqabala.lang.v1', 'ar']]);
  saveInterviewDraft(storage, draft());
  saveInterviewDraft(storage, draft({ roleId: 'housekeeper' }));
  discardInterviewDraft(storage, 'front-office-agent');
  discardInterviewDraft(storage, 'front-office-agent');
  assert.equal(storage.getItem(interviewDraftKey('front-office-agent')), null);
  assert.notEqual(storage.getItem(interviewDraftKey('housekeeper')), null);
  assert.equal(storage.getItem('muqabala.lang.v1'), 'ar');
});

test('the custom route can discover its latest saved job-ad interview after refresh', () => {
  const storage = new MemoryStorage();
  saveInterviewDraft(storage, draft({
    roleId: 'custom',
    customTitle: 'Revenue Manager',
    tailored: true,
    interviewToken: 'signed-rubric-token',
  }));
  const restored = loadLatestCustomInterviewDraft(storage);
  assert.equal(restored.customTitle, 'Revenue Manager');
  assert.equal(restored.tailored, true);
  assert.equal(restored.interviewToken, 'signed-rubric-token');
});

test('blocked storage fails closed without crashing practice', () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.equal(saveInterviewDraft(blocked, draft()), false);
  assert.equal(loadInterviewDraft(blocked, {
    roleId: 'front-office-agent', fallbackLanguage: 'en', fallbackQuestions: [question],
  }), null);
  assert.doesNotThrow(() => discardInterviewDraft(blocked, 'front-office-agent'));
});

test('feedback stage is valid only with the original feedback attached', () => {
  const storage = new MemoryStorage();
  saveInterviewDraft(storage, draft({ stage: 'feedback', feedback }));
  assert.deepEqual(loadInterviewDraft(storage, {
    roleId: 'front-office-agent', fallbackLanguage: 'en', fallbackQuestions: [question],
  }).feedback, feedback);
});
