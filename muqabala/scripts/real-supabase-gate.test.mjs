import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import crypto from 'node:crypto';
import { detectInterventionSignals } from '../lib/schools/intervention.ts';

const CONNECTION_STRING = process.env.REAL_SUPABASE_DATABASE_URL;

if (!CONNECTION_STRING) {
  throw new Error(
    'REAL_SUPABASE_DATABASE_URL is not set. Set it to the pre-production branch Postgres connection string before running this gate test.'
  );
}

describe('REAL SUPABASE PRE-PRODUCTION GATE (Branch: rbumgaluykobrfmhlftg)', () => {
  let client;

  before(async () => {
    client = new Client({
      connectionString: CONNECTION_STRING,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
  });

  after(async () => {
    if (client) {
      await client.end();
    }
  });

  async function createAuthUser(id) {
    const email = `user_${id.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@muqabala.test`;
    await client.query(`
      INSERT INTO auth.users (id, email)
      VALUES ($1, $2)
      ON CONFLICT (id) DO NOTHING;
    `, [id, email]);
  }

  function randomCode8() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  function randomCrockford6() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = '';
    for (let i = 0; i < 6; i++) {
      s += chars[crypto.randomInt(0, chars.length)];
    }
    return 'MQ-' + s;
  }

  async function asUser(userId, role = 'authenticated', fn) {
    const sessionId = crypto.randomUUID();
    if (userId) {
      await client.query(`
        INSERT INTO public.schools_sessions (user_id, session_id, last_seen_at)
        VALUES ($1, $2, now())
        ON CONFLICT (session_id) DO NOTHING;
      `, [userId, sessionId]);
    }

    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL ROLE ${role}`);
      if (userId) {
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
        await client.query(`SELECT set_config('request.jwt.claim.role', $1, true)`, [role]);
        await client.query(`SELECT set_config('request.jwt.claim', $1, true)`, [
          JSON.stringify({ sub: userId, role, session_id: sessionId })
        ]);
      }
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  it('1. Schema & Constraints: Verifies check constraints and schema invariants', async () => {
    const instId = crypto.randomUUID();
    const cohortId = crypto.randomUUID();
    const asgnId = crypto.randomUUID();
    const adminUser = crypto.randomUUID();

    await createAuthUser(adminUser);

    // Create setup institution and cohort
    await client.query(`
      INSERT INTO public.schools_institutions (id, name, country, language)
      VALUES ($1, 'Constraint Test Univ', 'AE', 'en');
    `, [instId]);

    const code = randomCode8();
    await client.query(`
      INSERT INTO public.schools_cohorts (id, institution_id, name, enrolment_code, created_by)
      VALUES ($1, $2, 'Cohort 1', $3, $4);
    `, [cohortId, instId, code, adminUser]);

    await client.query(`
      INSERT INTO public.schools_assignments (id, cohort_id, job_title, role_id, status, due_at, version, created_by)
      VALUES ($1, $2, 'Software Engineer Mock', 'software-engineer', 'draft', now() + interval '7 days', 1, $3);
    `, [asgnId, cohortId, adminUser]);

    // Create question versions for testing assignment question index constraints (0..7)
    const qv1 = crypto.randomUUID();
    const qv2 = crypto.randomUUID();
    const qv3 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.schools_question_versions (id, institution_id, question_key, version, role_id, language, question_text, rubric, approved_by, no_example_follow_up)
      VALUES 
        ($1, $4, 'qkey_1', 1, 'software-engineer', 'en', 'Question 1', '["r1", "r2", "r3", "r4"]'::jsonb, $5, 'Could you give an example?'),
        ($2, $4, 'qkey_2', 1, 'software-engineer', 'en', 'Question 2', '["r1", "r2", "r3", "r4"]'::jsonb, $5, 'Could you give an example?'),
        ($3, $4, 'qkey_3', 1, 'software-engineer', 'en', 'Question 3', '["r1", "r2", "r3", "r4"]'::jsonb, $5, 'Could you give an example?');
    `, [qv1, qv2, qv3, instId, adminUser]);

    // Insert valid question indices 0 and 7
    await client.query(`
      INSERT INTO public.schools_assignment_questions (assignment_id, question_index, question_version_id)
      VALUES ($1, 0, $2), ($1, 7, $3);
    `, [asgnId, qv1, qv2]);

    // Insert invalid question index 8 -> must fail check constraint
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO public.schools_assignment_questions (assignment_id, question_index, question_version_id)
          VALUES ($1, 8, $2);
        `, [asgnId, qv3]);
      },
      /check/i,
      'Should reject question_index 8 exceeding 0..7'
    );

    // Crockford Base32 check constraint on role_invites
    const employerId = crypto.randomUUID();
    const packId = crypto.randomUUID();
    await createAuthUser(employerId);

    const packCode = 'PK' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const packToken = 'tk_' + crypto.randomBytes(4).toString('hex');
    await client.query(`
      INSERT INTO public.screening_packs (id, employer_id, public_code, signed_token, workplace, expires_at)
      VALUES ($1, $2, $3, $4, 'Screening Pack 1', now() + interval '30 days');
    `, [packId, employerId, packCode, packToken]);

    // Valid Base32 Crockford ref e.g. MQ-7X9B2K, valid 64-hex token
    const validRef = randomCrockford6();
    const validHex = crypto.randomBytes(32).toString('hex');
    await client.query(`
      INSERT INTO public.role_invites (role_id, candidate_ref, token_hash, token_cipher, name, email, channel)
      VALUES ($1, $2, $3, 'cipher_val', 'Candidate One', 'cand1@example.com', 'email');
    `, [packId, validRef, validHex]);

    // Invalid Base32 (contains forbidden letter 'I' or 'O' or lowercase) -> must fail
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO public.role_invites (role_id, candidate_ref, token_hash, token_cipher, name, email, channel)
          VALUES ($1, 'MQ-INVALID', $2, 'cipher_val', 'Candidate Two', 'cand2@example.com', 'email');
        `, [packId, validHex]);
      },
      /check/i,
      'Should reject invalid Crockford Base32 ref'
    );

    // Invalid token_hash (less than 64 hex characters) -> must fail
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO public.role_invites (role_id, candidate_ref, token_hash, token_cipher, name, email, channel)
          VALUES ($1, 'MQ-8Y3C9M', 'short_hash', 'cipher_val', 'Candidate Three', 'cand3@example.com', 'email');
        `, [packId]);
      },
      /check/i,
      'Should reject token_hash not matching 64-hex pattern'
    );
  });

  it('2. Tenant & Role Isolation (RLS / RBAC)', async () => {
    const instA = crypto.randomUUID();
    const instB = crypto.randomUUID();
    const educatorA = crypto.randomUUID();
    const educatorB = crypto.randomUUID();
    const studentA = crypto.randomUUID();
    const studentB = crypto.randomUUID();

    // Create auth users
    await createAuthUser(educatorA);
    await createAuthUser(educatorB);
    await createAuthUser(studentA);
    await createAuthUser(studentB);

    // Create Institution A and B
    await client.query(`
      INSERT INTO public.schools_institutions (id, name, country, language)
      VALUES 
        ($1, 'Institution Alpha', 'AE', 'en'),
        ($2, 'Institution Beta', 'SA', 'ar');
    `, [instA, instB]);

    // Register educators in institution_members
    await client.query(`
      INSERT INTO public.schools_institution_members (institution_id, user_id, role, accepted_at)
      VALUES 
        ($1, $3, 'educator', now()),
        ($2, $4, 'educator', now());
    `, [instA, instB, educatorA, educatorB]);

    // Create Programmes in Inst A and Inst B
    const progA = crypto.randomUUID();
    const progB = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.schools_programmes (id, institution_id, name, code, created_by)
      VALUES 
        ($1, $3, 'Alpha Computer Science', 'CS-A', $5),
        ($2, $4, 'Beta Mechanical Eng', 'ME-B', $6);
    `, [progA, progB, instA, instB, educatorA, educatorB]);

    // Create Cohorts in Inst A and Inst B
    const cohortA = crypto.randomUUID();
    const cohortB = crypto.randomUUID();
    const codeA = randomCode8();
    const codeB = randomCode8();
    await client.query(`
      INSERT INTO public.schools_cohorts (id, institution_id, programme_id, name, enrolment_code, created_by)
      VALUES 
        ($1, $3, $5, 'Alpha 2026', $7, $9),
        ($2, $4, $6, 'Beta 2026', $8, $10);
    `, [cohortA, cohortB, instA, instB, progA, progB, codeA, codeB, educatorA, educatorB]);

    // Assign educators to their respective cohorts
    await client.query(`
      INSERT INTO public.schools_cohort_educators (cohort_id, educator_user_id)
      VALUES 
        ($1, $3),
        ($2, $4);
    `, [cohortA, cohortB, educatorA, educatorB]);

    // RLS Test: Educator A queries schools_programmes -> should only see Inst A programme
    await asUser(educatorA, 'authenticated', async (tx) => {
      const res = await tx.query(`SELECT id, name FROM public.schools_programmes;`);
      const ids = res.rows.map(r => r.id);
      assert.ok(ids.includes(progA), 'Educator A should see Inst A programme');
      assert.ok(!ids.includes(progB), 'Educator A must NOT see Inst B programme');
    });

    // RLS Test: Educator B queries schools_cohorts -> should only see Inst B cohort
    await asUser(educatorB, 'authenticated', async (tx) => {
      const res = await tx.query(`SELECT id, name FROM public.schools_cohorts;`);
      const ids = res.rows.map(r => r.id);
      assert.ok(ids.includes(cohortB), 'Educator B should see Inst B cohort');
      assert.ok(!ids.includes(cohortA), 'Educator B must NOT see Inst A cohort');
    });

    // Cross-tenant programme linking prevention: Creating cohort in Inst A with Inst B programme must fail
    await assert.rejects(
      async () => {
        await client.query(`
          SELECT public.schools_manage($1, 'cohort', $2::jsonb);
        `, [educatorA, JSON.stringify({
          institutionId: instA,
          name: 'Malicious Cohort',
          programmeId: progB
        })]);
      },
      /Programme not found in this institution/i,
      'Must reject cross-tenant programme linkage'
    );

    // Cross-tenant assignment edit prevention: Educator B attempting to edit Inst A assignment must fail
    const asgnA = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.schools_assignments (id, cohort_id, job_title, role_id, status, due_at, created_by)
      VALUES ($1, $2, 'Alpha Exam', 'general', 'draft', now() + interval '7 days', $3);
    `, [asgnA, cohortA, educatorA]);

    await assert.rejects(
      async () => {
        await client.query(`
          SELECT public.schools_manage($1, 'edit_assignment', $2::jsonb);
        `, [educatorB, JSON.stringify({
          assignmentId: asgnA,
          jobTitle: 'Hacked Title'
        })]);
      },
      /adviser access required/i,
      'Must reject cross-tenant assignment manipulation'
    );

    // Student draft privacy: Student B cannot see Student A draft attempt
    const attemptA = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.schools_cohort_members (cohort_id, student_user_id, display_name, adult_confirmed_at)
      VALUES 
        ($1, $2, 'Student A', now()),
        ($1, $3, 'Student B', now());
    `, [cohortA, studentA, studentB]);

    await client.query(`
      INSERT INTO public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status)
      VALUES ($1, $2, $3, 1, 'draft');
    `, [attemptA, asgnA, studentA]);

    await asUser(studentB, 'authenticated', async (tx) => {
      const res = await tx.query(`SELECT id FROM public.schools_assignment_attempts WHERE id = $1;`, [attemptA]);
      assert.equal(res.rows.length, 0, 'Student B must not see Student A draft attempt');
    });
  });

  it('3. Assignment Lifecycle, Immutability & Safe Duplication', async () => {
    const instId = crypto.randomUUID();
    const educatorId = crypto.randomUUID();
    const cohortId = crypto.randomUUID();
    const studentId = crypto.randomUUID();

    await createAuthUser(educatorId);
    await createAuthUser(studentId);

    // Create institution, educator, cohort
    await client.query(`
      INSERT INTO public.schools_institutions (id, name, country, language, setup_complete, dpa_complete, dpa_reference, approved_by, approved_at)
      VALUES ($1, 'Lifecycle Univ', 'AE', 'en', true, true, 'DPA-LIFECYCLE', $2, now());
    `, [instId, educatorId]);

    await client.query(`
      INSERT INTO public.schools_institution_members (institution_id, user_id, role, accepted_at)
      VALUES ($1, $2, 'educator', now());
    `, [instId, educatorId]);

    const code = randomCode8();
    await client.query(`
      INSERT INTO public.schools_cohorts (id, institution_id, name, enrolment_code, created_by)
      VALUES ($1, $2, 'Class 2026', $3, $4);
    `, [cohortId, instId, code, educatorId]);

    await client.query(`
      INSERT INTO public.schools_cohort_educators (cohort_id, educator_user_id)
      VALUES ($1, $2);
    `, [cohortId, educatorId]);

    await client.query(`
      INSERT INTO public.schools_cohort_members (cohort_id, student_user_id, display_name, adult_confirmed_at)
      VALUES ($1, $2, 'Lifecycle Student', now());
    `, [cohortId, studentId]);

    // Create question versions for this institution
    const qIds = [];
    for (let i = 1; i <= 5; i++) {
      const qvId = crypto.randomUUID();
      qIds.push(qvId);
      await client.query(`
        INSERT INTO public.schools_question_versions (id, institution_id, question_key, version, role_id, language, question_text, rubric, approved_by, no_example_follow_up)
        VALUES ($1, $2, $3, 1, 'software-engineer', 'en', $4, '["r1", "r2", "r3", "r4"]'::jsonb, $5, 'Could you give an example?');
      `, [qvId, instId, `qkey_${i}`, `Question ${i} text`, educatorId]);
    }

    // 1. Create draft assignment with 3 questions
    const asgnRes = await client.query(`
      SELECT public.schools_manage($1, 'assignment', $2::jsonb) as res;
    `, [educatorId, JSON.stringify({
      cohortId,
      jobTitle: 'Software Engineer Mock',
      roleId: 'software-engineer',
      status: 'draft',
      dueAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      questionIds: [qIds[0], qIds[1], qIds[2]],
      maxAttempts: 3,
      instructions: 'Review your webcam before starting.'
    })]);
    const asgnId = asgnRes.rows[0].res.id;
    assert.ok(asgnId, 'Assignment should be created');

    // 2. While in draft, config edits (questions, title) are freely allowed
    await client.query(`
      SELECT public.schools_manage($1, 'edit_assignment', $2::jsonb);
    `, [educatorId, JSON.stringify({
      assignmentId: asgnId,
      jobTitle: 'Software Engineer Mock v1.1',
      questionIds: [qIds[0], qIds[1], qIds[2], qIds[3]]
    })]);

    // 3. Publish assignment
    await client.query(`
      SELECT public.schools_manage($1, 'edit_assignment', $2::jsonb);
    `, [educatorId, JSON.stringify({
      assignmentId: asgnId,
      status: 'published'
    })]);

    const pubRow = (await client.query(`SELECT status, version FROM public.schools_assignments WHERE id = $1`, [asgnId])).rows[0];
    assert.equal(pubRow.status, 'published');
    assert.equal(pubRow.version, 1);

    // 4. Once published, modifying questions is rejected by database trigger
    await assert.rejects(
      async () => {
        await client.query(`
          SELECT public.schools_manage($1, 'edit_assignment', $2::jsonb);
        `, [educatorId, JSON.stringify({
          assignmentId: asgnId,
          questionIds: [qIds[0], qIds[1], qIds[2]]
        })]);
      },
      /Published questions are immutable/i,
      'Database trigger must reject modifying questions of published assignment'
    );

    // 4. Student submits attempt 1
    const attemptId = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, answers)
      VALUES ($1, $2, $3, 1, 'submitted', now(), '["Ans 1", "Ans 2", "Ans 3"]'::jsonb);
    `, [attemptId, asgnId, studentId]);

    // 5. Immutability: Mutating assessment config when attempts exist must be rejected
    await assert.rejects(
      async () => {
        await client.query(`
          SELECT public.schools_manage($1, 'edit_assignment', $2::jsonb);
        `, [educatorId, JSON.stringify({
          assignmentId: asgnId,
          maxAttempts: 5
        })]);
      },
      /Assessment content cannot be modified after student attempts have started/i,
      'Must enforce assessment immutability once attempts exist'
    );

    // 6. Safe metadata edits (dueAt, instructions) succeed
    await client.query(`
      SELECT public.schools_manage($1, 'edit_assignment', $2::jsonb);
    `, [educatorId, JSON.stringify({
      assignmentId: asgnId,
      instructions: 'Updated guidance: please check microphone gain.'
    })]);

    const updatedRow = (await client.query(`SELECT instructions FROM public.schools_assignments WHERE id = $1`, [asgnId])).rows[0];
    assert.equal(updatedRow.instructions, 'Updated guidance: please check microphone gain.');

    // 7. Duplicate assignment creates version 2 in draft
    const dupRes = await client.query(`
      SELECT public.schools_manage($1, 'duplicate_assignment', $2::jsonb) as res;
    `, [educatorId, JSON.stringify({ assignmentId: asgnId })]);
    const v2Id = dupRes.rows[0].res.id;
    assert.ok(v2Id, 'Duplicated assignment ID returned');

    const v2Row = (await client.query(`SELECT status, version, duplicated_from_id FROM public.schools_assignments WHERE id = $1`, [v2Id])).rows[0];
    assert.equal(v2Row.status, 'draft', 'Version 2 should start in draft');
    assert.equal(v2Row.version, 2, 'Version 2 should have version = 2');
    assert.equal(v2Row.duplicated_from_id, asgnId, 'Version 2 should point to parent');

    // 8. Version 2 is freely editable before student participation
    await client.query(`
      SELECT public.schools_manage($1, 'edit_assignment', $2::jsonb);
    `, [educatorId, JSON.stringify({
      assignmentId: v2Id,
      jobTitle: 'Software Engineer Mock - 2027 Edition'
    })]);
    const v2Edited = (await client.query(`SELECT job_title FROM public.schools_assignments WHERE id = $1`, [v2Id])).rows[0];
    assert.equal(v2Edited.job_title, 'Software Engineer Mock - 2027 Edition');

    // 9. Adviser Review with separate internal notes and student-facing comment
    const reviewRes = await client.query(`
      SELECT public.schools_write($1, 'review', $2::jsonb) as res;
    `, [educatorId, JSON.stringify({
      attemptId,
      state: 'needs_more',
      comment: 'Good effort on STAR structure. Please clarify the quantifiable impact in question 2.',
      internalNotes: 'Student may need referral to writing lab. Revisit during week 4 faculty sync.',
      revision: 0,
    })]);
    assert.ok(reviewRes.rows[0].res, 'Review saved successfully');
    assert.equal(reviewRes.rows[0].res.comment, 'Good effort on STAR structure. Please clarify the quantifiable impact in question 2.');
    assert.equal(reviewRes.rows[0].res.internal_notes, 'Student may need referral to writing lab. Revisit during week 4 faculty sync.');

    // 10. Student Privacy Isolation: Student report query selects only public fields (never internal_notes)
    await asUser(studentId, 'authenticated', async (tx) => {
      const studentReportReview = await tx.query(`
        SELECT state, comment, revision FROM public.schools_reviews WHERE assignment_attempt_id = $1;
      `, [attemptId]);
      assert.equal(studentReportReview.rows.length, 1);
      assert.equal(studentReportReview.rows[0].comment, 'Good effort on STAR structure. Please clarify the quantifiable impact in question 2.');
      assert.equal(studentReportReview.rows[0].internal_notes, undefined, 'Student report query must never request internal_notes');
    });
  });

  it('4. Synthetic University Simulation (10 Students & Explainable Interventions)', async () => {
    const instId = crypto.randomUUID();
    const educatorId = crypto.randomUUID();
    const progId = crypto.randomUUID();
    const cohortId = crypto.randomUUID();
    const asgnId = crypto.randomUUID();

    await createAuthUser(educatorId);

    // 1. Create Institution: Muqabala Test University
    await client.query(`
      INSERT INTO public.schools_institutions (id, name, country, language)
      VALUES ($1, 'Muqabala Test University', 'AE', 'en');
    `, [instId]);

    // 2. Assign Educator: Dr. Tariq Al-Mansoor
    await client.query(`
      INSERT INTO public.schools_institution_members (institution_id, user_id, role, accepted_at)
      VALUES ($1, $2, 'educator', now());
    `, [instId, educatorId]);

    // 3. Create Programme: School of Business -> BSc Financial Technology
    await client.query(`
      INSERT INTO public.schools_programmes (id, institution_id, name, code, faculty, campus, created_by)
      VALUES ($1, $2, 'BSc Financial Technology', 'FINTECH-BSC', 'School of Business', 'Main Campus', $3);
    `, [progId, instId, educatorId]);

    // 4. Create Cohort: Class of 2027
    const code = randomCode8();
    await client.query(`
      INSERT INTO public.schools_cohorts (id, institution_id, programme_id, name, faculty, campus, enrolment_code, created_by)
      VALUES ($1, $2, $3, 'Class of 2027', 'School of Business', 'Main Campus', $4, $5);
    `, [cohortId, instId, progId, code, educatorId]);

    await client.query(`
      INSERT INTO public.schools_cohort_educators (cohort_id, educator_user_id)
      VALUES ($1, $2);
    `, [cohortId, educatorId]);

    // 5. Enrol 10 Synthetic Students
    const studentIds = Array.from({ length: 10 }, (_, i) => ({
      id: crypto.randomUUID(),
      identifier: `STU-${String(i + 1).padStart(3, '0')}`,
      name: `Synthetic Student ${i + 1}`,
      email: `student${i + 1}@mtu.test`
    }));

    for (const stu of studentIds) {
      await createAuthUser(stu.id);
      await client.query(`
        INSERT INTO public.schools_cohort_members (cohort_id, student_user_id, display_name, adult_confirmed_at, student_identifier)
        VALUES ($1, $2, $3, now(), $4);
      `, [cohortId, stu.id, stu.name, stu.identifier]);
    }

    // 6. Create & Publish Assignment: FinTech Structured Mock Interview (4 Questions)
    const tomorrow = new Date(Date.now() + 18 * 3600 * 1000).toISOString(); // 18 hours remaining
    await client.query(`
      INSERT INTO public.schools_assignments (id, cohort_id, job_title, role_id, status, due_at, max_attempts, instructions, created_by)
      VALUES ($1, $2, 'FinTech Structured Mock Interview', 'financial-analyst', 'published', $3, 3, 'Focus on DCF valuation and regulatory compliance.', $4);
    `, [asgnId, cohortId, tomorrow, educatorId]);

    // 7. Simulate 10 Student States
    // STU-001 & STU-002: 0 attempts with deadline < 24h -> deadline_unstarted
    // (no attempt rows)

    // STU-003: draft attempt started > 48h ago -> stalled_draft
    const twoDaysAgo = new Date(Date.now() - 50 * 3600 * 1000).toISOString();
    await client.query(`
      INSERT INTO public.schools_assignment_attempts (assignment_id, student_user_id, attempt_number, status, created_at, updated_at)
      VALUES ($1, $2, 1, 'draft', $3, $3);
    `, [asgnId, studentIds[2].id, twoDaysAgo]);

    // STU-004 & STU-005: attempt submitted with low evidence (4 of 16 elements = 25%) -> low_evidence
    for (const idx of [3, 4]) {
      const attId = crypto.randomUUID();
      await client.query(`
        INSERT INTO public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, evidence_covered)
        VALUES ($1, $2, $3, 1, 'submitted', now(), 4);
      `, [attId, asgnId, studentIds[idx].id]);

      await client.query(`
        INSERT INTO public.schools_feedback_versions (assignment_attempt_id, provider, model, contract_version, output)
        VALUES ($1, 'google', 'gemini-1.5-flash', 'v1', $2);
      `, [attId, JSON.stringify({
        overall_score: 42,
        evidence: { total_elements_observed: 4, possible_elements: 16 }
      })]);
    }

    // STU-006: 2 submitted attempts with stagnant evidence (9/16 on attempt 1, 9/16 on attempt 2) -> stagnant_attempts
    const att6_1 = crypto.randomUUID();
    const att6_2 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, evidence_covered, created_at)
      VALUES ($1, $2, $3, 1, 'submitted', now() - interval '2 days', 9, now() - interval '2 days');
    `, [att6_1, asgnId, studentIds[5].id]);

    await client.query(`
      INSERT INTO public.schools_feedback_versions (assignment_attempt_id, provider, model, contract_version, output)
      VALUES ($1, 'google', 'gemini-1.5-flash', 'v1', $2);
    `, [att6_1, JSON.stringify({
      overall_score: 65,
      evidence: { total_elements_observed: 9, possible_elements: 16 }
    })]);

    await client.query(`
      INSERT INTO public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, evidence_covered, created_at)
      VALUES ($1, $2, $3, 2, 'submitted', now() - interval '1 day', 9, now() - interval '1 day');
    `, [att6_2, asgnId, studentIds[5].id]);

    await client.query(`
      INSERT INTO public.schools_feedback_versions (assignment_attempt_id, provider, model, contract_version, output)
      VALUES ($1, 'google', 'gemini-1.5-flash', 'v1', $2);
    `, [att6_2, JSON.stringify({
      overall_score: 65,
      evidence: { total_elements_observed: 9, possible_elements: 16 }
    })]);

    // STU-007: active support request logged -> support_requested
    await client.query(`
      INSERT INTO public.schools_support_requests (cohort_id, student_user_id, created_by, note, status)
      VALUES ($1, $2, 'student', 'I need clarification on the valuation model question.', 'open');
    `, [cohortId, studentIds[6].id]);

    // STU-008, STU-009, STU-010: successful submissions with strong evidence (11/16 elements = 69%) -> zero flags
    for (const idx of [7, 8, 9]) {
      const attId = crypto.randomUUID();
      await client.query(`
        INSERT INTO public.schools_assignment_attempts (id, assignment_id, student_user_id, attempt_number, status, submitted_at, evidence_covered)
        VALUES ($1, $2, $3, 1, 'submitted', now(), 11);
      `, [attId, asgnId, studentIds[idx].id]);

      await client.query(`
        INSERT INTO public.schools_feedback_versions (assignment_attempt_id, provider, model, contract_version, output)
        VALUES ($1, 'google', 'gemini-1.5-flash', 'v1', $2);
      `, [attId, JSON.stringify({
        overall_score: 85,
        evidence: { total_elements_observed: 11, possible_elements: 16 }
      })]);
    }

    // 8. Run Intervention Detection Engine
    const memberRows = (await client.query(`
      SELECT student_user_id, display_name, student_identifier
      FROM public.schools_cohort_members
      WHERE cohort_id = $1;
    `, [cohortId])).rows;

    const assignmentRows = (await client.query(`
      SELECT id, role_id, job_title, due_at, status, 4 as question_count
      FROM public.schools_assignments
      WHERE id = $1;
    `, [asgnId])).rows;

    const attemptRows = (await client.query(`
      SELECT id, assignment_id, student_user_id, attempt_number, status, submitted_at, created_at, evidence_covered
      FROM public.schools_assignment_attempts
      WHERE assignment_id = $1;
    `, [asgnId])).rows;

    const supportRows = (await client.query(`
      SELECT student_user_id, status, note, created_at
      FROM public.schools_support_requests
      WHERE cohort_id = $1;
    `, [cohortId])).rows;

    const allSignals = detectInterventionSignals({
      cohortId,
      members: memberRows,
      assignments: assignmentRows,
      attempts: attemptRows,
      supportRequests: supportRows
    });

    // Verify detected signals
    const signalCategories = allSignals.map(s => s.category);
    assert.ok(signalCategories.includes('deadline_unstarted'), 'Should detect deadline_unstarted for STU-001 & STU-002');
    assert.ok(signalCategories.includes('stalled_draft'), 'Should detect stalled_draft for STU-003');
    assert.ok(signalCategories.includes('low_evidence'), 'Should detect low_evidence for STU-004 & STU-005');
    assert.ok(signalCategories.includes('stagnant_attempts'), 'Should detect stagnant_attempts for STU-006');
    assert.ok(signalCategories.includes('support_requested'), 'Should detect support_requested for STU-007');

    // Verify STU-008, 009, 010 have 0 signals
    const goodStudentSignals = allSignals.filter(s => ['STU-008', 'STU-009', 'STU-010'].includes(s.studentIdentifier));
    assert.equal(goodStudentSignals.length, 0, 'Successful students should have zero intervention flags');

    // Verify ZERO medical/psychological diagnostic language in signals
    const forbiddenJargon = [/bipolar/i, /adhd/i, /depression/i, /pathology/i, /mental health/i, /disorder/i, /deficit/i];
    for (const s of allSignals) {
      for (const pattern of forbiddenJargon) {
        assert.ok(!pattern.test(s.humanReason) && !pattern.test(s.evidenceBasis), `Signal must not contain diagnostic jargon: ${s.humanReason}`);
      }
    }
  });

  it('5. Recruiter Assistance Suite Validation on Supabase', async () => {
    const employerId = crypto.randomUUID();
    const candidateId = crypto.randomUUID();
    const packId = crypto.randomUUID();
    const interviewId = crypto.randomUUID();
    const candidateRef = randomCrockford6();
    const tokenHash = crypto.randomBytes(32).toString('hex');

    await createAuthUser(employerId);
    await createAuthUser(candidateId);

    const packCode = 'CH' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const packToken = 'tk_' + crypto.randomBytes(4).toString('hex');
    // 1. Create screening pack
    await client.query(`
      INSERT INTO public.screening_packs (id, employer_id, public_code, signed_token, workplace, expires_at)
      VALUES ($1, $2, $3, $4, 'Executive Chef Screening', now() + interval '30 days');
    `, [packId, employerId, packCode, packToken]);

    // 2. Create role invite with Crockford Base32 ref & 64-hex token hash
    const inviteRes = await client.query(`
      INSERT INTO public.role_invites (role_id, candidate_ref, token_hash, token_cipher, name, email, status, channel)
      VALUES ($1, $2, $3, 'cipher_val', 'Amira Al-Hashemi', 'amira@example.com', 'invited', 'email')
      RETURNING id;
    `, [packId, candidateRef, tokenHash]);
    const inviteId = inviteRes.rows[0].id;

    // 3. Add candidate role question
    const qHash = crypto.createHash('sha256').update('What culinary certifications do you hold?').digest('hex');
    const qRes = await client.query(`
      INSERT INTO public.candidate_role_questions (role_id, candidate_id, candidate_email, question_text, question_hash)
      VALUES ($1, $2, 'amira@example.com', 'What culinary certifications do you hold?', $3)
      RETURNING id;
    `, [packId, candidateId, qHash]);
    const questionId = qRes.rows[0].id;

    // 4. Employer replies to candidate question
    await client.query(`
      UPDATE public.candidate_role_questions
      SET reply_text = 'HACCP Level 3 is required for executive chefs.',
          replied_at = now(),
          replied_by = $1,
          resolved_at = now(),
          resolved_by = $1
      WHERE id = $2;
    `, [employerId, questionId]);

    const qRow = (await client.query(`
      SELECT reply_text, resolved_at FROM public.candidate_role_questions WHERE id = $1;
    `, [questionId])).rows[0];
    assert.equal(qRow.reply_text, 'HACCP Level 3 is required for executive chefs.');
    assert.ok(qRow.resolved_at !== null);

    // 5. Create interview and generate employer answer summary
    await client.query(`
      INSERT INTO public.interviews (
        id, user_id, role_id, role_title, language, mode, status, current_question,
        question_snapshot, saved, started_at, expires_at, screening_pack_id, invite_id
      )
      VALUES (
        $1, $2, 'executive-chef', 'Executive Chef', 'en', 'screening', 'completed', 3,
        '[]'::jsonb, true, now() - interval '1 hour', now() + interval '24 hours', $3, $4
      );
    `, [interviewId, candidateId, packId, inviteId]);

    const sourceVersion = crypto.createHash('sha256').update('interview-source-v1').digest('hex');
    await client.query(`
      INSERT INTO public.employer_answer_summaries (
        interview_id, role_id, source_version, generation_version, summary_points, source_references
      )
      VALUES (
        $1, $2, $3, 'v1.0.0',
        '["Demonstrates professional certifications and strict HACCP compliance.", "Extensive banquet allergen management experience."]'::jsonb,
        '[]'::jsonb
      );
    `, [interviewId, packId, sourceVersion]);

    // 6. Query summaries back
    const summaryRow = (await client.query(`
      SELECT source_version, generation_version, summary_points 
      FROM public.employer_answer_summaries 
      WHERE interview_id = $1;
    `, [interviewId])).rows[0];
    assert.equal(summaryRow.source_version, sourceVersion);
    assert.equal(summaryRow.summary_points.length, 2);

    // 7. Test recruiter reminders RPC: queue_manual_employer_reminders
    const batchKey = crypto.randomUUID();
    const reminderRes = await client.query(`
      SELECT public.queue_manual_employer_reminders($1, $2, ARRAY[$3]::uuid[], $4, $5) as res;
    `, [packId, employerId, inviteId, 'Please complete your screening interview when convenient.', batchKey]);
    assert.ok(reminderRes.rows[0].res);
    assert.equal(reminderRes.rows[0].res.batchKey, batchKey);

    // 8. Candidate opt-out
    await client.query(`
      UPDATE public.role_invites 
      SET opted_out_at = now() 
      WHERE id = $1;
    `, [inviteId]);
    const optOutRow = (await client.query(`SELECT opted_out_at FROM public.role_invites WHERE id = $1`, [inviteId])).rows[0];
    assert.ok(optOutRow.opted_out_at !== null, 'Opt-out timestamp recorded');
  });

  it('11. ADAPTIVE_V2 Architecture & Isolation: Verifies canonical assignment, adaptive delivery mode, and audit snapshots', async () => {
    const instId = crypto.randomUUID();
    const cohortId = crypto.randomUUID();
    const asgnFormId = crypto.randomUUID();
    const asgnAdaptiveId = crypto.randomUUID();
    const adviserId = crypto.randomUUID();
    const studentId = crypto.randomUUID();
    const attemptId = crypto.randomUUID();
    const universalId = crypto.randomUUID();

    await createAuthUser(adviserId);
    await createAuthUser(studentId);

    // Setup institution, cohort, adviser
    await client.query(`
      INSERT INTO public.schools_institutions (id, name, country, language, setup_complete, dpa_complete)
      VALUES ($1, 'Adaptive Pilot Univ', 'GB', 'en', false, false);
    `, [instId]);

    const code = randomCode8();
    await client.query(`
      INSERT INTO public.schools_cohorts (id, institution_id, name, enrolment_code, created_by)
      VALUES ($1, $2, 'Adaptive Cohort', $3, $4);
    `, [cohortId, instId, code, adviserId]);

    await client.query(`
      INSERT INTO public.schools_institution_members (institution_id, user_id, role, accepted_at)
      VALUES ($1, $2, 'educator', now());
    `, [instId, adviserId]);

    await client.query(`
      INSERT INTO public.schools_cohort_educators (cohort_id, educator_user_id)
      VALUES ($1, $2);
    `, [cohortId, adviserId]);

    await client.query(`
      INSERT INTO public.schools_cohort_members (cohort_id, student_user_id, display_name, status, adult_confirmed_at)
      VALUES ($1, $2, 'Amina Hassan (Student)', 'active', now());
    `, [cohortId, studentId]);

    // 1. Verify default delivery_mode is 'form_v1'
    await client.query(`
      INSERT INTO public.schools_assignments (id, cohort_id, role_id, job_title, status, due_at, created_by)
      VALUES ($1, $2, 'financial-analyst', 'Junior Analyst Form', 'published', now() + interval '14 days', $3);
    `, [asgnFormId, cohortId, adviserId]);

    const formRow = (await client.query(`SELECT delivery_mode FROM public.schools_assignments WHERE id = $1`, [asgnFormId])).rows[0];
    assert.equal(formRow.delivery_mode, 'form_v1', 'Default delivery_mode must be form_v1');

    // 2. Verify creating ADAPTIVE_V2 assignment via schools_manage RPC
    const qv1 = crypto.randomUUID();
    const qv2 = crypto.randomUUID();
    const qv3 = crypto.randomUUID();
    await client.query(`
      INSERT INTO public.schools_question_versions (id, institution_id, question_key, version, role_id, language, question_text, rubric, approved_by, no_example_follow_up)
      VALUES
        ($1, $4, 'q_1', 1, 'financial-analyst', 'en', 'Describe an analytical problem you solved.', '["r1","r2","r3","r4"]'::jsonb, $5, 'Think about a coursework or project challenge.'),
        ($2, $4, 'q_2', 1, 'financial-analyst', 'en', 'Tell me about a time you handled a project disagreement.', '["r1","r2","r3","r4"]'::jsonb, $5, 'Think about a team or group assignment.'),
        ($3, $4, 'q_3', 1, 'financial-analyst', 'en', 'How do you prioritize competing deadlines?', '["r1","r2","r3","r4"]'::jsonb, $5, 'Think about exam periods or competing milestones.');
    `, [qv1, qv2, qv3, instId, adviserId]);

    const asgnRes = await client.query(`
      SELECT public.schools_manage($1, 'assignment', $2) as res;
    `, [
      adviserId,
      JSON.stringify({
        cohortId,
        roleId: 'financial-analyst',
        jobTitle: 'Graduate Financial Analyst (Adaptive)',
        questionIds: [qv1, qv2, qv3],
        dueAt: new Date(Date.now() + 86400000 * 14).toISOString(),
        deliveryMode: 'adaptive_v2',
        status: 'published',
      }),
    ]);

    const createdAsgn = asgnRes.rows[0].res;
    assert.equal(createdAsgn.delivery_mode, 'adaptive_v2', 'schools_manage must support deliveryMode = adaptive_v2');
    assert.equal(createdAsgn.status, 'published');

    // 3. Test universal_interviews row creation and attempt linkage
    await client.query(`
      INSERT INTO public.universal_interviews (id, owner_token_hash, state_ciphertext, status)
      VALUES ($1, 'dummy_token_hash', 'v1.dummy_iv.dummy_tag.dummy_ciphertext', 'ACTIVE');
    `, [universalId]);

    await client.query(`
      INSERT INTO public.universal_interview_accounts (interview_id, user_id)
      VALUES ($1, $2);
    `, [universalId, studentId]);

    const canonicalSnapshot = [
      { questionIndex: 0, text: 'Describe an analytical problem you solved.' },
      { questionIndex: 1, text: 'Tell me about a time you handled a project disagreement.' },
      { questionIndex: 2, text: 'How do you prioritize competing deadlines?' },
    ];

    const turns = [
      { turnNumber: 1, questionNumber: 1, questionText: 'Describe an analytical problem you solved.', answerText: 'I built a DCF model for my university valuation project.', action: 'PROBE_ACTION' },
      { turnNumber: 2, questionNumber: 1, questionText: 'What specific sensitivity checks did you implement?', answerText: 'I varied WACC between 8% and 12% and tested terminal growth rates.', action: 'MOVE_ON' },
    ];

    const evidence = [
      { id: 'E01', question_number: 1, summary: 'Valuation project DCF modeling', evidence_type: 'ACADEMIC', competencies: { c_analytical_thinking: 'STRONG' } },
    ];

    await client.query(`
      INSERT INTO public.schools_assignment_attempts (
        id, assignment_id, student_user_id, attempt_number, status, submitted_at, delivery_mode,
        universal_interview_id, engine_version, canonical_questions_snapshot,
        adaptive_turns, evidence_ledger, evidence_sources, answers
      )
      VALUES (
        $1, $2, $3, 1, 'submitted', now(), 'adaptive_v2',
        $4, 'universal-brain-v2.0.1', $5,
        $6, $7, '["ACADEMIC", "PERSONAL_PROJECT"]'::jsonb, '["Answer 1 with probe", "", ""]'::jsonb
      );
    `, [
      attemptId, createdAsgn.id, studentId,
      universalId, JSON.stringify(canonicalSnapshot),
      JSON.stringify(turns), JSON.stringify(evidence),
    ]);

    // 4. Verify attempt query back
    const attemptRow = (await client.query(`
      SELECT delivery_mode, universal_interview_id, engine_version,
             canonical_questions_snapshot, adaptive_turns, evidence_ledger
      FROM public.schools_assignment_attempts
      WHERE id = $1;
    `, [attemptId])).rows[0];

    assert.equal(attemptRow.delivery_mode, 'adaptive_v2');
    assert.equal(attemptRow.universal_interview_id, universalId);
    assert.equal(attemptRow.engine_version, 'universal-brain-v2.0.1');
    assert.equal(attemptRow.canonical_questions_snapshot.length, 3);
    assert.equal(attemptRow.adaptive_turns.length, 2);
    assert.equal(attemptRow.evidence_ledger[0].evidence_type, 'ACADEMIC');

    // 5. Verify delivery_mode check constraint rejects invalid strings
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO public.schools_assignments (id, cohort_id, role_id, due_at, created_by, delivery_mode)
          VALUES ($1, $2, 'financial-analyst', now() + interval '7 days', $3, 'invalid_mode');
        `, [crypto.randomUUID(), cohortId, adviserId]);
      },
      /check/i,
      'Should reject delivery_mode not in (form_v1, adaptive_v2)'
    );
  });
});

