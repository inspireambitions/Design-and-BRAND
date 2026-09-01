/**
 * Records whether a candidate agreed to receive their interview pack by email.
 *
 * The consent itself lives in localStorage so the practice plan pipeline can
 * read it later. A decline is kept in sessionStorage only: the ask is skipped
 * for the rest of the tab, and comes back on a fresh visit. The email address
 * is never stored on the device.
 */
export const EMAIL_CONSENT_KEY = 'muqabala.emailConsent.v1';

export type EmailConsentSource = 'advert_pack';

export type EmailConsent = { at: string; source: EmailConsentSource };

export type EmailConsentRecord = {
  consent?: EmailConsent;
  declinedAt?: string;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type Stores = { local: StorageLike | null; session: StorageLike | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function readRecord(storage: StorageLike | null): EmailConsentRecord | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(EMAIL_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const record: EmailConsentRecord = {};
    if (isRecord(parsed.consent) && isIsoDate(parsed.consent.at) && parsed.consent.source === 'advert_pack') {
      record.consent = { at: parsed.consent.at, source: parsed.consent.source };
    }
    if (isIsoDate(parsed.declinedAt)) record.declinedAt = parsed.declinedAt;
    return record.consent || record.declinedAt ? record : null;
  } catch {
    return null;
  }
}

/** The stored consent, if the candidate has given one on this device. */
export function readEmailConsent(local: StorageLike | null): EmailConsent | null {
  return readRecord(local)?.consent ?? null;
}

export function recordEmailConsent(
  local: StorageLike | null,
  source: EmailConsentSource,
  now: Date = new Date(),
): boolean {
  if (!local) return false;
  try {
    const record: EmailConsentRecord = { consent: { at: now.toISOString(), source } };
    local.setItem(EMAIL_CONSENT_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function recordEmailDeclined(session: StorageLike | null, now: Date = new Date()): boolean {
  if (!session) return false;
  try {
    const record: EmailConsentRecord = { declinedAt: now.toISOString() };
    session.setItem(EMAIL_CONSENT_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask only when nothing has been decided: no consent on this device and no
 * decline in this tab. Blocked storage counts as undecided, so the candidate
 * is asked, and the question simply cannot be remembered.
 */
export function shouldAskForEmail(stores: Stores): boolean {
  if (readRecord(stores.local)?.consent) return false;
  if (readRecord(stores.session)?.declinedAt) return false;
  return true;
}

/** Browser storage, or null where it is unavailable or blocked. */
export function browserStores(): Stores {
  const pick = (name: 'localStorage' | 'sessionStorage'): StorageLike | null => {
    try {
      return typeof window === 'undefined' ? null : window[name];
    } catch {
      return null;
    }
  };
  return { local: pick('localStorage'), session: pick('sessionStorage') };
}
