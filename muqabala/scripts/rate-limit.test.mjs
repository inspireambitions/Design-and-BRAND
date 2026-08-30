import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// These tests deliberately run without Upstash credentials. They verify the
// local safety brake used in development.
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const {
  limitInterviewGeneration,
  limitInterviewGenerationDaily,
  limitScoring,
  DEFAULT_DAILY_GENERATION_LIMIT,
  sharedRateLimitsConfigured,
} = await import('../lib/rate-limit.ts');

function requestFrom(ip) {
  return new Request('https://trymuqabala.com/api/test', {
    headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` },
  });
}

test('local scoring limit allows 30 requests and blocks the next request', async () => {
  const request = requestFrom('203.0.113.10');
  for (let index = 0; index < 30; index += 1) {
    assert.equal((await limitScoring(request)).limited, false);
  }
  const blocked = await limitScoring(request);
  assert.equal(blocked.limited, true);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test('local interview limit is isolated by candidate IP', async () => {
  const firstCandidate = requestFrom('203.0.113.20');
  const secondCandidate = requestFrom('203.0.113.21');
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await limitInterviewGeneration(firstCandidate)).limited, false);
  }
  assert.equal((await limitInterviewGeneration(firstCandidate)).limited, true);
  assert.equal((await limitInterviewGeneration(secondCandidate)).limited, false);
});

test('two candidates behind one shared IP receive separate interview limits', async () => {
  const sharedOffice = requestFrom('203.0.113.30');
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await limitInterviewGeneration(sharedOffice, '11111111-1111-4111-8111-111111111111')).limited, false);
  }
  assert.equal((await limitInterviewGeneration(sharedOffice, '11111111-1111-4111-8111-111111111111')).limited, true);
  assert.equal((await limitInterviewGeneration(sharedOffice, '22222222-2222-4222-8222-222222222222')).limited, false);
});

test('local daily generation ceiling is deployment-shaped and deterministic', async () => {
  const configuredLimit = Number(process.env.INTERVIEW_DAILY_LIMIT ?? DEFAULT_DAILY_GENERATION_LIMIT);
  for (let index = 0; index < configuredLimit; index += 1) {
    assert.equal((await limitInterviewGenerationDaily()).limited, false);
  }
  assert.equal((await limitInterviewGenerationDaily()).limited, true);
});

test('tests do not accidentally connect to a live Redis database', () => {
  assert.equal(sharedRateLimitsConfigured(), false);
});

test('production Redis timeouts use the deployment-wide database fallback', () => {
  const source = readFileSync(new URL('../lib/rate-limit.ts', import.meta.url), 'utf8');
  assert.match(source, /result\.reason !== 'timeout'/);
  assert.match(source, /consumeDatabaseRateLimit/);
  assert.match(source, /return \{ limited: true, retryAfterSeconds: 60 \}/);
});
