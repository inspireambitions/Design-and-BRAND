import './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {hkdfSync} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {stagingEnvironment} from './schools-staging-env.mjs';
import {previewAccess,previewOrigin} from './schools-preview-access.mjs';
import {qaStage} from './schools-qa-errors.mjs';
const assignment=process.env.SCHOOLS_QA_ASSIGNMENT;
assert.match(assignment??'',/^[a-f0-9-]{36}$/);
const require=createRequire(import.meta.url),{request}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const c=stagingEnvironment();assert.equal(new URL(c.SUPABASE_URL).hostname,'okrsezhospztwtptqhpo.supabase.co');
const cron=Buffer.from(hkdfSync('sha256',c.SUPABASE_JWT_SECRET,'okrsezhospztwtptqhpo','schools-synthetic-cron-v1',32)).toString('hex');
const state=(mode,id='')=>{
  const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/schools-worker-state.ps1','-Mode',mode,...(id?['-InviteId',id]:[])],{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
  assert.equal(r.status,0,'Staging worker state failed');const data=JSON.parse(r.stdout);assert(!data.failed);return Array.isArray(data)?data:[data];
};
qaStage('assignment queue preflight');assert.equal(state('Preflight')[0].pending,0);
const queued=state('Assignment',assignment);assert.equal(queued.length,1,'One authorised active synthetic assignment required');const message=queued[0].id;
let context;
try{
  const access=await previewAccess();context=await request.newContext({baseURL:previewOrigin});
  await context.get('/schools?_vercel_share='+encodeURIComponent(Object.keys(access.protectionBypass)[0]));
  qaStage('controlled assignment delivery');
  const response=await context.get('/api/schools/mail',{headers:{Authorization:'Bearer '+cron},timeout:65000});
  console.log(JSON.stringify({stage:'assignment worker',status:response.status()}));assert.equal(response.status(),200);
  const result=await response.json();assert.equal(result.sent,1);assert.equal(result.failed,0);
  const receipt=state('AssignmentInspect',message)[0];assert.equal(receipt.status,'sent');assert(receipt.provider_message_id);
  const evidence={checkedAt:new Date().toISOString(),previewOrigin,stagingOnly:true,authorisedInboxOnly:true,assignmentId:assignment,messageId:message,providerMessageId:receipt.provider_message_id,providerAccepted:true,inboxVerified:false};
  await writeFile('../docs/evidence/schools-assignment-worker-preview.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{state('AssignmentCleanup',message);await context?.dispose();}
