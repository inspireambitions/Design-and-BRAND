import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import {
  answerExcerpts,
  resolveSchoolsFeedback,
  calculateEvidence,
  normalizeAttemptAnswers,
} from '../lib/schools/evidence.ts';
import {
  recoverStuckFeedbackAttempts,
  isEligibleForFeedbackRecovery,
} from '../lib/schools/feedback-recovery.ts';

const rubric = [0, 1, 2, 3].map((i) => ({
  id: 'e' + i,
  label: 'Element ' + i,
  description: 'Evidence element ' + i,
}));
const rubrics = [rubric, rubric, rubric];

test('REPRODUCTION 1: answerExcerpts must be resilient to null and undefined', () => {
  // Current code throws TypeError: Cannot convert undefined or null to object
  assert.doesNotThrow(() => {
    const resUndef = answerExcerpts(undefined);
    assert.deepEqual(resUndef, []);
  });

  assert.doesNotThrow(() => {
    const resNull = answerExcerpts(null);
    assert.deepEqual(resNull, []);
  });

  assert.doesNotThrow(() => {
    const resEmpty = answerExcerpts('');
    assert.deepEqual(resEmpty, []);
  });
});

test('REPRODUCTION 2: normalizeAttemptAnswers safely pads and aligns answers to question count', () => {
  // Scenario A: Candidate answers shorter than 3 questions (e.g. adaptive turn had 2 canonical answers)
  const shortAnswers = ['First answer provided by candidate.'];
  const normalizedShort = normalizeAttemptAnswers(shortAnswers, 3);
  assert.equal(normalizedShort.length, 3);
  assert.equal(normalizedShort[0], 'First answer provided by candidate.');
  assert.equal(normalizedShort[1], '');
  assert.equal(normalizedShort[2], '');

  // Scenario B: Candidate answers contains undefined or null items
  const sparseAnswers = ['Valid sentence here.', undefined, null];
  const normalizedSparse = normalizeAttemptAnswers(sparseAnswers, 3);
  assert.equal(normalizedSparse.length, 3);
  assert.equal(normalizedSparse[0], 'Valid sentence here.');
  assert.equal(normalizedSparse[1], '');
  assert.equal(normalizedSparse[2], '');

  // Scenario C: Candidate answers longer than question count (e.g. extra probe turned into extra index)
  const longAnswers = ['Ans 1', 'Ans 2', 'Ans 3', 'Extra turn answer'];
  const normalizedLong = normalizeAttemptAnswers(longAnswers, 3);
  assert.equal(normalizedLong.length, 3);
  assert.equal(normalizedLong[0], 'Ans 1');
  assert.equal(normalizedLong[1], 'Ans 2');
  assert.equal(normalizedLong[2], 'Ans 3');
});

test('REPRODUCTION 3: resolveSchoolsFeedback and calculateEvidence handle normalized sparse answers without crashing', () => {
  const normalized = normalizeAttemptAnswers(['I helped the team finish early.'], 3);
  const providerOutput = {
    questions: [0, 1, 2].map((qIndex) => ({
      questionIndex: qIndex,
      improvement: 'Add what happened next.',
      elements: rubric.map((r, i) => ({
        id: r.id,
        present: qIndex === 0 && i === 0,
        firstExcerpt: qIndex === 0 && i === 0 ? 0 : null,
        lastExcerpt: qIndex === 0 && i === 0 ? 0 : null,
        confidence: 'medium',
      })),
    })),
  };

  assert.doesNotThrow(() => {
    const feedback = resolveSchoolsFeedback(providerOutput, normalized);
    assert.equal(feedback.questions.length, 3);
    const result = calculateEvidence(feedback, normalized, rubrics);
    assert.equal(result.covered, 1);
  });
});

