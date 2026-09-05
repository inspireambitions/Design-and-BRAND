import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { shouldClaimPracticeAttempt } from '../lib/auth-destination.ts';

async function loadRoute(path, next, claim = 'stale-claim') {
  const state = new Map([['attempt', 'old-attempt'], ['auth-state', claim]]);
  let claimed = 0, callback;
  const deps = {
    'next/headers': { cookies: async () => ({ get: k => ({ value: state.get(k) }), delete: k => state.delete(k) }) },
    'next/server': { NextResponse: { redirect: url => new Response(null, { status: 307, headers: { location: url } }) } },
    '@/lib/auth-destination': { shouldClaimPracticeAttempt },
    '@/lib/interviews': { OtpVerifySchema: { safeParse: () => ({ success: true, data: { email: 'test@example.test', token: '123456', next } }) }, AuthRequestSchema: { safeParse: () => ({ success: true, data: { email: 'test@example.test', next } }) } },
    '@/lib/rate-limit': { limitAuth: async () => ({ limited: false }) },
    '@/lib/server/claim-attempt': { claimCurrentAttempt: async () => { claimed++; return { id: 'old-report', roleId: 'nurse', status: 'completed' }; } },
    '@/lib/server/security': { ATTEMPT_COOKIE: 'attempt', AUTH_STATE_COOKIE: 'auth-state', hasTrustedOrigin: () => true, isOpaqueToken: () => true, privateNoStoreHeaders: () => ({}), safeNext: n => n, configuredOrigin: () => 'https://trymuqabala.com' },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => assert.fail('Employer sign-in must not prepare a practice claim') }) },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { verifyOtp: async () => ({ data: { user: { id: 'owner' } }, error: null }), signInWithOtp: async args => { callback = args.options.emailRedirectTo; return { error: null }; }, signOut: () => assert.fail('Valid employer sign-in must remain signed in') } }) },
    '@/lib/server/analytics': { trackServer: () => {} },
  };
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, URL, Response, process, require: id => { assert.ok(deps[id], id); return deps[id]; } });
  return { exports, state, claimed: () => claimed, callback: () => callback };
}

test('employer OTP returns to the requested evaluation despite an old practice claim', async () => {
  const next = '/employer/candidates/test/evaluation';
  const run = await loadRoute('../app/api/auth/verify/route.ts', next);
  const response = await run.exports.POST({ json: async () => ({}) });
  assert.equal((await response.json()).next, next);
  assert.equal(run.claimed(), 0);
  assert.equal(run.state.has('auth-state'), false);
});

test('employer email link ignores an unrelated practice claim', async () => {
  const next = '/for-employers';
  const run = await loadRoute('../app/auth/confirm/route.ts', next);
  const response = await run.exports.GET(new Request(`https://trymuqabala.com/auth/confirm?token_hash=test&type=email&next=${encodeURIComponent(next)}&claim=stale`));
  assert.equal(response.headers.get('location'), `https://trymuqabala.com${next}`);
  assert.equal(run.claimed(), 0);
});

test('employer code request clears the stale claim and does not create another', async () => {
  const run = await loadRoute('../app/api/auth/request/route.ts', '/employer');
  assert.equal((await run.exports.POST({ json: async () => ({}) })).status, 200);
  assert.equal(new URL(run.callback()).searchParams.has('claim'), false);
  assert.equal(run.state.has('auth-state'), false);
  assert.equal(run.state.has('attempt'), true);
});

test('practice report verification still redeems its claim', async () => {
  const run = await loadRoute('../app/api/auth/verify/route.ts', '/account/reports/old-report');
  assert.equal((await (await run.exports.POST({ json: async () => ({}) })).json()).next, '/account/reports/old-report');
  assert.equal(run.claimed(), 1);
});

test('employer destination matching respects path boundaries and query strings', () => {
  for (const next of ['/employer?tab=roles', '/for-employers#start', '/employer/roles/a']) assert.equal(shouldClaimPracticeAttempt(next), false);
  for (const next of ['/account', '/practice/nurse?resume=a', '/employer-career']) assert.equal(shouldClaimPracticeAttempt(next), true);
});
