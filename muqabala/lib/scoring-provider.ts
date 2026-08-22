import { z } from 'zod';

export const ScoreRequestSchema = z
  .object({
    roleId: z.string().min(1).max(100),
    questionId: z.string().min(1).max(100),
    transcript: z.string(),
    lang: z.enum(['en', 'ar']).optional(),
    roleTitle: z.string().max(160).optional(),
    /** Signed rubric for an interview built from a pasted job advert. */
    interviewToken: z.string().max(64_000).optional(),
  })
  .strict();

export const FeedbackSchema = z.object({
  headline: z.string().max(120),
  competencies: z
    .array(
      z.object({
        id: z.string().max(100),
        score: z.number().min(0).max(10),
        evidence: z.string().max(400),
      }),
    )
    .max(10),
  strengths: z.array(z.string().max(400)).max(3),
  improvements: z.array(z.string().max(400)).max(3),
  coach_tip: z.string().max(600),
  /** Set when the transcript is too garbled or too short to judge fairly. */
  unscorable: z.boolean(),
});

export type ParsedFeedback = z.infer<typeof FeedbackSchema>;

const ENGLISH_TRAILING_CONNECTOR = /\b(and|or|but|because|so|to|with|for|by|from|while|that|which|who|a|an|the)$/i;
const ARABIC_TRAILING_CONNECTOR = /(?:^|\s)(و|أو|لكن|لأن|إلى|مع|من|في)$/;

/**
 * Structured output limits stop oversized text, but a model can still end a
 * headline on "and" or "or" to stay under the limit. Clean that edge without
 * inventing a new claim about the candidate's answer.
 */
export function completeFeedbackHeadline(value: string, lang: 'en' | 'ar'): string {
  let headline = value.trim().replace(/\s+/g, ' ');
  if (!headline) {
    return lang === 'ar' ? 'راجع ملاحظات إجابتك أدناه.' : 'Review the feedback on your answer below.';
  }

  if (headline.length > 116) {
    const clipped = headline.slice(0, 116);
    headline = clipped.includes(' ') ? clipped.slice(0, clipped.lastIndexOf(' ')) : clipped;
  }

  headline = headline.replace(/[\s,;:\-–—]+$/g, '');
  const connector = lang === 'ar' ? ARABIC_TRAILING_CONNECTOR : ENGLISH_TRAILING_CONNECTOR;
  while (connector.test(headline)) {
    headline = headline.replace(connector, '').replace(/[\s,;:\-–—]+$/g, '').trim();
  }

  if (!headline) {
    return lang === 'ar' ? 'راجع ملاحظات إجابتك أدناه.' : 'Review the feedback on your answer below.';
  }
  return /[.!?؟]$/.test(headline) ? headline : `${headline}.`;
}

/**
 * The same quote under several competencies looks like several pieces of
 * proof. Keep its first honest use and show no evidence for later duplicates.
 */
export function removeRepeatedEvidence<T extends { evidence: string | null }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.map((item) => {
    if (!item.evidence) return item;
    const key = item.evidence
      .toLocaleLowerCase()
      .replace(/[“”"'‘’.,!?؟:;\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!key || seen.has(key)) return { ...item, evidence: null };
    seen.add(key);
    return item;
  });
}

/** Strict JSON Schema mirror of FeedbackSchema for OpenAI-compatible providers. */
export const FEEDBACK_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'competencies', 'strengths', 'improvements', 'coach_tip', 'unscorable'],
  properties: {
    headline: { type: 'string', maxLength: 120 },
    competencies: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'score', 'evidence'],
        properties: {
          id: { type: 'string', maxLength: 100 },
          score: { type: 'number', minimum: 0, maximum: 10 },
          evidence: { type: 'string', maxLength: 400 },
        },
      },
    },
    strengths: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 400 } },
    improvements: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 400 } },
    coach_tip: { type: 'string', maxLength: 600 },
    unscorable: { type: 'boolean' },
  },
} as const;

export function retryAfterMilliseconds(value: string | null, now = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

export function isRetryableProviderStatus(status: number): boolean {
  return status === 429 || status === 503;
}

type RetryOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  maxAttempts?: number;
  maxTotalWaitMs?: number;
  timeoutMs?: number;
};

/**
 * Retry only temporary provider failures. Retry-After wins over local backoff,
 * but a serverless request never sleeps beyond its safe execution budget.
 */
export async function fetchProviderWithRetry(
  input: string,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const random = options.random ?? Math.random;
  const maxAttempts = options.maxAttempts ?? 3;
  const maxTotalWaitMs = options.maxTotalWaitMs ?? 20_000;
  const timeoutMs = options.timeoutMs ?? 20_000;
  let waited = 0;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(input, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
      });
      if (!isRetryableProviderStatus(response.status) || attempt === maxAttempts) return response;

      const providerDelay = retryAfterMilliseconds(response.headers.get('Retry-After'));
      const fallbackDelay = Math.min(1000 * 2 ** (attempt - 1) + Math.floor(random() * 300), 5000);
      const delay = providerDelay ?? fallbackDelay;
      if (waited + delay > maxTotalWaitMs) return response;
      await sleep(delay);
      waited += delay;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) throw error;
      const delay = Math.min(1000 * 2 ** (attempt - 1) + Math.floor(random() * 300), 5000);
      if (waited + delay > maxTotalWaitMs) throw error;
      await sleep(delay);
      waited += delay;
    }
  }

  throw lastError ?? new Error('Provider request failed.');
}
