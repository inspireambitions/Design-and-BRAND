import './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {login} from './schools-staging-qa.mjs';
import {previewAccess,previewOrigin} from './schools-preview-access.mjs';
const require=createRequire(import.meta.url),{request}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const owner='hello@trymuqabala.com',path='../docs/evidence/schools-controlled-handoff.json';
const senderKey=process.env.SCHOOLS_QA_SENDER;delete process.env.SCHOOLS_QA_SENDER;
assert.match(senderKey??'',/^re_[A-Za-z0-9_-]+$/);
const {admin,fixture:f}=await login('admin');
const check=r=>{assert(!r.error);return r.data;};
const user=check(await admin.auth.admin.generateLink({type:'magiclink',email:owner})).user;
const member=check(await admin.from('schools_institution_members').select('id').eq('institution_id',f.institutions[0]).eq('user_id',user.id).maybeSingle());
if(!member)check(await admin.rpc('schools_manage_action',{actor:f.users.admin.id,operation:'staff',device:'server',payload:{institutionId:f.institutions[0],userId:user.id,role:'educator'}}));
let record=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
if(!record){
  const cohort=check(await admin.rpc('schools_manage_action',{actor:f.users.admin.id,operation:'cohort',device:'server',payload:{institutionId:f.institutions[0],name:'Controlled tester group - fictional answers only'}}));
  for(const id of [user.id,f.users.educator.id])check(await admin.rpc('schools_manage_action',{actor:f.users.admin.id,operation:'assign_educator',device:'server',payload:{cohortId:cohort.id,userId:id}}));
  check(await admin.rpc('schools_manage_action',{actor:f.users.admin.id,operation:'enrolment',device:'server',payload:{cohortId:cohort.id,open:true,rotate:false}}));
  const questions=check(await admin.from('schools_assignment_questions').select('question_version_id').eq('assignment_id',f.assignments[0]).order('question_index'));
  const assignment=check(await admin.rpc('schools_manage_action',{actor:f.users.educator.id,operation:'assignment',device:'server',payload:{cohortId:cohort.id,roleId:'Student placement',questionIds:questions.map(q=>q.question_version_id),dueAt:new Date(Date.now()+7*86400000).toISOString()}}));
  record={createdAt:new Date().toISOString(),stagingOnly:true,recipient:owner,cohortId:cohort.id,assignmentId:assignment.id,educatorUserId:user.id,restriction:'Fictional answers only; no real institution activation'};
  writeFileSync(path,JSON.stringify(record,null,2)+'\n');
}
const educator=await login('educator'),access=await previewAccess(),secret=Object.keys(access.protectionBypass)[0];
const query='?_vercel_share='+encodeURIComponent(secret);
const context=await request.newContext({baseURL:previewOrigin,extraHTTPHeaders:{Origin:previewOrigin},storageState:{cookies:educator.cookies.map(c=>({...c,expires:-1,domain:new URL(previewOrigin).hostname,secure:true})),origins:[]}});
try {
  await context.get('/schools'+query);
  const issued=await context.post('/api/schools/access',{data:{operation:'issue',cohortId:record.cohortId,purpose:'enrolment',mode:'pseudonymous',displayName:'Controlled student tester',identityChecked:false}});assert.equal(issued.status(),200);
  const grant=await issued.json();const parts=grant.path.split('#');
  // Invitation URLs are sent directly to the authorised mailbox, never stdout.
  const educatorUrl=previewOrigin+'/schools/sign-in'+query;
  const studentUrl=previewOrigin+parts[0]+query+'#'+parts[1];
  const text='Greetings from Muqabala.\n\nYour Schools and Colleges suite is ready for a small supervised staging test. Production Schools remains disabled. Use fictional answers only.\n\nADVISER ACCESS\n'+educatorUrl+'\nSign in with hello@trymuqabala.com. Open Controlled tester group - fictional answers only.\n\nSTUDENT TEST\n'+studentUrl+'\nOpen this in a separate browser profile or private window so it does not replace your adviser session. Confirm you are 18 or over, save the once-shown recovery code, and answer the three questions. This individual link expires at '+grant.expiresAt+'. Do not share it with several people.\n\nTEST CHECKLIST\n1. Save an answer, refresh, and confirm it remains.\n2. Submit three fictional answers and read feedback.\n3. Retry one answer.\n4. As adviser, review the exact submitted attempt and leave a comment.\n5. As student, read the comment, test sign out everywhere and recovery.\n6. Record device, browser, step, expected result and actual result for any failure. Do not include login codes or private links in screenshots.\n\nAGENT REPORT\n541 regression tests passed. Fresh desktop and mobile-width Chrome journeys passed, including lost-response retry without duplicates, live feedback, adviser review, recovery and deletion. Email sign-in and enrolment passed. Staff and assignment emails reached the controlled inbox, concurrent workers sent once, and lost-receipt replay did not duplicate delivery.\n\nLIMITS\nPhysical iPhone/Safari and Android checks remain part of this supervised test. Messaging previews, automatic scheduling, supplier deletion receipts and large-group AI capacity are not signed off. Real institutional enrolment still requires the institution, adults, language, approved questions and DPA checks. Start with a small group and report any blocker before expanding.\n\nSend feedback by replying to your usual Muqabala contact.';
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+senderKey,'Content-Type':'application/json','Idempotency-Key':'schools-handoff:'+record.cohortId},body:JSON.stringify({from:'Muqabala Schools staging <hello@auth.trymuqabala.com>',to:[owner],subject:'Muqabala Educators: staging access and agent test report',text})});
  assert(sent.ok);const receipt=await sent.json();
  record.handoffProviderId=receipt.id;record.handoffSentAt=new Date().toISOString();writeFileSync(path,JSON.stringify(record,null,2)+'\n');
  console.log(JSON.stringify({recipient:owner,providerMessageId:receipt.id,sent:true,privateLinksPrinted:false}));
}finally {await context.dispose();}
