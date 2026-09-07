import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function loadRoute(owner = 'owner') {
  const builder = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: 'role', employer_id: owner, workplace: 'Fictional Test', signed_token: 'test', minutes_per_cv: 4 } }; } };
  const deps = {
    '@/lib/employer-volume': { employerVolumeEnabled: () => true },
    '@/lib/employer-volume/strip': { timeSavedHours: () => 1.2 },
    '@/lib/server/employer-role-strip': { loadRoleStrip: async () => ({ strip: { invited: 20, answered: 12, fullCoverage: 8, shortlisted: 3, decided: 5 } }) },
    '@/lib/interview-token': { verifyInterview: () => ({ title: 'Housekeeping Attendant' }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }) },
    '@/lib/supabase/server': { currentUser: async () => ({ id: 'owner' }), createClient: async () => ({ from: () => builder }) },
  };
  const source = await readFile(new URL('../app/api/employer/roles/[roleId]/summary/route.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Response, require: id => deps[id] ?? require(id) });
  return exports.GET;
}

test('the owning employer summary renders a complete PNG through the real image renderer', async () => {
  const get = await loadRoute();
  const response = await get(new Request('https://trymuqabala.com/api/employer/roles/role/summary'), { params: Promise.resolve({ roleId: 'role' }) });
  const png = Buffer.from(await response.arrayBuffer());
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1350);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
});

test('another employer cannot render the role summary', async () => {
  const get = await loadRoute('someone-else');
  const response = await get(new Request('https://trymuqabala.com/api/employer/roles/role/summary'), { params: Promise.resolve({ roleId: 'role' }) });
  assert.equal(response.status, 404);
});
