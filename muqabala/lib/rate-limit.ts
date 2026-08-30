import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type LimitDecision = {
  limited: boolean;
  retryAfterSeconds: number;
};

type LocalEntry = { count: number; resetAt: number };

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// A short timeout keeps an Upstash incident from holding an interview request.
// Production falls through to the shared database counter on timeout.
const scoreLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '10 m'),
      prefix: 'muqabala:limit:score',
      analytics: false,
      timeout: 1_000,
    })
  : null;

const interviewLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      prefix: 'muqabala:limit:interview',
      analytics: false,
      timeout: 1_000,
    })
  : null;

const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      prefix: 'muqabala:limit:auth',
      analytics: false,
      timeout: 1_000,
    })
  : null;

const shareLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 m'),
      prefix: 'muqabala:limit:share',
      analytics: false,
      timeout: 1_000,
    })
  : null;

const screeningStartLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '30 m'),
      prefix: 'muqabala:limit:screening-start',
      analytics: false,
      timeout: 1_000,
    })
  : null;

export const DEFAULT_DAILY_GENERATION_LIMIT = 1_000;

const configuredDailyLimit = Number(process.env.INTERVIEW_DAILY_LIMIT ?? DEFAULT_DAILY_GENERATION_LIMIT);
const interviewDailyLimit = Number.isFinite(configuredDailyLimit)
  ? Math.max(1, Math.floor(configuredDailyLimit))
  : DEFAULT_DAILY_GENERATION_LIMIT;

const dailyLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(interviewDailyLimit, '1 d'),
      prefix: 'muqabala:limit:interview-daily',
      analytics: false,
      timeout: 1_000,
    })
  : null;

const localBuckets = new Map<string, Map<string, LocalEntry>>();

function requestAddress(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function privateIdentifier(value: string): string {
  // Redis keys never contain the candidate's raw IP address.
  return createHash('sha256').update(value).digest('hex');
}

function localLimit(
  bucketName: string,
  identifier: string,
  limit: number,
  windowMs: number,
): LimitDecision {
  const bucket = localBuckets.get(bucketName) ?? new Map<string, LocalEntry>();
  localBuckets.set(bucketName, bucket);

  const now = Date.now();
  const entry = bucket.get(identifier);
  if (!entry || now >= entry.resetAt) {
    bucket.set(identifier, { count: 1, resetAt: now + windowMs });
    if (bucket.size > 5_000) {
      for (const [key, value] of bucket) if (now >= value.resetAt) bucket.delete(key);
    }
    return { limited: false, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  return {
    limited: entry.count > limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  };
}

async function sharedLimit(options: {
  bucketName: string;
  identifier: string;
  limiter: Ratelimit | null;
  localLimit: number;
  localWindowMs: number;
}): Promise<LimitDecision> {
  const identifier = privateIdentifier(options.identifier);
  if (!options.limiter && process.env.NODE_ENV !== 'production') {
    return localLimit(
      options.bucketName,
      identifier,
      options.localLimit,
      options.localWindowMs,
    );
  }

  if (options.limiter) {
    try {
      const result = await options.limiter.limit(identifier);
      if (result.reason !== 'timeout') {
        return {
          limited: !result.success,
          retryAfterSeconds: result.success
            ? 0
            : Math.max(1, Math.ceil((result.reset - Date.now()) / 1_000)),
        };
      }
      console.error('shared_rate_limit_primary_unavailable', {
        bucket: options.bucketName,
        error: 'timeout',
      });
    } catch (error) {
      // Continue to the database fallback. Never put a raw IP or token in logs.
      console.error('shared_rate_limit_primary_unavailable', {
        bucket: options.bucketName,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  const { consumeDatabaseRateLimit } = await import('./server/shared-rate-limit-fallback');
  const fallback = await consumeDatabaseRateLimit({
    bucketName: options.bucketName,
    identifierHash: identifier,
    limit: options.localLimit,
    windowSeconds: Math.max(1, Math.ceil(options.localWindowMs / 1_000)),
  });
  if (fallback) return fallback;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY) {
    console.error('shared_rate_limit_unavailable', {
      bucket: options.bucketName,
      error: 'database_fallback_failed',
    });
  } else {
    console.error('shared_rate_limit_unavailable', { bucket: options.bucketName, error: 'storage_unconfigured' });
  }

  // Production must not turn a deployment-wide limit into one limit per
  // server when both shared stores fail. Retry soon instead of spending cost.
  return { limited: true, retryAfterSeconds: 60 };
}

export function limitScoring(request: Request, candidateIdentity?: string): Promise<LimitDecision> {
  return sharedLimit({
    bucketName: 'score',
    // A verified account or attempt avoids punishing a whole school, office or
    // mobile network because many candidates share one public IP address.
    identifier: candidateIdentity ? `candidate:${candidateIdentity}` : `ip:${requestAddress(request)}`,
    limiter: scoreLimiter,
    localLimit: 30,
    localWindowMs: 10 * 60 * 1_000,
  });
}

export function limitInterviewGeneration(request: Request, candidateIdentity?: string): Promise<LimitDecision> {
  return sharedLimit({
    bucketName: 'interview',
    identifier: candidateIdentity ? `candidate:${candidateIdentity}` : `ip:${requestAddress(request)}`,
    limiter: interviewLimiter,
    localLimit: 5,
    localWindowMs: 10 * 60 * 1_000,
  });
}

export function limitInterviewGenerationDaily(): Promise<LimitDecision> {
  return sharedLimit({
    bucketName: 'interview-daily',
    identifier: 'all-candidates',
    limiter: dailyLimiter,
    localLimit: interviewDailyLimit,
    localWindowMs: 24 * 60 * 60 * 1_000,
  });
}

export function limitAuth(request: Request, email: string): Promise<LimitDecision> {
  return sharedLimit({
    bucketName: 'auth',
    identifier: `${requestAddress(request)}:${email.trim().toLowerCase()}`,
    limiter: authLimiter,
    localLimit: 5,
    localWindowMs: 10 * 60 * 1_000,
  });
}

export function limitShare(request: Request, userId: string): Promise<LimitDecision> {
  return sharedLimit({
    bucketName: 'share',
    identifier: `${userId}:${requestAddress(request)}`,
    limiter: shareLimiter,
    localLimit: 10,
    localWindowMs: 10 * 60 * 1_000,
  });
}

export function limitScreeningStart(request: Request, packId: string): Promise<LimitDecision> {
  return sharedLimit({
    bucketName: 'screening-start',
    identifier: `${packId}:${requestAddress(request)}`,
    limiter: screeningStartLimiter,
    localLimit: 5,
    localWindowMs: 30 * 60 * 1_000,
  });
}

export function sharedRateLimitsConfigured(): boolean {
  return Boolean(redis);
}
