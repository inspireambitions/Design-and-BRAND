import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const role = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const contact = (index = 0) => ({ candidate_ref: `MQ-AAAAA${'ABCDEFGH'[index]}`, email: `test${index}@example.test`, phone: null,
  name: 'Test Candidate', channel: 'email', token_hash: String(index).repeat(64), token_cipher: `sealed-test-${index}` });

test('employer delivery SQL executes against an isolated PostgreSQL engine', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
      create table auth.users(id uuid primary key);
      create table public.screening_packs(id uuid primary key, employer_id uuid, expires_at timestamptz,
        reminders_enabled boolean default true, shortlist_48h_sent_at timestamptz, shortlist_close_sent_at timestamptz);
      create table public.interviews(id uuid primary key, screening_pack_id uuid, submitted_at timestamptz);
      grant all on public.screening_packs, public.interviews to service_role;
    `);
    await db.exec(read('supabase/migrations/20260902120000_employer_volume_invites.sql'));
    await db.exec(read('supabase/migrations/20260905061702_employer_invite_delivery_reliability.sql'));
    await db.exec(read('supabase/migrations/20260905130942_employer_message_acceptance_atomic.sql'));
    await db.exec(read('supabase/migrations/20260914103000_harden_invite_submission_trigger.sql'));
    await db.exec(read('supabase/migrations/20260915120000_recruiter_assistance.sql'));
    const reset = async () => {
      await db.exec('truncate public.employer_message_outbox, public.role_invites, public.interviews, public.screening_packs cascade');
      await db.query('insert into auth.users(id) values ($1),($2),($3) on conflict do nothing', [owner, other, '44444444-4444-4444-8444-444444444444']);
      await db.query("insert into public.screening_packs(id,employer_id,expires_at) values ($1,$2,now()+interval '14 days')", [role, owner]);
    };
    const queue = async rows => (await db.query('select public.queue_employer_invites($1,$2,$3::jsonb) as result', [role, owner, JSON.stringify(rows)])).rows[0].result;
    const count = async table => Number((await db.query(`select count(*) as count from public.${table}`)).rows[0].count);
    const claim = async (lease = randomUUID()) => (await db.query('select * from public.claim_employer_messages(50,$1,$2)', [lease, role])).rows;

    await t.test('the trigger-only definer function is not executable by browser JWT roles', async () => {
      for (const roleName of ['anon', 'authenticated']) {
        const result = await db.query(
          "select has_function_privilege($1, 'public.mark_invite_submitted()', 'execute') as allowed",
          [roleName],
        );
        assert.equal(result.rows[0].allowed, false);
      }
      const service = await db.query(
        "select has_function_privilege('service_role', 'public.mark_invite_submitted()', 'execute') as allowed",
      );
      assert.equal(service.rows[0].allowed, true);
    });

    await t.test('repeated and mixed contacts keep one original token and one outbox job', async () => {
      await reset();
      assert.deepEqual(await queue([contact(), contact()]), { queued: 1, byEmail: 1, byWhatsApp: 0, duplicates: 1 });
      assert.equal((await queue([contact(), contact(1)])).queued, 1);
      assert.equal(await count('role_invites'), 2);
      assert.equal(await count('employer_message_outbox'), 2);
      const row = (await db.query('select token_cipher from public.role_invites where email=$1', [contact().email])).rows[0];
      assert.equal(row.token_cipher, contact().token_cipher);
    });
    await t.test('outbox failure rolls back the candidate insert; retry repairs a legacy orphan', async () => {
      await reset();
      await db.exec(`create function public.reject_test_job() returns trigger language plpgsql as $$ begin raise exception 'synthetic outage'; end $$;
        create trigger reject_test_job before insert on public.employer_message_outbox for each row execute function public.reject_test_job();`);
      await assert.rejects(queue([contact()]), /synthetic outage/);
      assert.equal(await count('role_invites'), 0);
      await db.exec('drop trigger reject_test_job on public.employer_message_outbox');
      await queue([contact()]);
      await db.exec('delete from public.employer_message_outbox');
      assert.equal((await queue([contact()])).queued, 1);
      assert.equal(await count('role_invites'), 1);
    });
    await t.test('wrong employer, closed role and unsupported channel create no jobs', async () => {
      await reset();
      await assert.rejects(db.query('select public.queue_employer_invites($1,$2,$3::jsonb)', [role, other, JSON.stringify([contact()])]), /Role not found/);
      await assert.rejects(queue([{ ...contact(), channel: 'whatsapp' }]), /Email required/);
      await db.exec("update public.screening_packs set expires_at=now()-interval '1 day'");
      await assert.rejects(queue([contact()]), /Role closed/);
      assert.equal(await count('role_invites'), 0);
    });
    await t.test('JWT roles cannot call any delivery function', async () => {
      for (const jwtRole of ['anon', 'authenticated']) {
        await db.exec(`set role ${jwtRole}`);
        try {
          await assert.rejects(db.query('select public.queue_employer_invites($1,$2,$3::jsonb)', [role, owner, '[]']), /permission denied/);
          await assert.rejects(db.query('select public.employer_invite_delivery_status($1,$2)', [role, owner]), /permission denied/);
          await assert.rejects(db.query('select * from public.claim_employer_messages(5,$1,$2)', [randomUUID(), role]), /permission denied/);
          await assert.rejects(db.query("select public.queue_employer_reminders('[]'::jsonb)"), /permission denied/);
          await assert.rejects(db.query("select public.queue_manual_employer_reminders($1,$2,array[]::uuid[],'Reminder',$3)", [role, owner, randomUUID()]), /permission denied/);
          await assert.rejects(db.query("select public.queue_employer_shortlist($1,'close')", [role]), /permission denied/);
        } finally { await db.exec('reset role'); }
      }
    });
    await t.test('leases cap batches at five, skip active jobs and recover expired attempts', async () => {
      await reset();
      await queue(Array.from({ length: 6 }, (_, i) => contact(i)));
      const first = await claim();
      assert.equal(first.length, 5);
      assert.equal((await claim()).length, 1);
      assert.equal((await claim()).length, 0);
      await db.exec("update public.employer_message_outbox set locked_until=now()-interval '1 minute', attempt_count=9");
      const recovered = await claim();
      assert.equal(recovered.length, 5);
      assert.ok(recovered.every(row => row.attempt_count === 10));
      await db.exec("update public.employer_message_outbox set locked_until=now()-interval '1 minute' where attempt_count=10");
      assert.equal((await claim()).length, 1);
      assert.equal(Number((await db.query("select count(*) as count from public.employer_message_outbox where status='failed'")).rows[0].count), 5);
    });
    await t.test('delivery summary is owner scoped and distinguishes provider acceptance from queued', async () => {
      await reset(); await queue([contact(), contact(1)]);
      await db.exec("update public.employer_message_outbox set status='accepted', accepted_at=now() where invite_id=(select id from public.role_invites where email='test0@example.test')");
      const result = (await db.query('select public.employer_invite_delivery_status($1,$2) as result', [role, owner])).rows[0].result;
      assert.deepEqual(result, { queued: 1, accepted: 1, failed: 0, cancelled: 0 });
      await assert.rejects(db.query('select public.employer_invite_delivery_status($1,$2)', [role, other]), /Role not found/);
    });
    await t.test('reminders deduplicate against the actual partial index and honour stop conditions', async () => {
      await reset(); await queue([contact()]);
      const inviteId = (await db.query('select id from public.role_invites')).rows[0].id;
      const rows = JSON.stringify([{ role_id: role, invite_id: inviteId, kind: 'reminder_1' }]);
      const remind = async () => (await db.query('select public.queue_employer_reminders($1::jsonb) as count', [rows])).rows[0].count;
      assert.equal(await remind(), 1); assert.equal(await remind(), 0);
      await db.exec("delete from public.employer_message_outbox where kind='reminder_1'; update public.screening_packs set reminders_enabled=false");
      assert.equal(await remind(), 0);
      await db.exec("update public.screening_packs set reminders_enabled=true; update public.role_invites set status='submitted'");
      assert.equal(await remind(), 0);
    });
    await t.test('acceptance and its timestamp roll back together when the invite update fails', async () => {
      await reset(); await queue([contact()]); await claim();
      await db.exec(`create trigger reject_test_stamp before update on public.role_invites for each row execute function public.reject_test_job()`);
      await assert.rejects(db.exec("update public.employer_message_outbox set status='accepted', accepted_at=now(), lease_token=null"), /synthetic outage/);
      const pending = (await db.query('select status, accepted_at, lease_token from public.employer_message_outbox')).rows[0];
      assert.equal(pending.status, 'processing'); assert.equal(pending.accepted_at, null); assert.ok(pending.lease_token);
      await db.exec('drop trigger reject_test_stamp on public.role_invites');
      await db.exec("update public.employer_message_outbox set status='accepted', accepted_at=now(), lease_token=null");
      const stamps = (await db.query('select i.invited_at=o.accepted_at as same from public.role_invites i join public.employer_message_outbox o on o.invite_id=i.id')).rows[0];
      assert.equal(stamps.same, true);
    });
    await t.test('each reminder stamps its own clock and duplicate acceptance preserves it', async () => {
      await reset(); await queue([contact()]);
      await db.exec("update public.employer_message_outbox set status='accepted', accepted_at=now()");
      for (const [kind, column] of [['reminder_1', 'first_reminder_at'], ['reminder_2', 'second_reminder_at'], ['completion', 'completion_reminder_at']]) {
        await db.query('insert into public.employer_message_outbox(role_id,invite_id,kind,channel) select role_id,id,$1,\'email\' from public.role_invites', [kind]);
        await db.query("update public.employer_message_outbox set status='accepted', accepted_at=now() where kind=$1", [kind]);
        const stamp = (await db.query(`select ${column} as stamp from public.role_invites`)).rows[0].stamp;
        assert.ok(stamp);
        await db.query("update public.employer_message_outbox set status='accepted', accepted_at=now()+interval '1 day' where kind=$1", [kind]);
        assert.deepEqual((await db.query(`select ${column} as stamp from public.role_invites`)).rows[0].stamp, stamp);
      }
    });
    await t.test('manual reminder transaction rechecks eligibility, owner scope and batch idempotency', async () => {
      await reset(); await queue([contact(), contact(1), contact(2)]);
      const invites = (await db.query('select id,email from public.role_invites order by email')).rows;
      await db.query("update public.role_invites set status='submitted' where id=$1", [invites[0].id]);
      await db.query("update public.role_invites set last_manual_reminder_at=now()-interval '2 hours' where id=$1", [invites[1].id]);
      const batch = randomUUID();
      const ids = invites.map(row => row.id);
      const remind = async employerId => (await db.query(
        'select public.queue_manual_employer_reminders($1,$2,$3::uuid[],$4,$5) as result',
        [role, employerId, ids, 'Please complete your work sample. {{invitation_link}}', batch],
      )).rows[0].result;
      assert.deepEqual(await remind(owner), { queued: 1, skipped: 2, batchKey: batch });
      assert.deepEqual(await remind(owner), { queued: 0, skipped: 3, batchKey: batch });
      const secondBatch = (await db.query(
        'select public.queue_manual_employer_reminders($1,$2,$3::uuid[],$4,$5) as result',
        [role, owner, ids, 'Please complete your work sample. {{invitation_link}}', randomUUID()],
      )).rows[0].result;
      assert.equal(secondBatch.queued, 0);
      await assert.rejects(remind(other), /Role not found/);
      const job = (await db.query("select kind,message_body,batch_key from public.employer_message_outbox where kind='manual_reminder'")).rows[0];
      assert.equal(job.kind, 'manual_reminder');
      assert.match(job.message_body, /invitation_link/);
      assert.equal(job.batch_key, batch);
      assert.equal(Number((await db.query("select count(*) as count from public.recruiter_audit_events where action='reminders_queued'")).rows[0].count), 3);
    });
    await t.test('manual reminder acceptance stamps only the selected invite and delivered is a valid provider state', async () => {
      await reset(); await queue([contact()]);
      const inviteId = (await db.query('select id from public.role_invites')).rows[0].id;
      await db.query(
        'select public.queue_manual_employer_reminders($1,$2,$3::uuid[],$4,$5)',
        [role, owner, [inviteId], 'Reminder {{invitation_link}}', randomUUID()],
      );
      await db.exec("update public.employer_message_outbox set status='accepted',accepted_at=now() where kind='manual_reminder'");
      assert.ok((await db.query('select last_manual_reminder_at as stamp from public.role_invites')).rows[0].stamp);
      await db.exec("update public.employer_message_outbox set status='delivered',delivered_at=now() where kind='manual_reminder'");
      assert.equal((await db.query("select status from public.employer_message_outbox where kind='manual_reminder'")).rows[0].status, 'delivered');
    });
    await t.test('role publication idempotency key permits one intended record per employer', async () => {
      await reset();
      const publishKey = randomUUID();
      await db.query('update public.screening_packs set publish_key=$1 where id=$2', [publishKey, role]);
      await assert.rejects(
        db.query("insert into public.screening_packs(id,employer_id,expires_at,publish_key) values ($1,$2,now()+interval '1 day',$3)", [randomUUID(), owner, publishKey]),
        /duplicate key/,
      );
      await db.query("insert into public.screening_packs(id,employer_id,expires_at,publish_key) values ($1,$2,now()+interval '1 day',$3)", [randomUUID(), other, publishKey]);
    });
    await t.test('shortlist marker rolls back on outage; each schedule queues once', async () => {
      await reset(); await queue([contact()]);
      await db.exec("update public.role_invites set invited_at=now()-interval '3 days'");
      await db.query('insert into public.interviews(id,screening_pack_id,submitted_at) values ($1,$2,now())', [randomUUID(), role]);
      const shortlist = async kind => (await db.query('select public.queue_employer_shortlist($1,$2) as count', [role, kind])).rows[0].count;
      await db.exec('create trigger reject_test_job before insert on public.employer_message_outbox for each row execute function public.reject_test_job()');
      await assert.rejects(shortlist('48h'), /synthetic outage/);
      assert.equal((await db.query('select shortlist_48h_sent_at as stamp from public.screening_packs')).rows[0].stamp, null);
      await db.exec('drop trigger reject_test_job on public.employer_message_outbox');
      assert.equal(await shortlist('48h'), 1); assert.equal(await shortlist('48h'), 0);
      assert.equal(await shortlist('close'), 0);
      await db.exec("update public.screening_packs set expires_at=now()-interval '1 day'");
      assert.equal(await shortlist('close'), 1); assert.equal(await shortlist('close'), 0);
    });
  } finally { await db.close(); }
});
