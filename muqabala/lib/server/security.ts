import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

export const ATTEMPT_COOKIE = 'muqabala_attempt';
export const AUTH_STATE_COOKIE = 'muqabala_auth_state';

export function configuredOrigin(): string {
  const deploymentOrigin = process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null;
  return (process.env.APP_ORIGIN || deploymentOrigin || 'https://trymuqabala.com').replace(/\/$/, '');
}

export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  if (origin === configuredOrigin()) return true;
  return process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function safeNext(value: string | null | undefined, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}

export function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function emailHash(email: string): string {
  return tokenHash(email.trim().toLowerCase());
}

export function isOpaqueToken(value: string | null | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{40,60}$/.test(value));
}

export function privateNoStoreHeaders(): HeadersInit {
  return { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' };
}
