import { createHash, createHmac, randomBytes } from 'node:crypto';

function claimSecret(): string {
  const secret = process.env.REPORT_CLAIM_SECRET;
  if (!secret || secret.length < 32) throw new Error('REPORT_CLAIM_SECRET is not configured');
  return secret;
}

export function newClaimToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashClaimToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function hashClaimEmail(email: string): string {
  return createHmac('sha256', claimSecret())
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex');
}
