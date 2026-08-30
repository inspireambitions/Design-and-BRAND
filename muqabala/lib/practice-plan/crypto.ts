import 'server-only';

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

type TokenPayload = { v: 1; kind: 'completion'; sessionId: string; exp: number }
  | { v: 1; kind: 'plan-view'; grantId: string; exp: number };

function secret(name: 'PRACTICE_PLAN_TOKEN_SECRET' | 'PRACTICE_PLAN_HASH_KEY'): Buffer {
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(`${name}_not_configured`);
  return Buffer.from(value, 'utf8');
}

function encryptionKey(): Buffer {
  const encoded = process.env.PRACTICE_PLAN_ENCRYPTION_KEY;
  if (!encoded) throw new Error('PRACTICE_PLAN_ENCRYPTION_KEY_not_configured');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('PRACTICE_PLAN_ENCRYPTION_KEY_invalid');
  return key;
}

function b64(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function signedToken(payload: TokenPayload): string {
  const encoded = b64(JSON.stringify(payload));
  const signature = b64(createHmac('sha256', secret('PRACTICE_PLAN_TOKEN_SECRET')).update(encoded).digest());
  return `${encoded}.${signature}`;
}

function verifyToken(token: string, kind: TokenPayload['kind']): TokenPayload | null {
  const [encoded, supplied, extra] = token.split('.');
  if (!encoded || !supplied || extra || token.length > 2_048) return null;
  const expected = b64(createHmac('sha256', secret('PRACTICE_PLAN_TOKEN_SECRET')).update(encoded).digest());
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (payload.v !== 1 || payload.kind !== kind || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function issueCompletionProof(sessionId: string): string {
  return signedToken({ v: 1, kind: 'completion', sessionId, exp: Date.now() + 24 * 60 * 60 * 1_000 });
}

export function practicePlanSecretsConfigured(): boolean {
  try {
    secret('PRACTICE_PLAN_TOKEN_SECRET');
    secret('PRACTICE_PLAN_HASH_KEY');
    encryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function verifyCompletionProof(token: string, sessionId: string): boolean {
  const payload = verifyToken(token, 'completion');
  return Boolean(payload?.kind === 'completion' && payload.sessionId === sessionId);
}

export function issuePlanViewToken(grantId: string, expiresAt: number): string {
  return signedToken({ v: 1, kind: 'plan-view', grantId, exp: expiresAt });
}

export function verifyPlanViewToken(token: string): { grantId: string } | null {
  const payload = verifyToken(token, 'plan-view');
  return payload?.kind === 'plan-view' ? { grantId: payload.grantId } : null;
}

export function keyedHash(value: string): string {
  return createHmac('sha256', secret('PRACTICE_PLAN_HASH_KEY')).update(value).digest('hex');
}

export function tokenHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join('.');
}

export function decryptJson<T>(envelope: string): T {
  const [version, ivText, tagText, cipherText] = envelope.split('.');
  if (version !== 'v1' || !ivText || !tagText || !cipherText) throw new Error('invalid_envelope');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  const plain = Buffer.concat([decipher.update(Buffer.from(cipherText, 'base64url')), decipher.final()]);
  return JSON.parse(plain.toString('utf8')) as T;
}

export function contentDigest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
