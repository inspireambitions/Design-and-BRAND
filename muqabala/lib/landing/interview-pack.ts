import { z } from 'zod';

/** Refused before the body is parsed: an email and a source fit in far less. */
export const MAX_INTERVIEW_PACK_BODY_BYTES = 2 * 1024;

export const INTERVIEW_PACK_SOURCES = ['advert_pack'] as const;

export type InterviewPackSource = (typeof INTERVIEW_PACK_SOURCES)[number];

const InterviewPackRequestSchema = z
  .object({
    email: z.string().trim().max(254).pipe(z.email()),
    source: z.enum(INTERVIEW_PACK_SOURCES),
  })
  .strict();

export type InterviewPackRequest = { email: string; source: InterviewPackSource };

/** Validates a request body. Returns null rather than throwing on bad input. */
export function parseInterviewPackRequest(raw: unknown): InterviewPackRequest | null {
  const parsed = InterviewPackRequestSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { email: parsed.data.email.toLowerCase(), source: parsed.data.source };
}

/**
 * A quick check for the browser so an obvious typo is caught before the
 * request. The server remains the authority.
 */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}
