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
    /** Server-owned attempt. When present, the answer is saved before scoring. */
    interviewId: z.string().uuid().optional(),
    questionIndex: z.number().int().min(0).max(19).optional(),
    /** Clear a retryable failed score and generate fresh feedback. */
    rescore: z.boolean().optional(),
  })
  .strict();

/**
 * Field order matters. Structured-output models emit keys in schema order, and
 * the streaming route shows readable blocks as they land. Scores and evidence
 * come last so nothing numeric is visible before the integrity gate has run.
 */
export const FeedbackSchema = z.object({
  /** Set when the transcript is too garbled or too short to judge fairly. */
  unscorable: z.boolean(),
  /** Explicit cause. Use none whenever unscorable is false. */
  unscorable_reason: z.enum(['too_short', 'unclear', 'none']),
  headline: z.string().max(160),
  strengths: z.array(z.string().max(400)).max(3),
  improvements: z.array(z.string().max(400)).max(3),
  coach_tip: z.string().max(600),
  competencies: z
    .array(
      z.object({
        id: z.string().max(100),
        score: z.number().min(0).max(10),
        evidence: z.string().max(400),
      }),
    )
    .max(10),
});

export type ParsedFeedback = z.infer<typeof FeedbackSchema>;
export type ProviderName = 'openai' | 'anthropic' | 'openrouter';

export type ScoringIntegrityIssue =
  | 'missing_competency'
  | 'duplicate_competency'
  | 'unknown_competency'
  | 'invented_evidence'
  | 'duplicate_evidence'
  | 'missing_strong_evidence'
  | 'no_verified_evidence';

type IntegrityCompetency = Omit<ParsedFeedback['competencies'][number], 'evidence'> & {
  evidence: string | null;
};

type ScoringIntegrityResult =
  | { ok: true; competencies: IntegrityCompetency[] }
  | { ok: false; issue: ScoringIntegrityIssue };

/**
 * Compare quoted evidence without letting harmless punctuation, quote-mark or
 * Arabic-diacritic differences turn a real quote into a false mismatch.
 */
export function normaliseEvidenceText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The model may explain a judgement, but it may not choose which competencies
 * count or invent the words used as proof. Any integrity failure makes the
 * whole response unscored so a partial average can never look authoritative.
 */
export function validateScoringIntegrity(
  competencies: ParsedFeedback['competencies'],
  requiredIds: readonly string[],
  transcript: string,
): ScoringIntegrityResult {
  const required = new Set(requiredIds);
  const returnedIds = competencies.map((competency) => competency.id);
  const returned = new Set(returnedIds);

  if (returnedIds.some((id, index) => returnedIds.indexOf(id) !== index)) {
    return { ok: false, issue: 'duplicate_competency' };
  }
  if (returnedIds.some((id) => !required.has(id))) {
    return { ok: false, issue: 'unknown_competency' };
  }
  if (requiredIds.some((id) => !returned.has(id))) {
    return { ok: false, issue: 'missing_competency' };
  }

  const normalisedTranscript = normaliseEvidenceText(transcript);
  const seenEvidence = new Set<string>();
  let verifiedEvidenceCount = 0;
  const verified = competencies.map((competency): IntegrityCompetency | null => {
    const rawEvidence = competency.evidence.trim();
    if (!rawEvidence) {
      return competency.score >= 6 ? null : { ...competency, evidence: null };
    }

    const evidence = normaliseEvidenceText(rawEvidence);
    if (!evidence || !normalisedTranscript.includes(evidence)) {
      return null;
    }
    if (seenEvidence.has(evidence)) {
      return null;
    }

    seenEvidence.add(evidence);
    verifiedEvidenceCount += 1;
    return { ...competency, evidence: rawEvidence };
  });

  const firstInvalidIndex = verified.findIndex((competency) => competency === null);
  if (firstInvalidIndex >= 0) {
    const source = competencies[firstInvalidIndex];
    const rawEvidence = source.evidence.trim();
    if (!rawEvidence && source.score >= 6) return { ok: false, issue: 'missing_strong_evidence' };
    const evidence = normaliseEvidenceText(rawEvidence);
    if (evidence && seenEvidence.has(evidence)) return { ok: false, issue: 'duplicate_evidence' };
    return { ok: false, issue: 'invented_evidence' };
  }

  if (verifiedEvidenceCount === 0) return { ok: false, issue: 'no_verified_evidence' };
  return { ok: true, competencies: verified as IntegrityCompetency[] };
}

export function scoringProviderOrder(env: {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ENABLE_ANTHROPIC_FALLBACK?: string;
  OPENROUTER_API_KEY?: string;
}): ProviderName[] {
  const openAI = Boolean(env.OPENAI_API_KEY);
  const anthropic = Boolean(
    env.ANTHROPIC_API_KEY
    && (!openAI || env.ENABLE_ANTHROPIC_FALLBACK === 'true'),
  );
  const openRouter = Boolean(env.OPENROUTER_API_KEY && !openAI && !anthropic);
  return [
    ...(openAI ? ['openai' as const] : []),
    ...(anthropic ? ['anthropic' as const] : []),
    ...(openRouter ? ['openrouter' as const] : []),
  ];
}

/** Strict JSON Schema mirror of FeedbackSchema for OpenAI-compatible providers. */
export const FEEDBACK_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['unscorable', 'unscorable_reason', 'headline', 'strengths', 'improvements', 'coach_tip', 'competencies'],
  properties: {
    unscorable: { type: 'boolean' },
    unscorable_reason: { type: 'string', enum: ['too_short', 'unclear', 'none'] },
    headline: { type: 'string', maxLength: 160 },
    strengths: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 400 } },
    improvements: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 400 } },
    coach_tip: { type: 'string', maxLength: 600 },
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
