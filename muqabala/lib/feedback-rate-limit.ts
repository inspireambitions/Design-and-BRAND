import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function feedbackClientIp(request: Request): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  );
}

let feedbackLimiters:
  | { network: Ratelimit; attempt: Ratelimit; daily: Ratelimit }
  | null
  | undefined;

function configuredLimiters() {
  if (feedbackLimiters !== undefined) return feedbackLimiters;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return (feedbackLimiters = null);

  const redis = new Redis({ url, token });
  feedbackLimiters = {
    network: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      prefix: 'muqabala:feedback:network',
      analytics: false,
    }),
    attempt: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '24 h'),
      prefix: 'muqabala:feedback:attempt',
      analytics: false,
    }),
    daily: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(300, '24 h'),
      prefix: 'muqabala:feedback:daily',
      analytics: false,
    }),
  };
  return feedbackLimiters;
}

export async function limitFeedback(request: Request, attemptId: string) {
  const active = configuredLimiters();
  if (!active) return { configured: false, success: false, retryAfter: 60 };

  const attemptHash = createHash('sha256').update(attemptId).digest('hex').slice(0, 24);
  const limits = await Promise.all([
      active.network.limit(feedbackClientIp(request)),
      active.attempt.limit(attemptHash),
      active.daily.limit('all'),
    ]).catch(() => null);
  if (!limits) return { configured: true, success: false, retryAfter: 60 };
  const [network, attempt, daily] = limits;
  const reset = Math.max(network.reset, attempt.reset, daily.reset);
  return {
    configured: true,
    success: network.success && attempt.success && daily.success,
    retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
  };
}
