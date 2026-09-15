import './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
import {qaStage} from './schools-qa-errors.mjs';

const require=createRequire(import.meta.url),{chromium}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const viewports=[[320,568],[375,812],[390,844],[768,1024],[1280,800],[1440,900]];
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[];
try{
  const student=await login('student'),educator=await login('educator'),admin=await login('admin');
  const routes=[
    {path:'/schools',cookies:[]},
    {path:'/schools/me',cookies:student.cookies},
    {path:'/schools/cohorts/'+educator.fixture.cohorts[0],cookies:educator.cookies},
    {path:'/schools/cohorts/'+educator.fixture.cohorts[0]+'/review',cookies:educator.cookies},
    {path:'/schools/admin',cookies:admin.cookies},
  ];
  for(const [width,height] of viewports){
    for(const route of routes){
      qaStage(`responsive ${width}x${height} ${route.path}`);
      const context=await browser.newContext({viewport:{width,height}});await context.addCookies(route.cookies);const page=await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://localhost:3110'+route.path,{waitUntil:'domcontentloaded',timeout:45000});
      await page.locator('main').waitFor();
      const dimensions=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
      qaStage(`overflow ${width}x${height} ${route.path} ${dimensions.scrollWidth}/${dimensions.clientWidth}`);
      assert(dimensions.scrollWidth<=dimensions.clientWidth+1,`Horizontal overflow at ${width} on ${route.path}`);
      qaStage(`page errors ${width}x${height} ${route.path}`);
      assert.equal(errors.length,0,`Page error at ${width} on ${route.path}`);
      qaStage(`keyboard focus ${width}x${height} ${route.path}`);
      await page.keyboard.press('Tab');assert(await page.locator(':focus-visible').count(),`No visible keyboard focus at ${width} on ${route.path}`);
      checks.push({route:route.path,width,height,noHorizontalOverflow:true,noPageErrors:true,visibleKeyboardFocus:true});
      await context.close();
    }
  }
  const evidence={checkedAt:new Date().toISOString(),stagingRef:student.fixture.stagingRef,emulatedViewports:true,checks,limitation:'Browser emulation is not a physical-device test.'};
  await writeFile('../docs/evidence/schools-responsive-browser.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({checks:checks.length,passed:true}));
}finally{await browser.close();}
