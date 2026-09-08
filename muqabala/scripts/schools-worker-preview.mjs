import './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {hkdfSync} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {stagingEnvironment} from './schools-staging-env.mjs';
import {login} from './schools-staging-qa.mjs';
import {previewAccess,previewOrigin} from './schools-preview-access.mjs';
import {sealSchoolsMail} from '../lib/schools/mail-crypto.ts';
import {newSchoolsSecret,schoolsEmailHash,schoolsSecretHash} from '../lib/schools/access-secrets.ts';
import {qaStage} from './schools-qa-errors.mjs';

const require=createRequire(import.meta.url),{request}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const c=stagingEnvironment();assert.equal(new URL(c.SUPABASE_URL).hostname,'okrsezhospztwtptqhpo.supabase.co');
const derive=info=>Buffer.from(hkdfSync('sha256',c.SUPABASE_JWT_SECRET,'okrsezhospztwtptqhpo',info,32)).toString('hex');
const cron=process.env.SCHOOLS_QA_CRON||derive('schools-synthetic-cron-v1');
process.env.INTERVIEW_SECRET=derive('schools-synthetic-preview-v1');
const state=(mode,id='',envelope='')=>{
  const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/schools-worker-state.ps1','-Mode',mode,...(id?['-InviteId',id]:[])],{encoding:'utf8',windowsHide:true,input:envelope,maxBuffer:1024*1024});
  assert.equal(r.status,0,'Staging worker state failed');const data=JSON.parse(r.stdout);assert(!data.failed,'Staging worker state unavailable');return Array.isArray(data)?data:[data];
};
qaStage('worker queue preflight');
assert.equal(state('Preflight')[0].pending,0,'Clear only verified synthetic pending messages before this test');
const {admin,fixture:f}=await login('admin');
const to='inspireambition.com@gmail.com',secret=newSchoolsSecret();
// This synthetic staff invitation is revoked during cleanup. No permission is
// granted unless the controlled inbox follows the link and accepts it.
const url=previewOrigin+'/schools/staff#'+secret;
const envelope=sealSchoolsMail({to,url});
const invited=await admin.rpc('schools_invite_staff',{actor:f.users.admin.id,institution:f.institutions[0],staff_role:'educator',recipient_hash:schoolsEmailHash(to),secret_hash:schoolsSecretHash(secret),sealed_message:envelope});
assert(!invited.error&&invited.data,'Controlled worker invitation');const invite=invited.data;
let context;
const evidence={checkedAt:new Date().toISOString(),previewOrigin,stagingOnly:true,authorisedInboxOnly:true,checks:[],inboxVerified:false,scheduledTriggerVerified:false};
try{
  const access=await previewAccess();context=await request.newContext({baseURL:previewOrigin,extraHTTPHeaders:{Origin:previewOrigin}});
  await context.get('/schools?_vercel_share='+encodeURIComponent(Object.keys(access.protectionBypass)[0]));
  qaStage('worker unauthorised rejection');
  const denied=await context.get('/api/schools/mail');console.log(JSON.stringify({stage:'worker unauthorised rejection',status:denied.status()}));assert.equal(denied.status(),401);
  evidence.checks.push({check:'Mail worker rejects missing cron authorisation',passed:true});
  qaStage('controlled invitation delivery');
  const run=async()=>{const r=await context.get('/api/schools/mail',{headers:{Authorization:'Bearer '+cron},timeout:65000});console.log(JSON.stringify({stage:'authorised mail worker',status:r.status()}));assert.equal(r.status(),200,'Worker response');return r.json();};
  const first=await Promise.all([run(),run()]);assert.equal(first.reduce((n,r)=>n+r.sent,0),1);assert.equal(first.reduce((n,r)=>n+r.failed,0),0);
  const receipt=state('Inspect',invite)[0];assert.equal(receipt.status,'sent');assert(receipt.provider_message_id);
  evidence.checks.push({check:'Controlled staff notification accepted by provider and stored as sent',passed:true,messageId:receipt.id,providerMessageId:receipt.provider_message_id});
  evidence.checks.push({check:'Two simultaneous worker requests send one queued message once',passed:true});
  qaStage('lost receipt replay');
  assert.equal(state('Replay',invite,envelope).length,1);
  const replay=await run();assert.equal(replay.sent,1);assert.equal(replay.failed,0);
  const second=state('Inspect',invite)[0];assert.equal(second.status,'sent');assert.equal(second.provider_message_id,receipt.provider_message_id);assert.equal(second.attempts,2);
  evidence.checks.push({check:'Lost receipt replay returns the same provider message id',passed:true,attempts:second.attempts});
  const empty=await run();assert.equal(empty.sent,0);assert.equal(empty.failed,0);
  evidence.checks.push({check:'Completed message is not claimed a third time',passed:true});
  qaStage('retention authentication');
  const retentionDenied=await context.get('/api/schools/retention');assert.equal(retentionDenied.status(),401);
  evidence.checks.push({check:'Retention rejects missing cron authorisation',passed:true});
  await writeFile('../docs/evidence/schools-worker-preview.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{
  state('Cleanup',invite);
  await context?.dispose();
}
