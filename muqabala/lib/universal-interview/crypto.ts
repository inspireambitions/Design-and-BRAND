import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { InterviewState } from './types.ts';

function dataKey(): Buffer | null {
  const configured = process.env.UNIVERSAL_INTERVIEW_DATA_KEY;
  if (configured) {
    const decoded = Buffer.from(configured, 'base64');
    if (decoded.length === 32) return decoded;
  }
  const fallback = process.env.INTERVIEW_SECRET;
  return fallback ? createHash('sha256').update(`muqabala-universal-v2:${fallback}`).digest() : null;
}

export function encryptionConfigured(): boolean {
  return Boolean(dataKey());
}

export function sealInterviewState(state: InterviewState): string {
  const key = dataKey();
  if (!key) throw new Error('universal_interview_encryption_not_configured');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function openInterviewState(payload: string): InterviewState {
  const key = dataKey();
  if (!key) throw new Error('universal_interview_encryption_not_configured');
  const [version, ivValue, tagValue, ciphertextValue] = payload.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) throw new Error('invalid_interview_ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext) as InterviewState;
}
