import { createHash, createHmac } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type LimitKind = 'network' | 'daily' | 'capacity' | 'unavailable';

export type AiLimitResult = {
  configured: boolean;
  success: boolean;
  retryAfter: number;
  reason: LimitKind;
};

type AiControls = {
  redis: Redis;
  scoreNetwork: Ratelimit;
  scoreDaily: Ratelimit;
  interviewNetwork: Ratelimit;
  interviewDaily: Ratelimit;
  openRouterMinute: Ratelimit;
};

const localWindows = new Map<string, { count: number; resetAt: number }>();
const localSessions = new Set<string>();
let controls: AiControls | null | undefined;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function configuredControls(): AiControls | null {
  if (controls !== undefined) return controls;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return (controls = null);

  const redis = new Redis({ url, token });
  controls = {
    redis,
    scoreNetwork: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '10 m'),
      prefix: 'muqabala:ai:score:network:v1',
      analytics: false,
    }),
    scoreDaily: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(positiveInteger(process.env.SCORING_DAILY_LIMIT, 1000), '24 h'),
      prefix: 'muqabala:ai:score:daily:v1',
      analytics: false,
    }),
    interviewNetwork: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      prefix: 'muqabala:ai:interview:network:v1',
      analytics: false,
    }),
    interviewDaily: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(positiveInteger(process.env.INTERVIEW_DAILY_LIMIT, 400), '24 h'),
      prefix: 'muqabala:ai:interview:daily:v1',
      analytics: false,
    }),
    openRouterMinute: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(positiveInteger(process.env.OPENROUTER_RPM_LIMIT, 9), '1 m'),
      prefix: 'muqabala:ai:openrouter:minute:v1',
      analytics: false,
    }),
  };
  return controls;
}

function safeControls(): AiControls | null | 'unavailable' {
  try {
    return configuredControls();
  } catch (error) {
    console.error('ai_rate_limit_configuration_failed', {
      errorType: error instanceof Error ? error.name : 'unknown',
    });
    return 'unavailable';
  }
}

/** Hash network and session identifiers before they leave the application. */
export function privateLimitKey(value: string): string {
  const secret = process.env.INTERVIEW_SECRET || process.env.REPORT_CLAIM_SECRET;
  const digest = secret
    ? createHmac('sha256', secret).update(value).digest('hex')
    : createHash('sha256').update(value).digest('hex');
  return digest.slice(0, 32);
}

function localLimit(key: string, maximum: number, windowMs: number, reason: LimitKind): AiLimitResult {
  const now = Date.now();
  const existing = localWindows.get(key);
  if (!existing || now >= existing.resetAt) {
    localWindows.set(key, { count: 1, resetAt: now + windowMs });
    return { configured: false, success: true, retryAfter: 0, reason };
  }

  existing.count += 1;
  return {
    configured: false,
    success: existing.count <= maximum,
    retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    reason,
  };
}

function unavailable(): AiLimitResult {
  return { configured: true, success: false, retryAfter: 20, reason: 'unavailable' };
}

function clientIp(request: Request): string {
  return (
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

async function sharedLimit(
  limiter: Ratelimit,
  identifier: string,
  reason: LimitKind,
): Promise<AiLimitResult> {
  try {
    const result = await limiter.limit(identifier);
    return {
      configured: true,
      success: result.success,
      retryAfter: result.success ? 0 : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      reason,
    };
  } catch (error) {
    // Technical metadata only. Never log IPs, sessions, prompts or answers.
    console.error('ai_rate_limit_unavailable', {
      errorType: error instanceof Error ? error.name : 'unknown',
    });
    return unavailable();
  }
}

export async function limitScoreNetwork(request: Request): Promise<AiLimitResult> {
  const identifier = privateLimitKey(clientIp(request));
  const active = safeControls();
  if (active === 'unavailable') return unavailable();
  if (!active) return localLimit(`score-network:${identifier}`, 30, 10 * 60_000, 'network');
  return sharedLimit(active.scoreNetwork, identifier, 'network');
}

export async function limitScoreDaily(): Promise<AiLimitResult> {
  const maximum = positiveInteger(process.env.SCORING_DAILY_LIMIT, 1000);
  const active = safeControls();
  if (active === 'unavailable') return unavailable();
  if (!active) return localLimit('score-daily:all', maximum, 24 * 60 * 60_000, 'daily');
  return sharedLimit(active.scoreDaily, 'all', 'daily');
}

export async function limitInterviewNetwork(request: Request): Promise<AiLimitResult> {
  const identifier = privateLimitKey(clientIp(request));
  const active = safeControls();
  if (active === 'unavailable') return unavailable();
  if (!active) return localLimit(`interview-network:${identifier}`, 5, 10 * 60_000, 'network');
  return sharedLimit(active.interviewNetwork, identifier, 'network');
}

export async function limitInterviewDaily(): Promise<AiLimitResult> {
  const maximum = positiveInteger(process.env.INTERVIEW_DAILY_LIMIT, 400);
  const active = safeControls();
  if (active === 'unavailable') return unavailable();
  if (!active) return localLimit('interview-daily:all', maximum, 24 * 60 * 60_000, 'daily');
  return sharedLimit(active.interviewDaily, 'all', 'daily');
}

export async function limitOpenRouterAttempt(): Promise<AiLimitResult> {
  const maximum = positiveInteger(process.env.OPENROUTER_RPM_LIMIT, 9);
  const active = safeControls();
  if (active === 'unavailable') return unavailable();
  if (!active) return localLimit('openrouter-minute:all', maximum, 60_000, 'capacity');
  return sharedLimit(active.openRouterMinute, 'all', 'capacity');
}

export type ScoringSessionLease = {
  acquired: boolean;
  configured: boolean;
  retryAfter: number;
  release: () => Promise<void>;
};

export async function acquireScoringSession(session: string): Promise<ScoringSessionLease> {
  const sessionKey = privateLimitKey(session);
  const active = safeControls();

  if (active === 'unavailable') {
    return { acquired: false, configured: true, retryAfter: 20, release: async () => {} };
  }

  if (!active) {
    if (localSessions.has(sessionKey)) {
      return { acquired: false, configured: false, retryAfter: 2, release: async () => {} };
    }
    localSessions.add(sessionKey);
    return {
      acquired: true,
      configured: false,
      retryAfter: 0,
      release: async () => {
        localSessions.delete(sessionKey);
      },
    };
  }

  const key = `muqabala:ai:score:session:v1:${sessionKey}`;
  try {
    const result = await active.redis.set(key, 'active', { nx: true, ex: 90 });
    if (result !== 'OK') {
      return { acquired: false, configured: true, retryAfter: 2, release: async () => {} };
    }
    return {
      acquired: true,
      configured: true,
      retryAfter: 0,
      release: async () => {
        try {
          await active.redis.del(key);
        } catch (error) {
          console.error('ai_session_release_failed', {
            errorType: error instanceof Error ? error.name : 'unknown',
          });
        }
      },
    };
  } catch (error) {
    console.error('ai_session_lock_unavailable', {
      errorType: error instanceof Error ? error.name : 'unknown',
    });
    return { acquired: false, configured: true, retryAfter: 20, release: async () => {} };
  }
}
