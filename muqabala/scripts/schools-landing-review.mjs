import {qaStage,qaFailure} from './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const origin=process.env.SCHOOLS_LANDING_ORIGIN??'http://localhost:3110';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[];let enquiryReference;
try {
  await mkdir('output/playwright',{recursive:true});
  for(const width of [1280,375]) {
    qaStage('landing layout');const page=await browser.newPage({viewport:{width,height:900}});
    await page.goto(origin+'/schools');await page.getByRole('heading',{level:1}).waitFor();
    assert.equal(await page.locator('header').getByRole('link',{name:'Muqabala',exact:true}).getAttribute('href'),'/');
    await page.getByRole('figure').getByText('C. D.',{exact:true}).waitFor();
    await page.locator('#sample-report').getByText('Adviser correction:',{exact:true}).waitFor();
    assert.equal(await page.locator('footer nav a').count(),4);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:'output/playwright/schools-landing-review-'+width+'.png',fullPage:true});
    checks.push({width,horizontalOverflow:false,reviewAndCohortVisible:true});
    if(width===375) {
      qaStage('pilot form recovery');const form=page.locator('#start-pilot form');
      await form.getByLabel('Institution',{exact:true}).fill('Synthetic landing review');
      await form.getByLabel('Your name',{exact:true}).fill('Synthetic adviser');
      await form.getByLabel('Email',{exact:true}).fill('landing-review@example.invalid');
      await form.getByLabel('Message',{exact:true}).fill('Synthetic UI verification only. Please discard this enquiry.');
      await page.route('**/api/schools/pilot-contact',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Please try again later.'})}),{times:1});
      await form.getByRole('button',{name:'Send pilot enquiry'}).click();
      await page.getByRole('status').filter({hasText:'Please try again later.'}).waitFor();
      assert.equal(await form.getByLabel('Institution',{exact:true}).inputValue(),'Synthetic landing review');
      await page.unrouteAll({behavior:'wait'});
      qaStage('pilot form real submission');
      const response=page.waitForResponse(r=>r.url().endsWith('/api/schools/pilot-contact')&&r.request().method()==='POST');
      await form.getByRole('button',{name:'Send pilot enquiry'}).click();
      const saved=await response;assert.equal(saved.status(),200);enquiryReference=(await saved.json()).reference;
      await page.getByRole('status').filter({hasText:'Your pilot enquiry is saved.'}).waitFor();assert.equal(await form.count(),0);
      await page.screenshot({path:'output/playwright/schools-pilot-form-success-375.png',fullPage:true});
      checks.push({formFailurePreservesInput:true,realFormSubmission:200,successState:true});
    }
    await page.close();
  }
  const evidence={checkedAt:new Date().toISOString(),origin,physicalDevice:false,checks,enquiryReference};
  await writeFile('../docs/evidence/schools-landing-review.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}catch{qaFailure();}finally{await browser.close();}
