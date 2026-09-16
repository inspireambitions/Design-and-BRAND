// Controlled production QA only. Private browser state stays outside the repository.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';

if(!process.argv.includes('--approved-production-qa'))throw new Error('Production QA approval required');
const require=createRequire(import.meta.url),{chromium}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const origin='https://trymuqabala.com';
const privateDir=process.env.SCHOOLS_QA_PRIVATE_DIR;
assert(privateDir?.startsWith('/private/tmp/muqabala-schools-'));
await mkdir(privateDir,{recursive:true,mode:0o700});
const role=process.argv.includes('--educator')?'educator':'founder';
const email=role==='educator'?'hello+schools-educator@trymuqabala.com':'hello@trymuqabala.com';
const statePath=privateDir+'/'+role+'.json';
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},...(process.argv.includes('--login')?{}:{storageState:statePath})});
const page=await context.newPage();
try{
  if(process.argv.includes('--login')){
    await page.goto(origin+'/schools/sign-in');
    await page.locator('input[type=email]').fill(email);
    await page.locator('form').first().getByRole('button').click();
    await page.locator('input[autocomplete="one-time-code"]').waitFor();
    console.log(JSON.stringify({waitingForCode:true,role}));
    const input=createInterface({input:process.stdin,output:process.stdout,terminal:false});
    const code=await input.question('');input.close();assert(/^\d{6}$/.test(code.trim()));
    await page.locator('input[autocomplete="one-time-code"]').fill(code.trim());
    await page.locator('form').nth(1).getByRole('button').click();
    await page.waitForURL(url=>!url.pathname.endsWith('/sign-in'));
    await context.storageState({path:statePath});
    // Restrict persisted authenticated browser state, never print its contents.
    const {chmod}=await import('node:fs/promises');await chmod(statePath,0o600);
    console.log(JSON.stringify({authenticated:true,role,path:new URL(page.url()).pathname}));
  }else if(process.argv.includes('--neb-link')){
    assert(role==='educator');
    const cohort=process.env.SCHOOLS_QA_COHORT;assert(/^[0-9a-f-]{36}$/.test(cohort??''));
    await page.goto(origin+'/schools/cohorts/'+cohort);
    await page.getByRole('heading',{name:'Neb Educators Suite – Controlled QA',exact:true}).waitFor();
    await page.getByText('Student enrolment and recovery',{exact:true}).click();
    await page.getByLabel('Student display name',{exact:true}).fill('Neb – controlled learner test');
    await page.getByLabel('Account method',{exact:true}).selectOption('pseudonymous');
    const result=page.waitForResponse(r=>r.url().endsWith('/api/schools/access')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Create private student link',exact:true}).click();
    const response=await result;assert(response.ok());const grant=await response.json();
    const link=await page.getByLabel('Copy this private link',{exact:true}).inputValue();
    assert(link.startsWith(origin+'/schools/enrol#'));
    await writeFile(privateDir+'/neb-invitation.json',JSON.stringify({link,expiresAt:grant.expiresAt},null,2),{mode:0o600});
    console.log(JSON.stringify({created:true,learnerOnly:true,expiresAt:grant.expiresAt,privateLinkPrinted:false}));
  }else{
    await page.goto(origin+(role==='educator'?'/schools/cohorts':'/schools/founder'));
    assert(!(await page.title()).includes('404'));
    console.log(JSON.stringify({role,path:new URL(page.url()).pathname,text:(await page.locator('main').innerText()).slice(0,14000)}));
  }
}catch(error){
  // Browser call logs may contain access secrets. Report safe diagnostics only.
  console.error(JSON.stringify({failed:true,role,path:new URL(page.url()).pathname,errorType:error.name}));process.exitCode=1;
}finally{await browser.close();}
