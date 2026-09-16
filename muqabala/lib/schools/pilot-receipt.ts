/** Only an opaque retry key and a masked receipt belong in browser storage. */
export const PILOT_PENDING_KEY = 'schools.pilot.pending.v1';
export const PILOT_RECEIPT_KEY = 'schools.pilot.receipt.v1';
export type PilotReceipt = { reference: string; maskedEmail: string };
export type PilotAcknowledgement = 'queued' | 'unavailable';
type StorageProvider = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const browserStorage: StorageProvider = () => window.sessionStorage;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function maskPilotEmail(email: string): string {
  const [local, domain] = email.trim().split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

export function readPilotPending(storage: StorageProvider = browserStorage): string | null {
  try {
    const value = storage().getItem(PILOT_PENDING_KEY);
    return value && uuid.test(value) ? value : null;
  } catch { return null; }
}

export function savePilotPending(id: string, storage: StorageProvider = browserStorage): boolean {
  try { storage().setItem(PILOT_PENDING_KEY, id); return true; } catch { return false; }
}

export function readPilotReceipt(storage: StorageProvider = browserStorage): PilotReceipt | null {
  try {
    const value = JSON.parse(storage().getItem(PILOT_RECEIPT_KEY) || 'null');
    if (typeof value?.reference !== 'string' || !value.reference.trim() || value.reference.length > 160
      || typeof value.maskedEmail !== 'string' || !/^[^@\s]\*\*\*@[^@\s]+$/.test(value.maskedEmail)) return null;
    return { reference: value.reference, maskedEmail: value.maskedEmail };
  } catch { return null; }
}

export function savePilotReceipt(receipt: PilotReceipt, storage: StorageProvider = browserStorage): boolean {
  try {
    storage().setItem(PILOT_RECEIPT_KEY, JSON.stringify({ reference: receipt.reference, maskedEmail: receipt.maskedEmail }));
    return true;
  } catch { return false; }
}

export function clearPilotStorage(storage: StorageProvider = browserStorage): boolean {
  try {
    storage().removeItem(PILOT_RECEIPT_KEY);
    storage().removeItem(PILOT_PENDING_KEY);
    return true;
  } catch { return false; }
}

export function parsePilotResponse(value: unknown): { reference: string; acknowledgement: PilotAcknowledgement } | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  return typeof body.reference === 'string' && !!body.reference.trim() && body.reference.length <= 160
    && (body.acknowledgement === 'queued' || body.acknowledgement === 'unavailable')
    ? { reference: body.reference, acknowledgement: body.acknowledgement } : null;
}
