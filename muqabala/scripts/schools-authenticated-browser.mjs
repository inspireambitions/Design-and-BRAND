import './schools-qa-errors.mjs';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
const playwrightPath=process.env.SCHOOLS_QA_PLAYWRIGHT;
if(!playwrightPath)throw new Error('Set the local Playwright module path.');
const {chromium}=require(playwrightPath);
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const identity=await login('student');
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addCookies(identity.cookies);
  const page=await context.newPage();
  await page.goto('http://localhost:3110/schools/me/'+identity.fixture.assignments[0]);
  await page.getByRole('heading',{name:'Student placement',exact:true}).waitFor();
  await mkdir('output/playwright',{recursive:true});
  await page.screenshot({path:'output/playwright/schools-student-practice.png',fullPage:true});
  const visible=await page.locator('body').innerText();
  await writeFile('output/playwright/schools-student-practice.txt',visible);
  console.log(visible);
  if(process.argv.includes('--journey')){
    const checks=[];
    const answers=['Our class project was due on Friday. I made a task list and checked who could help. We finished on time.','Our project materials were late. I found another supplier and asked the tutor to check the order. The project continued.','My tutor asked for clearer notes. I used headings and asked a classmate to check them. We could follow the notes.'];
    const fields=page.getByRole('textbox',{name:'Your answer',exact:true});
    const saved=page.waitForResponse(r=>r.url().endsWith('/api/schools')&&r.request().postDataJSON()?.operation==='draft'&&r.ok(),{timeout:45000});
    await fields.nth(0).focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(answers[0]);
    await saved;await page.getByRole('status').filter({hasText:'Draft saved.'}).waitFor();
    await page.reload();if(await fields.nth(0).inputValue()!==answers[0])throw new Error('Autosaved draft did not resume');checks.push('Timed autosave and refresh resume');
    const educator=await login('educator');
    const drafts=await educator.session.from('schools_assignment_attempts').select('id').eq('assignment_id',identity.fixture.assignments[0]);
    if(drafts.error||drafts.data.length)throw new Error('Adviser could read a draft');checks.push('Hosted adviser draft privacy');
    for(let n=1;n<3;n++){await fields.nth(n).focus();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type(answers[n]);}
    await page.getByRole('button',{name:'Save draft',exact:true}).click();
    await page.getByRole('button',{name:'Submit answers',exact:true}).waitFor();
    let lost=false;
    await page.route('**/api/schools',async route=>{if(route.request().postDataJSON()?.operation==='submit'&&!lost){lost=true;const response=await route.fetch();if(!response.ok())throw new Error('Synthetic submit failed before response loss');await route.abort('failed');}else await route.continue();});
    await page.getByRole('button',{name:'Submit answers',exact:true}).click();
    await page.getByRole('alert').first().waitFor();
    if(await fields.nth(0).inputValue()!==answers[0])throw new Error('Response loss erased answer');
    await page.getByRole('button',{name:'Submit answers',exact:true}).click();
    await page.getByRole('heading',{name:'Your answers are saved',exact:true}).waitFor();
    const submitted=await identity.session.from('schools_assignment_attempts').select('id,answers').eq('assignment_id',identity.fixture.assignments[0]).eq('status','submitted');
    if(submitted.error||submitted.data.length!==1)throw new Error('Submission retry created duplicate attempts');checks.push('Lost submit response preserves answers and retries once');
    const attempt=submitted.data[0];const claim=randomUUID();
    const claimed=await identity.admin.rpc('schools_claim_feedback',{attempt:attempt.id,claim});if(claimed.error)throw new Error('Synthetic feedback claim failed');
    const detail=answers.map((answer,questionIndex)=>({questionIndex,improvement:'Describe one detail about the outcome.',elements:[0,1,2,3].map(i=>({id:'e'+i,present:i<2,supportingText:i<2?answer:'',confidence:'medium',start:i<2?0:null,end:i<2?answer.length:null}))}));
    const stored=await identity.admin.rpc('schools_store_feedback',{attempt:attempt.id,claim,model_name:'synthetic-ui-fixture',contract:'synthetic-ui-fixture',feedback:{questions:detail},detail,input_count:0,output_count:0});if(stored.error||!stored.data)throw new Error('Synthetic feedback fixture failed');
    await page.goto('http://localhost:3110/schools/me/reports/'+attempt.id);await page.screenshot({path:'output/playwright/schools-private-report.png',fullPage:true});
    const teacherContext=await browser.newContext();await teacherContext.addCookies(educator.cookies);const teacherPage=await teacherContext.newPage();
    await teacherPage.goto('http://localhost:3110/schools/cohorts/'+identity.fixture.cohorts[0]+'/review?attempt='+attempt.id);
    await writeFile('output/playwright/schools-review.txt',await teacherPage.locator('body').innerText());
    await teacherPage.screenshot({path:'output/playwright/schools-review.png',fullPage:true});
    await writeFile('../docs/evidence/schools-authenticated-browser.json',JSON.stringify({checkedAt:new Date().toISOString(),stagingRef:identity.fixture.stagingRef,checks,syntheticFeedback:true},null,2)+'\n');
    console.log(JSON.stringify({checks,syntheticFeedback:true}));
  }
}finally{await browser.close();}
