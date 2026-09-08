import './schools-qa-errors.mjs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const {default:lighthouse}=await import(pathToFileURL(process.env.SCHOOLS_QA_LIGHTHOUSE).href);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--remote-debugging-port=9333']});
const results=[];
try{
  for(const role of ['student','educator']){
    const identity=await login(role),f=identity.fixture;
    const routes=role==='student'?['/schools/me']:['/schools/cohorts/'+f.cohorts[0],'/schools/cohorts/'+f.cohorts[0]+'/review'];
    for(const route of routes){
      const result=await lighthouse('http://localhost:3110'+route,{port:9333,onlyCategories:['accessibility'],output:'json',logLevel:'error',extraHeaders:{Cookie:identity.cookies.map(c=>c.name+'='+c.value).join('; ')}});
      const report=result.lhr;
      results.push({route,accessibility:report.categories.accessibility.score*100,finalUrl:report.finalDisplayedUrl,failures:Object.values(report.audits).filter(a=>a.score===0).map(a=>({id:a.id,title:a.title,items:a.details?.items}))});
    }
  }
  await writeFile('../docs/evidence/schools-authenticated-accessibility.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
  console.log(JSON.stringify({results}));
}finally{await browser.close();}
