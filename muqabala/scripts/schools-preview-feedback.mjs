import './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
import {previewAccess,previewOrigin} from './schools-preview-access.mjs';
const require=createRequire(import.meta.url),{request}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const identity=await login('student'),f=identity.fixture,access=await previewAccess();
const secret=Object.keys(access.protectionBypass)[0];if(!secret)throw new Error('No preview sharing grant');
const context=await request.newContext({baseURL:previewOrigin,extraHTTPHeaders:{Origin:previewOrigin},storageState:{cookies:identity.cookies.map(c=>({...c,domain:new URL(previewOrigin).hostname,secure:true,expires:-1})),origins:[]}});
try{
  const landing=await context.get('/schools?_vercel_share='+encodeURIComponent(secret));
  assert((await landing.text()).includes('Muqabala for Schools and Colleges'),'Preview protection did not open the school page');
  const latest=await identity.session.from('schools_assignment_attempts').select('id,feedback_status').eq('assignment_id',f.assignments[0]).eq('status','submitted').order('attempt_number',{ascending:false}).limit(1).single();assert(!latest.error);
  const response=await context.post('/api/schools/feedback',{data:{attemptId:latest.data.id},timeout:60000});
  assert.equal(response.status(),200,'Feedback endpoint returned '+response.status());assert((await response.json()).ready);
  const attempt=await identity.session.from('schools_assignment_attempts').select('feedback_status,evidence_covered,evidence_detail,feedback_version_id').eq('id',latest.data.id).single();assert(!attempt.error);
  const version=await identity.session.from('schools_feedback_versions').select('model,provider,contract_version').eq('id',attempt.data.feedback_version_id).single();assert(!version.error);
  assert.equal(version.data.model,'gpt-4.1-mini');assert.equal(attempt.data.evidence_detail.length,3);
  assert.equal(attempt.data.evidence_covered,attempt.data.evidence_detail.reduce((sum,q)=>sum+q.elements.filter(e=>e.present).length,0));
  const report=await context.get('/schools/me/reports/'+latest.data.id);assert.equal(report.status(),200);
  const evidence={checkedAt:new Date().toISOString(),previewOrigin,syntheticOnly:true,provider:version.data.provider,model:version.data.model,contract:version.data.contract_version,evidenceCovered:attempt.data.evidence_covered,detail:attempt.data.evidence_detail,checks:['Protected preview opens with the scoped share link','Live provider returns and stores answer-text feedback','Stored evidence count matches the rubric elements','Private report renders on Vercel']};
  await writeFile('../docs/evidence/schools-preview-feedback.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({checks:evidence.checks,model:evidence.model,evidenceCovered:evidence.evidenceCovered}));
}finally{await context.dispose();}
