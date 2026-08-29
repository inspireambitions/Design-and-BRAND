import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { configuredOrigin } from '@/lib/server/security';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signature(userId: string, secret: string): string {
  return createHmac('sha256', secret).update(`muqabala-email-preferences-v1:${userId}`).digest('base64url');
}

export function createPreferenceToken(userId: string, secret: string): string {
  if (!UUID_PATTERN.test(userId)) throw new Error('Invalid lifecycle email user id.');
  if (secret.length < 32) throw new Error('EMAIL_PREFERENCES_SECRET must contain at least 32 characters.');
  return `${userId}.${signature(userId, secret)}`;
}

export function verifyPreferenceToken(token: string, secret: string): string | null {
  const [userId, supplied, extra] = token.split('.');
  if (extra || !userId || !supplied || !UUID_PATTERN.test(userId) || secret.length < 32) return null;
  const expected = signature(userId, secret);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(suppliedBuffer, expectedBuffer) ? userId : null;
}

export function unsubscribeUrls(userId: string): { api: string; page: string } {
  const secret = process.env.EMAIL_PREFERENCES_SECRET;
  if (!secret) throw new Error('EMAIL_PREFERENCES_SECRET is not configured.');
  const token = encodeURIComponent(createPreferenceToken(userId, secret));
  return {
    api: `${configuredOrigin()}/api/email/unsubscribe?token=${token}`,
    page: `${configuredOrigin()}/email/unsubscribe?token=${token}`,
  };
}

export function bearerMatches(request: Request, expected: string): boolean {
  const supplied = request.headers.get('authorization');
  if (!supplied || !expected) return false;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(`Bearer ${expected}`);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}
