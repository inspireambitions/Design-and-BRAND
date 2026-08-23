import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let limiters:
  | {
      network: Ratelimit;
      address: Ratelimit;
      claim: Ratelimit;
    }
  | null
  | undefined;

function configuredLimiters() {
  if (limiters !== undefined) return limiters;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return (limiters = null);

  const redis = new Redis({ url, token });
  limiters = {
    network: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 m'),
      prefix: 'muqabala:reports:network',
      analytics: false,
    }),
    address: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '10 m'),
      prefix: 'muqabala:reports:address',
      analytics: false,
    }),
    claim: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 m'),
      prefix: 'muqabala:reports:claim',
      analytics: false,
    }),
  };
  return limiters;
}

export function reportClientIp(request: Request): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function limitReportCreation(request: Request, emailHash: string) {
  const active = configuredLimiters();
  if (!active) return { configured: false, success: false, retryAfter: 60 };
  const ip = reportClientIp(request);
  const [network, address] = await Promise.all([
    active.network.limit(ip),
    active.address.limit(emailHash),
  ]);
  const reset = Math.max(network.reset, address.reset);
  return {
    configured: true,
    success: network.success && address.success,
    retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
  };
}

export async function limitReportClaim(request: Request) {
  const active = configuredLimiters();
  if (!active) return { configured: false, success: false, retryAfter: 60 };
  const result = await active.claim.limit(reportClientIp(request));
  return {
    configured: true,
    success: result.success,
    retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  };
}
