import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

async function status(load, stored, lookupError = null) {
  const source = await readFile(new URL('../app/api/screening/interviews/[id]/status/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const admin = { from(table) {
    const chain = { select: () => chain, eq: () => chain,
      order: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: stored, error: lookupError }) };
    assert.ok(['interview_answers', 'universal_interviews'].includes(table));
    return chain;
  } };
  vm.runInNewContext(compiled, { exports, Response, require(id) {
    if (id.endsWith('/interview-access')) return { interviewAccess: async () => ({ configured: true, user: {}, candidate: true, admin,
      interview: { mode: 'screening', current_question: 3, question_snapshot: [], submitted_at: null } }) };
    if (id.endsWith('/security')) return { privateNoStoreHeaders: () => ({ 'Cache-Control': 'no-store' }) };
    if (id.endsWith('/repository')) return { loadStoredInterview: load };
    if (id.endsWith('/employer')) return { publicEmployerBrainState: () => ({ stage: 'questions' }) };
    throw new Error(id);
  } });
  return exports.GET(new Request('https://example.com'), { params: Promise.resolve({ id: 'synthetic' }) });
}

test('state lookup failure cannot switch adaptive interview into fixed questions', async () => {
  for (const [load, stored, error] of [
    [async () => { throw new Error('database unavailable'); }, null, null],
    [async () => null, { id: 'synthetic' }, null],
    [async () => null, null, { code: 'timeout' }],
  ]) {
    const response = await status(load, stored, error);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await response.json()).brain, undefined);
  }
});

test('confirmed fixed interviews and available adaptive interviews remain usable', async () => {
  const fixed = await status(async () => null, null);
  assert.equal(fixed.status, 200);
  assert.equal((await fixed.json()).brain, null);
  const adaptive = await status(async () => ({ screening: {} }), null);
  assert.equal(adaptive.status, 200);
  assert.equal((await adaptive.json()).brain.stage, 'questions');
});
