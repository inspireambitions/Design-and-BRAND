import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { schoolsEnabled } from '../lib/schools/config.ts';
import { calculateEvidence } from '../lib/schools/evidence.ts';
import { shouldClaimPracticeAttempt } from '../lib/auth-destination.ts';

test('schools requires an explicit server flag', () => {
  for (const value of ['', 'false', 'TRUE', '1']) assert.equal(schoolsEnabled(value), false);
  assert.equal(schoolsEnabled('true'), true);
});
test('schools authentication never claims unrelated anonymous practice', () => {
  for (const destination of ['/schools','/schools/me','/schools?next=x']) assert.equal(shouldClaimPracticeAttempt(destination),false);
  assert.equal(shouldClaimPracticeAttempt('/practice'),true);
  assert.equal(shouldClaimPracticeAttempt('/employer'),false);
});
const rubric = [0,1,2,3].map(i=>({id:'e'+i,label:'Element '+i,description:'An observable fact'}));
const output = () => ({questions:[0,1,2].map(questionIndex=>({questionIndex,improvement:'Describe your own action.',elements:rubric.map((r,i)=>({id:r.id,present:i===0,supportingText:i===0?'I checked the list.':'',confidence:'medium'}))}))});
test('evidence derives the count from exact stored answer excerpts', () => {
  const result=calculateEvidence(output(),Array(3).fill('I checked the list.'),Array(3).fill(rubric));
  assert.equal(result.covered,3); assert.equal(result.detail[0].elements[0].start,0);
  assert.throws(()=>calculateEvidence({...output(),covered:12},Array(3).fill('I checked the list.'),Array(3).fill(rubric)));
  assert.throws(()=>calculateEvidence(output(),Array(3).fill('Different text'),Array(3).fill(rubric)));
  const duplicate=output(); duplicate.questions[1].questionIndex=0;
  assert.throws(()=>calculateEvidence(duplicate,Array(3).fill('I checked the list.'),Array(3).fill(rubric)));
});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('schools database denies cross-institution, draft and employer access', async t=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create function auth.jwt() returns jsonb language sql as 'select jsonb_build_object(''session_id'',nullif(current_setting(''request.jwt.claim.sub'',true),''''))';
      grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role;`);
    await db.exec(readFileSync(new URL('../supabase/migrations/20260908104304_schools_pilot_foundation.sql',import.meta.url),'utf8'));
    await db.exec(`
      insert into auth.users values ('${id(1)}'),('${id(2)}'),('${id(3)}'),('${id(4)}'),('${id(5)}'),('${id(6)}');
      insert into public.schools_institutions(id,name,country,language) values ('${id(10)}','A','UAE','en'),('${id(11)}','B','UAE','en');
      insert into public.schools_institution_members(institution_id,user_id,role,accepted_at) values
        ('${id(10)}','${id(1)}','educator',now()),('${id(11)}','${id(2)}','educator',now()),('${id(10)}','${id(6)}','institution_admin',now());
      insert into public.schools_cohorts(id,institution_id,name,enrolment_code,created_by) values
        ('${id(20)}','${id(10)}','A1','ABCDEFGH','${id(1)}'),('${id(21)}','${id(11)}','B1','ABCDEFGH','${id(2)}'),
        ('${id(22)}','${id(10)}','A2','ABCDEFGJ','${id(1)}');
      insert into public.schools_cohort_educators(cohort_id,educator_user_id) values ('${id(20)}','${id(1)}'),('${id(21)}','${id(2)}');
      insert into public.schools_cohort_members(cohort_id,student_user_id,display_name,adult_confirmed_at) values
        ('${id(20)}','${id(3)}','Student A',now()),('${id(21)}','${id(4)}','Student B',now()),('${id(22)}','${id(4)}','Student C',now());
      insert into public.schools_assignments(id,cohort_id,role_id,due_at,published_at,created_by) values
        ('${id(30)}','${id(20)}','role',now()+interval '7 days',null,'${id(1)}'),
        ('${id(31)}','${id(21)}','role',now()+interval '7 days',null,'${id(2)}');
      insert into public.schools_assignment_attempts(id,assignment_id,student_user_id,attempt_number,status,submitted_at) values
        ('${id(40)}','${id(30)}','${id(3)}',1,'submitted',now()),
        ('${id(41)}','${id(30)}','${id(3)}',2,'draft',null),
        ('${id(42)}','${id(31)}','${id(4)}',1,'submitted',now());
      insert into public.schools_sessions(session_id,user_id) select id,id from auth.users;`);
await db.exec('reset role');
    for (const [institution,assignment,educator] of [[10,30,1],[11,31,2]]) {
      for (let i=0;i<3;i++) {
        const qid=id(100+assignment*3+i);
        await db.query("insert into public.schools_question_versions(id,institution_id,question_key,version,role_id,language,question_text,rubric,no_example_follow_up,approved_by) values($1,$2,$3,1,'role','en','Describe your example.',$4::jsonb,'What did you do?',$5)",[qid,id(institution),'q'+i,JSON.stringify(rubric),id(educator)]);
        await db.query("insert into public.schools_assignment_questions values($1,$2,$3)",[id(assignment),i,qid]);
      }
      await db.query('update public.schools_assignments set published_at=now() where id=$1',[id(assignment)]);
    }
    await db.query("update public.schools_institutions set dpa_complete=true,dpa_reference='synthetic-only',approved_by=$1,approved_at=now(),setup_complete=true",[id(6)]);
    const as=async(user,query)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id(user)]);await db.exec('set role authenticated');return db.query(query);};
    await t.test('adviser reads only submitted work in assigned cohorts',async()=>{
      assert.deepEqual((await as(1,'select id from public.schools_assignment_attempts')).rows.map(r=>r.id),[id(40)]);
      assert.equal((await as(1,'select * from public.schools_cohort_members')).rows.length,1);
    });
    await t.test('student sees their own draft and submitted attempt',async()=>{
      assert.equal((await as(3,'select * from public.schools_assignment_attempts')).rows.length,2);
      assert.equal((await as(3,'select id,name from public.schools_cohorts')).rows.length,1);
      await assert.rejects(()=>as(3,'select enrolment_code from public.schools_cohorts'));
    });
    await t.test('institution admin cannot read answer contents',async()=>{
      assert.equal((await as(6,'select * from public.schools_assignment_attempts')).rows.length,0);
    });
    await t.test('an employer identity cannot read any schools table',async()=>{
      await db.exec('reset role');
      const tables=(await db.query("select tablename from pg_tables where schemaname='public' and tablename like 'schools_%'")).rows;
      for (const {tablename} of tables) {
        if(['schools_staff','schools_sessions'].includes(tablename)) { await assert.rejects(()=>as(5,'select * from public.'+tablename)); continue; }
        const result=await as(5,tablename==='schools_cohorts'?'select id,name from public.schools_cohorts':'select * from public.'+tablename);
        assert.equal(result.rows.length,0,tablename);
      }
    });
    await t.test('client writes cannot set evidence or impersonate a student',async()=>{
      await assert.rejects(()=>as(3,"update public.schools_assignment_attempts set evidence_covered=12"));
      await assert.rejects(()=>as(1,"delete from public.schools_assignment_attempts"));
    });
await t.test('service transaction rejects tampered assignment and closes enrolment gates',async()=>{
      await db.exec('reset role; set role service_role');
      const call=(actor,operation,payload)=>db.query('select public.schools_write($1,$2,$3::jsonb) as result',[id(actor),operation,JSON.stringify(payload)]);
      await assert.rejects(()=>call(3,'draft',{assignmentId:id(31),answers:['a','b','c'],revision:0}));
      await db.exec("reset role; update public.schools_institutions set setup_complete=false where id='"+id(10)+"'; set role service_role");
      await assert.rejects(()=>call(3,'draft',{assignmentId:id(30),attemptId:id(41),answers:['a','b','c'],revision:0}));
      await db.exec("reset role; update public.schools_institutions set setup_complete=true where id='"+id(10)+"'; set role service_role");
      const saved=(await call(3,'draft',{assignmentId:id(30),attemptId:id(41),answers:['a','b','c'],revision:0})).rows[0].result;
      assert.equal(saved.revision,1);
      await assert.rejects(()=>call(3,'draft',{assignmentId:id(30),attemptId:id(41),answers:['lost','b','c'],revision:0}));
      const submitted=(await call(3,'submit',{assignmentId:id(30),attemptId:id(41),answers:['a','b','c'],revision:1,evidence_covered:12})).rows[0].result;
      assert.equal(submitted.status,'submitted'); assert.equal(submitted.evidence_covered,null);
      const repeated=(await call(3,'submit',{assignmentId:id(30),attemptId:id(41),answers:['a','b','c'],revision:1})).rows[0].result;
      assert.equal(repeated.id,submitted.id);
    });
    await t.test('a lost first submission response returns the same reserved attempt',async()=>{
      await db.exec('reset role; set role service_role');
      const payload={assignmentId:id(30),attemptId:id(901),revision:0,answers:['first','second','third']};
      const call=()=>db.query('select public.schools_write($1,$2,$3::jsonb) as result',[id(3),'submit',JSON.stringify(payload)]);
      const first=(await call()).rows[0].result;
      const repeated=(await call()).rows[0].result;
      assert.equal(first.id,id(901));assert.equal(repeated.id,first.id);assert.equal(repeated.revision,first.revision);
      assert.equal((await db.query('select count(*)::int as n from public.schools_assignment_attempts where id=$1',[id(901)])).rows[0].n,1);
    });
    await t.test('support ownership rejects another institution and preserves its assigned owner',async()=>{
      await db.exec('reset role; set role service_role');
      const opened=(await db.query("select public.schools_write($1,'support',$2::jsonb) as result",[id(3),JSON.stringify({cohortId:id(20)})])).rows[0].result;
      assert.equal(opened.owner_educator_id,null);
      await assert.rejects(()=>db.query('select public.schools_adviser_support($1,$2,$3,$4,$5)',[id(2),id(20),id(3),'open','']));
      const claimed=(await db.query('select public.schools_adviser_support($1,$2,$3,$4,$5) as result',[id(1),id(20),id(3),'scheduled','Meet on Tuesday.'])).rows[0].result;
      assert.equal(claimed.id,opened.id);assert.equal(claimed.owner_educator_id,id(1));assert.equal(claimed.status,'scheduled');
    });
    await t.test('read markers reject another student and an unseen review revision',async()=>{
      await db.exec('reset role; set role service_role');
      await assert.rejects(()=>db.query('select public.schools_mark_read($1,$2,true,null)',[id(4),id(40)]));
      await db.query('select public.schools_mark_read($1,$2,true,999)',[id(3),id(40)]);
      const stored=(await db.query('select feedback_opened_at,comment_read_revision from public.schools_assignment_attempts where id=$1',[id(40)])).rows[0];
      assert.equal(stored.feedback_opened_at,null);assert.equal(stored.comment_read_revision,null);
    });
    await t.test('published question versions cannot be removed or moved',async()=>{
      await db.exec('reset role; set role service_role');
      await assert.rejects(()=>db.query('delete from public.schools_assignment_questions where assignment_id=$1',[id(30)]));
      await assert.rejects(()=>db.query('update public.schools_assignments set rubric_version_id=$2 where id=$1',[id(30),id(999)]));
    });
    await t.test('review is attempt-bound with exact content undo and stale-write rejection',async()=>{
      await db.exec('reset role; set role service_role');
      const call=(operation,payload)=>db.query('select public.schools_write($1,$2,$3::jsonb) as result',[id(1),operation,JSON.stringify(payload)]);
      const first=(await call('review',{attemptId:id(40),revision:0,state:'on_track',comment:'Original note'})).rows[0].result;
      const second=(await call('review',{attemptId:id(40),revision:first.revision,state:'discuss',comment:'Changed note'})).rows[0].result;
      const undone=(await call('undo_review',{attemptId:id(40),revision:second.revision})).rows[0].result;
      for(const field of ['state','comment','created_at','updated_at','educator_id']) assert.equal(undone[field],first[field],field);
      await assert.rejects(()=>call('review',{attemptId:id(40),revision:second.revision,state:'discuss'}));
      assert.equal((await db.query('select count(*)::int as n from public.schools_reviews where assignment_attempt_id=$1',[id(41)])).rows[0].n,0);
    });
await t.test('every client table write is denied, including direct deletion',async()=>{
      await db.exec('reset role');
      const tables=(await db.query("select tablename from pg_tables where schemaname='public' and tablename like 'schools_%'")).rows;
      for(const {tablename}of tables) {
        await assert.rejects(()=>as(3,'delete from public.'+tablename),tablename);
        await db.exec('reset role; set role anon');
        await assert.rejects(()=>db.query('select * from public.'+tablename),tablename);
      }
      await assert.rejects(()=>as(3,"select public.schools_write(null,'draft','{}')"));
    });
    await t.test('idle and revoked sessions cannot read even their own membership',async()=>{
      await db.exec("reset role; update public.schools_sessions set last_seen_at=now()-interval '13 hours' where user_id='"+id(3)+"'");
      assert.equal((await as(3,'select * from public.schools_cohort_members')).rows.length,0);
      await db.exec("reset role; update public.schools_sessions set last_seen_at=now(),revoked_at=now() where user_id='"+id(3)+"'");
      assert.equal((await as(3,'select * from public.schools_assignment_attempts')).rows.length,0);
      await db.exec("reset role; update public.schools_sessions set revoked_at=null,last_seen_at=now() where user_id='"+id(3)+"'");
    });
    await t.test('a retry copies answer provenance without carrying an adviser review',async()=>{
      await db.exec('reset role; set role service_role');
      const retry=(await db.query('select public.schools_retry($1,$2) as result',[id(3),id(40)])).rows[0].result;
      assert.equal(retry.status,'draft');assert.equal(retry.copied_from_attempt_id,id(40));
      assert.equal(retry.evidence_covered,null);assert.equal(retry.feedback_version_id,null);
      assert.equal((await db.query('select count(*)::int as n from public.schools_reviews where assignment_attempt_id=$1',[retry.id])).rows[0].n,0);
      await assert.rejects(()=>db.query('select public.schools_retry($1,$2)',[id(4),id(40)]));
    });
    await t.test('removed membership loses access immediately',async()=>{
      await db.exec("reset role; update public.schools_cohort_members set status='removed',removed_at=now() where student_user_id='"+id(3)+"'");
      assert.equal((await as(3,'select * from public.schools_assignment_attempts')).rows.length,0);
    });
    await t.test('submitted answers cannot be overwritten even by the storage worker',async()=>{
      await db.exec('reset role');
      await assert.rejects(()=>db.query("update public.schools_assignment_attempts set answers=$2::jsonb where id=$1",[id(40),JSON.stringify(["changed","",""])]));
    });
  } finally {await db.close();}
});
