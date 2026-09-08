import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
function harness(mode='local'){
  const keys=[];let now=0;
  class FakeLimiter{
    static slidingWindow(){return {};}
    async limit(key){keys.push(key);if(mode==='error')throw new Error('private');return {success:true,reason:mode==='timeout'?'timeout':undefined};}
  }
  class Clock extends Date{static now(){return now;}}
  const dependencies={'node:crypto':{createHash},'@upstash/ratelimit':{Ratelimit:FakeLimiter},'@upstash/redis':{Redis:class{}}};
  const source=readFileSync(new URL('../lib/schools/access-rate-limit.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(code,{exports,Date:Clock,Response,process:{env:mode==='local'?{}:{UPSTASH_REDIS_REST_URL:'test',UPSTASH_REDIS_REST_TOKEN:'test'}},require:name=>dependencies[name]});
  return {...exports,keys,advance:()=>{now+=600001;}};
}
const request=ip=>new Request('https://example.test/api/schools/access',{headers:{'x-forwarded-for':ip}});
test('thirty learners sharing an address each have enrolment and recovery headroom',async()=>{
  const h=harness();
  for(let user=0;user<30;user++)for(let retry=0;retry<3;retry++){
    assert.equal((await h.limitSchoolsAccessIp(request('192.0.2.1'))).limited,false);
    assert.equal((await h.limitSchoolsRedemption(`unique-secret-${user}`)).limited,false);
  }
});
test('repeated invalid secret attempts are bounded across addresses',async()=>{
  const h=harness();for(let i=0;i<8;i++)assert.equal((await h.limitSchoolsRedemption('same-secret')).limited,false);
  const result=await h.limitSchoolsRedemption('same-secret');assert.equal(result.limited,true);
  assert.equal(h.schoolsAccessLimitResponse(result).headers.get('Retry-After'),'600');
  assert.equal((await h.limitSchoolsRedemption('different-secret')).limited,false);
  h.advance();assert.equal((await h.limitSchoolsRedemption('same-secret')).limited,false);
});
test('changing codes cannot escape the bounded address cap',async()=>{
  const h=harness();for(let i=0;i<300;i++)assert.equal((await h.limitSchoolsAccessIp(request('192.0.2.2'))).limited,false);
  assert.equal((await h.limitSchoolsAccessIp(request('192.0.2.2'))).limited,true);
  assert.equal((await h.limitSchoolsAccessIp(request('192.0.2.3'))).limited,false);
});
test('verified issuance actor has a separate budget from learners and other advisers',async()=>{
  const h=harness();for(let i=0;i<60;i++)assert.equal((await h.limitSchoolsIssuance('adviser-a')).limited,false);
  assert.equal((await h.limitSchoolsIssuance('adviser-a')).limited,true);
  assert.equal((await h.limitSchoolsIssuance('adviser-b')).limited,false);
  assert.equal((await h.limitSchoolsRedemption('learner-secret')).limited,false);
});
for(const mode of ['timeout','error'])test(`Redis ${mode} retains a bounded local brake without raw identifiers`,async()=>{
  const h=harness(mode);for(let i=0;i<8;i++)assert.equal((await h.limitSchoolsRedemption('private-code')).limited,false);
  assert.equal((await h.limitSchoolsRedemption('private-code')).limited,true);
  assert.equal(h.keys.length,9);for(const key of h.keys)assert.match(key,/^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(h.keys).includes('private-code'));
});
