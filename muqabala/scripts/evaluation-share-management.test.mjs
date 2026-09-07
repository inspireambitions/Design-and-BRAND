import test from 'node:test';
import assert from 'node:assert/strict';
import './test-hooks/register.mjs';
const { closeOwnedEvaluationShare } = await import('../lib/server/evaluation-share-management.ts');

function database() {
  const tables = {
    candidate_evaluation_reports: [
      { id: 'old', interview_id: 'interview', employer_id: 'owner', version: 1 },
      { id: 'new', interview_id: 'interview', employer_id: 'owner', version: 2 },
      { id: 'other', interview_id: 'other-interview', employer_id: 'someone-else', version: 1 },
    ],
    evaluation_report_shares: [
      { id: 'old-link', report_id: 'old', revoked_at: null },
      { id: 'foreign-link', report_id: 'other', revoked_at: null },
    ],
  };
  return { tables, from(table) {
    const filters = []; let update;
    const execute = () => {
      const data = tables[table].filter((row) => filters.every((filter) => filter(row)));
      if (update) data.forEach((row) => Object.assign(row, update));
      return { data, error: null };
    };
    const query = {
      select() { return query; },
      update(value) { update = value; return query; },
      eq(key, value) { filters.push((row) => row[key] === value); return query; },
      is(key, value) { return query.eq(key, value); },
      in(key, values) { filters.push((row) => values.includes(row[key])); return query; },
      then(resolve) { return Promise.resolve(execute()).then(resolve); },
      maybeSingle() { const result = execute(); return Promise.resolve({ ...result, data: result.data[0] ?? null }); },
    };
    return query;
  } };
}

test('owner can revoke an archived version link and audit the actual version', async () => {
  const db = database();
  assert.deepEqual(await closeOwnedEvaluationShare(db, 'interview', 'owner', 'old-link'), { reportDatabaseId: 'old', reportVersion: 1 });
  assert.ok(db.tables.evaluation_report_shares[0].revoked_at);
  assert.equal(await closeOwnedEvaluationShare(db, 'interview', 'owner', 'old-link'), null);
});

test('another employer cannot revoke a link by guessing its id', async () => {
  const db = database();
  assert.equal(await closeOwnedEvaluationShare(db, 'interview', 'someone-else', 'old-link'), null);
  assert.equal(await closeOwnedEvaluationShare(db, 'interview', 'owner', 'foreign-link'), null);
  assert.ok(db.tables.evaluation_report_shares.every((row) => row.revoked_at === null));
});

test('an unavailable ownership query fails closed before any update', async () => {
  let writes = 0;
  const db = { from() { return { select() { return this; }, eq() { return this; }, then(resolve) { return Promise.resolve({ data: null, error: new Error('unavailable') }).then(resolve); }, update() { writes++; } }; } };
  assert.equal(await closeOwnedEvaluationShare(db, 'interview', 'owner', 'old-link'), null);
  assert.equal(writes, 0);
});
