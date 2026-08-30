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

// A short timeout keeps an Upstash incident from stopping an interview. The
// SDK allows the request when the timeout is reached, while local limits still
// protect development and deployments whose Redis credentials are not set.
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

const practicePlanIpLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      prefix: 'muqabala:limit:practice-plan-ip',
      analytics: false,
      timeout: 1_000,
    })
  : null;

const practicePlanEmailLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '24 h'),
      prefix: 'muqabala:limit:practice-plan-email',
      analytics: false,
      timeout: 1_000,
    })
  : null;

const configuredDailyLimit = Number(process.env.INTERVIEW_DAILY_LIMIT ?? 400);
const interviewDailyLimit = Number.isFinite(configuredDailyLimit)
  ? Math.max(1, Math.floor(configuredDailyLimit))
  : 400;

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
  if (!options.limiter) {
    return localLimit(
      options.bucketName,
      identifier,
      options.localLimit,
      options.localWindowMs,
    );
  }

  try {
    const result = await options.limiter.limit(identifier);
    return {
      limited: !result.success,
      retryAfterSeconds: result.success
        ? 0
        : Math.max(1, Math.ceil((result.reset - Date.now()) / 1_000)),
    };
  } catch (error) {
    // Availability wins over a perfect limit. Do not log request data or the
    // Redis token. A local brake still applies while Upstash is unreachable.
    console.error('shared_rate_limit_unavailable', {
      bucket: options.bucketName,
      error: error instanceof Error ? error.name : 'unknown',
    });
    return localLimit(
      options.bucketName,
      identifier,
      options.localLimit,
      options.localWindowMs,
    );
  }
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

export async function limitPracticePlan(request: Request, keyedEmailHash: string): Promise<LimitDecision> {
  const [ip, email] = await Promise.all([
    sharedLimit({
      bucketName: 'practice-plan-ip',
      identifier: `ip:${requestAddress(request)}`,
      limiter: practicePlanIpLimiter,
      localLimit: 5,
      localWindowMs: 10 * 60 * 1_000,
    }),
    sharedLimit({
      bucketName: 'practice-plan-email',
      identifier: `email:${keyedEmailHash}`,
      limiter: practicePlanEmailLimiter,
      localLimit: 3,
      localWindowMs: 24 * 60 * 60 * 1_000,
    }),
  ]);
  if (ip.limited && email.limited) return { limited: true, retryAfterSeconds: Math.max(ip.retryAfterSeconds, email.retryAfterSeconds) };
  return ip.limited ? ip : email;
}

export function sharedRateLimitsConfigured(): boolean {
  return Boolean(redis);
}
