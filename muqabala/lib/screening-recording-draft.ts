'use client';

import type { RecordedVideo } from './media';

const DATABASE_NAME = 'muqabala-screening-drafts';
const STORE_NAME = 'recordings';
const DATABASE_VERSION = 1;
const MAX_AGE_MS = 48 * 60 * 60 * 1_000;

export type ScreeningRecordingDraft = {
  interviewId: string;
  questionIndex: number;
  transcript: string;
  recording: RecordedVideo;
  updatedAt: number;
};

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

export async function saveScreeningRecordingDraft(
  draft: Omit<ScreeningRecordingDraft, 'updatedAt'>,
): Promise<boolean> {
  const database = await openDatabase();
  if (!database) return false;
  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ ...draft, updatedAt: Date.now() }, draft.interviewId);
    transaction.oncomplete = () => { database.close(); resolve(true); };
    transaction.onerror = () => { database.close(); resolve(false); };
    transaction.onabort = () => { database.close(); resolve(false); };
  });
}

export async function loadScreeningRecordingDraft(interviewId: string): Promise<ScreeningRecordingDraft | null> {
  const database = await openDatabase();
  if (!database) return null;
  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(interviewId);
    request.onsuccess = () => {
      const draft = request.result as ScreeningRecordingDraft | undefined;
      database.close();
      if (!draft || Date.now() - draft.updatedAt > MAX_AGE_MS || draft.updatedAt > Date.now() + 60_000) {
        void deleteScreeningRecordingDraft(interviewId);
        resolve(null);
        return;
      }
      resolve(draft);
    };
    request.onerror = () => { database.close(); resolve(null); };
  });
}

export async function deleteScreeningRecordingDraft(interviewId: string): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(interviewId);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); resolve(); };
    transaction.onabort = () => { database.close(); resolve(); };
  });
}
