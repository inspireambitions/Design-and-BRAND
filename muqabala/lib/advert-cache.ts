import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { z } from 'zod';
import type { Competency, Question } from './roles';

/**
 * Many candidates apply to the same advert. Building the interview once per
 * advert, rather than once per candidate, removes a 20 to 50 second model call
 * from every repeat visit and keeps the daily generation budget for adverts
 * nobody has pasted before.
 *
 * What is stored: the validated role title, industry, competencies and
 * questions the model produced, and nothing else. The advert text itself is
 * never stored; the key is a hash of it. Nothing about the candidate (session,
 * IP address, account) is part of the key or the value.
 *
 * What is never stored: fallbacks, rejected interviews, failures. Only an
 * interview that passed every check and was about to be signed is cached.
 */

/**
 * Bump whenever the generation prompt, the output schema or the validation
 * rules change. The value is part of the key, so an old entry is simply never
 * found again and expires on its own.
 */
export const ADVERT_CACHE_VERSION = 'interview-2026-09-03-question-gate-v1';

export const ADVERT_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Upstash calls that take longer than this are treated as a miss. */
const CACHE_TIMEOUT_MS = 1_000;

const KEY_PREFIX = 'advert:v1:';

/**
 * Reduce an advert to the words in it, so that two pastes of the same posting
 * with different capitalisation, line breaks, bullet characters or trailing
 * punctuation hash to the same key. Letters in any script are kept as they
 * are; only case, whitespace and punctuation are normalised.
 */
export function normaliseAdvertText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function advertCacheKey(normalised: string, options: { model: string; version: string }): string {
  const digest = createHash('sha256')
    .update(options.version)
    .update('\n')
    .update(options.model)
    .update('\n')
    .update(normalised)
    .digest('hex');
  return `${KEY_PREFIX}${digest}`;
}

export type CachedInterview = {
  title: string;
  industry: string;
  competencies: Competency[];
  questions: Question[];
};

const CompetencySchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().max(40),
  labelAr: z.string().max(60),
  anchor: z.string().max(240),
  anchorAr: z.string().max(300),
});

const QuestionSchema = z.object({
  id: z.string().min(1).max(40),
  text: z.string().max(320),
  textAr: z.string().max(400),
  hint: z.string().max(240),
  hintAr: z.string().max(300),
  competencies: z.array(z.string().min(1).max(40)).min(1).max(4),
  prepSeconds: z.number().int().min(0).max(120),
  answerSeconds: z.number().int().min(90).max(180),
});

/** Mirrors the shape the interview route validates before signing. */
export const CachedInterviewSchema = z.object({
  title: z.string().max(80),
  industry: z.string().max(60),
  competencies: z.array(CompetencySchema).min(3).max(5),
  questions: z.array(QuestionSchema).length(8),
});

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export function advertCacheConfigured(): boolean {
  return Boolean(redis);
}

function withTimeout<T>(operation: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('advert_cache_timeout')), CACHE_TIMEOUT_MS);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function logUnavailable(operation: 'read' | 'write', error: unknown): void {
  // Never log the key (it identifies an advert) or the token.
  console.error('advert_cache_unavailable', {
    operation,
    error: error instanceof Error ? error.name : 'unknown',
  });
}

/**
 * Returns the cached interview for this key, or null on a miss, a malformed
 * entry, an unconfigured cache or an Upstash problem. Never throws: the
 * caller generates fresh when it gets null.
 */
export async function readCachedInterview(key: string): Promise<CachedInterview | null> {
  if (!redis) return null;
  try {
    const raw = await withTimeout(redis.get<unknown>(key));
    if (raw === null || raw === undefined) return null;
    const parsed = CachedInterviewSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch (error) {
    logUnavailable('read', error);
    return null;
  }
}

/** Best effort. A failed write is logged and otherwise ignored. */
export async function writeCachedInterview(key: string, interview: CachedInterview): Promise<void> {
  if (!redis) return;
  try {
    await withTimeout(redis.set(key, interview, { ex: ADVERT_CACHE_TTL_SECONDS }));
  } catch (error) {
    logUnavailable('write', error);
  }
}
