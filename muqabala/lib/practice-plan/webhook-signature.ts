import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Resend signs webhooks with the Svix scheme: HMAC-SHA256 over
 * `${id}.${timestamp}.${rawBody}` using the base64 key after `whsec_`, sent as
 * one or more `v1,<base64>` entries in `svix-signature`. Verified here without
 * the SDK so the raw body is checked byte for byte and nothing is parsed first.
 */
export type WebhookHeaders = { id: string; timestamp: string; signature: string };

const TOLERANCE_SECONDS = 5 * 60;

export function verifyResendWebhook(
  payload: string,
  headers: WebhookHeaders,
  secret: string,
  nowMs = Date.now(),
): boolean {
  const encoded = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(encoded, 'base64');
  } catch {
    return false;
  }
  if (key.length < 16) return false;
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(nowMs / 1_000 - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${payload}`).digest();
  return headers.signature.split(' ').some((entry) => {
    const [version, value] = entry.split(',');
    if (version !== 'v1' || !value) return false;
    const supplied = Buffer.from(value, 'base64');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}

export type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data: { email_id?: string };
};

export function parseResendWebhook(payload: string): ResendWebhookEvent | null {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const event = parsed as Record<string, unknown>;
    if (typeof event.type !== 'string' || !event.data || typeof event.data !== 'object') return null;
    const data = event.data as Record<string, unknown>;
    return {
      type: event.type,
      created_at: typeof event.created_at === 'string' ? event.created_at : undefined,
      data: { email_id: typeof data.email_id === 'string' ? data.email_id : undefined },
    };
  } catch {
    return null;
  }
}
