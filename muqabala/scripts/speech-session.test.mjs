import assert from 'node:assert/strict';
import test from 'node:test';

import { startDictation } from '../lib/speech.ts';

test('stopping dictation preserves interim-only speech', () => {
  const originalWindow = globalThis.window;
  const updates = [];

  class FakeRecognition {
    static instance;

    constructor() {
      FakeRecognition.instance = this;
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }

    start() {}
    stop() {}
    abort() {}
  }

  globalThis.window = { SpeechRecognition: FakeRecognition };

  try {
    const session = startDictation('en-US', (finalText, interimText) => {
      updates.push({ finalText, interimText });
    });
    assert.ok(session);

    const interimResult = [{ transcript: 'interim only answer', confidence: 0.9 }];
    interimResult.isFinal = false;
    FakeRecognition.instance.onresult({ resultIndex: 0, results: [interimResult] });

    assert.deepEqual(session.stop(), {
      finalText: '',
      interimText: 'interim only answer',
    });
    assert.deepEqual(updates, [{ finalText: '', interimText: 'interim only answer' }]);

    FakeRecognition.instance.onresult({ resultIndex: 0, results: [interimResult] });
    assert.equal(updates.length, 1);
  } finally {
    globalThis.window = originalWindow;
  }
});
