import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFileSync(new URL(`../supabase/migrations/${path}`, import.meta.url), 'utf8');
const interview = '11111111-1111-4111-8111-111111111111';
const employer = '22222222-2222-4222-8222-222222222222';
const author = '33333333-3333-4333-8333-333333333333';

test('evaluation versions preserve reviewer context atomically in PostgreSQL', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create table auth.users(id uuid primary key);
      create table public.interviews(id uuid primary key);
    `);
    await db.exec(read('20260903181735_candidate_evaluation_reports.sql'));
    await db.exec(read('20260903191312_add_manual_evaluation_interviewer.sql'));
    await db.exec(read('20260907181818_preserve_evaluation_reviewer_context.sql'));
    await db.query('insert into auth.users values ($1),($2)', [employer, author]);
    await db.query('insert into public.interviews values ($1)', [interview]);
    const store = async version => (await db.query(
      'select public.store_candidate_evaluation_report($1,$2,$3,$4::smallint,$5::jsonb,$6,$7,$3) as id',
      [`EVAL-2026-${String(version).padStart(8, '0')}`, interview, employer, version, JSON.stringify({ version }), 'pipeline-v1', 'rubric-v1'],
    )).rows[0].id;
    const notes = async id => (await db.query('select author_id,author_name,note_text,created_at from public.evaluation_report_notes where report_id=$1 order by created_at', [id])).rows;
    const row = async id => (await db.query('select interviewer_name,payload,superseded_at from public.candidate_evaluation_reports where id=$1', [id])).rows[0];
    const addNote = async (owner = employer) => (await db.query('select public.add_current_evaluation_note($1,$2,$3,$4) as id', [interview, owner, 'Current reviewer', 'New context from a previously opened tab.'])).rows[0].id;
    const setName = async (name, owner = employer) => (await db.query('select public.update_current_evaluation_interviewer($1,$2,$3) as id', [interview, owner, name])).rows[0].id;
    let first;
    let second;
    let originalNotes;

    await t.test('first version succeeds with no prior reviewer context', async () => {
      first = await store(1);
      assert.ok(first);
      assert.equal((await row(first)).interviewer_name, null);
      assert.deepEqual(await notes(first), []);
    });
    await t.test('revision keeps name, note authors and original dates without changing the archive', async () => {
      await db.query('update public.candidate_evaluation_reports set interviewer_name=$1 where id=$2', ['Test Reviewer', first]);
      await db.query("insert into public.evaluation_report_notes(report_id,author_id,author_name,note_text,created_at) values ($1,$2,'Second reviewer','Check the saved answer.','2026-09-05T10:00:00Z'),($1,$3,'Employer','Follow up on availability.','2026-09-05T11:00:00Z')", [first, author, employer]);
      originalNotes = await notes(first);
      second = await store(2);
      assert.notEqual(second, first);
      assert.equal((await row(second)).interviewer_name, 'Test Reviewer');
      assert.deepEqual(await notes(second), originalNotes);
      assert.deepEqual(await notes(first), originalNotes);
      assert.deepEqual((await row(first)).payload, { version: 1 });
      assert.equal((await row(first)).interviewer_name, 'Test Reviewer');
      assert.ok((await row(first)).superseded_at);
    });
    await t.test('repeated revisions carry each note once and preserve newer reviewer changes', async () => {
      await db.query('update public.candidate_evaluation_reports set interviewer_name=$1 where id=$2', ['Corrected Reviewer', second]);
      const third = await store(3);
      assert.deepEqual(await notes(third), originalNotes);
      assert.equal((await row(third)).interviewer_name, 'Corrected Reviewer');
      assert.equal((await row(first)).interviewer_name, 'Test Reviewer');
      assert.equal(await store(3), null);
      assert.equal((await db.query('select count(*)::int as count from public.candidate_evaluation_reports')).rows[0].count, 3);
    });
    await t.test('note-copy failure rolls back new version and superseding the current version', async () => {
      await db.exec(`create function public.fail_note_copy() returns trigger language plpgsql as $$ begin raise exception 'synthetic copy failure'; end $$;
        create trigger fail_note_copy before insert on public.evaluation_report_notes for each row execute function public.fail_note_copy()`);
      await assert.rejects(store(4), /synthetic copy failure/);
      const current = (await db.query('select version from public.candidate_evaluation_reports where superseded_at is null')).rows;
      assert.deepEqual(current, [{ version: 3 }]);
      assert.equal((await db.query('select count(*)::int as count from public.candidate_evaluation_reports')).rows[0].count, 3);
      assert.deepEqual(await notes(first), originalNotes);
      await db.exec('drop trigger fail_note_copy on public.evaluation_report_notes');
      assert.ok(await store(4));
    });
    await t.test('replacing function preserves service-only execution permissions', async () => {
      for (const role of ['anon', 'authenticated']) {
        await db.exec(`set role ${role}`);
        try {
          await assert.rejects(store(5), /permission denied/);
          await assert.rejects(addNote(), /permission denied/);
          await assert.rejects(setName('Denied'), /permission denied/);
        }
        finally { await db.exec('reset role'); }
      }
      await db.exec('set role service_role');
      try { assert.ok(await store(5)); }
      finally { await db.exec('reset role'); }
    });
    await t.test('reviewer edits resolve current version after refresh and preserve archived context', async () => {
      const prior = (await db.query('select id from public.candidate_evaluation_reports where superseded_at is null')).rows[0].id;
      assert.equal(await setName('Before refresh'), prior);
      assert.ok(await addNote());
      const before = await notes(prior);
      const next = await store(6);
      assert.deepEqual(await notes(next), before);
      assert.equal((await row(next)).interviewer_name, 'Before refresh');
      // Neither RPC accepts a report ID cached by a stale browser tab.
      assert.equal(await setName('After refresh'), next);
      assert.ok(await addNote());
      assert.deepEqual(await notes(prior), before);
      assert.equal((await row(prior)).interviewer_name, 'Before refresh');
      assert.equal((await notes(next)).length, before.length + 1);
      assert.equal(await setName(''), next);
      assert.equal((await row(next)).interviewer_name, null);
    });
    await t.test('reviewer RPCs reject another employer without changing reports or notes', async () => {
      const before = (await db.query('select id,interviewer_name from public.candidate_evaluation_reports order by version')).rows;
      const count = (await db.query('select count(*)::int as count from public.evaluation_report_notes')).rows[0].count;
      assert.equal(await addNote(author), null);
      assert.equal(await setName('Wrong owner', author), null);
      assert.deepEqual((await db.query('select id,interviewer_name from public.candidate_evaluation_reports order by version')).rows, before);
      assert.equal((await db.query('select count(*)::int as count from public.evaluation_report_notes')).rows[0].count, count);
    });
  } finally { await db.close(); }
});
