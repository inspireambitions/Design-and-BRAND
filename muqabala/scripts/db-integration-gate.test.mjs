import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { detectInterventionSignals } from '../lib/schools/intervention.ts';

const id = (prefix, n) => {
  let hash = 0;
  for (let i = 0; i < prefix.length; i++) {
    hash = ((hash << 5) - hash + prefix.charCodeAt(i)) & 0xffff;
  }
  const hexPrefix = Math.abs(hash).toString(16).padStart(4, '0');
  return `00000000-${hexPrefix}-4000-8000-${String(n).padStart(12, '0')}`;
};

// Helper to set JWT claims in Postgres session
async function setSession(db, userId, role = 'authenticated', email = 'test@example.com') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId || '']);
  await db.query("select set_config('request.jwt.claim.email', $1, false)", [email || '']);
  if (role) {
    await db.exec(`set role ${role}`);
  }
}

async function resetSession(db) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', '', false)");
  await db.query("select set_config('request.jwt.claim.email', '', false)");
}

test('REAL DATABASE INTEGRATION GATE: Comprehensive Unified Muqabala Validation', async (suite) => {
  const db = new PGlite();

  await suite.test('1. Setup Supabase Extensions & Schemas', async () => {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema if not exists extensions;
      create schema if not exists auth;
      create table if not exists auth.users (id uuid primary key, email text);
      create or replace function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      create or replace function auth.jwt() returns jsonb language sql as 'select jsonb_build_object(''session_id'',nullif(current_setting(''request.jwt.claim.sub'',true),''''),''email'',nullif(current_setting(''request.jwt.claim.email'',true),''''))';
      create schema if not exists storage;
      create table if not exists storage.buckets (
        id text primary key,
        name text not null,
        public boolean default false,
        file_size_limit bigint,
        allowed_mime_types text[]
      );
      create table if not exists storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text references storage.buckets(id),
        name text,
        owner uuid,
        created_at timestamptz default now(),
        updated_at timestamptz default now(),
        metadata jsonb
      );
      create schema if not exists cron;
      create table if not exists cron.job (jobid bigint primary key, jobname text, schedule text, command text);
      create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language plpgsql as $$
      begin
        delete from cron.job where jobname = job_name;
        insert into cron.job (jobid, jobname, schedule, command) values (coalesce((select max(jobid)+1 from cron.job), 1), job_name, schedule, command);
        return 1;
      end;
      $$;
      create or replace function cron.unschedule(job_id bigint) returns boolean language plpgsql as $$
      begin
        delete from cron.job where jobid = job_id;
        return true;
      end;
      $$;
      create schema if not exists vault;
      create table if not exists vault.decrypted_secrets (id uuid primary key, name text, decrypted_secret text);
      grant usage on schema auth to authenticated, anon, service_role;
      grant usage on schema storage to authenticated, anon, service_role;
    `);
  });

  await suite.test('2. Replay all 47 migrations in chronological order', async () => {
    const migrationsDir = new URL('../supabase/migrations', import.meta.url).pathname;
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    assert.equal(files.length, 47, 'Expected exactly 47 migration files');

    for (const file of files) {
      let sql = readFileSync(join(migrationsDir, file), 'utf8');
      sql = sql.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_cron[^;]*;/gi, '-- pg_cron skipped');
      sql = sql.replace(/create\s+extension\s+if\s+not\s+exists\s+pgcrypto[^;]*;/gi, '-- pgcrypto in pglite');
      sql = sql.replace(/create\s+extension\s+if\s+not\s+exists\s+pg_stat_statements[^;]*;/gi, '-- pg_stat_statements skipped');
      await db.exec(sql);
    }

    // Verify key tables exist from all 3 pending migrations
    // 1. Recruiter Suite
    const recruiterCols = await db.query(`
      select column_name from information_schema.columns 
      where table_name = 'screening_packs' and column_name in ('location', 'timezone', 'published_facts', 'publish_key', 'questionnaire_language')
    `);
    assert.equal(recruiterCols.rows.length, 5, 'All recruiter screening_packs columns exist');

    const candidateRoleQ = await db.query(`
      select count(*) as c from information_schema.tables where table_name = 'candidate_role_questions'
    `);
    assert.equal(Number(candidateRoleQ.rows[0].c), 1, 'candidate_role_questions exists');

    // 2. Educator P0-A
    const cohortColsP0A = await db.query(`
      select column_name from information_schema.columns 
      where table_name = 'schools_cohorts' and column_name in ('campus', 'faculty', 'programme')
    `);
    assert.equal(cohortColsP0A.rows.length, 3, 'All P0-A schools_cohorts columns exist');

    // 3. Educator P0-B
    const programmesTable = await db.query(`
      select count(*) as c from information_schema.tables where table_name = 'schools_programmes'
    `);
    assert.equal(Number(programmesTable.rows[0].c), 1, 'schools_programmes exists');

    const asgnColsP0B = await db.query(`
      select column_name from information_schema.columns 
      where table_name = 'schools_assignments' and column_name in ('status', 'instructions', 'version', 'duplicated_from_id')
    `);
    assert.equal(asgnColsP0B.rows.length, 4, 'All P0-B schools_assignments columns exist');
  });

  await suite.test('3. Tenant & Role Isolation (RLS / RBAC)', async () => {
    // Populate Institutions, Users, and Roles
    const founderId = id('1', 1);
    const adminA = id('1', 2);
    const educatorA1 = id('1', 3);
    const educatorA2 = id('1', 4);
    const studentA1 = id('1', 5);
    const adminB = id('2', 2);
    const educatorB = id('2', 3);
    const studentB = id('2', 5);

    const instA = id('a', 1);
    const instB = id('b', 1);

    await db.exec(`
      insert into auth.users (id, email) values
        ('${founderId}', 'founder@muqabala.test'),
        ('${adminA}', 'admin@insta.test'),
        ('${educatorA1}', 'ed1@insta.test'),
        ('${educatorA2}', 'ed2@insta.test'),
        ('${studentA1}', 'student1@insta.test'),
        ('${adminB}', 'admin@instb.test'),
        ('${educatorB}', 'ed@instb.test'),
        ('${studentB}', 'student@instb.test')
      on conflict do nothing;

      insert into public.schools_staff (user_id) values ('${founderId}') on conflict do nothing;

      insert into public.schools_institutions (id, name, country, language, setup_complete, dpa_complete, approved_by, dpa_reference, approved_at) values
        ('${instA}', 'University of Dubai', 'UAE', 'en', true, true, '${founderId}', 'DPA-UAEDXB-2026', now()),
        ('${instB}', 'Sharjah Vocational Academy', 'UAE', 'en', true, true, '${founderId}', 'DPA-UAESHJ-2026', now())
      on conflict do nothing;

      insert into public.schools_institution_members (institution_id, user_id, role, accepted_at) values
        ('${instA}', '${adminA}', 'institution_admin', now()),
        ('${instA}', '${educatorA1}', 'educator', now()),
        ('${instA}', '${educatorA2}', 'educator', now()),
        ('${instB}', '${adminB}', 'institution_admin', now()),
        ('${instB}', '${educatorB}', 'educator', now())
      on conflict do nothing;

      insert into public.schools_sessions(session_id, user_id)
        select id, id from auth.users on conflict do nothing;
    `);

    // Create Programme A in Inst A and Programme B in Inst B
    const progAId = id('a', 10);
    const progBId = id('b', 10);

    await db.exec(`
      insert into public.schools_programmes (id, institution_id, name, code, created_by) values
        ('${progAId}', '${instA}', 'BSc FinTech', 'FIN-101', '${educatorA1}'),
        ('${progBId}', '${instB}', 'Diploma Culinary Arts', 'CUL-201', '${educatorB}')
      on conflict do nothing;
    `);

    try {
      // Test RLS: Educator A1 reading programmes
      await setSession(db, educatorA1, 'authenticated', 'ed1@insta.test');
      const readByEdA = await db.query('select id, name from public.schools_programmes');
      assert.equal(readByEdA.rows.length, 1, 'Educator A1 sees only Inst A programmes');
      assert.equal(readByEdA.rows[0].id, progAId);

      // Test RLS: Educator B reading programmes
      await setSession(db, educatorB, 'authenticated', 'ed@instb.test');
      const readByEdB = await db.query('select id, name from public.schools_programmes');
      assert.equal(readByEdB.rows.length, 1, 'Educator B sees only Inst B programmes');
      assert.equal(readByEdB.rows[0].id, progBId);

      // Test RLS: Student A1 reading programmes (denied)
      await setSession(db, studentA1, 'authenticated', 'student1@insta.test');
      const readByStudent = await db.query('select id, name from public.schools_programmes');
      assert.equal(readByStudent.rows.length, 0, 'Students cannot read institutional programmes table');

      // Test RLS: Founder reading programmes (sees both)
      await setSession(db, founderId, 'authenticated', 'founder@muqabala.test');
      const readByFounder = await db.query('select id, name from public.schools_programmes');
      assert.equal(readByFounder.rows.length, 2, 'Founder can inspect all programmes across institutions');

      await resetSession(db);

      // Security Gate: Cross-Tenant Programme Linking Prevention
      // Educator A attempts to create a cohort in Inst A linked to Programme B (belonging to Inst B)
      await assert.rejects(
        async () => {
          await db.query(
            "select public.schools_manage($1, 'cohort', $2::jsonb)",
            [educatorA1, JSON.stringify({ institutionId: instA, name: 'Malicious Cohort', programmeId: progBId })]
          );
        },
        /Programme not found in this institution/,
        'Cross-tenant programme linking in cohort must be rejected'
      );

      // Security Gate: Cross-Tenant Assignment Spoofing Prevention
      // Create a cohort & assignment in Inst B
      const cohortB = id('b', 20);
      const asgnB = id('b', 30);
      const qVersionB = id('b', 40);

      await db.exec(`
        insert into public.schools_cohorts (id, institution_id, name, enrolment_code, created_by)
          values ('${cohortB}', '${instB}', 'Culinary Cohort 1', 'CULINARY', '${educatorB}');
        insert into public.schools_cohort_educators (cohort_id, educator_user_id) values ('${cohortB}', '${educatorB}');
        insert into public.schools_question_versions (id, institution_id, question_key, version, role_id, language, question_text, rubric, approved_by, no_example_follow_up)
          values ('${qVersionB}', '${instB}', 'cul-q1', 1, 'chef', 'en', 'Describe knife safety.', '[{"id":"e1","label":"Grip","description":"proper grip"},{"id":"e2","label":"Board","description":"stable board"},{"id":"e3","label":"Motion","description":"smooth cut"},{"id":"e4","label":"Storage","description":"sheath"}]'::jsonb, '${educatorB}', 'What safety precautions did you take?');
        insert into public.schools_assignments (id, cohort_id, role_id, due_at, created_by, status)
          values ('${asgnB}', '${cohortB}', 'chef', now() + interval '7 days', '${educatorB}', 'published');
      `);

      // Educator A attempts to edit Inst B's assignment using Inst A's credentials
      await assert.rejects(
        async () => {
          await db.query(
            "select public.schools_manage($1, 'edit_assignment', $2::jsonb)",
            [educatorA1, JSON.stringify({ institutionId: instA, assignmentId: asgnB, dueAt: new Date().toISOString() })]
          );
        },
        /Assigned adviser access required/,
        'Cross-tenant assignment modification must be strictly denied'
      );

      // Security Gate: Student Draft Privacy
      const cohortA = id('a', 20);
      const asgnA = id('a', 30);
      const attDraftA = id('a', 50);

      await db.exec(`
        insert into public.schools_cohorts (id, institution_id, name, enrolment_code, created_by)
          values ('${cohortA}', '${instA}', 'FinTech Cohort A', 'FINTECH1', '${educatorA1}');
        insert into public.schools_cohort_educators (cohort_id, educator_user_id) values ('${cohortA}', '${educatorA1}');
        insert into public.schools_cohort_members (cohort_id, student_user_id, display_name, adult_confirmed_at)
          values ('${cohortA}', '${studentA1}', 'Student A1', now());
        insert into public.schools_assignments (id, cohort_id, role_id, due_at, created_by, status)
          values ('${asgnA}', '${cohortA}', 'analyst', now() + interval '7 days', '${educatorA1}', 'published');

        -- Insert Draft Attempt for Student A1
        insert into public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, created_at)
          values ('${attDraftA}', '${asgnA}', '${studentA1}', 1, 'draft', now());
      `);

      // Educator A1 queries assignment attempts: MUST NOT see the draft
      await setSession(db, educatorA1, 'authenticated', 'ed1@insta.test');
      const edAttempts = await db.query("select id, status from public.schools_assignment_attempts where assignment_id = $1", [asgnA]);
      assert.equal(edAttempts.rows.length, 0, 'Educators cannot see student draft attempts before submission');

      // Student A1 queries assignment attempts: MUST see their own draft
      await setSession(db, studentA1, 'authenticated', 'student1@insta.test');
      const studentAttempts = await db.query("select id, status from public.schools_assignment_attempts where assignment_id = $1", [asgnA]);
      assert.equal(studentAttempts.rows.length, 1, 'Student can see their own draft');
      assert.equal(studentAttempts.rows[0].status, 'draft');

      // Student B queries assignment attempts in Inst A: MUST see 0 rows
      await setSession(db, studentB, 'authenticated', 'student@instb.test');
      const peerAttempts = await db.query("select id, status from public.schools_assignment_attempts where assignment_id = $1", [asgnA]);
      assert.equal(peerAttempts.rows.length, 0, 'Students cannot view peer or other institution attempts');
    } finally {
      await resetSession(db);
    }
  });

  await suite.test('4. Full Synthetic University Simulation (10 Students & Interventions)', async () => {
    await resetSession(db);
    const uniId = id('u', 1);
    const deanUser = id('u', 2);
    const profUser = id('u', 3);

    // Setup University, Faculty, Programme, Cohort
    await db.exec(`
      insert into auth.users (id, email) values
        ('${deanUser}', 'dean.business@mtu.test'),
        ('${profUser}', 'prof.finance@mtu.test')
      on conflict do nothing;

      insert into public.schools_institutions (id, name, country, language, setup_complete, dpa_complete, approved_by, dpa_reference, approved_at) values
        ('${uniId}', 'Muqabala Test University', 'UAE', 'en', true, true, '${deanUser}', 'DPA-MTU-2026', now())
      on conflict do nothing;

      insert into public.schools_institution_members (institution_id, user_id, role, accepted_at) values
        ('${uniId}', '${deanUser}', 'institution_admin', now()),
        ('${uniId}', '${profUser}', 'educator', now())
      on conflict do nothing;
    `);

    // Create Programme & Cohort via schools_manage
    const progRes = await db.query(
      "select public.schools_manage($1, 'programme', $2::jsonb) as res",
      [
        profUser,
        JSON.stringify({
          institutionId: uniId,
          name: 'BSc Financial Technology & Banking',
          code: 'FIN-TECH-2027',
          campus: 'Dubai Silicon Oasis',
          faculty: 'School of Business & Economics',
          description: 'Institutional career-readiness training for investment banking and asset management.'
        })
      ]
    );
    const progId = progRes.rows[0].res.id;
    assert.ok(progId, 'Programme created successfully');

    const cohortRes = await db.query(
      "select public.schools_manage($1, 'cohort', $2::jsonb) as res",
      [
        profUser,
        JSON.stringify({
          institutionId: uniId,
          programmeId: progId,
          name: 'Class of 2027 - Corporate Finance Cohort',
          campus: 'Dubai Silicon Oasis',
          faculty: 'School of Business & Economics',
          programme: 'BSc Financial Technology & Banking'
        })
      ]
    );
    const cohortId = cohortRes.rows[0].res.id;
    assert.ok(cohortId, 'Cohort created with programme linkage');

    // Create 3 Approved Question Versions
    const qIds = [];
    for (let i = 1; i <= 3; i++) {
      const qRes = await db.query(
        "select public.schools_manage($1, 'question', $2::jsonb) as res",
        [
          profUser,
          JSON.stringify({
            institutionId: uniId,
            roleId: 'investment-banker',
            text: `Question ${i}: How do you perform discounted cash flow modeling under uncertainty?`,
            followUp: 'Provide an example of working capital adjustment.',
            rubric: [
              { id: `e${i}_1`, label: 'Methodology explanation', description: 'Clear DCF formula step' },
              { id: `e${i}_2`, label: 'WACC calculation', description: 'Cost of equity and debt weights' },
              { id: `e${i}_3`, label: 'Terminal value estimate', description: 'Perpetual growth or exit multiple' },
              { id: `e${i}_4`, label: 'Sensitivity analysis', description: 'Stress testing discount rates' },
            ]
          })
        ]
      );
      qIds.push(qRes.rows[0].res.id);
    }
    assert.equal(qIds.length, 3, 'Created 3 question versions');

    // Create Assignment in DRAFT status
    const asgnRes = await db.query(
      "select public.schools_manage($1, 'assignment', $2::jsonb) as res",
      [
        profUser,
        JSON.stringify({
          cohortId,
          roleId: 'investment-banker',
          industry: 'Financial Services & Investment Banking',
          jobTitle: 'Junior Investment Banking Analyst',
          jobDescription: 'Perform valuation models, financial benchmarking, and M&A pitchbook synthesis.',
          competencies: ['Valuation Modeling', 'Critical Thinking', 'Client Communication'],
          dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), // 24 hours from now
          maxAttempts: 3,
          instructions: 'Complete 3 structured video answers. Emphasize analytical rigor.',
          status: 'draft',
          questionIds: qIds
        })
      ]
    );
    const asgnId = asgnRes.rows[0].res.id;
    assert.equal(asgnRes.rows[0].res.status, 'draft', 'Assignment created in draft status');

    // Enroll 10 Students
    const students = [
      { id: id('s', 1), name: 'Fatima Al-Nuaimi', stdId: 'STD-2027-001', email: 'fatima@student.mtu.test' },
      { id: id('s', 2), name: 'Tariq Mansoor', stdId: 'STD-2027-002', email: 'tariq@student.mtu.test' },
      { id: id('s', 3), name: 'Sara Chen', stdId: 'STD-2027-003', email: 'sara@student.mtu.test' },
      { id: id('s', 4), name: 'Omar Al-Hashimi', stdId: 'STD-2027-004', email: 'omar@student.mtu.test' },
      { id: id('s', 5), name: 'Layla Al-Mansoor', stdId: 'STD-2027-005', email: 'layla@student.mtu.test' },
      { id: id('s', 6), name: 'Zayd Ibrahim', stdId: 'STD-2027-006', email: 'zayd@student.mtu.test' },
      { id: id('s', 7), name: 'Maryam Al-Kuwari', stdId: 'STD-2027-007', email: 'maryam@student.mtu.test' },
      { id: id('s', 8), name: 'Khalid Al-Mutawa', stdId: 'STD-2027-008', email: 'khalid@student.mtu.test' },
      { id: id('s', 9), name: 'Noura Al-Falasi', stdId: 'STD-2027-009', email: 'noura@student.mtu.test' },
      { id: id('s', 10), name: 'Hamad Al-Suwaidi', stdId: 'STD-2027-010', email: 'hamad@student.mtu.test' },
    ];

    for (const s of students) {
      await db.exec(`
        insert into auth.users (id, email) values ('${s.id}', '${s.email}') on conflict do nothing;
        insert into public.schools_cohort_members (cohort_id, student_user_id, display_name, student_identifier, adult_confirmed_at)
          values ('${cohortId}', '${s.id}', '${s.name}', '${s.stdId}', now());
      `);
    }

    // Publish Assignment
    const publishRes = await db.query(
      "select public.schools_manage($1, 'edit_assignment', $2::jsonb) as res",
      [profUser, JSON.stringify({ assignmentId: asgnId, status: 'published' })]
    );
    assert.equal(publishRes.rows[0].res.status, 'published', 'Assignment published successfully');

    // Simulate Student Attempts & States:
    const now = Date.now();
    const attempts = [];
    const supportRequests = [];

    // Student 1 (Fatima): Submitted Attempt 1, High Evidence (11 / 12)
    const attFatima = id('att', 1);
    await db.exec(`
      insert into public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, evidence_covered)
        values ('${attFatima}', '${asgnId}', '${students[0].id}', 1, 'submitted', now() - interval '4 hours', 11);
    `);
    attempts.push({
      id: attFatima,
      assignment_id: asgnId,
      student_user_id: students[0].id,
      attempt_number: 1,
      status: 'submitted',
      submitted_at: new Date(now - 4 * 3600 * 1000).toISOString(),
      evidence_covered: 11
    });

    // Student 2 (Tariq): Submitted Attempt 1, Low Evidence (3 / 12) -> triggers low_evidence
    const attTariq = id('att', 2);
    await db.exec(`
      insert into public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, evidence_covered)
        values ('${attTariq}', '${asgnId}', '${students[1].id}', 1, 'submitted', now() - interval '3 hours', 3);
    `);
    attempts.push({
      id: attTariq,
      assignment_id: asgnId,
      student_user_id: students[1].id,
      attempt_number: 1,
      status: 'submitted',
      submitted_at: new Date(now - 3 * 3600 * 1000).toISOString(),
      evidence_covered: 3
    });

    // Student 3 (Sara): Submitted Attempt 1 (8 elements) & Attempt 2 (7 elements) -> stagnant_attempts
    const attSara1 = id('att', 31);
    const attSara2 = id('att', 32);
    await db.exec(`
      insert into public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, evidence_covered)
        values ('${attSara1}', '${asgnId}', '${students[2].id}', 1, 'submitted', now() - interval '48 hours', 8),
               ('${attSara2}', '${asgnId}', '${students[2].id}', 2, 'submitted', now() - interval '6 hours', 7);
    `);
    attempts.push(
      { id: attSara1, assignment_id: asgnId, student_user_id: students[2].id, attempt_number: 1, status: 'submitted', submitted_at: new Date(now - 48 * 3600 * 1000).toISOString(), evidence_covered: 8 },
      { id: attSara2, assignment_id: asgnId, student_user_id: students[2].id, attempt_number: 2, status: 'submitted', submitted_at: new Date(now - 6 * 3600 * 1000).toISOString(), evidence_covered: 7 }
    );

    // Student 4 (Omar): Draft opened 52 hours ago -> stalled_draft
    const attOmar = id('att', 4);
    await db.exec(`
      insert into public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, created_at)
        values ('${attOmar}', '${asgnId}', '${students[3].id}', 1, 'draft', now() - interval '52 hours');
    `);
    attempts.push({
      id: attOmar,
      assignment_id: asgnId,
      student_user_id: students[3].id,
      attempt_number: 1,
      status: 'draft',
      created_at: new Date(now - 52 * 3600 * 1000).toISOString(),
    });

    // Student 5 (Layla): 0 attempts recorded, due in 24 hours -> deadline_unstarted (no attempts pushed)

    // Student 6 (Zayd): Open Support Request -> support_requested (with submitted attempt, avoiding deadline_unstarted)
    const attZayd = id('att', 60);
    await db.exec(`
      insert into public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, evidence_covered)
        values ('${attZayd}', '${asgnId}', '${students[5].id}', 1, 'submitted', now() - interval '18 hours', 8);
      insert into public.schools_support_requests (cohort_id, student_user_id, created_by, owner_educator_id, status, note)
        values ('${cohortId}', '${students[5].id}', 'student', '${profUser}', 'open', 'Need guidance structuring the DCF growth stage');
    `);
    attempts.push({
      id: attZayd,
      assignment_id: asgnId,
      student_user_id: students[5].id,
      attempt_number: 1,
      status: 'submitted',
      submitted_at: new Date(now - 18 * 3600 * 1000).toISOString(),
      evidence_covered: 8,
    });
    supportRequests.push({
      student_user_id: students[5].id,
      status: 'open',
      note: 'Need guidance structuring the DCF growth stage',
      created_at: new Date(now - 2 * 3600 * 1000).toISOString(),
    });

    // Students 7-10: On Track Submissions (Evidence 7-10 / 12)
    for (let i = 6; i < 10; i++) {
      const attId = id('att', i + 1);
      const score = 7 + (i - 6);
      await db.exec(`
        insert into public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, evidence_covered)
          values ('${attId}', '${asgnId}', '${students[i].id}', 1, 'submitted', now() - interval '10 hours', ${score});
      `);
      attempts.push({
        id: attId,
        assignment_id: asgnId,
        student_user_id: students[i].id,
        attempt_number: 1,
        status: 'submitted',
        submitted_at: new Date(now - 10 * 3600 * 1000).toISOString(),
        evidence_covered: score
      });
    }

    // Run Intervention Engine against all 10 students
    const signals = detectInterventionSignals({
      cohortId,
      members: students.map(s => ({ student_user_id: s.id, display_name: s.name, student_identifier: s.stdId })),
      assignments: [{ id: asgnId, role_id: 'investment-banker', job_title: 'Junior Investment Banking Analyst', due_at: new Date(now + 24 * 3600 * 1000).toISOString(), question_count: 3 }],
      attempts,
      supportRequests,
      now,
    });

    // Validate Signals
    assert.equal(signals.length, 5, 'Exactly 5 actionable signals detected across 10 students');

    const lowEvSignal = signals.find(s => s.studentId === students[1].id);
    assert.ok(lowEvSignal, 'Tariq has low_evidence signal');
    assert.equal(lowEvSignal.category, 'low_evidence');
    assert.equal(lowEvSignal.severity, 'urgent');
    assert.ok(lowEvSignal.evidenceBasis.includes('< 6 of 12'));

    const stagnantSignal = signals.find(s => s.studentId === students[2].id);
    assert.ok(stagnantSignal, 'Sara has stagnant_attempts signal');
    assert.equal(stagnantSignal.category, 'stagnant_attempts');
    assert.equal(stagnantSignal.severity, 'advisory');

    const stalledSignal = signals.find(s => s.studentId === students[3].id);
    assert.ok(stalledSignal, 'Omar has stalled_draft signal');
    assert.equal(stalledSignal.category, 'stalled_draft');

    const deadlineSignal = signals.find(s => s.studentId === students[4].id);
    assert.ok(deadlineSignal, 'Layla has deadline_unstarted signal');
    assert.equal(deadlineSignal.category, 'deadline_unstarted');

    const supportSignal = signals.find(s => s.studentId === students[5].id);
    assert.ok(supportSignal, 'Zayd has support_requested signal');
    assert.equal(supportSignal.category, 'support_requested');

    // Confirm that on-track students (Fatima, Maryam, Khalid, Noura, Hamad) have zero signals
    for (const student of [students[0], students[6], students[7], students[8], students[9]]) {
      assert.equal(signals.filter(s => s.studentId === student.id).length, 0, `${student.name} is on track with 0 signals`);
    }

    // Strict Product Guarantee: Zero psychological labels and zero peer ranking
    const jsonStr = JSON.stringify(signals).toLowerCase();
    assert.ok(!jsonStr.includes('diagnosis'), 'Zero diagnostic terms in output');
    assert.ok(!jsonStr.includes('pathology'), 'Zero pathology terms in output');
    assert.ok(!jsonStr.includes('rank'), 'Zero ranking terms in output');
    assert.ok(!jsonStr.includes('percentile'), 'Zero percentile terms in output');
  });

  await suite.test('5. Assignment Lifecycle, Immutability & Safe Duplication', async () => {
    await resetSession(db);
    const profUser = id('u', 3);
    const asgnId = (await db.query("select id from public.schools_assignments where role_id = 'investment-banker' limit 1")).rows[0].id;

    // Student attempts exist for this assignment (from Phase 4)
    // Attempting to modify questions must be BLOCKED by PostgreSQL exception
    await assert.rejects(
      async () => {
        await db.query(
          "select public.schools_manage($1, 'edit_assignment', $2::jsonb)",
          [
            profUser,
            JSON.stringify({
              assignmentId: asgnId,
              questionIds: [id('q', 1), id('q', 2), id('q', 3)]
            })
          ]
        );
      },
      /Assessment content cannot be modified after student attempts have started/,
      'Must block assessment question alteration after attempts have started'
    );

    // Attempting to change role_id must also be BLOCKED
    await assert.rejects(
      async () => {
        await db.query(
          "select public.schools_manage($1, 'edit_assignment', $2::jsonb)",
          [
            profUser,
            JSON.stringify({
              assignmentId: asgnId,
              roleId: 'new-role'
            })
          ]
        );
      },
      /Assessment content cannot be modified after student attempts have started/,
      'Must block role change after attempts have started'
    );

    // Administrative metadata updates (extending deadline, updating instructions, status) must SUCCEED
    const safeUpdate = await db.query(
      "select public.schools_manage($1, 'edit_assignment', $2::jsonb) as res",
      [
        profUser,
        JSON.stringify({
          assignmentId: asgnId,
          dueAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          instructions: 'Updated: Please review your DCF assumptions before submission.'
        })
      ]
    );
    assert.equal(safeUpdate.rows[0].res.instructions, 'Updated: Please review your DCF assumptions before submission.');

    // Safe Duplication: Create Assignment v2
    const dupRes = await db.query(
      "select public.schools_manage($1, 'duplicate_assignment', $2::jsonb) as res",
      [profUser, JSON.stringify({ assignmentId: asgnId })]
    );
    const asgnV2 = dupRes.rows[0].res;
    assert.ok(asgnV2.id, 'Duplicated assignment created');
    assert.equal(asgnV2.status, 'draft', 'Duplicated assignment begins in draft');
    assert.equal(asgnV2.version, 2, 'Duplicated assignment version incremented to 2');
    assert.equal(asgnV2.duplicated_from_id, asgnId, 'Duplicated assignment references original parent');

    // Questions are copied to v2
    const v2Questions = await db.query(
      "select count(*) as c from public.schools_assignment_questions where assignment_id = $1",
      [asgnV2.id]
    );
    assert.equal(Number(v2Questions.rows[0].c), 3, 'Questions cleanly copied to v2');

    // On v2 (no attempts yet), educator CAN freely edit questions
    const q4Res = await db.query(
      "select public.schools_manage($1, 'question', $2::jsonb) as res",
      [
        profUser,
        JSON.stringify({
          institutionId: id('u', 1),
          roleId: 'investment-banker',
          text: 'Question 4: Explain LBO debt tranches and repayment waterfalls.',
          followUp: 'Discuss mezzanine financing.',
          rubric: [
            { id: 'lbo_1', label: 'Senior debt', description: 'Bank loans' },
            { id: 'lbo_2', label: 'Subordinated notes', description: 'High yield' },
            { id: 'lbo_3', label: 'Equity contribution', description: 'Sponsor equity' },
            { id: 'lbo_4', label: 'Waterfall logic', description: 'Cash sweep' }
          ]
        })
      ]
    );
    const q4Id = q4Res.rows[0].res.id;

    const q5Res = await db.query(
      "select public.schools_manage($1, 'question', $2::jsonb) as res",
      [
        profUser,
        JSON.stringify({
          institutionId: id('u', 1),
          roleId: 'investment-banker',
          text: 'Question 5: Explain working capital adjustments in free cash flow.',
          followUp: 'Discuss receivables.',
          rubric: [
            { id: 'wcap_1', label: 'Working capital delta', description: 'Current assets minus liabilities' },
            { id: 'wcap_2', label: 'Cash flow impact', description: 'Source vs use of cash' },
            { id: 'wcap_3', label: 'Days sales outstanding', description: 'Receivables cycle' },
            { id: 'wcap_4', label: 'Days inventory outstanding', description: 'Inventory cycle' }
          ]
        })
      ]
    );
    const q5Id = q5Res.rows[0].res.id;

    const firstQId = (await db.query("select question_version_id from public.schools_assignment_questions where assignment_id = $1 limit 1", [asgnV2.id])).rows[0].question_version_id;

    const v2Edit = await db.query(
      "select public.schools_manage($1, 'edit_assignment', $2::jsonb) as res",
      [
        profUser,
        JSON.stringify({
          assignmentId: asgnV2.id,
          maxAttempts: 5,
          questionIds: [firstQId, q4Id, q5Id]
        })
      ]
    );
    assert.equal(v2Edit.rows[0].res.max_attempts, 5, 'v2 freely edited prior to attempts');
  });

  await suite.test('6. Recruiter Assistance Suite Validation', async () => {
    await resetSession(db);
    const employerId = id('emp', 1);
    const packId = id('pack', 1);
    const candidateId = id('cand', 1);
    const candidateEmail = 'candidate@recruiter.test';

    await db.exec(`
      insert into auth.users (id, email) values
        ('${employerId}', 'recruiter@employer.test'),
        ('${candidateId}', '${candidateEmail}')
      on conflict do nothing;

      insert into public.screening_packs (id, employer_id, public_code, signed_token, expires_at, location, timezone, published_facts, questionnaire_language)
        values ('${packId}', '${employerId}', 'PACKTEST01', 'token-sample-signed', now() + interval '14 days', 'Dubai, UAE', 'Asia/Dubai', '{"department": "FinTech"}'::jsonb, 'both');

      insert into public.role_invites (role_id, candidate_ref, email, name, channel, token_hash, token_cipher, contact_allowed)
        values ('${packId}', 'MQ-TEST22', '${candidateEmail}', 'Applicant One', 'email', '${'a'.repeat(64)}', 'cipher01', true);
    `);

    // Candidate submits a question
    const qHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    await db.exec(`
      insert into public.candidate_role_questions (role_id, candidate_id, candidate_email, question_text, question_hash)
        values ('${packId}', '${candidateId}', '${candidateEmail}', 'What is the expected start date for this internship?', '${qHash}');
    `);
    const qRow = (await db.query("select id, question_text from public.candidate_role_questions where role_id = $1", [packId])).rows[0];
    assert.ok(qRow.id, 'Candidate question stored in candidate_role_questions');

    // Recruiter replies to question
    await db.exec(`
      update public.candidate_role_questions set
        reply_text = 'The start date is October 1, 2026.',
        replied_at = now(),
        replied_by = '${employerId}',
        resolved_at = now(),
        resolved_by = '${employerId}'
      where id = '${qRow.id}';
    `);
    const repliedRow = (await db.query("select reply_text, replied_at from public.candidate_role_questions where id = $1", [qRow.id])).rows[0];
    assert.equal(repliedRow.reply_text, 'The start date is October 1, 2026.', 'Recruiter reply recorded');

    // Recruiter queues a manual reminder batch
    const inviteId = (await db.query("select id from public.role_invites where role_id = $1", [packId])).rows[0].id;
    const batchKey = id('bat', 1);
    const queueRes = await db.query(
      "select public.queue_manual_employer_reminders($1, $2, array[$3]::uuid[], $4, $5) as res",
      [packId, employerId, inviteId, 'Reminder: please submit your video screening sample.', batchKey]
    );
    assert.ok(queueRes.rows[0].res, 'Manual reminder batch executed');

    // Candidate opts out -> opted_out_at stamped
    await db.exec(`
      update public.role_invites set contact_allowed = false, opted_out_at = now()
      where role_id = '${packId}' and email = '${candidateEmail}';
    `);

    const invite = (await db.query("select contact_allowed, opted_out_at from public.role_invites where role_id = $1", [packId])).rows[0];
    assert.equal(invite.contact_allowed, false, 'Candidate contact preference honoured');
    assert.ok(invite.opted_out_at, 'Opt-out timestamp recorded');
  });
});
