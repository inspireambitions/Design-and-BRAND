import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

function page(file, { roles = [], student = false, assigned = [], accepted = true, failure = false, anonymous = false } = {}) {
  const calls = [];
  const client = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const query = {
      select(value) { call.select = value; return query; },
      eq(...args) { call.filters.push(['eq', ...args]); return query; },
      not(...args) { call.filters.push(['not', ...args]); return query; },
      limit() { return query; },
      then(resolve, reject) {
        const data = table === 'schools_institution_members' ? (accepted ? roles.map(role => ({role, institution_id:'own'})) : [])
          : table === 'schools_cohort_educators' ? assigned : student ? [{cohort_id:'own'}] : [];
        return Promise.resolve({ data, error: failure ? {message:'unavailable'} : null }).then(resolve, reject);
      },
    }; return query;
  }};
  const deps = {
    'react/jsx-runtime': jsx,
    'next/link': { default: () => null },
    'next/navigation': { redirect: path => { throw new Error('redirect:' + path); }, notFound: () => { throw new Error('notFound'); } },
    '@/lib/schools/server': { schoolsContext: async () => {
      if (anonymous) throw new Error('redirect:/schools/sign-in');
      return {client, user:{id:'current-user'}};
    }},
    '@/lib/schools/dashboard': { buildSchoolsCohortSummaries() { throw new Error('Unexpected cohort-data read'); } },
  };
  const source = readFileSync(new URL('../app/schools/' + file + '/page.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require: key => { assert.ok(deps[key], key); return deps[key]; }});
  return {render: exports.default, calls};
}
for (const [name, options, destination] of [
  ['administrator', {roles:['institution_admin'], student:true}, '/schools/admin'],
  ['educator', {roles:['educator']}, '/schools/cohorts'],
  ['student', {student:true}, '/schools/me'],
  ['unassigned account', {}, '/schools/access'],
  ['unaccepted educator', {roles:['educator'], accepted:false}, '/schools/access'],
  ['learner with unaccepted staff invite', {roles:['educator'], accepted:false, student:true}, '/schools/me'],
  ['signed out', {anonymous:true}, '/schools/sign-in'],
]) test(name + ' receives only its authorized destination', async () => {
  const run = page('home', options);
  await assert.rejects(run.render(), {message:'redirect:' + destination});
  for (const call of run.calls) {
    const owner = call.table === 'schools_institution_members' ? 'user_id' : 'student_user_id';
    assert.ok(call.filters.some(filter => filter[0] === 'eq' && filter[1] === owner && filter[2] === 'current-user'));
    if (call.table === 'schools_institution_members') assert.ok(call.filters.some(filter => filter.join() === 'not,accepted_at,is,'));
  }
});
test('membership lookup failure never falls through to another workspace', async () => {
  await assert.rejects(page('home', {failure:true}).render(), /Could not load your school access/);
});
test('accepted educator without assigned cohorts sees useful guidance without cohort data', async () => {
  const run = page('cohorts', {roles:['educator']});
  const rendered = await run.render();
  assert.match(JSON.stringify(rendered), /No cohorts assigned yet/);
  assert.deepEqual(run.calls.map(call => call.table), ['schools_cohort_educators','schools_institution_members']);
  assert.ok(run.calls[1].filters.some(filter => filter.join() === 'eq,role,educator'));
});
test('student and unaccepted staff cannot receive educator empty state', async () => {
  for (const options of [{student:true}, {roles:['educator'], accepted:false}]) {
    await assert.rejects(page('cohorts', options).render(), /notFound/);
  }
});
