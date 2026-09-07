import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function privateDataKey(): Buffer {
  const source = process.env.UNIVERSAL_INTERVIEW_DATA_KEY || process.env.INTERVIEW_SECRET;
  if (!source) throw new Error('private_data_encryption_not_configured');
  return createHash('sha256').update(`muqabala-private-data-v1:${source}`).digest();
}

export function sealPrivateText(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', privateDataKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function openPrivateText(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('invalid_private_ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', privateDataKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
