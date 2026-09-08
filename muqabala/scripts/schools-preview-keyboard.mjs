import {qaStage as setStage,qaFailure} from './schools-qa-errors.mjs';
function qaStage(stage){setStage(stage);console.log(JSON.stringify({stage}));}
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
import {previewAccess,previewOrigin} from './schools-preview-access.mjs';
import {createServerClient} from '@supabase/ssr';
import {stagingEnvironment} from './schools-staging-env.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const mode=process.argv.includes('--desktop')?'desktop':'mobile-emulation';
if(process.argv.includes('--cleanup-only')){
  qaStage('synthetic keyboard cleanup');const {admin,fixture}=await login('educator');
  const rows=await admin.from('schools_cohort_members').select('student_user_id').eq('cohort_id',fixture.cohorts[0]).eq('display_name','Synthetic keyboard learner');assert(!rows.error);
  for(const row of rows.data){
    assert(!Object.values(fixture.users).some(user=>user.id===row.student_user_id));
    const requested=await admin.rpc('schools_request_deletion',{actor:row.student_user_id});assert(!requested.error);
    const purged=await admin.rpc('schools_purge_local',{job_id:requested.data});assert(!purged.error);
    if(purged.data.deleteAuth){const guard=await admin.rpc('schools_can_delete_auth',{student:row.student_user_id});assert(!guard.error&&guard.data);assert(!(await admin.auth.admin.deleteUser(row.student_user_id)).error);assert(!(await admin.rpc('schools_privacy_auth_done',{job_id:requested.data,deleted:true})).error);}
  }
  console.log(JSON.stringify({syntheticLearnersDeleted:rows.data.length}));process.exit(0);
}
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[];
async function tabTo(page,locator,key='Enter'){
  await locator.waitFor({state:'visible'});
  for(let i=0;i<150;i++){
    if(await locator.evaluate(el=>el===document.activeElement&&!el.disabled)){await page.keyboard.press(key);return;}
    await page.keyboard.press('Tab');
  }
  console.log(JSON.stringify({step:'keyboard unreachable',target:await locator.evaluate(el=>({tag:el.tagName,disabled:!!el.disabled})),active:await page.evaluate(()=>({tag:document.activeElement?.tagName,focused:document.hasFocus(),buttons:Array.from(document.querySelectorAll('button')).length}))}));
  throw new Error('Keyboard control was unreachable');
}
try{
  qaStage('enrolment');
  const educator=await login('educator'),f=educator.fixture,access=await previewAccess();
  const share='/schools?_vercel_share='+encodeURIComponent(Object.keys(access.protectionBypass)[0]);
  const device=mode==='desktop'?{viewport:{width:1365,height:900}}:{viewport:{width:390,height:844},isMobile:true,hasTouch:true};
  const teacher=await browser.newContext({...device,extraHTTPHeaders:{Origin:previewOrigin}});await teacher.addCookies(educator.cookies.map(c=>({...c,domain:new URL(previewOrigin).hostname,secure:true})));
  const teacherPage=await teacher.newPage();await teacherPage.goto(previewOrigin+share);
  let recoveryCode;
  const student=await browser.newContext({...device,extraHTTPHeaders:{Origin:previewOrigin}}),page=await student.newPage();
  await page.goto(previewOrigin+share);
  if(process.argv.includes('--reuse')){
    const row=await educator.admin.from('schools_cohort_members').select('student_user_id').eq('cohort_id',f.cohorts[0]).eq('display_name','Synthetic keyboard learner').eq('status','active').order('joined_at',{ascending:false}).limit(1).single();assert(!row.error);
    const identity=await educator.admin.auth.admin.getUserById(row.data.student_user_id);assert(identity.data.user);
    const link=await educator.admin.auth.admin.generateLink({type:'magiclink',email:identity.data.user.email});assert(!link.error);
    const c=stagingEnvironment();let cookies=[];
    const client=createServerClient(c.SUPABASE_URL,c.SUPABASE_PUBLISHABLE_KEY||c.SUPABASE_ANON_KEY,{cookies:{getAll:()=>cookies,setAll:values=>{for(const value of values){cookies=cookies.filter(item=>item.name!==value.name);cookies.push(value);}}}});
    assert(!(await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'magiclink'})).error);
    const claims=await client.auth.getClaims();assert(!claims.error);assert(!(await educator.admin.from('schools_sessions').insert({session_id:claims.data.claims.session_id,user_id:row.data.student_user_id})).error);
    await student.addCookies(cookies.map(c=>({name:c.name,value:c.value,domain:new URL(previewOrigin).hostname,path:'/',secure:true,sameSite:'Lax'})));
    const existing=await educator.admin.from('schools_assignment_attempts').select('id,status').eq('assignment_id',f.assignments[0]).eq('student_user_id',row.data.student_user_id).order('attempt_number',{ascending:false}).limit(1).maybeSingle();assert(!existing.error);
    if(existing.data?.status==='submitted'){const retry=await student.request.post(previewOrigin+'/api/schools',{data:{operation:'retry',payload:{attemptId:existing.data.id}}});assert.equal(retry.status(),200);}
    await page.goto(previewOrigin+'/schools/me');checks.push('Existing synthetic learner reused for focused network diagnosis');
  }else{
  const issued=await teacher.request.post(previewOrigin+'/api/schools/access',{data:{operation:'issue',cohortId:f.cohorts[0],purpose:'enrolment',mode:'pseudonymous',displayName:'Synthetic keyboard learner',identityChecked:false}});console.log(JSON.stringify({step:'issue enrolment',status:issued.status()}));assert.equal(issued.status(),200);
  const invitation=await issued.json();
  await page.goto(previewOrigin+invitation.path);
  await page.getByLabel('Private link code or recovery code').waitFor();
  await tabTo(page,page.getByLabel('I confirm I am aged 18 or over'),'Space');
  const enrolResponse=page.waitForResponse(r=>r.url().endsWith('/api/schools/access')&&r.request().method()==='POST');
  await tabTo(page,page.getByRole('button',{name:'Continue',exact:true}));
  const enrolledResponse=await enrolResponse;console.log(JSON.stringify({step:'redeem enrolment',status:enrolledResponse.status()}));const enrolled=await enrolledResponse.json();assert(enrolled.recoveryCode);recoveryCode=enrolled.recoveryCode;
  await page.getByRole('heading',{name:'Your account is available',exact:true}).waitFor();
  await tabTo(page,page.getByRole('link',{name:'I have saved the code. Continue',exact:true}));
  await page.waitForURL('**/schools/me');checks.push('Keyboard-only pseudonymous enrolment and recovery-code acknowledgement');
  }
  const studentRow=await educator.admin.from('schools_cohort_members').select('student_user_id').eq('cohort_id',f.cohorts[0]).eq('display_name','Synthetic keyboard learner').eq('status','active').order('joined_at',{ascending:false}).limit(1).single();assert(!studentRow.error);const studentId=studentRow.data.student_user_id;
  const previous=await educator.admin.from('schools_assignment_attempts').select('id').eq('assignment_id',f.assignments[0]).eq('student_user_id',studentId).eq('status','submitted');assert(!previous.error);
  qaStage('answer and autosave');
  const assignment=page.locator('a[href="/schools/me/'+f.assignments[0]+'"]');await assignment.waitFor();await tabTo(page,assignment);
  await page.getByRole('textbox',{name:'Your answer',exact:true}).first().waitFor();
  const answers=['Our class project was due Friday. I made a task list and agreed jobs with two classmates. We finished Thursday.','Our project materials were late. I called another supplier and agreed the new order with my tutor. We completed the model on time.','My tutor asked for clearer notes. I added headings and asked a classmate to check the steps. We completed the next task without confusion.'];
  for(let n=0;n<3;n++){
    const field=page.getByRole('textbox',{name:'Your answer',exact:true}).nth(n);await tabTo(page,field,'ControlOrMeta+A');await page.keyboard.type(answers[n]);
    await page.keyboard.press('Tab');
  }
  let savedAll=false;
  for(let check=0;check<30;check++){
    const draft=await educator.admin.from('schools_assignment_attempts').select('answers').eq('assignment_id',f.assignments[0]).eq('student_user_id',studentId).eq('status','draft').maybeSingle();assert(!draft.error);
    if(JSON.stringify(draft.data?.answers)===JSON.stringify(answers)){savedAll=true;break;}
    await page.waitForTimeout(1000);
  }
  assert(savedAll);
  await page.reload();for(let n=0;n<3;n++)assert.equal(await page.getByRole('textbox',{name:'Your answer',exact:true}).nth(n).inputValue(),answers[n]);checks.push('All three keyboard answers and autosaves survive refresh on the preview');
  qaStage('lost submission response');
  let lost=false,routeFailed=false;await page.route('**/api/schools',async route=>{try{if(route.request().postDataJSON()?.operation==='submit'&&!lost){lost=true;const response=await route.fetch({timeout:60000});console.log(JSON.stringify({step:'intercepted submission',status:response.status()}));assert(response.ok());await route.abort('failed');}else await route.continue();}catch{routeFailed=true;console.log(JSON.stringify({step:'intercept failed'}));await route.abort('failed').catch(()=>{});}});
  qaStage('first keyboard submit');await tabTo(page,page.getByRole('button',{name:'Submit answers',exact:true}));qaStage('lost response alert');await page.locator('p[role="alert"]').filter({hasText:/\S/}).waitFor();
  console.log(JSON.stringify({step:'before retry',submitButtons:await page.getByRole('button',{name:'Submit answers',exact:true}).count(),savedHeadings:await page.getByRole('heading',{name:'Your answers are saved',exact:true}).count(),focusTag:await page.evaluate(()=>document.activeElement?.tagName)}));
  qaStage('keyboard submit retry');await tabTo(page,page.getByRole('button',{name:'Submit answers',exact:true}));qaStage('submitted heading');await page.getByRole('heading',{name:'Your answers are saved',exact:true}).waitFor();checks.push('Keyboard recovery from a lost submission response on Vercel');
  assert.equal(routeFailed,false);await page.unrouteAll({behavior:'wait'});qaStage('read feedback');
  const submittedRows=await educator.admin.from('schools_assignment_attempts').select('id').eq('assignment_id',f.assignments[0]).eq('student_user_id',studentId).eq('status','submitted').order('attempt_number',{ascending:false});assert(!submittedRows.error);assert.equal(submittedRows.data.length,previous.data.length+1);const attemptId=submittedRows.data[0].id;checks.push('Lost response retry creates exactly one submitted attempt');
  await page.getByRole('heading',{name:'Your private feedback',exact:true}).waitFor({timeout:130000});
  await page.getByRole('heading',{name:'Add this first',exact:true}).waitFor();checks.push('Keyboard-only live feedback reading');
  await page.screenshot({path:'output/playwright/schools-preview-keyboard-feedback-'+mode+'.png',fullPage:true});
  qaStage('adviser keyboard review');await teacherPage.goto(previewOrigin+'/schools/cohorts/'+f.cohorts[0]+'/review?attempt='+attemptId);
  await tabTo(teacherPage,teacherPage.getByLabel('Your view',{exact:true}),'Home');await teacherPage.keyboard.press('ArrowDown');
  await tabTo(teacherPage,teacherPage.getByLabel('Comment, up to 280 characters',{exact:true}),'ControlOrMeta+A');await teacherPage.keyboard.type('Synthetic keyboard review. Describe the result of your own action.');
  await tabTo(teacherPage,teacherPage.getByRole('button',{name:'Save review',exact:true}));await teacherPage.getByRole('status').filter({hasText:'Review saved.'}).waitFor();
  await page.goto(previewOrigin+'/schools/me/reports/'+attemptId);await page.getByText('Synthetic keyboard review. Describe the result of your own action.',{exact:true}).waitFor();checks.push('Adviser saves an attempt-bound review with keyboard controls and the student reads it privately');
  await page.goto(previewOrigin+'/schools/me/settings');await tabTo(page,page.getByRole('button',{name:'Sign out everywhere',exact:true}));await page.waitForURL('**/schools/sign-in');
  const denied=await student.request.post(previewOrigin+'/api/schools',{data:{operation:'support',payload:{cohortId:f.cohorts[0]}}});assert.equal(denied.status(),401);checks.push('Keyboard sign out everywhere closes access');
  if(recoveryCode){const recovered=await student.request.post(previewOrigin+'/api/schools/access',{data:{operation:'redeem',secret:recoveryCode,recovery:true,adultConfirmed:true}});assert.equal(recovered.status(),200);
  const deleted=await student.request.post(previewOrigin+'/api/schools/delete',{data:{confirm:true}});assert.equal(deleted.status(),200);assert((await deleted.json()).localDeleted);
  assert(!(await educator.admin.auth.admin.getUserById(studentId)).data.user);
  const remaining=await educator.admin.from('schools_cohort_members').select('id').eq('student_user_id',studentId);assert(!remaining.error&&remaining.data.length===0);
  checks.push('Disposable keyboard learner recovered and deleted after testing');}
  await writeFile('../docs/evidence/schools-preview-keyboard-'+mode+'.json',JSON.stringify({checkedAt:new Date().toISOString(),previewOrigin,mode,browser:'Chrome headless',physicalDevice:false,syntheticOnly:true,checks},null,2)+'\n');console.log(JSON.stringify({mode,checks}));
}catch{qaFailure();}finally{for(const context of browser.contexts()){for(const page of context.pages()){await page.unrouteAll({behavior:'ignoreErrors'}).catch(()=>{});}}await browser.close();}
