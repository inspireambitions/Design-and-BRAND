import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import * as secrets from '../lib/schools/access-secrets.ts';
import {parseContacts} from '../lib/employer-volume/contacts.ts';
const id='00000000-0000-4000-8000-000000000001';
function route({enabled=true,signedIn=false,emailRequired=false,failSession=false,blockedBucket=null}={}) {
  const calls=[];let signedOut=false;
  const user={id,email:secrets.schoolsInternalEmail(id),email_confirmed_at:'2026-09-08'};
  const client={auth:{getUser:async()=>({data:{user:signedIn?user:null}}),verifyOtp:async()=>({data:{user},error:null}),signOut:async()=>{signedOut=true;return {error:null};}}};
  const admin={rpc:async(name,args)=>{calls.push({name,args});return {error:null,data:name==='schools_claim_access'?(emailRequired?{requiresEmail:true}:{id,mode:'pseudonymous',studentId:id}):name==='schools_issue_access'?{id,expiresAt:'2026-09-09'}:true};},auth:{admin:{getUserById:async()=>({data:{user}}),generateLink:async()=>({data:{user,properties:{hashed_token:'synthetic-auth-token'}}})}}};
  const deps={zod:{z},'node:crypto':{randomUUID},'@/lib/schools/access':{schoolsUnavailable:()=>enabled?null:Response.json({error:'Not found'},{status:404})},
    '@/lib/supabase/server':{createClient:async()=>client},'@/lib/supabase/admin':{createAdminClient:()=>admin},
    '@/lib/server/security':{hasTrustedOrigin:()=>true},'@/lib/schools/access-rate-limit':{limitSchoolsAccessIp:async()=>({limited:blockedBucket==='ip'}),limitSchoolsRedemption:async()=>({limited:blockedBucket==='secret'}),limitSchoolsIssuance:async actor=>{calls.push({name:'actor_limit',actor});return {limited:blockedBucket==='actor'};},schoolsAccessLimitResponse:value=>value.limited?Response.json({error:'Please wait'},{status:429}):null},
    '@/lib/schools/session':{touchSchoolsSession:async()=>signedIn?{user}:null,registerSchoolsSession:async()=>!failSession},
    '@/lib/schools/access-secrets':secrets,'@/lib/employer-volume/contacts':{parseContacts}};
  const source=readFileSync(new URL('../app/api/schools/access/route.ts',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};vm.runInNewContext(code,{exports,Response,require:name=>{assert.ok(deps[name],name);return deps[name];}});
  return {post:body=>exports.POST(new Request('https://trymuqabala.com/api/schools/access',{method:'POST',body:JSON.stringify(body)})),calls,signedOut:()=>signedOut};
}
const redemption={operation:'redeem',secret:'x'.repeat(43),recovery:false,adultConfirmed:true};
test('disabled enrolment does not touch Auth or storage',async()=>{const run=route({enabled:false});assert.equal((await run.post(redemption)).status,404);assert.equal(run.calls.length,0);});
test('email enrolment requires its verified recipient before consuming a grant',async()=>{const run=route({emailRequired:true});const response=await run.post(redemption);assert.equal(response.status,401);assert.equal((await response.json()).signInRequired,true);assert.equal(run.calls.length,1);});
test('pseudonymous access returns a fresh recovery code and stores only its hash',async()=>{
  const run=route();const response=await run.post(redemption);assert.equal(response.status,200);const body=await response.json();assert.match(body.recoveryCode,/^[A-Za-z0-9_-]{43}$/);
  const completed=run.calls.find(call=>call.name==='schools_complete_access');assert.equal(completed.args.student,id);assert.equal(completed.args.new_recovery_hash,secrets.schoolsSecretHash(body.recoveryCode));
  assert.ok(!JSON.stringify(run.calls).includes(body.recoveryCode));
});
test('failed schools session creation signs out the newly issued identity',async()=>{const run=route({failSession:true});assert.equal((await run.post(redemption)).status,503);assert.equal(run.signedOut(),true);});
test('browser cannot substitute a student identity in redemption',async()=>{const run=route();assert.equal((await run.post({...redemption,studentId:id})).status,400);assert.equal(run.calls.length,0);});
for(const bucket of ['ip','secret'])test(`blocked ${bucket} redemption does not claim or create an identity`,async()=>{
  const run=route({blockedBucket:bucket});assert.equal((await run.post(redemption)).status,429);assert.equal(run.calls.length,0);
});
test('issuance limiter takes the verified session actor and cannot bypass sign-in',async()=>{
  const input={operation:'issue',cohortId:id,purpose:'enrolment',mode:'pseudonymous',displayName:'Synthetic learner',identityChecked:false};
  const anonymous=route({blockedBucket:'actor'});assert.equal((await anonymous.post(input)).status,401);assert.equal(anonymous.calls.length,0);
  const authenticated=route({signedIn:true,blockedBucket:'actor'});assert.equal((await authenticated.post(input)).status,429);
  assert.deepEqual(authenticated.calls,[{name:'actor_limit',actor:id}]);
});
