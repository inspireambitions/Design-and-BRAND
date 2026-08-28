import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import type { Competency, Question, Role } from './roles';

/**
 * Tailored interviews are generated per candidate and exist only for that
 * session, so the server has no catalogue entry to look them up in when the
 * answers come back to be scored.
 *
 * The generated rubric therefore travels with the candidate as a signed token.
 * The browser holds it but cannot author or alter it: scoring recomputes the
 * signature before trusting a single field. An unsigned or edited rubric is
 * refused, so nobody can hand the scorer a rubric of their own devising.
 */

const TOKEN_VERSION = 1;
const TOKEN_TTL_MS = 3 * 60 * 60 * 1000; // a practice session, not a login
const PROOF_TTL_MS = 14 * 24 * 60 * 60 * 1000; // a WhatsApp link sitting in an agency chat

export type InterviewTokenPayload = {
  v: number;
  exp: number;
  title: string;
  industry: string;
  level: Role['level'];
  competencies: Competency[];
  questions: Question[];
  /** Workplace name on a proof sitting. Absent for Coach practice. */
  workplace?: string;
  kind?: 'practice' | 'proof';
};

/**
 * Signing key. A dedicated secret is preferred; failing that we derive a stable
 * one from the provider key, which every instance already shares. Without
 * either, tailored interviews simply cannot be signed — and the caller falls
 * back to the generic interview rather than trusting unsigned input.
 */
function signingKey(): Buffer | null {
  const explicit = process.env.INTERVIEW_SECRET;
  if (explicit && explicit.length >= 16) return Buffer.from(explicit, 'utf8');
  const derived = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  if (derived) return createHash('sha256').update(`muqabala.interview.v1:${derived}`).digest();
  return null;
}

function b64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function signPayload(payload: InterviewTokenPayload): string | null {
  const key = signingKey();
  if (!key) return null;
  const encoded = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = b64url(createHmac('sha256', key).update(encoded).digest());
  return `${encoded}.${signature}`;
}

export function signInterview(
  payload: Omit<InterviewTokenPayload, 'v' | 'exp' | 'kind' | 'workplace'>,
): string | null {
  return signPayload({ ...payload, v: TOKEN_VERSION, kind: 'practice', exp: Date.now() + TOKEN_TTL_MS });
}

/** 14-day work-sample pack. Same signature family as practice so scoring can trust it. */
export function signProofPack(
  payload: Omit<InterviewTokenPayload, 'v' | 'exp' | 'kind'> & { workplace: string },
): string | null {
  const workplace = payload.workplace.trim().slice(0, 80);
  return signPayload({
    ...payload,
    workplace,
    v: TOKEN_VERSION,
    kind: 'proof',
    exp: Date.now() + PROOF_TTL_MS,
  });
}

export function verifyInterview(token: unknown): InterviewTokenPayload | null {
  if (typeof token !== 'string' || token.length > 64_000) return null;
  const key = signingKey();
  if (!key) return null;

  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const encoded = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]+$/.test(provided)) return null;

  const expected = b64url(createHmac('sha256', key).update(encoded).digest());
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // Constant-time compare so the signature cannot be guessed byte by byte.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(encoded).toString('utf8')) as InterviewTokenPayload;
    if (payload.v !== TOKEN_VERSION) return null;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    if (!Array.isArray(payload.questions) || !Array.isArray(payload.competencies)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Rebuild the Role the scorer needs from a verified token. */
export function roleFromToken(payload: InterviewTokenPayload): Role {
  return {
    id: 'custom',
    title: payload.title,
    titleAr: payload.title,
    industry: payload.industry,
    industryAr: payload.industry,
    level: payload.level,
    blurb: '',
    blurbAr: '',
    competencies: payload.competencies,
    questions: payload.questions,
  };
}
