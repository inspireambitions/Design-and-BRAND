import {qaStage as stage,qaFailure} from './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
import {previewAccess,previewOrigin} from './schools-preview-access.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.SCHOOLS_QA_PLAYWRIGHT);
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
function qaStage(value){stage(value);console.log(JSON.stringify({stage:value}));}
try{
 qaStage('hosted synthetic login');const {admin,fixture:f,cookies}=await login('student'),access=await previewAccess();
 const context=await browser.newContext({viewport:{width:375,height:900},extraHTTPHeaders:{Origin:previewOrigin}});await context.addCookies(cookies.map(c=>({...c,domain:new URL(previewOrigin).hostname,secure:true})));const page=await context.newPage();
 await page.goto(previewOrigin+'/schools?_vercel_share='+encodeURIComponent(Object.keys(access.protectionBypass)[0]));
 const links=await admin.from('schools_assignment_questions').select('question_version_id').eq('assignment_id',f.assignments[0]).order('question_index');assert(!links.error);
 const assignment=await admin.rpc('schools_manage_action',{actor:f.users.educator.id,operation:'assignment',device:'server',payload:{cohortId:f.cohorts[0],roleId:'Student placement',questionIds:links.data.map(q=>q.question_version_id),dueAt:new Date(Date.now()+86400000).toISOString()}});assert(!assignment.error);
 await page.goto(previewOrigin+'/schools/me/'+assignment.data.id);await page.getByRole('textbox',{name:'Your answer',exact:true}).first().waitFor();assert.equal(await page.locator('header a[href="/schools/cohorts"]').count(),0);
 const answers=['Our class project was due Friday. I made a task list and agreed jobs with two classmates. We finished Thursday.','Our project materials were late. I called another supplier and agreed the new order with my tutor. We completed the model on time.','My tutor said my presentation slides had too much text. I rewrote them with one idea per slide and practised with a friend. In the next presentation I finished on time and the tutor said it was much clearer.'];
 for(let n=0;n<3;n++)await page.getByRole('textbox',{name:'Your answer',exact:true}).nth(n).fill(answers[n]);
 qaStage('real model feedback without reload');const start=Date.now();await page.getByRole('button',{name:'Submit answers',exact:true}).click();await page.getByRole('heading',{name:'Your private feedback',exact:true}).waitFor({timeout:140000});const feedbackSeconds=Math.round((Date.now()-start)/1000);
 const attempt=await admin.from('schools_assignment_attempts').select('id,feedback_status,evidence_detail,evidence_covered,feedback_version_id').eq('assignment_id',assignment.data.id).eq('status','submitted').single();assert(!attempt.error);const improvement=attempt.data.evidence_detail[2].improvement;
 assert(!/specify|rubric element|to better address|for clearer context|what feedback (was|you were) given/i.test(improvement));
 checks.push({check:'Real AI feedback appeared without reload',seconds:feedbackSeconds,status:attempt.data.feedback_status});checks.push({check:'Exact fictional Q3 regression',improvement,allElementsPresent:attempt.data.evidence_detail[2].elements.every(e=>e.present)});
 assert.equal(await page.getByText(/Confidence: high/).count(),0);
 qaStage('hosted retry');await page.getByRole('button',{name:/^Retry question [123]$/}).click();await page.getByRole('button',{name:'Submit answers',exact:true}).waitFor();assert.equal(await page.locator('textarea').first().isEnabled(),true);
 const rows=await admin.from('schools_assignment_attempts').select('status').eq('assignment_id',assignment.data.id).order('attempt_number');assert(!rows.error);assert.deepEqual(rows.data.map(row=>row.status),['submitted','draft']);checks.push({check:'Hosted retry creates one editable draft and preserves submission'});
 const denied=await context.request.get(previewOrigin+'/schools/cohorts');assert.equal(denied.status(),404);checks.push({check:'Hosted student cohort page returns 404'});
 await page.screenshot({path:'output/playwright/schools-hosted-student-fixes.png',fullPage:true});
 await writeFile('../docs/evidence/schools-hosted-student-fixes.json',JSON.stringify({checkedAt:new Date().toISOString(),previewOrigin,syntheticOnly:true,physicalDevice:false,checks},null,2)+'\n');console.log(JSON.stringify({checks}));
}catch{qaFailure();}finally{await browser.close();}
