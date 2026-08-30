import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('capacity testing is distributed, staging-only and blocked from production', () => {
  const source = read('scripts/load/interview-journey.js');
  assert.match(source, /TARGET_ENV !== 'staging'/);
  assert.match(source, /DISTRIBUTED !== 'YES'/);
  assert.match(source, /productionHosts\.has\(host\)/);
  assert.match(source, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(source, /redirects: 0/);
  assert.match(source, /Content-Security-Policy/);
  assert.match(source, /Staging preflight did not reach the Muqabala application/);
  assert.match(source, /amazon:in:mumbai/);
  assert.match(source, /amazon:sg:singapore/);
  assert.match(source, /amazon:de:frankfurt/);
});

test('load results separate connection failures from application 5xx responses', () => {
  const source = read('scripts/load/interview-journey.js');
  assert.match(source, /response\.status === 0/);
  assert.match(source, /response\.status >= 500/);
  assert.match(source, /transport_failure_rate/);
  assert.match(source, /application_5xx_rate/);
  assert.match(source, /X-Vercel-Id/);
  assert.match(source, /load_run=/);
});

test('the release record treats local bursts as warnings, not capacity proof', () => {
  const runbook = read('docs/staging-load-test-runbook.md');
  assert.match(runbook, /49\/50/);
  assert.match(runbook, /44\/50/);
  assert.match(runbook, /115\/150/);
  assert.match(runbook, /not approved for a claim of 1,000 concurrent users/i);
  assert.match(runbook, /did not reach Muqabala/i);
});
