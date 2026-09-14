import './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
import {previewAccess,previewOrigin} from './schools-preview-access.mjs';

const require=createRequire(import.meta.url),{request}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const student=await login('student'),{fixture:f,admin}=student,access=await previewAccess();
assert.equal(f.stagingRef,'okrsezhospztwtptqhpo');
const context=await request.newContext({baseURL:previewOrigin,extraHTTPHeaders:{Origin:previewOrigin},storageState:{cookies:student.cookies.map(c=>({...c,domain:new URL(previewOrigin).hostname,secure:true,expires:-1})),origins:[]}});
const answers=['Our class project was due on Friday. I made a list with the group and asked each person what help they needed. We split the remaining work and finished on Thursday.','Our materials arrived late. I found another supplier, asked the tutor to check the order and arranged collection with a classmate. We completed the model before class.','My tutor said my notes were hard to follow. I added headings and dates, then asked a classmate to check them. They could find each task and we finished the next activity without confusion.'];
const assignmentIds=[],attemptIds=[];
const startedAt=new Date().toISOString();
try{
  await context.get('/schools?_vercel_share='+encodeURIComponent(Object.keys(access.protectionBypass)[0]));
  const links=await admin.from('schools_assignment_questions').select('question_version_id').eq('assignment_id',f.assignments[0]).order('question_index');assert(!links.error);
  for(let n=0;n<5;n++){
    const created=await admin.rpc('schools_manage_action',{actor:f.users.educator.id,operation:'assignment',device:'server',payload:{cohortId:f.cohorts[0],roleId:'Synthetic capacity '+(n+1),questionIds:links.data.map(q=>q.question_version_id),dueAt:new Date(Date.now()+86400000).toISOString()}});
    assert(!created.error);assignmentIds.push(created.data.id);attemptIds.push(randomUUID());
  }
  const journeys=await Promise.all(assignmentIds.map(async(assignmentId,index)=>{
    const started=Date.now();
    const submitted=await context.post('/api/schools',{data:{operation:'submit',payload:{assignmentId,attemptId:attemptIds[index],revision:0,answers}}});
    assert.equal(submitted.status(),200,'Synthetic submission rejected');
    const response=await context.post('/api/schools/feedback',{data:{attemptId:attemptIds[index]},timeout:60000});
    const stored=await admin.from('schools_assignment_attempts').select('feedback_status,feedback_failure_code,feedback_claim,evidence_covered').eq('id',attemptIds[index]).single();assert(!stored.error);
    return {journey:index+1,httpStatus:response.status(),status:stored.data.feedback_status,failure:stored.data.feedback_failure_code,covered:stored.data.evidence_covered,claimId:stored.data.feedback_claim,latencyMs:Date.now()-started};
  }));
  assert(journeys.every(item=>item.httpStatus===200&&item.status==='ready'),'At least one feedback journey failed');
  const claims=journeys.map(item=>item.claimId).filter(Boolean);
  const usage=await admin.schema('schools_private').from('feedback_usage').select('claim_id,input_tokens,output_tokens,estimated_usd').in('claim_id',claims);assert(!usage.error);
  assert.equal(usage.data.length,5,'Every model call needs a usage receipt');
  const evidence={checkedAt:new Date().toISOString(),startedAt,stagingRef:f.stagingRef,previewOrigin,syntheticOnly:true,model:'gpt-4.1-mini',pricingUsdPerMillion:{input:0.40,output:1.60,source:'https://developers.openai.com/api/docs/models/gpt-4.1-mini'},modelCallCap:5,modelCalls:usage.data.length,results:journeys.map(({claimId,...item})=>item),usage:{inputTokens:usage.data.reduce((sum,item)=>sum+(item.input_tokens??0),0),outputTokens:usage.data.reduce((sum,item)=>sum+(item.output_tokens??0),0),estimatedUsd:Number(usage.data.reduce((sum,item)=>sum+Number(item.estimated_usd??0),0).toFixed(8))},limitation:'Five simultaneous synthetic journeys validate this preview path only. They do not establish classroom-scale or provider-wide capacity.'};
  await writeFile('../docs/evidence/schools-feedback-concurrency.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence));
}finally{
  if(attemptIds.length){
    await admin.from('schools_assignment_attempts').update({feedback_status:'failed',feedback_version_id:null,evidence_detail:null,evidence_covered:null}).in('id',attemptIds);
    await admin.from('schools_feedback_versions').delete().in('assignment_attempt_id',attemptIds);
    await admin.from('schools_assignment_attempts').delete().in('id',attemptIds);
  }
  if(assignmentIds.length){await admin.from('schools_assignment_questions').delete().in('assignment_id',assignmentIds);await admin.from('schools_assignments').delete().in('id',assignmentIds);}
  await context.dispose();
}
