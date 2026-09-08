import './schools-qa-errors.mjs';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {stagingEnvironment} from './schools-staging-env.mjs';
const require=createRequire(import.meta.url);
const fixturePath=new URL('../../docs/evidence/schools-staging-fixture.json',import.meta.url);
let cachedConfig;
const config=()=>{if(cachedConfig)return cachedConfig;const c=stagingEnvironment();if(new URL(c.SUPABASE_URL).hostname!=='okrsezhospztwtptqhpo.supabase.co')throw new Error('Staging-only guard failed');cachedConfig=c;return c;};
const client=c=>createClient(c.SUPABASE_URL,c.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const checked=(result,label)=>{if(result.error)throw new Error(label+': '+(result.error.code??'request failed'));return result.data;};
export async function seed(){
  if(existsSync(fixturePath))return JSON.parse(readFileSync(fixturePath,'utf8'));
  const c=config(),admin=client(c),f={stagingRef:'okrsezhospztwtptqhpo',syntheticOnly:true,users:{},institutions:[randomUUID(),randomUUID()],cohorts:[randomUUID(),randomUUID()],assignments:[]};
  for(const role of ['founder','admin','educator','student','otherEducator','otherStudent','employer']){
    const email='schools-qa-'+role+'-'+randomUUID()+'@example.invalid';
    const created=checked(await admin.auth.admin.createUser({email,email_confirm:true}), 'Create synthetic '+role);
    f.users[role]={id:created.user.id,email};
  }
  checked(await admin.from('schools_staff').insert({user_id:f.users.founder.id}),'Founder fixture');
  for(let n=0;n<2;n++){
    const educator=n?f.users.otherEducator:f.users.educator,student=n?f.users.otherStudent:f.users.student;
    checked(await admin.from('schools_institutions').insert({id:f.institutions[n],name:'Synthetic QA Institution '+(n+1),country:'Test only',language:'en',setup_complete:true,dpa_complete:true,dpa_reference:'SYNTHETIC QA ONLY. No real institution or students.',approved_by:f.users.founder.id,approved_at:new Date().toISOString()}),'Institution fixture');
    checked(await admin.from('schools_institution_members').insert([{institution_id:f.institutions[n],user_id:educator.id,role:'educator',accepted_at:new Date().toISOString()},...(n?[]:[{institution_id:f.institutions[n],user_id:f.users.admin.id,role:'institution_admin',accepted_at:new Date().toISOString()}])]),'Staff fixture');
    checked(await admin.from('schools_cohorts').insert({id:f.cohorts[n],institution_id:f.institutions[n],name:'Synthetic QA Cohort '+(n+1),enrolment_code:'QAONLY0'+n,enrolment_open:true,created_by:educator.id}),'Cohort fixture');
    checked(await admin.from('schools_cohort_educators').insert({cohort_id:f.cohorts[n],educator_user_id:educator.id}),'Adviser fixture');
    checked(await admin.from('schools_cohort_members').insert({cohort_id:f.cohorts[n],student_user_id:student.id,display_name:'Synthetic Student '+(n+1),adult_confirmed_at:new Date().toISOString()}),'Student fixture');
    const questionIds=[];
    for(let q=0;q<3;q++){
      const id=randomUUID();questionIds.push(id);
      checked(await admin.from('schools_question_versions').insert({id,institution_id:f.institutions[n],question_key:'synthetic-'+q,version:1,role_id:'Student placement',language:'en',question_text:['Describe a time you helped a group meet a deadline.','Describe a time you solved a problem during a project.','Describe a time you learned from feedback.'][q],rubric:['Situation','Own action','Working with others','Outcome'].map((label,i)=>({id:'e'+i,label,description:'Describe '+label.toLowerCase()+' using an example.'})),no_example_follow_up:'What did you do during a recent class project?',approved_by:educator.id}),'Question fixture');
    }
    const assignment=checked(await admin.rpc('schools_manage_action',{actor:educator.id,operation:'assignment',device:'server',payload:{cohortId:f.cohorts[n],roleId:'Student placement',questionIds,dueAt:new Date(Date.now()+7*86400000).toISOString()}}),'Assignment fixture');
    f.assignments.push(assignment.id);
  }
  writeFileSync(fixturePath,JSON.stringify(f,null,2)+'\n');return f;
}
export async function login(role){
  const f=await seed(),c=config(),admin=client(c),identity=f.users[role];if(!identity)throw new Error('Unknown synthetic role');
  const link=checked(await admin.auth.admin.generateLink({type:'magiclink',email:identity.email}),'Synthetic magic link');
  let cookies=[];
  const session=createServerClient(c.SUPABASE_URL,c.SUPABASE_PUBLISHABLE_KEY||c.SUPABASE_ANON_KEY,{cookies:{getAll:()=>cookies,setAll:values=>{for(const value of values){cookies=cookies.filter(item=>item.name!==value.name);cookies.push(value);}}}});
  checked(await session.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'magiclink'}),'Verify synthetic magic link');
  const claims=checked(await session.auth.getClaims(),'Synthetic claims');
  checked(await admin.from('schools_sessions').insert({session_id:claims.claims.session_id,user_id:identity.id}),'Schools session');
  return {fixture:f,session,admin,cookies:cookies.map(item=>({name:item.name,value:item.value,domain:'localhost',path:'/',httpOnly:!!item.options?.httpOnly,secure:false,sameSite:'Lax'}))};
}
if(process.argv.includes('--seed')){const f=await seed();console.log(JSON.stringify({syntheticUsers:Object.keys(f.users).length,stagingRef:f.stagingRef,credentialsPrinted:false}));}
if(process.argv.includes('--serve')){
  const c=config();const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--webpack','--port','3110'],{stdio:'inherit',windowsHide:true,env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:c.SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:c.SUPABASE_PUBLISHABLE_KEY||c.SUPABASE_ANON_KEY,SUPABASE_SECRET_KEY:c.SUPABASE_SERVICE_ROLE_KEY,SCHOOLS_ENABLED:'true',APP_ORIGIN:'http://localhost:3110',INTERVIEW_SECRET:randomBytes(32).toString('hex')}});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
  child.on('exit',code=>process.exit(code??0));
}
