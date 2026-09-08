import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { isSchoolsDestination } from '../lib/auth-destination.ts';
test('general analytics ignores schools even after personal-practice initialisation',async()=>{
  const events=[];let initialised=0;
  const client={init:()=>{initialised++;},capture:(...args)=>events.push(args)};
  const window={location:{pathname:'/schools/me'}};
  const exports={};
  const source=readFileSync(new URL('../lib/analytics.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,window,process:{env:{NEXT_PUBLIC_POSTHOG_KEY:'synthetic-test-key'}},require:id=>{
    if(id==='./auth-destination')return {isSchoolsDestination};
    if(id==='posthog-js')return {default:client};
    throw new Error('Unexpected import '+id);
  }});
  exports.initAnalytics();exports.track('email_submitted',{source:'feedback_card'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(initialised,0);assert.equal(events.length,0);
  window.location.pathname='/practice';exports.initAnalytics();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(initialised,1);assert.equal(events.length,0);
  exports.track('interview_started',{role_id:'test-role'});assert.equal(events.length,1);
  window.location.pathname='/schools/me/reports/private-attempt';
  exports.track('interview_completed',{role_id:'private-role'});assert.equal(events.length,1);
});
