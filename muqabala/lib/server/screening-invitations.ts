import 'server-only';

import { createHash, createHmac } from 'node:crypto';
import { tokenHash } from './security';

function invitationKey(): Buffer | null {
  const explicit = process.env.INTERVIEW_SECRET;
  if (explicit && explicit.length >= 16) {
    return createHash('sha256').update(`muqabala.screening.invitation.v1:${explicit}`).digest();
  }
  const fallback = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  return fallback
    ? createHash('sha256').update(`muqabala.screening.invitation.v1:${fallback}`).digest()
    : null;
}

export function normaliseInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function screeningInvitationEmailHash(email: string): string | null {
  const key = invitationKey();
  if (!key) return null;
  return createHmac('sha256', key)
    .update(`recipient:${normaliseInvitationEmail(email)}`)
    .digest('hex');
}

export function screeningInvitationToken(input: {
  invitationId: string;
  packId: string;
  recipientEmailHash: string;
}): string | null {
  const key = invitationKey();
  if (!key) return null;
  return createHmac('sha256', key)
    .update(`token:${input.invitationId}:${input.packId}:${input.recipientEmailHash}`)
    .digest('base64url');
}

export function screeningInvitationTokenHash(rawToken: string): string {
  return tokenHash(rawToken);
}

