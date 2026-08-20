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
    return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
  } catch {
    return [];
  }
}

export function saveAttempt(attempt: Attempt): void {
  if (typeof window === 'undefined') return;
  try {
    const all = loadAttempts();
    // Keep the 100 most recent so localStorage never fills up.
    const next = [attempt, ...all].slice(0, 100);
    window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private mode) — practice still works, history just is not kept.
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
