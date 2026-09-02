import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { newOpaqueToken, tokenHash } from '@/lib/server/security';

/**
 * Invite tokens are looked up by SHA-256 hash. Reminders must resend the same
 * link, so an AES-256-GCM copy is kept alongside the hash. The key is derived
 * from INTERVIEW_SECRET, which production already sets for signing interviews.
 */
function key(): Buffer {
  const secret = process.env.INTERVIEW_SECRET;
  if (!secret) throw new Error('INTERVIEW_SECRET_not_configured');
  return createHash('sha256').update(`role-invite-token:${secret}`).digest();
}

const b64 = (buffer: Buffer) => buffer.toString('base64url');

export function sealToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return ['v1', b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join('.');
}

export function openToken(envelope: string): string | null {
  try {
    const [version, ivText, tagText, cipherText] = envelope.split('.');
    if (version !== 'v1' || !ivText || !tagText || !cipherText) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(cipherText, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export function newInviteToken(): { token: string; hash: string; cipher: string } {
  const token = newOpaqueToken();
  return { token, hash: tokenHash(token), cipher: sealToken(token) };
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** MQ-XXXXXX using an alphabet without 0, O, 1 or I. */
export function newCandidateRef(): string {
  const bytes = randomBytes(6);
  let out = '';
  for (const byte of bytes) out += REF_ALPHABET[byte % REF_ALPHABET.length];
  return `MQ-${out}`;
}
