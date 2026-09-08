import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {login} from './schools-staging-qa.mjs';
const checks=[];
const student=await login('student'),other=await login('otherEducator'),employer=await login('employer');
const {fixture:f,admin}=student;
const tables=new Set();
for(const file of await readdir('supabase/migrations'))if(file.includes('schools')){
  const sql=await readFile('supabase/migrations/'+file,'utf8');
  for(const match of sql.matchAll(/create table public\.(schools_\w+)/gi))tables.add(match[1]);
}
const inaccessible=result=>!!result.error||result.data.length===0;
for(const table of tables){
  assert(inaccessible(await employer.session.from(table).select('*')),'Employer read: '+table);
  const write=await employer.session.from(table).delete().select();
  assert(inaccessible(write),'Employer write: '+table);
}
checks.push('Employer identity cannot read or delete rows in all '+tables.size+' public schools tables');
for(const table of tables){
  const own=await admin.from(table).select('*');assert(!own.error,'Fixture read '+table);
  const visible=await other.session.from(table).select('*');if(visible.error)continue;
  for(const row of visible.data){
    assert(row.institution_id!==f.institutions[0],'Cross-institution '+table);
    assert(row.cohort_id!==f.cohorts[0],'Cross-cohort '+table);
    assert(row.assignment_id!==f.assignments[0],'Cross-assignment '+table);
    assert(row.student_user_id!==f.users.student.id,'Cross-student '+table);
  }
}
checks.push('Unassigned educator cannot read the other institution or its student records');
const cookie=student.cookies.map(c=>c.name+'='+c.value).join('; ');
const post=body=>fetch('http://localhost:3110/api/schools',{method:'POST',headers:{Origin:'http://localhost:3110','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
assert.equal((await post({operation:'draft',payload:{assignmentId:f.assignments[1],revision:0,answers:['','','']}})).status,403);
checks.push('Tampered assignment rejected by hosted application');
try{
  const removal=await admin.from('schools_cohort_members').update({status:'removed',removed_at:new Date().toISOString()}).eq('student_user_id',f.users.student.id);assert(!removal.error);
  for(const table of ['schools_cohorts','schools_assignments','schools_assignment_attempts','schools_feedback_versions','schools_reviews'])assert(inaccessible(await student.session.from(table).select('*')),'Removed access '+table);
  checks.push('Removed member immediately loses hosted RLS access');
}finally{await admin.from('schools_cohort_members').update({status:'active',removed_at:null}).eq('student_user_id',f.users.student.id);}
const claims=await student.session.auth.getClaims();const sessionId=claims.data.claims.session_id;
await admin.from('schools_sessions').update({last_seen_at:new Date(Date.now()-13*3600000).toISOString()}).eq('session_id',sessionId);
assert(inaccessible(await student.session.from('schools_assignments').select('*')));
assert.equal((await post({operation:'support',payload:{cohortId:f.cohorts[0]}})).status,401);
checks.push('Expired idle session denied by both RLS and application');
await admin.from('schools_sessions').update({last_seen_at:new Date().toISOString(),revoked_at:new Date().toISOString()}).eq('session_id',sessionId);
assert(inaccessible(await student.session.from('schools_assignments').select('*')));
checks.push('Revoked session cannot use an otherwise valid Auth token');
await writeFile('../docs/evidence/schools-hosted-security.json',JSON.stringify({checkedAt:new Date().toISOString(),checks,syntheticOnly:true},null,2)+'\n');
console.log(JSON.stringify({checks}));
