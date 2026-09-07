import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteExpiredScreeningInterview } from '../lib/screening-cleanup.ts';
import { drainScreeningNotifications } from '../lib/screening-notification-drain.ts';
import { saveScreeningRecordingDraft, clearScreeningRecordingDrafts, pruneExpiredScreeningRecordingDrafts } from '../lib/screening-draft-store.ts';
import { signOutWithLocalCleanup } from '../lib/sign-out.ts';

test('cleanup preserves parent and video references when the answer lookup fails', async () => {
  const called = [];
  const result = await deleteExpiredScreeningInterview({
    readPaths: async () => ({ data: null, error: { code: 'database_unavailable' } }),
    removeVideos: async () => { called.push('storage'); return { error: null }; },
    removeInterview: async () => { called.push('parent'); return { error: null }; },
  });
  assert.deepEqual(called, []);
  assert.deepEqual(result, { deleted: false, code: 'database_unavailable' });
});

test('cleanup only deletes the parent after confirmed storage removal', async () => {
  for (const storageFails of [true, false]) {
    const called = [];
    const result = await deleteExpiredScreeningInterview({
      readPaths: async () => ({ data: [{ video_path: 'synthetic/video.webm' }], error: null }),
      removeVideos: async paths => { called.push(paths); return { error: storageFails ? { name: 'storage_unavailable' } : null }; },
      removeInterview: async () => { called.push('parent'); return { error: null }; },
    });
    assert.equal(result.deleted, !storageFails);
    assert.deepEqual(called, storageFails ? [['synthetic/video.webm']] : [['synthetic/video.webm'], 'parent']);
  }
});

test('one recovery invocation can process 60 due pilot messages in five-job batches', async () => {
  let calls = 0;
  const result = await drainScreeningNotifications(async () => {
    calls += 1;
    return { configured: true, claimed: 5, accepted: 5, failed: 0 };
  }, () => 0);
  assert.equal(calls, 12);
  assert.equal(result.accepted, 60);
});

test('recovery stops claiming when provider fails, queue empties or time budget expires', async () => {
  for (const scenario of ['failure', 'empty', 'timeout']) {
    let calls = 0;
    let elapsed = 0;
    const result = await drainScreeningNotifications(async () => {
      calls += 1;
      if (scenario === 'timeout') elapsed = 21_000;
      return { configured: true, claimed: scenario === 'empty' ? 0 : 5, accepted: 0, failed: scenario === 'failure' ? 5 : 0 };
    }, () => elapsed);
    assert.equal(calls, 1);
    assert.equal(result.stopped, { failure: 'failure', empty: 'drained', timeout: 'time_budget' }[scenario]);
  }
});

// This fake exposes request-success and transaction completion separately. It is
// deliberately unlike a synchronous Map mock, which cannot reproduce late aborts.
function installDatabase({ abort = false, rows = [], concurrentReplacement } = {}) {
  const records = new Map(rows.map(row => [row.key, row]));
  const old = globalThis.indexedDB;
  const operations = [];
  const modes = [];
  globalThis.indexedDB = {
    open() {
      const opening = {};
      queueMicrotask(() => {
        opening.result = {
          close() {},
          transaction(_storeName, mode) {
            modes.push(mode);
            const transaction = {};
            const operation = (kind, value) => {
              const request = {};
              operations.push(kind);
              queueMicrotask(() => {
                request.result = kind === 'getAll' ? [...records.values()] : value?.key;
                request.onsuccess();
                if (kind === 'getAll' && concurrentReplacement) records.set(concurrentReplacement.key, concurrentReplacement);
                setImmediate(() => {
                  if (abort) {
                    transaction.error = new Error('synthetic transaction abort');
                    transaction.onabort();
                  } else {
                    if (kind === 'put') records.set(value.key, value);
                    if (kind === 'clear') records.clear();
                    if (kind === 'delete') records.delete(value);
                    transaction.oncomplete();
                  }
                });
              });
              return request;
            };
            transaction.objectStore = () => ({
              put: value => operation('put', value), clear: () => operation('clear'),
              getAll: () => operation('getAll'), delete: value => operation('delete', value),
              openCursor() {
                operations.push('cursor');
                const request = {};
                const snapshot = [...records.values()];
                const deletedKeys = [];
                let index = 0;
                const advance = () => queueMicrotask(() => {
                  const value = snapshot[index++];
                  request.result = value ? {
                    value, delete: () => deletedKeys.push(value.key), continue: advance,
                  } : null;
                  request.onsuccess();
                  if (!value) setImmediate(() => {
                    if (abort) {
                      transaction.error = new Error('synthetic transaction abort');
                      transaction.onabort();
                    } else {
                      deletedKeys.forEach(key => records.delete(key));
                      transaction.oncomplete();
                      // A different write transaction acquires its lock only now.
                      if (concurrentReplacement) records.set(concurrentReplacement.key, concurrentReplacement);
                    }
                  });
                });
                advance();
                return request;
              },
            });
            return transaction;
          },
        };
        opening.onsuccess();
      });
      return opening;
    },
  };
  return { records, operations, modes, restore: () => { globalThis.indexedDB = old; } };
}

