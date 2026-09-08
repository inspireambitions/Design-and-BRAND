import './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
import {qaStage} from './schools-qa-errors.mjs';

qaStage('synthetic concurrency fixture');
const {admin,fixture:f}=await login('student');
assert.equal(f.stagingRef,'okrsezhospztwtptqhpo');
const assignment=randomUUID(),attempt=randomUUID();
const checks=[];
try {
  const a=await admin.from('schools_assignments').insert({id:assignment,cohort_id:f.cohorts[0],role_id:'Synthetic concurrency only',due_at:new Date(Date.now()+86400000).toISOString(),created_by:f.users.educator.id});assert(!a.error,'Synthetic assignment fixture');
  const b=await admin.from('schools_assignment_attempts').insert({id:attempt,assignment_id:assignment,student_user_id:f.users.student.id,attempt_number:1,status:'submitted',submitted_at:new Date().toISOString(),answers:['Synthetic only.','Synthetic only.','Synthetic only.']});assert(!b.error,'Synthetic attempt fixture');
  qaStage('twenty parallel feedback claims without model calls');
  const started=Date.now();
  const results=await Promise.all(Array.from({length:20},async()=>{
    const start=Date.now();const r=await admin.rpc('schools_claim_feedback',{attempt,claim:randomUUID()});
    assert(!r.error,'Feedback claim');return {claimed:!!r.data,ms:Date.now()-start};
  }));
  assert.equal(results.filter(r=>r.claimed).length,1);
  const stored=await admin.from('schools_assignment_attempts').select('feedback_tries,feedback_status').eq('id',attempt).single();assert(!stored.error);assert.equal(stored.data.feedback_tries,1);
  const times=results.map(r=>r.ms).sort((a,b)=>a-b);
  checks.push({check:'20 simultaneous requests for one submitted attempt reserve exactly one provider call',passed:true,requests:20,claims:1,totalMs:Date.now()-started,p50Ms:times[9],p95Ms:times[18],modelCalls:0});
  qaStage('attempt retry ceiling');
  for(let i=0;i<3;i++){
    const update=await admin.from('schools_assignment_attempts').update({feedback_status:'failed',feedback_claim:null}).eq('id',attempt);assert(!update.error);
    const r=await admin.rpc('schools_claim_feedback',{attempt,claim:randomUUID()});assert(!r.error);assert.equal(!!r.data,i<2);
  }
  checks.push({check:'Automatic feedback claim ceiling is three per attempt',passed:true,modelCalls:0});
  await writeFile(new URL('../../docs/evidence/schools-hosted-concurrency.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),stagingOnly:true,syntheticOnly:true,checks,limitation:'Database concurrency only. This does not measure 20 model generations, full page throughput or provider capacity.'},null,2)+'\n');
  console.log(JSON.stringify({checks,passed:true}));
}finally{
  // Keep the original test stage if cleanup follows an assertion failure.
  const deleted=await admin.from('schools_assignment_attempts').delete().eq('id',attempt);assert(!deleted.error,'Synthetic attempt cleanup');
  const removed=await admin.from('schools_assignments').delete().eq('id',assignment);assert(!removed.error,'Synthetic assignment cleanup');
}
