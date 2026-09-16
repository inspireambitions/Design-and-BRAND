// Local UI verification only: every enquiry/auth request is intercepted.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const origin=process.env.SCHOOLS_LANDING_ORIGIN??'http://localhost:3110';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const output=process.env.SCHOOLS_LANDING_OUTPUT??'/tmp/muqabala-schools-landing-review';
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[],pageErrors=[];
const fixture={institution:'Synthetic landing review',name:'Synthetic adviser',email:'landing-review@example.invalid',message:'Synthetic UI verification only.'};
const fill=async(page,values=fixture)=>{
  for(const [name,value] of Object.entries(values))await page.locator('#start-pilot [name="'+name+'"]').fill(value);
};
const send=page=>page.getByRole('button',{name:'Send pilot enquiry',exact:true});
const receipt=page=>page.locator('#start-pilot [role="status"]');
const payloads=[];
// Model the backend's atomic idempotency contract without writing to staging.
const savedEnquiries=new Map();
let simulatedEmailJobs=0;
let mode='failure',release;
const handleEnquiry=async route=>{
  const payload=route.request().postDataJSON();
  payloads.push(payload);
  if(mode==='slow')await new Promise(resolve=>{release=resolve;});
  const respond=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(mode==='failure')return respond(503,{error:'Please try again later.'});
  const {submissionId,...details}=payload;
  let saved=savedEnquiries.get(submissionId);
  if(saved&&JSON.stringify(saved.details)!==JSON.stringify(details))return respond(409,{error:'Submission content mismatch'});
  if(!saved){
    saved={details,receipt:{reference:'PILOT-'+submissionId,acknowledgement:mode==='unavailable'?'unavailable':'queued'}};
    savedEnquiries.set(submissionId,saved);
    simulatedEmailJobs++;
  }
  if(mode==='lost')return route.abort('failed');
  return respond(200,mode==='malformed'?{reference:saved.receipt.reference}:saved.receipt);
};
async function newContext(options={}){
  const context=await browser.newContext(options);
  // Block telemetry and all unmocked writes, including email sign-in.
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin)return route.abort();
    if(!['GET','HEAD'].includes(request.method()))return route.fulfill({status:503,body:'Blocked by local UI test'});
    return route.continue();
  });
  await context.route('**/api/schools/pilot-contact',handleEnquiry);
  context.on('page',page=>page.on('pageerror',error=>pageErrors.push(error.message)));
  return context;
}
try {
  await mkdir(output,{recursive:true});
  for(const width of [1280,375]) {
    const context=await newContext({viewport:{width,height:900}}),page=await context.newPage();
    await page.goto(origin+'/schools');
    await page.getByRole('heading',{name:'Enquire about a school pilot',exact:true}).waitFor();
    await send(page).waitFor();
    assert.equal(await page.locator('header').getByRole('link',{name:'Muqabala',exact:true}).getAttribute('href'),'/');
    await page.getByRole('figure').getByText('C. D.',{exact:true}).waitFor();
    await page.locator('#sample-report').getByText('Adviser correction:',{exact:true}).waitFor();
    const access=page.getByRole('complementary',{name:'Existing or invited access'});
    assert.equal(await access.getByRole('link',{name:'Educator or administrator sign-in'}).getAttribute('href'),'/schools/sign-in?role=educator');
    assert.equal(await access.getByRole('link',{name:'Student access',exact:true}).getAttribute('href'),'/schools/access#student-access');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:output+'/landing-'+width+'.png',fullPage:true});
    checks.push({width,horizontalOverflow:false,prominentAccess:true});
    if(width===375) {
      assert.equal(await page.getByRole('textbox',{name:'Email for our reply',exact:true}).count(),1);
      await send(page).click();
      assert.equal(await page.locator('[aria-invalid="true"]').count(),4);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'pilot-institution');
      await fill(page,{...fixture,email:'invalid'});
      await send(page).click();
      await page.getByText('Enter a valid email address.',{exact:true}).waitFor();
      assert.equal(payloads.length,0);
      await fill(page);
      await send(page).click();
      await page.getByRole('alert').filter({hasText:'Please try again later.'}).waitFor();
      assert.equal(await page.locator('[name="institution"]').inputValue(),fixture.institution);
      const firstId=payloads.at(-1).submissionId;
      assert.match(firstId,/^[0-9a-f-]{36}$/i);
      assert.deepEqual(Object.keys(payloads.at(-1)).sort(),['email','institution','message','name','submissionId']);
      mode='slow';
      await send(page).click();
      await page.getByRole('button',{name:'Sending enquiry…',exact:true}).waitFor();
      assert.equal(await page.getByRole('button',{name:'Sending enquiry…',exact:true}).isDisabled(),true);
      assert.equal(await page.locator('[name="email"]').isDisabled(),true);
      await page.waitForFunction(()=>document.querySelector('#start-pilot form').getAttribute('aria-busy')==='true');
      while(!release)await new Promise(resolve=>setTimeout(resolve,10));
      // A programmatic second submit must also be suppressed.
      const before=payloads.length;
      await page.locator('#start-pilot form').evaluate(form=>form.requestSubmit());
      assert.equal(payloads.length,before);
      mode='queued';release();release=null;
      await receipt(page).filter({hasText:'Your pilot enquiry is saved.'}).waitFor();
      assert.equal(payloads.at(-1).submissionId,firstId);
      assert.match(await receipt(page).innerText(),/An email receipt is queued\. Keep this reference if it does not arrive\./);
      assert.doesNotMatch(await receipt(page).innerText(),/receipt will follow/i);
      assert.match(await receipt(page).innerText(),/l\*\*\*@example.invalid/);
      assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('role')),'status');
      const stored=await page.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage).filter(([key])=>key.startsWith('schools.pilot.'))));
      assert.deepEqual(JSON.parse(stored['schools.pilot.receipt.v1']),{reference:'PILOT-'+firstId,maskedEmail:'l***@example.invalid'});
      for(const raw of Object.values(fixture))assert.equal(JSON.stringify(stored).includes(raw),false);
      await page.reload();
      await receipt(page).filter({hasText:'PILOT-'+firstId}).waitFor();
      assert.equal(await page.locator('#start-pilot form').count(),0);
      await page.getByRole('button',{name:'Start a new enquiry',exact:true}).click();
      await fill(page);
      mode='unavailable';
      await send(page).click();
      await receipt(page).filter({hasText:'Email confirmation is currently unavailable.'}).waitFor();
      assert.notEqual(payloads.at(-1).submissionId,firstId);
      checks.push({fieldValidation:true,retryUsesSameId:true,sendingState:true,receiptFocus:true,maskedStorage:true,refreshReceipt:true,newEnquiryRotatesId:true,unavailableReceipt:true});

      await page.getByRole('button',{name:'Start a new enquiry',exact:true}).click();
      await fill(page);
      mode='lost';await send(page).click();
      await page.getByRole('alert').filter({hasText:'could not confirm'}).waitFor();
      const lostId=payloads.at(-1).submissionId;
      const lostReference=savedEnquiries.get(lostId).receipt.reference;
      const jobsAfterLostResponse=simulatedEmailJobs;
      await page.reload();
      await page.getByText(/A previous enquiry may have been saved/).waitFor();
      assert.equal(await page.locator('[name="message"]').inputValue(),'');
      await fill(page,{...fixture,message:'Accidental typo on recovery'});
      mode='queued';await send(page).click();
      await page.getByRole('alert').filter({hasText:'already saved with different details'}).waitFor();
      assert.equal(payloads.at(-1).submissionId,lostId);
      assert.equal(await send(page).isDisabled(),false);
      assert.equal(simulatedEmailJobs,jobsAfterLostResponse);
      await fill(page);
      mode='malformed';await send(page).click();
      await page.getByRole('alert').filter({hasText:'could not confirm'}).waitFor();
      assert.equal(payloads.at(-1).submissionId,lostId);
      mode='queued';await send(page).click();
      await receipt(page).filter({hasText:lostReference}).waitFor();
      assert.equal(payloads.at(-1).submissionId,lostId);
      assert.equal(simulatedEmailJobs,jobsAfterLostResponse);
      checks.push({lostResponseRefreshConflictCorrection:true,correctedRetryPreservesUuidAndReference:true,noAdditionalSimulatedEmailJob:true,malformedResponseRetry:true});

      await page.getByRole('button',{name:'Start a new enquiry',exact:true}).click();
      await fill(page);
      mode='lost';await send(page).click();
      await page.getByRole('alert').filter({hasText:'could not confirm'}).waitFor();
      const separateId=payloads.at(-1).submissionId;
      await fill(page,{...fixture,message:'Intentionally edited enquiry'});
      mode='queued';await send(page).click();
      await page.getByRole('alert').filter({hasText:'already saved with different details'}).waitFor();
      assert.equal(payloads.at(-1).submissionId,separateId);
      await page.getByRole('button',{name:'Start a new enquiry with these details',exact:true}).click();
      assert.equal(await page.locator('[name="message"]').inputValue(),'Intentionally edited enquiry');
      mode='queued';await send(page).click();
      await receipt(page).filter({hasText:'Your pilot enquiry is saved.'}).waitFor();
      assert.notEqual(payloads.at(-1).submissionId,separateId);
      await page.screenshot({path:output+'/receipt-375.png',fullPage:true});
      checks.push({contentConflictRotatesUuidOnlyForExplicitNewEnquiry:true});

      await page.goto(origin+'/schools/access');
      await page.getByRole('heading',{name:'Access your school workspace',exact:true}).waitFor();
      await page.waitForLoadState('networkidle');
      await page.getByRole('link',{name:'Educator or administrator sign-in',exact:true}).click();
      await page.getByRole('heading',{name:'Educator and administrator sign-in',exact:true}).waitFor();
      let authPayload;
      await page.route('**/api/auth/request',async route=>{
        authPayload=route.request().postDataJSON();
        await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic sign-in test; no email sent.'})});
      });
      await page.locator('input[type="email"]').fill('fixture@example.invalid');
      await page.locator('form button[type="submit"]').first().click();
      await page.getByRole('alert').filter({hasText:'Synthetic sign-in test'}).waitFor();
      assert.equal(authPayload.next,'/schools/home');
      await page.goto(origin+'/schools/sign-in?role=student');
      await page.getByRole('heading',{name:'Student email sign-in',exact:true}).waitFor();
      await page.locator('input[type="email"]').fill('fixture@example.invalid');
      await page.locator('form button[type="submit"]').first().click();
      await page.getByRole('alert').filter({hasText:'Synthetic sign-in test'}).waitFor();
      assert.equal(authPayload.next,'/schools/me');
      await page.getByRole('link',{name:'Use a student private link or recovery code',exact:true}).click();
      await page.waitForURL('**/schools/enrol');
      checks.push({educatorSignInDestination:true,studentSignInDestination:true,privateLinkRoute:true});
    }
    await context.close();
  }

  const blocked=await newContext({viewport:{width:375,height:900}});
  await blocked.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new Error('Storage disabled for test');}}));
  const page=await blocked.newPage();
  await page.goto(origin+'/schools');await fill(page);
  mode='failure';await send(page).click();await page.getByRole('alert').waitFor();
  const blockedId=payloads.at(-1).submissionId;
  mode='queued';await send(page).click();
  await receipt(page).filter({hasText:'Your pilot enquiry is saved.'}).waitFor();
  assert.equal(payloads.at(-1).submissionId,blockedId);
  await page.getByRole('note').filter({hasText:'cannot remember your receipt'}).waitFor();
  checks.push({storageDisabledSubmissionAndRetry:true});
  await blocked.close();
  assert.deepEqual(pageErrors,[]);
  const evidence={checkedAt:new Date().toISOString(),origin,physicalDevice:false,requestsMocked:true,externalWrites:false,checks};
  await writeFile(output+'/results.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
} catch(error) {
  for(const context of browser.contexts())for(const page of context.pages()) {
    console.error(JSON.stringify({url:page.url(),headings:await page.locator('h1').allTextContents(),pageErrors,checks}));
    await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});
  }
  throw error;
} finally {await browser.close();}