test('recording save rejects when request succeeds but transaction later aborts', async () => {
  const database = installDatabase({ abort: true });
  try {
    await assert.rejects(saveScreeningRecordingDraft('synthetic', 0, {
      blob: new Blob(['synthetic']), mimeType: 'video/webm', durationSeconds: 1,
    }, 'synthetic transcript'), /synthetic transaction abort/);
    assert.equal(database.records.size, 0);
  } finally { database.restore(); }
});

test('recording save resolves only after its recovery copy is committed', async () => {
  const database = installDatabase();
  try {
    await saveScreeningRecordingDraft('synthetic', 0, {
      blob: new Blob(['synthetic']), mimeType: 'video/webm', durationSeconds: 1,
    }, 'synthetic transcript');
    assert.equal(database.records.size, 1);
    await clearScreeningRecordingDrafts();
    assert.equal(database.records.size, 0);
  } finally { database.restore(); }
});

test('the recovery copy retains separate audio and its pending transcription marker', async () => {
  const database = installDatabase();
  try {
    await saveScreeningRecordingDraft('synthetic', 0, {
      blob: new Blob(['video']), mimeType: 'video/webm', durationSeconds: 5,
    }, '', [], null, { transcriptionAudio: new Blob(['audio'], { type: 'audio/mp4' }), needsTranscription: true });
    const draft = [...database.records.values()][0];
    assert.equal(await draft.blob.text(), 'video');
    assert.equal(await draft.transcriptionAudio.text(), 'audio');
    assert.equal(draft.needsTranscription, true);
    await clearScreeningRecordingDrafts();
    assert.equal(database.records.size, 0);
  } finally { database.restore(); }
});

test('sign-out purge rejects a late abort instead of reporting local evidence removed', async () => {
  const database = installDatabase({ abort: true, rows: [{ key: 'synthetic', transcript: 'synthetic' }] });
  try {
    await assert.rejects(clearScreeningRecordingDrafts(), /synthetic transaction abort/);
    assert.equal(database.records.size, 1);
  } finally { database.restore(); }
});

test('abandoned draft pruning removes expired or invalid dates but retains recent recovery', async () => {
  const database = installDatabase({ rows: [
    { key: 'old', savedOnDeviceAt: new Date(Date.now() - 8 * 86400_000).toISOString() },
    { key: 'invalid', savedOnDeviceAt: 'invalid' },
    { key: 'recent', savedOnDeviceAt: new Date().toISOString() },
  ] });
  try {
    await pruneExpiredScreeningRecordingDrafts();
    assert.deepEqual([...database.records.keys()], ['recent']);
  } finally { database.restore(); }
});

test('pruning uses one write transaction so a queued fresh replacement survives', async () => {
  const recent = { key: 'same-answer', savedOnDeviceAt: new Date().toISOString() };
  const database = installDatabase({
    rows: [{ key: 'same-answer', savedOnDeviceAt: new Date(Date.now() - 8 * 86400_000).toISOString() }],
    concurrentReplacement: recent,
  });
  try {
    await pruneExpiredScreeningRecordingDrafts();
    assert.deepEqual(database.modes, ['readwrite']);
    assert.equal(database.records.get('same-answer'), recent);
  } finally { database.restore(); }
});

test('a failed pruning transaction preserves recovery and reports failure', async () => {
  const database = installDatabase({ abort: true, rows: [{ key: 'old', savedOnDeviceAt: 'invalid' }] });
  try {
    await assert.rejects(pruneExpiredScreeningRecordingDrafts(), /synthetic transaction abort/);
    assert.equal(database.records.size, 1);
  } finally { database.restore(); }
});

test('local cleanup failure cannot prevent ending the authenticated session', async () => {
  let attempted = false;
  const result = await signOutWithLocalCleanup({
    clearLocal: async () => { throw new Error('IndexedDB blocked'); },
    endSession: async () => { attempted = true; return true; },
  });
  assert.equal(attempted, true);
  assert.deepEqual(result, { purgeFailed: true, signedOut: true });
});

test('session failure still removes local evidence and remains visibly signed in', async () => {
  let cleared = false;
  const result = await signOutWithLocalCleanup({
    clearLocal: async () => { cleared = true; },
    endSession: async () => { throw new Error('offline'); },
  });
  assert.equal(cleared, true);
  assert.deepEqual(result, { purgeFailed: false, signedOut: false });
});
