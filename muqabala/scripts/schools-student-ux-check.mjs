import {qaStage as setStage,qaFailure} from './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
function qaStage(stage){setStage(stage);console.log(JSON.stringify({stage}));}
const {chromium}=createRequire(import.meta.url)(process.env.SCHOOLS_QA_PLAYWRIGHT);
const browser=await chromium.launch({channel:'chrome',headless:true}),origin='http://localhost:3110',checks=[];
try{
 qaStage('enrolment widths and progress');
 for(const width of [848,375]){
 const page=await browser.newPage({viewport:{width,height:900}});
 await page.goto(origin+'/schools/enrol');await page.getByRole('heading',{level:1}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByLabel('Private link code or recovery code').fill('synthetic-invalid-code');await page.getByLabel('I confirm I am aged 18 or over').check();
 await page.route('**/api/schools/access',async route=>{await new Promise(r=>setTimeout(r,11000));await route.fulfill({status:503,json:{error:'Please try again.'}});});
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('progressbar').waitFor();
 await page.getByText(/Still working/).waitFor({timeout:15000});await page.getByRole('alert').waitFor();
 assert.equal(await page.getByLabel('Private link code or recovery code').inputValue(),'synthetic-invalid-code');
 await page.screenshot({path:'output/playwright/schools-enrol-fixes-'+width+'.png',fullPage:true});await page.close();checks.push('Enrolment '+width+'px: no overflow, progress, slow response cue and retained code');}
 qaStage('student retry and feedback updates');
 qaStage('synthetic login');const student=await login('student'),{admin,fixture:f}=student;
 qaStage('synthetic assignment');const links=await admin.from('schools_assignment_questions').select('question_version_id').eq('assignment_id',f.assignments[0]).order('question_index');assert(!links.error);
 const created=await admin.rpc('schools_manage_action',{actor:f.users.educator.id,operation:'assignment',device:'server',payload:{cohortId:f.cohorts[0],roleId:'Student placement',questionIds:links.data.map(q=>q.question_version_id),dueAt:new Date(Date.now()+86400000).toISOString()}});assert(!created.error);
 const assignment=created.data.id,context=await browser.newContext({viewport:{width:375,height:900},extraHTTPHeaders:{Origin:origin}});await context.addCookies(student.cookies);const page=await context.newPage();
 qaStage('student page');await page.goto(origin+'/schools/me/'+assignment);assert.equal(await page.locator('header a[href="/schools/cohorts"]').count(),0);
 qaStage('cohort denial');const cohortResponse=await context.request.get(origin+'/schools/cohorts');assert.equal(cohortResponse.status(),404);checks.push('Student cohort navigation hidden and direct route returns 404');
 const text='Our tutor asked for clearer notes. I added headings and checked each step with my classmate. We finished the next task without confusion.';
 await page.route('**/api/schools',async route=>{if(route.request().postDataJSON()?.operation==='draft')await new Promise(resolve=>setTimeout(resolve,1000));await route.continue();});
 qaStage('answer fields');for(const field of await page.getByRole('textbox',{name:'Your answer',exact:true}).all())await field.fill(text);
 assert.match(await page.locator('textarea').first().evaluate(e=>getComputedStyle(e).fontFamily),/Arial/);
 await page.route('**/api/schools/feedback',route=>route.fulfill({status:202,json:{ready:false}}));
 let polls=0;const detail=Array.from({length:3},(_,q)=>({questionIndex:q,improvement:'Add what happened next.',elements:Array.from({length:4},(_,e)=>({id:'e'+e,present:true,supportingText:text,confidence:e===0?'medium':'high'}))}));
 await page.route('**/api/schools/feedback?*',route=>route.fulfill({json:++polls<2?{feedback_status:'processing'}:{feedback_status:'ready',evidence_detail:detail,evidence_covered:12}}));
 qaStage('submit and automatic feedback');await page.getByRole('button',{name:'Submit answers',exact:true}).click();await page.getByRole('heading',{name:'Your private feedback',exact:true}).waitFor({timeout:30000});
 qaStage('confidence');assert(polls>=2);assert.equal(await page.getByText(/Confidence: high/).count(),0);assert.equal(await page.getByText(/Confidence: medium/).count(),3);checks.push('Submit click queues behind delayed blur autosave');checks.push('Pending feedback appears without reload; student high confidence hidden; medium retained; normal form font');
 const before=await admin.from('schools_assignment_attempts').select('id').eq('assignment_id',assignment).eq('status','submitted').single();assert(!before.error);
 qaStage('retry button');await page.getByRole('button',{name:'Retry question 1',exact:true}).click();await page.getByRole('button',{name:'Submit answers',exact:true}).waitFor();assert.equal(await page.locator('textarea').first().isEnabled(),true);assert.equal(await page.locator('textarea').first().inputValue(),text);checks.push('Feedback retry button opens a separate prefilled draft');
 await page.getByRole('button',{name:'Submit answers',exact:true}).click();await page.getByRole('heading',{name:'Your answers are saved',exact:true}).waitFor();
 qaStage('retry query');await page.goto(origin+'/schools/me/'+assignment+'?retry=1');await page.getByRole('button',{name:'Submit answers',exact:true}).waitFor();assert.equal(await page.locator('textarea').first().isEnabled(),true);
 const attempts=await admin.from('schools_assignment_attempts').select('id,status,attempt_number').eq('assignment_id',assignment).order('attempt_number');assert(!attempts.error);assert.deepEqual(attempts.data.map(a=>a.status),['submitted','submitted','draft']);checks.push('Retry URL opens draft directly and preserves both submitted attempts');
 const denied=await context.request.get(origin+'/api/schools/feedback?attemptId='+f.assignments[1]);assert.equal(denied.status(),404);checks.push('Feedback status endpoint rejects inaccessible attempt');
 await writeFile('../docs/evidence/schools-student-ux-fixes.json',JSON.stringify({checkedAt:new Date().toISOString(),syntheticOnly:true,origin,physicalDevice:false,feedbackTransition:'simulated pending then ready, real draft and retry storage',assignment,checks},null,2));console.log(JSON.stringify({checks}));
}catch{qaFailure();}finally{await browser.close();}

