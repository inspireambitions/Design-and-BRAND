'use client';

import type { Attempt, AttemptRating } from './scoring';
import type { Lang } from './i18n';

const ATTEMPTS_KEY = 'muqabala.attempts.v1';
const LANG_KEY = 'muqabala.lang.v1';

export function loadAttempts(): Attempt[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1_000;
    const retained = (parsed as Attempt[]).filter((attempt) => Date.parse(attempt.startedAt) >= cutoff);
    if (retained.length !== parsed.length) window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(retained));
    return retained;
  } catch {
    return [];
  }
}

/** Local history for one role, newest first. Read-only; the saved shape is unchanged. */
export function loadAttemptsForRole(roleId: string): Attempt[] {
  return loadAttempts().filter((attempt) => attempt.roleId === roleId);
}

/** Returns whether the attempt was actually persisted, so the UI never claims a save that failed. */
export function saveAttempt(attempt: Attempt): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const all = loadAttempts();
    // Keep the 100 most recent so localStorage never fills up.
    const next = [attempt, ...all].slice(0, 100);
    window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next));
    return true;
  } catch {
    // Storage full or blocked (private mode) — practice still works, history just is not kept.
    return false;
  }
}

/** Attach the candidate's rating to an attempt already saved. */
export function rateAttempt(id: string, rating: AttemptRating): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadAttempts();
    const next = all.map((a) => (a.id === id ? { ...a, rating } : a));
    window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked — the rating is still shown in the session */
  }
}

export function clearAttempts(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    /* ignore */
  }
}

/** Remove transcripts and local history when the candidate signs out. */
export function clearSensitiveLocalData(): void {
  if (typeof window === 'undefined') return;
  try {
    clearAttempts();
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith('muqabala.interview.') || key?.startsWith('muqabala.draft.v1.')) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* storage may be blocked */
  }
}

export function loadLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    return window.localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function saveLang(lang: Lang): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}
