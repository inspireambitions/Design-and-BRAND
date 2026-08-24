import 'server-only';

import { Redis } from '@upstash/redis';

export type ScoringProviderName = 'openai' | 'anthropic' | 'openrouter';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;
const configuredLimit = Number(process.env.AI_GLOBAL_CONCURRENCY ?? 100);
const globalLimit = Number.isFinite(configuredLimit) ? Math.max(1, Math.floor(configuredLimit)) : 100;
let localActive = 0;

const ACQUIRE = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current >= tonumber(ARGV[1]) then return 0 end
current = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return current
`;

const RELEASE = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current <= 1 then redis.call('DEL', KEYS[1]); return 0 end
return redis.call('DECR', KEYS[1])
`;

export async function acquireAiCapacity(): Promise<boolean> {
  if (!redis) {
    if (localActive >= globalLimit) return false;
    localActive += 1;
    return true;
  }
  try {
    const result = Number(await redis.eval(ACQUIRE, ['muqabala:ai:active'], [globalLimit, 60]));
    return result > 0;
  } catch {
    // Fail closed. A Redis incident must not create a provider stampede across
    // independent serverless instances.
    return false;
  }
}

export async function releaseAiCapacity(): Promise<void> {
  if (!redis) {
    if (localActive > 0) localActive -= 1;
    return;
  }
  try {
    await redis.eval(RELEASE, ['muqabala:ai:active'], []);
  } catch {
    // The 60-second lease releases abandoned capacity after an outage.
  }
}

export async function providerCircuitOpen(provider: ScoringProviderName): Promise<boolean> {
  if (!redis) return false;
  try {
    return Boolean(await redis.get(`muqabala:ai:circuit:${provider}`));
  } catch {
    return false;
  }
}

export async function recordProviderResult(provider: ScoringProviderName, succeeded: boolean): Promise<void> {
  if (!redis) return;
  const failuresKey = `muqabala:ai:failures:${provider}`;
  const circuitKey = `muqabala:ai:circuit:${provider}`;
  try {
    if (succeeded) {
      await redis.del(failuresKey, circuitKey);
      return;
    }
    const failures = await redis.incr(failuresKey);
    if (failures === 1) await redis.expire(failuresKey, 60);
    if (failures >= 5) await redis.set(circuitKey, 'open', { ex: 30 });
  } catch {
    // Provider errors are still returned safely if circuit telemetry is down.
  }
}
