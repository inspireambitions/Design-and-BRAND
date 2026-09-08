import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

test('Schools mail leases stop duplicate claims and unsafe retries',async t=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create function auth.jwt() returns jsonb language sql as 'select jsonb_build_object(''session_id'',nullif(current_setting(''request.jwt.claim.sub'',true),''''))';
      grant usage on schema auth to authenticated,service_role; grant execute on function auth.uid() to authenticated,service_role;`);
    const directory=new URL('../supabase/migrations/',import.meta.url);
    for(const name of readdirSync(directory).filter(n=>n.includes('_schools_')).sort())await db.exec(readFileSync(new URL(name,directory),'utf8'));
    const institution=randomUUID(),founder=randomUUID(),student=randomUUID(),cohort=randomUUID(),assignment=randomUUID();
    await db.query('insert into auth.users(id) values($1),($2)',[founder,student]);
    await db.query('insert into schools_staff(user_id) values($1)',[founder]);
    await db.query("insert into schools_institutions(id,name,country,language) values($1,'Synthetic operations','Test','en')",[institution]);
    await db.query("insert into schools_cohorts(id,institution_id,name,enrolment_code,created_by) values($1,$2,'Synthetic','QAONLY00',$3)",[cohort,institution,founder]);
    await db.query("insert into schools_cohort_members(cohort_id,student_user_id,display_name,adult_confirmed_at) values($1,$2,'Synthetic',now())",[cohort,student]);
    await db.query("insert into schools_assignments(id,cohort_id,role_id,due_at,created_by) values($1,$2,'Test',now()+interval '7 days',$3)",[assignment,cohort,founder]);
    const claim=async()=>{const id=randomUUID();return {id,jobs:(await db.query('select schools_claim_mail($1) as jobs',[id])).rows[0].jobs};};
    const insert=async(kind='privacy')=>{const id=randomUUID();await db.query('insert into schools_private.mail_outbox(id,institution_id,recipient_user_id,kind,payload_id) values($1,$2,$3,$4,$5)',[id,institution,student,kind,kind==='assignment'?assignment:randomUUID()]);return id;};
    const clear=()=>db.exec('delete from schools_private.mail_outbox');
    await t.test('ten simultaneous callers allocate twelve jobs once, at most three each',async()=>{
      for(let i=0;i<12;i++)await insert();
      const results=await Promise.all(Array.from({length:10},claim));
      const ids=results.flatMap(r=>r.jobs.map(j=>j.id));
      assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);assert.ok(results.every(r=>r.jobs.length<=3));await clear();
    });
    await t.test('expired fifth lease becomes visible as failed',async()=>{
      const id=await insert();await db.query("update schools_private.mail_outbox set status='sending',attempts=5,first_attempted_at=now(),claim_expires_at=now()-interval '1 second' where id=$1",[id]);
      assert.equal((await claim()).jobs.length,0);assert.equal((await db.query('select status from schools_private.mail_outbox where id=$1',[id])).rows[0].status,'failed');await clear();
    });
    await t.test('uncertain delivery older than 23 hours is held even after founder retry',async()=>{
      const id=await insert();await db.query("update schools_private.mail_outbox set attempts=1,first_attempted_at=now()-interval '24 hours' where id=$1",[id]);
      assert.equal((await claim()).jobs.length,0);await assert.rejects(()=>db.query('select schools_retry_mail($1,$2)',[founder,id]),/Inspect provider/);await clear();
    });
    await t.test('old unsent mail receives its first lease and can retry inside the window',async()=>{
      const id=await insert();await db.query("update schools_private.mail_outbox set created_at=now()-interval '3 days' where id=$1",[id]);
      const first=await claim();assert.equal(first.jobs.length,1);
      assert.equal((await db.query('select schools_finish_mail($1,$2,null) as ok',[id,randomUUID()])).rows[0].ok,false);
      await db.query('select schools_finish_mail($1,$2,null)',[id,first.id]);
      assert.equal((await claim()).jobs.length,0);
      await db.query("update schools_private.mail_outbox set next_at=now()-interval '1 second' where id=$1",[id]);
      const next=await claim();assert.equal(next.jobs.length,1);
      await db.query("select schools_finish_mail($1,$2,'synthetic-receipt')",[id,next.id]);assert.equal((await claim()).jobs.length,0);await clear();
    });
    await t.test('removed students receive no queued assignment notification',async()=>{
      await insert('assignment');await db.query("update schools_cohort_members set status='removed',removed_at=now() where student_user_id=$1",[student]);
      assert.equal((await claim()).jobs.length,0);assert.equal((await db.query('select count(*)::int as n from schools_private.mail_outbox')).rows[0].n,0);
    });
  }finally{await db.close();}
});