test('REPRODUCTION 4: Stuck attempt reaching claim ceiling (feedback_tries >= 3) can be identified and recovered safely', async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    create function auth.jwt() returns jsonb language sql as 'select jsonb_build_object(''session_id'',nullif(current_setting(''request.jwt.claim.sub'',true),''''))';
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/20260908104304_schools_pilot_foundation.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/20260908135304_schools_feedback_recovery.sql', import.meta.url), 'utf8'));
  await db.exec(`
    alter table public.schools_assignment_attempts drop constraint if exists schools_assignment_attempts_answers_check;
    alter table public.schools_assignment_attempts add constraint schools_assignment_attempts_answers_check check (jsonb_typeof(answers) = 'array');
  `);

  const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

  // Insert mock institution, cohort, member, assignment, and stuck attempt
  await db.exec(`
    insert into auth.users values ('${id(1)}'), ('${id(2)}'), ('${id(3)}'), ('${id(4)}');
    insert into public.schools_institutions(id,name,country,language) values ('${id(10)}','Test Uni','UAE','en');
    insert into public.schools_institution_members(institution_id,user_id,role,accepted_at) values ('${id(10)}','${id(1)}','educator',now());
    insert into public.schools_cohorts(id,institution_id,name,enrolment_code,created_by) values ('${id(20)}','${id(10)}','Cohort A','ENROL123','${id(1)}');
    insert into public.schools_cohort_members(cohort_id,student_user_id,display_name,adult_confirmed_at) values
      ('${id(20)}','${id(2)}','Neb Student',now()),
      ('${id(20)}','${id(3)}','Student B',now()),
      ('${id(20)}','${id(4)}','Student C',now());
    insert into public.schools_assignments(id,cohort_id,role_id,due_at,created_by) values ('${id(30)}','${id(20)}','role',now()+interval '7 days','${id(1)}');
  `);

  // Stuck attempt where student submitted, feedback failed repeatedly, feedback_tries = 3, failure code recorded
  await db.exec(`
    insert into public.schools_assignment_attempts (
      id, assignment_id, student_user_id, attempt_number, status, submitted_at, answers,
      feedback_status, feedback_tries, feedback_failure_code
    ) values (
      '${id(40)}', '${id(30)}', '${id(2)}', 1, 'submitted', now(), '["I helped the team finish early."]'::jsonb,
      'failed', 3, 'questions:TypeError'
    );
    -- Non-stuck normal draft: must NOT be touched
    insert into public.schools_assignment_attempts (
      id, assignment_id, student_user_id, attempt_number, status, answers,
      feedback_status, feedback_tries
    ) values (
      '${id(41)}', '${id(30)}', '${id(3)}', 1, 'draft', '[]'::jsonb,
      'pending', 0
    );
    -- Unrelated failed attempt without defect signature: must NOT be touched
    insert into public.schools_assignment_attempts (
      id, assignment_id, student_user_id, attempt_number, status, submitted_at, answers,
      feedback_status, feedback_tries, feedback_failure_code
    ) values (
      '${id(42)}', '${id(30)}', '${id(4)}', 1, 'submitted', now(), '["1","2","3"]'::jsonb,
      'failed', 3, 'auth:expired'
    );
  `);

  // Verify that schools_claim_feedback fails on the stuck attempt because feedback_tries >= 3
  const claimBefore = await db.query(
    `select public.schools_claim_feedback('${id(40)}'::uuid, '${id(99)}'::uuid) as claim`
  );
  assert.equal(claimBefore.rows[0].claim, null, 'Attempt at claim ceiling cannot be claimed by current RPC');

  // Verify eligibility check
  const stuckRow = (await db.query(`select * from public.schools_assignment_attempts where id = '${id(40)}'`)).rows[0];
  const draftRow = (await db.query(`select * from public.schools_assignment_attempts where id = '${id(41)}'`)).rows[0];
  const otherRow = (await db.query(`select * from public.schools_assignment_attempts where id = '${id(42)}'`)).rows[0];

  assert.equal(isEligibleForFeedbackRecovery(stuckRow), true);
  assert.equal(isEligibleForFeedbackRecovery(draftRow), false);
  assert.equal(isEligibleForFeedbackRecovery(otherRow), false);

  // Run the recovery function on the PGlite database
  const recoveredCount = await recoverStuckFeedbackAttempts(db);
  assert.equal(recoveredCount, 1, 'Only the single eligible stuck attempt was recovered');

  // Verify attempt state after recovery
  const postRecovery = (await db.query(`select feedback_status, feedback_tries, feedback_claim, feedback_failure_code, answers from public.schools_assignment_attempts where id = '${id(40)}'`)).rows[0];
  assert.equal(postRecovery.feedback_status, 'pending');
  assert.equal(postRecovery.feedback_tries, 0);
  assert.equal(postRecovery.feedback_claim, null);
  assert.match(String(postRecovery.feedback_failure_code), /recovered:post_neb_defect/);
  // Preserves answers exactly!
  const restoredAnswers = Array.isArray(postRecovery.answers) ? postRecovery.answers : JSON.parse(String(postRecovery.answers));
  assert.equal(restoredAnswers[0], 'I helped the team finish early.');

  // Verify that it can now be successfully claimed by schools_claim_feedback!
  const claimAfter = await db.query(
    `select public.schools_claim_feedback('${id(40)}'::uuid, '${id(99)}'::uuid) as claim`
  );
  assert.notEqual(claimAfter.rows[0].claim, null, 'Recovered attempt can now be claimed successfully!');
});
