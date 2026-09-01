'use client';

import type { RecordedVideo } from './media';

const DATABASE_NAME = 'muqabala-screening-recovery';
const STORE_NAME = 'recordings';
const DATABASE_VERSION = 1;

export type ScreeningRecordingDraft = {
  key: string;
  interviewId: string;
  questionIndex: number;
  blob: Blob;
  mimeType: RecordedVideo['mimeType'];
  durationSeconds: number;
  transcript: string;
  savedOnDeviceAt: string;
};

function draftKey(interviewId: string, questionIndex: number): string {
  return `${interviewId}:${questionIndex}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Secure recording recovery is not available in this browser.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('interviewId', 'interviewId', { unique: false });
      }
    };
    request.onerror = () => reject(request.error ?? new Error('Recording recovery could not be opened.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Recording recovery failed.'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Recording recovery was interrupted.'));
    };
  });
}

export async function saveScreeningRecordingDraft(
  interviewId: string,
  questionIndex: number,
  recording: RecordedVideo,
  transcript: string,
): Promise<ScreeningRecordingDraft> {
  const draft: ScreeningRecordingDraft = {
    key: draftKey(interviewId, questionIndex),
    interviewId,
    questionIndex,
    blob: recording.blob,
    mimeType: recording.mimeType,
    durationSeconds: recording.durationSeconds,
    transcript,
    savedOnDeviceAt: new Date().toISOString(),
  };
  await runRequest('readwrite', (store) => store.put(draft));
  return draft;
}

export async function getScreeningRecordingDraft(
  interviewId: string,
  questionIndex: number,
): Promise<ScreeningRecordingDraft | null> {
  const result = await runRequest<ScreeningRecordingDraft | undefined>(
    'readonly',
    (store) => store.get(draftKey(interviewId, questionIndex)),
  );
  return result ?? null;
}

export async function deleteScreeningRecordingDraft(interviewId: string, questionIndex: number): Promise<void> {
  await runRequest('readwrite', (store) => store.delete(draftKey(interviewId, questionIndex)));
}

export async function getScreeningRecordingDrafts(interviewId: string): Promise<ScreeningRecordingDraft[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const index = transaction.objectStore(STORE_NAME).index('interviewId');
    const request = index.getAll(IDBKeyRange.only(interviewId));
    request.onsuccess = () => resolve((request.result as ScreeningRecordingDraft[]).sort((a, b) => a.questionIndex - b.questionIndex));
    request.onerror = () => reject(request.error ?? new Error('Saved recordings could not be restored.'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Saved recordings could not be restored.'));
    };
  });
}

export async function probeScreeningRecordingStore(): Promise<boolean> {
  const probeId = `probe-${crypto.randomUUID()}`;
  try {
    const database = await openDatabase();
    database.close();
    const blob = new Blob(['muqabala'], { type: 'video/webm' });
    await saveScreeningRecordingDraft(probeId, 0, {
      blob,
      mimeType: 'video/webm',
      durationSeconds: 1,
    }, '');
    const restored = await getScreeningRecordingDraft(probeId, 0);
    await deleteScreeningRecordingDraft(probeId, 0);
    if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
    return restored?.blob.size === blob.size;
  } catch {
    return false;
  }
}
