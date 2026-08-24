import assert from 'node:assert/strict';
import test from 'node:test';
import { contentSecurityPolicy, securityHeaders } from '../next.config.ts';

test('security headers protect every browser-facing route', () => {
  const headers = new Map(securityHeaders.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.match(headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(headers.get('content-security-policy'), /object-src 'none'/);
  assert.match(headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(headers.get('permissions-policy'), /camera=\(self\)/);
  assert.match(headers.get('permissions-policy'), /microphone=\(self\)/);
  assert.equal(contentSecurityPolicy.includes('\n'), false);
});

test('local AI limits preserve the production thresholds during development', async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    const limiter = await import(`../lib/ai-rate-limit.ts?local=${Date.now()}`);
    const request = new Request('http://localhost/api/score', {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    let result;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      result = await limiter.limitScoreNetwork(request);
      assert.equal(result.success, true);
    }
    result = await limiter.limitScoreNetwork(request);
    assert.equal(result.success, false);
    assert.equal(result.reason, 'network');

    const first = await limiter.acquireScoringSession('session-12345678');
    const duplicate = await limiter.acquireScoringSession('session-12345678');
    assert.equal(first.acquired, true);
    assert.equal(duplicate.acquired, false);
    await first.release();
    const afterRelease = await limiter.acquireScoringSession('session-12345678');
    assert.equal(afterRelease.acquired, true);
    await afterRelease.release();

    const privateKey = limiter.privateLimitKey('203.0.113.9');
    assert.equal(privateKey.includes('203.0.113.9'), false);
    assert.equal(privateKey.length, 32);
  } finally {
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});

test('a broken Upstash configuration fails closed', async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const previousError = console.error;
  process.env.UPSTASH_REDIS_REST_URL = 'not-a-url';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  console.error = () => {};

  try {
    const limiter = await import(`../lib/ai-rate-limit.ts?broken=${Date.now()}`);
    const result = await limiter.limitScoreNetwork(
      new Request('http://localhost/api/score', { headers: { 'x-forwarded-for': '203.0.113.10' } }),
    );
    assert.equal(result.success, false);
    assert.equal(result.reason, 'unavailable');
  } finally {
    console.error = previousError;
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});
