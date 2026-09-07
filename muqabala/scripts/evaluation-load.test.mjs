import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { LegacyEvaluationUnavailableError } from '../lib/evaluation-availability.ts';

async function loader(load, generate, logs) {
  const source = await readFile(new URL('../lib/server/evaluation-load.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Error, require: id => id.endsWith('evaluation-availability')
    ? { LegacyEvaluationUnavailableError }
    : id.endsWith('evaluation-report')
    ? { loadOwnedEvaluationReport: load, generateCandidateEvaluationReport: generate }
    : { reportOperationalFailure: (...args) => logs.push(args), reportOperationalEvent: (...args) => logs.push(args) } });
  return exports.loadEvaluationForEmployer;
}

test('existing employer report opens without regeneration', async () => {
  const report = { databaseId: 'test' }, logs = [];
  const run = await loader(async (id, owner) => { assert.equal(owner, 'owner'); return report; }, () => assert.fail('must not regenerate'), logs);
  const result = await run('interview', 'owner');
  assert.equal(result.current, report); assert.equal(result.failed, false); assert.equal(logs.length, 0);
});

test('missing report is generated then reloaded through ownership check', async () => {
  let loads = 0, generates = 0;
  const run = await loader(async () => ++loads === 1 ? null : { databaseId: 'test' }, async () => { generates++; }, []);
  const result = await run('interview', 'owner');
  assert.equal(result.current.databaseId, 'test'); assert.equal(generates, 1);
});

test('unreadable encrypted state fails safely without leaking the exception message', async () => {
  const logs = [];
  const run = await loader(async () => null, async () => { throw new Error('private-content-must-not-appear'); }, logs);
  const result = await run('interview', 'owner');
  assert.equal(result.current, null); assert.equal(result.failed, true);
  assert.equal(JSON.stringify(logs).includes('private-content'), false);
});

test('older untimed interviews get an explicit original-review path without retrying generation', async () => {
  const logs = [];
  const run = await loader(async () => null, async () => { throw new LegacyEvaluationUnavailableError(); }, logs);
  const result = await run('interview', 'owner');
  assert.equal(result.legacy, true);
  assert.equal(result.failed, false);
  assert.equal(result.current, null);
  assert.equal(logs[0][0], 'evaluation_legacy_review_available');
});
