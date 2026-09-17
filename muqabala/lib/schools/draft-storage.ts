'use client';

/** 24 hours in milliseconds for draft expiration */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type StoredDraft = {
  text: string;
  updatedAt: number;
};

/**
 * Builds the canonical scoped draft key:
 * muqabala.draft.${studentUserId}.${assignmentId}.${attemptId}.${turnKey}
 */
export function getDraftKey(
  studentUserId: string,
  assignmentId: string,
  attemptId: string,
  turnKey: string
): string {
  return `muqabala.draft.${studentUserId}.${assignmentId}.${attemptId}.${turnKey}`;
}

/**
 * Saves a draft answer with a timestamp for TTL enforcement.
 * If text is empty/whitespace, removes the draft key.
 */
export function saveDraft(
  studentUserId: string,
  assignmentId: string,
  attemptId: string,
  turnKey: string,
  text: string
): void {
  if (typeof window === 'undefined') return;
  const key = getDraftKey(studentUserId, assignmentId, attemptId, turnKey);
  try {
    if (text && text.trim()) {
      const payload: StoredDraft = {
        text,
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(key, JSON.stringify(payload));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota / privacy mode exceptions
  }
}

/**
 * Loads a draft answer from localStorage.
 * Automatically checks the 24-hour TTL:
 * - If expired: removes the draft from storage and returns null.
 * - If valid: returns the draft text.
 */
export function loadDraft(
  studentUserId: string,
  assignmentId: string,
  attemptId: string,
  turnKey: string,
  now = Date.now()
): string | null {
  if (typeof window === 'undefined') return null;
  const key = getDraftKey(studentUserId, assignmentId, attemptId, turnKey);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
        const updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0;
        if (now - updatedAt > DRAFT_TTL_MS) {
          // Expired: remove and do not restore
          window.localStorage.removeItem(key);
          return null;
        }
        return parsed.text;
      }
    } catch {
      // If raw data was unparseable plain text without timestamp, treat as expired & remove
      window.localStorage.removeItem(key);
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Clears a specific question turn's draft upon server acceptance.
 */
export function clearDraft(
  studentUserId: string,
  assignmentId: string,
  attemptId: string,
  turnKey: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getDraftKey(studentUserId, assignmentId, attemptId, turnKey);
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Removes interview drafts belonging to the authenticated student upon sign-out.
 * Leaves all unrelated browser storage (e.g. language preferences, other users) intact.
 */
export function clearStudentDrafts(studentUserId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const prefix = studentUserId ? `muqabala.draft.${studentUserId}.` : 'muqabala.draft.';
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(prefix)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Prunes any expired interview drafts found in storage.
 */
export function pruneExpiredDrafts(now = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    const prefix = 'muqabala.draft.';
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(prefix)) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed.updatedAt !== 'number' || (now - parsed.updatedAt > DRAFT_TTL_MS)) {
              window.localStorage.removeItem(key);
            }
          } catch {
            window.localStorage.removeItem(key);
          }
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
}
