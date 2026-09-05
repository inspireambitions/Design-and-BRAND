'use client';

import type { RecordedVideo } from './media';
import type { TranscriptSegment } from './interviews';

const DATABASE_NAME = 'muqabala-screening-recovery';
const STORE_NAME = 'recordings';
const DATABASE_VERSION = 1;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type ScreeningRecordingDraft = {
  key: string;
  interviewId: string;
  questionIndex: number;
  blob: Blob;
  mimeType: RecordedVideo['mimeType'];
  durationSeconds: number;
  transcript: string;
  transcriptSegments: TranscriptSegment[];
  transcriptTimingVersion: 'openai-whisper-segment-v1' | null;
  savedOnDeviceAt: string;
  transcriptionAudio?: Blob | null;
  needsTranscription?: boolean;
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
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
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
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error('Recording recovery failed.'));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
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
  transcriptSegments: TranscriptSegment[] = [],
  transcriptTimingVersion: 'openai-whisper-segment-v1' | null = null,
  recovery: { transcriptionAudio?: Blob | null; needsTranscription?: boolean } = {},
): Promise<ScreeningRecordingDraft> {
  const draft: ScreeningRecordingDraft = {
    key: draftKey(interviewId, questionIndex),
    interviewId,
    questionIndex,
    blob: recording.blob,
    mimeType: recording.mimeType,
    durationSeconds: recording.durationSeconds,
    transcript,
    transcriptSegments,
    transcriptTimingVersion,
    savedOnDeviceAt: new Date().toISOString(),
    ...recovery,
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
  if (result && isExpiredDraft(result)) {
    await deleteScreeningRecordingDraft(interviewId, questionIndex);
    return null;
  }
  return result ?? null;
}

export async function deleteScreeningRecordingDraft(interviewId: string, questionIndex: number): Promise<void> {
  await runRequest('readwrite', (store) => store.delete(draftKey(interviewId, questionIndex)));
}

export async function getScreeningRecordingDrafts(interviewId: string): Promise<ScreeningRecordingDraft[]> {
  await pruneExpiredScreeningRecordingDrafts();
  const drafts = await runRequest<ScreeningRecordingDraft[]>('readonly', (store) =>
    store.index('interviewId').getAll(IDBKeyRange.only(interviewId)));
  return drafts.sort((a, b) => a.questionIndex - b.questionIndex);
}

function isExpiredDraft(draft: ScreeningRecordingDraft): boolean {
  const savedAt = Date.parse(draft.savedOnDeviceAt);
  return !Number.isFinite(savedAt) || savedAt <= Date.now() - DRAFT_MAX_AGE_MS;
}

export async function pruneExpiredScreeningRecordingDrafts(): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    // The cursor's read and delete share a write lock. A fresh recording from
    // another tab cannot replace an expired record between inspection and deletion.
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const request = transaction.objectStore(STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (isExpiredDraft(cursor.value as ScreeningRecordingDraft)) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Recording recovery cleanup was interrupted.'));
    };
  });
}

/** Explicit sign-out removes every recovery copy on this browser profile. */
export async function clearScreeningRecordingDrafts(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await runRequest('readwrite', (store) => store.clear());
}

export async function probeScreeningRecordingStore(): Promise<boolean> {
  const probeId = `probe-${crypto.randomUUID()}`;
  try {
    await pruneExpiredScreeningRecordingDrafts();
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

