import './schools-qa-errors.mjs';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {previewAccess,previewOrigin} from './schools-preview-access.mjs';
const require=createRequire(import.meta.url),{request}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const access=await previewAccess(),context=await request.newContext({baseURL:previewOrigin,extraHTTPHeaders:{Origin:previewOrigin}});
try{
  await context.get('/schools?_vercel_share='+encodeURIComponent(Object.keys(access.protectionBypass)[0]));
  const response=await context.post('/api/auth/request',{data:{email:'inspireambition.com@gmail.com',next:'/schools/me',lang:'en'},timeout:30000});
  const result=await response.json();const evidence={checkedAt:new Date().toISOString(),previewOrigin,httpStatus:response.status(),requestAccepted:result.sent===true,error:result.error??null,inboxVerified:false};
  await writeFile('../docs/evidence/schools-email-check.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}finally{await context.dispose();}
