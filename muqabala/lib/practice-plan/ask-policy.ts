/**
 * When to ask a candidate for their email. Pure functions over a small state
 * record so the rule is testable; the storage helpers below persist it in
 * localStorage under one key shared with the advert path, which writes
 * `source: 'advert_pack'` into the same shape.
 *
 * Rules: never ask twice in one session. If the candidate declines, the ask
 * returns only at the end of the second session after that. Once they have
 * consented, never ask again.
 */
export const EMAIL_CONSENT_KEY = 'muqabala.emailConsent.v1';

export type ConsentSource = 'feedback_card' | 'advert_pack';

export type EmailConsentState = {
  consentedAt?: string;
  source?: ConsentSource;
  declinedAt?: string;
  /** Completed sessions on this device. Incremented by recordSessionEnd. */
  sessions: number;
  /** Session count at the moment of the last decline, so "second session" is relative to it. */
  declinedAtSession?: number;
  /** Session count at the moment the card was last shown, so one session never asks twice. */
  askedAtSession?: number;
};

/** A decline stops blocking after this long, so a candidate who returns weeks later is asked again. */
const DECLINE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const SESSIONS_AFTER_DECLINE = 2;

export const emptyConsentState = (): EmailConsentState => ({ sessions: 0 });

export function normaliseConsentState(value: unknown): EmailConsentState {
  if (!value || typeof value !== 'object') return emptyConsentState();
  const raw = value as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === 'string' && (raw[key] as string).length > 0 ? (raw[key] as string) : undefined);
  const count = (key: string) => (typeof raw[key] === 'number' && Number.isFinite(raw[key]) ? Math.max(0, Math.floor(raw[key] as number)) : undefined);
  const source = raw.source === 'feedback_card' || raw.source === 'advert_pack' ? raw.source : undefined;
  return {
    consentedAt: text('consentedAt'),
    source,
    declinedAt: text('declinedAt'),
    sessions: count('sessions') ?? 0,
    declinedAtSession: count('declinedAtSession'),
    askedAtSession: count('askedAtSession'),
  };
}

export function shouldAskForEmail(state: EmailConsentState, now: number | Date = Date.now()): boolean {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  if (state.consentedAt) return false;
  // A decline from over a month ago no longer counts as "this session", however
  // the session counter has moved: the candidate is effectively new again.
  const declinedMs = state.declinedAt ? Date.parse(state.declinedAt) : NaN;
  if (Number.isFinite(declinedMs) && nowMs - declinedMs > DECLINE_TTL_MS) return true;
  if (state.askedAtSession !== undefined && state.askedAtSession === state.sessions) return false;
  if (!state.declinedAt) return true;
  const declinedAtSession = state.declinedAtSession ?? 0;
  return state.sessions >= declinedAtSession + SESSIONS_AFTER_DECLINE;
}

export function recordAsked(state: EmailConsentState): EmailConsentState {
  return { ...state, askedAtSession: state.sessions };
}

export function recordDecline(state: EmailConsentState, now: number | Date = Date.now()): EmailConsentState {
  return {
    ...state,
    declinedAt: new Date(now).toISOString(),
    declinedAtSession: state.sessions,
    askedAtSession: state.sessions,
  };
}

export function recordConsent(state: EmailConsentState, source: ConsentSource, now: number | Date = Date.now()): EmailConsentState {
  return {
    ...state,
    consentedAt: new Date(now).toISOString(),
    source,
    declinedAt: undefined,
    declinedAtSession: undefined,
    askedAtSession: state.sessions,
  };
}

export function recordSessionEnd(state: EmailConsentState): EmailConsentState {
  return { ...state, sessions: state.sessions + 1 };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function storage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadConsentState(store: StorageLike | null = storage()): EmailConsentState {
  if (!store) return emptyConsentState();
  try {
    const raw = store.getItem(EMAIL_CONSENT_KEY);
    return raw ? normaliseConsentState(JSON.parse(raw)) : emptyConsentState();
  } catch {
    return emptyConsentState();
  }
}

export function saveConsentState(state: EmailConsentState, store: StorageLike | null = storage()): boolean {
  if (!store) return false;
  try {
    const compact = Object.fromEntries(Object.entries(state).filter(([, value]) => value !== undefined));
    store.setItem(EMAIL_CONSENT_KEY, JSON.stringify(compact));
    return true;
  } catch {
    return false;
  }
}

/** Convenience for the card and the parent flow: read, transform, write. */
export function updateConsentState(
  transform: (state: EmailConsentState) => EmailConsentState,
  store: StorageLike | null = storage(),
): EmailConsentState {
  const next = transform(loadConsentState(store));
  saveConsentState(next, store);
  return next;
}
