import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';
register('./test-hooks/ts-paths.mjs', import.meta.url);
const { processEmployerMessages } = await import('../lib/server/employer-messages.ts');
const { newInviteToken } = await import('../lib/server/invite-token.ts');

test('employer sender retries safely and reports provider acceptance honestly', async t => {
  const keys = ['RESEND_TRANSACTIONAL_API_KEY', 'RESEND_FEEDBACK_API_KEY', 'INTERVIEW_SECRET'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.RESEND_TRANSACTIONAL_API_KEY = 'synthetic-test-key';
  delete process.env.RESEND_FEEDBACK_API_KEY;
  process.env.INTERVIEW_SECRET = 'synthetic-test-secret-never-used-outside-tests';
  const make = ({ lookupError = false, retrySourceError = false, saveError = false, code = 200, kind = 'invite', invitePatch = {}, jobPatch = {}, retrySource = null } = {}) => {
    const patches = []; const requests = []; const filters = [];
    const token = newInviteToken();
    const job = { id: 'test-job', role_id: 'test-role', invite_id: 'test-invite', kind, channel: 'email', attempt_count: 1, message_body: kind === 'manual_reminder' ? 'Reminder {{invitation_link}}' : null, retry_of: null, ...jobPatch };
    const adminClient = {
      rpc: async (_name, args) => { assert.equal(args.p_limit, 5); return { data: [job], error: null }; },
      from(table) {
        let patch;
        const builder = {
          select() { return builder; },
          eq(key, value) { filters.push([table, key, value]); return builder; },
          update(value) { patch = value; patches.push(value); return builder; },
          async maybeSingle() {
            if (lookupError) return { data: null, error: { code: 'temporary' } };
            if (table === 'employer_message_outbox') return { data: retrySource, error: retrySourceError ? { code: 'temporary' } : null };
            return { error: null, data: table === 'screening_packs'
              ? { id: 'test-role', public_code: 'test-public', workplace: 'Fictional Test', signed_token: '', expires_at: '2099-01-01T00:00:00Z' }
              : { id: 'test-invite', email: 'test@example.test', status: 'invited', token_cipher: token.cipher, contact_allowed: true, opted_out_at: null, withdrawn_at: null, deleted_at: null, last_manual_reminder_at: null, ...invitePatch } };
          },
          then(resolve, reject) {
            return Promise.resolve({ data: saveError ? null : [{ id: 'test-job' }], error: saveError ? { code: 'save_failed' } : null }).then(resolve, reject);
          },
        };
        return builder;
      },
    };
    const run = () => processEmployerMessages({ adminClient, limit: 50, fetchImpl: async (_url, options) => {
      requests.push(options);
      return Response.json(code === 200 ? { id: 'synthetic-provider-id' } : { error: 'synthetic' }, { status: code });
    } });
    return { run, patches, requests, filters };
  };
  try {
    await t.test('missing provider never claims or sends', async () => {
      delete process.env.RESEND_TRANSACTIONAL_API_KEY;
      const fixture = make();
      assert.equal((await fixture.run()).configured, false);
      assert.deepEqual(fixture.requests, []);
      process.env.RESEND_TRANSACTIONAL_API_KEY = 'synthetic-test-key';
    });
    await t.test('database lookup failure stays retryable instead of cancelling the invite', async () => {
      const fixture = make({ lookupError: true });
      assert.equal((await fixture.run()).failed, 1);
      assert.equal(fixture.patches[0].status, 'pending');
      assert.equal(fixture.patches[0].last_error_code, 'scope_lookup_failed');
      assert.deepEqual(fixture.requests, []);
    });
    await t.test('rate limiting reuses the same provider idempotency key', async () => {
      const fixture = make({ code: 429 });
      await fixture.run(); await fixture.run();
      assert.deepEqual(fixture.requests.map(r => r.headers['Idempotency-Key']), ['employer-message/test-job', 'employer-message/test-job']);
      assert.ok(fixture.patches.every(p => p.status === 'pending'));
    });
    await t.test('permanent provider rejection becomes failed', async () => {
      const fixture = make({ code: 422 });
      assert.equal((await fixture.run()).failed, 1);
      assert.equal(fixture.patches[0].status, 'failed');
    });
    await t.test('success persists provider acceptance and scopes invite lookup to its role', async () => {
      const fixture = make();
      assert.equal((await fixture.run()).accepted, 1);
      assert.equal(fixture.patches[0].status, 'accepted');
      assert.equal(fixture.patches[0].provider_message_id, 'synthetic-provider-id');
      assert.ok(fixture.filters.some(([table, key, value]) => table === 'role_invites' && key === 'role_id' && value === 'test-role'));
    });
    await t.test('a contact withdrawal after queueing cancels a manual reminder before provider dispatch', async () => {
      const fixture = make({ kind: 'manual_reminder', invitePatch: { contact_allowed: false } });
      assert.equal((await fixture.run()).failed, 1);
      assert.equal(fixture.patches[0].status, 'cancelled');
      assert.equal(fixture.patches[0].last_error_code, 'contact_disallowed');
      assert.deepEqual(fixture.requests, []);
    });
    await t.test('accepted then delivery-failed manual reminder can use one verified retry job', async () => {
      const fixture = make({
        kind: 'manual_reminder',
        invitePatch: { last_manual_reminder_at: new Date().toISOString() },
        jobPatch: { retry_of: 'failed-job' },
        retrySource: { id: 'failed-job', role_id: 'test-role', invite_id: 'test-invite', kind: 'manual_reminder', status: 'failed', last_error_code: 'email.failed' },
      });
      assert.equal((await fixture.run()).accepted, 1);
      assert.equal(fixture.patches.at(-1).status, 'accepted');
      assert.equal(fixture.requests.length, 1);
    });
    await t.test('complaint, bounce or unverified retry sources never bypass the recent-send guard', async () => {
      for (const last_error_code of ['email.complained', 'email.bounced', 'email.suppressed']) {
        const fixture = make({
          kind: 'manual_reminder',
          invitePatch: { last_manual_reminder_at: new Date().toISOString() },
          jobPatch: { retry_of: 'failed-job' },
          retrySource: { id: 'failed-job', role_id: 'test-role', invite_id: 'test-invite', kind: 'manual_reminder', status: 'failed', last_error_code },
        });
        assert.equal((await fixture.run()).failed, 1);
        assert.equal(fixture.patches[0].last_error_code, 'invalid_retry_source');
        assert.deepEqual(fixture.requests, []);
      }
    });
    await t.test('failed acceptance write is not reported as successful', async () => {
      const fixture = make({ saveError: true });
      await assert.rejects(fixture.run(), /employer_message_state_not_saved/);
    });
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }
});
