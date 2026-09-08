import './schools-qa-errors.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
const require=createRequire(import.meta.url),{request}=require(process.env.SCHOOLS_QA_PLAYWRIGHT);
const educator=await login('educator'),{fixture:f,admin}=educator;
const origin='http://localhost:3110',checks=[],contexts=[];
async function context(cookies=[]){const c=await request.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin},storageState:{cookies: cookies.map(c=>({...c,expires:-1})),origins:[]}});contexts.push(c);return c;}
async function post(c,path,data){const r=await c.post(path,{data});const body=await r.json();assert.equal(r.status(),200,'Hosted operation '+data.operation+' returned '+r.status()+': '+body.error);return body;}
try{
  const adviser=await context(educator.cookies);
  const issued=await post(adviser,'/api/schools/access',{operation:'issue',cohortId:f.cohorts[0],purpose:'enrolment',mode:'pseudonymous',displayName:'Synthetic recovery test',identityChecked:false});
  const first=await context();const enrolled=await post(first,'/api/schools/access',{operation:'redeem',secret:issued.path.split('#')[1],recovery:false,adultConfirmed:true});
  assert(enrolled.recoveryCode);assert.equal((await first.get('/schools/me')).status(),200);
  checks.push('Native hosted Auth pseudonymous enrolment succeeds without an email');
  const rows=await admin.from('schools_cohort_members').select('student_user_id').eq('cohort_id',f.cohorts[0]).eq('display_name','Synthetic recovery test').order('joined_at',{ascending:false}).limit(1).single();assert(!rows.error);const studentId=rows.data.student_user_id;
  const recoveredContext=await context();const recovered=await post(recoveredContext,'/api/schools/access',{operation:'redeem',secret:enrolled.recoveryCode,recovery:true,adultConfirmed:true});
  assert(recovered.recoveryCode&&recovered.recoveryCode!==enrolled.recoveryCode);
  const replay=await context();assert.equal((await replay.post('/api/schools/access',{data:{operation:'redeem',secret:enrolled.recoveryCode,recovery:true,adultConfirmed:true}})).status(),400);
  assert.equal((await first.post('/api/schools',{data:{operation:'support',payload:{cohortId:f.cohorts[0]}}})).status(),401);
  checks.push('Recovery code rotates once and invalidates the earlier session');
  const recoveryInvite=await post(adviser,'/api/schools/access',{operation:'issue',cohortId:f.cohorts[0],purpose:'recovery',mode:'pseudonymous',studentId,displayName:'Synthetic recovery test',identityChecked:true});
  const assisted=await context();await post(assisted,'/api/schools/access',{operation:'redeem',secret:recoveryInvite.path.split('#')[1],recovery:false,adultConfirmed:true});
  assert.equal((await recoveredContext.post('/api/schools',{data:{operation:'support',payload:{cohortId:f.cohorts[0]}}})).status(),401);
  checks.push('Educator-assisted recovery succeeds and revokes prior access');
  const deletion=await post(assisted,'/api/schools/delete',{confirm:true});assert(deletion.localDeleted);
  const account=await admin.auth.admin.getUserById(studentId);assert(!account.data.user);
  const remaining=await admin.from('schools_cohort_members').select('id').eq('student_user_id',studentId);assert(!remaining.error&&remaining.data.length===0);
  checks.push('Immediate pseudonymous deletion removes local records and native Auth identity');
  await writeFile('../docs/evidence/schools-hosted-recovery.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,syntheticOnly:true,secretsRecorded:false},null,2)+'\n');
  console.log(JSON.stringify({checks}));
}finally{for(const c of contexts)await c.dispose();}
