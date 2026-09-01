import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildScreeningInvitationEmail } from '../lib/screening-invitation-email.ts';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const migrationFile = 'supabase/migrations/20260901160810_screening_email_invitations_and_pack_close.sql';

test('invitation creation is owner-scoped, origin checked and idempotent', () => {
  const route = read('app/api/screening/packs/[id]/invitations/route.ts');
  const migration = read(migrationFile);

  assert.match(route, /hasTrustedOrigin\(request\)/);
  assert.match(route, /currentUser\(\)/);
  assert.match(route, /email_confirmed_at/);
  assert.match(route, /\.eq\('id', id\.data\)[\s\S]*\.eq\('employer_id', employer\.id\)/);
  assert.match(route, /z\.object\(\{ email: z\.string\(\)\.trim\(\)\.email\(\)\.max\(254\) \}\)\.strict\(\)/);
  assert.match(migration, /unique \(screening_pack_id, recipient_email_hash\)/);
  assert.match(route, /Idempotency-Key': `screening_invitation_\$\{invitation\.id\}`/);
  assert.match(route, /alreadySent: true/);
  assert.doesNotMatch(route, /Response\.json\(\{\s*sent:[^}]*\bemail\s*:/i);
});

test('invitation storage is service-only and never stores raw recipient addresses or tokens', () => {
  const migration = read(migrationFile);

  assert.match(migration, /alter table public\.screening_email_invitations enable row level security/);
  assert.match(migration, /revoke all on table public\.screening_email_invitations from public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete on table public\.screening_email_invitations to service_role/);
  assert.match(migration, /recipient_email_hash text not null/);
  assert.match(migration, /token_hash text not null unique/);
  assert.doesNotMatch(migration, /recipient_email\s+text|raw_token|invitation_token\s+text/i);
});

test('email-bound invitations reject a different verified email before and after OTP', () => {
  const requestRoute = read('app/api/screening/auth/request/route.ts');
  const verifyRoute = read('app/api/screening/auth/verify/route.ts');
  const migration = read(migrationFile);

  assert.match(requestRoute, /inviteToken: z\.string\(\)\.regex\(\/\^\[A-Za-z0-9_-\]\{43\}\$\/\)\.optional\(\)/);
  assert.match(requestRoute, /\.eq\('token_hash', screeningInvitationTokenHash\(parsed\.data\.inviteToken\)\)/);
  assert.match(requestRoute, /\.eq\('recipient_email_hash', recipientEmailHash\)/);
  assert.match(verifyRoute, /p_recipient_email_hash: recipientEmailHash/);
  assert.match(verifyRoute, /p_candidate_user_id: data\.user\.id/);
  assert.match(migration, /invitation_row\.recipient_email_hash <> p_recipient_email_hash/);
  assert.match(migration, /invitation_row\.candidate_user_id <> p_candidate_user_id/);
});

test('manual close is owner-scoped, idempotent and preserves the original expiry', () => {
  const route = read('app/api/screening/packs/[id]/route.ts');
  const migration = read(migrationFile);

  assert.match(route, /z\.object\(\{ action: z\.literal\('close'\) \}\)\.strict\(\)/);
  assert.match(route, /\.eq\('id', id\.data\)[\s\S]*\.eq\('employer_id', employer\.id\)/);
  assert.match(route, /\.update\(\{ closed_at: closedAt \}\)/);
  assert.match(route, /\.is\('closed_at', null\)/);
  assert.match(route, /alreadyClosed: true/);
  assert.doesNotMatch(route, /update\(\{[^}]*expires_at/);
  assert.match(migration, /add column if not exists closed_at timestamptz/);
});

test('closing a pack blocks new starts but allows the same candidate to resume', () => {
  const migration = read(migrationFile);
  const existingInterviewCheck = migration.indexOf('select * into existing_row');
  const closedCheck = migration.indexOf('if pack_row.closed_at is not null then');

  assert.ok(existingInterviewCheck >= 0, 'existing interview lookup must exist');
  assert.ok(closedCheck > existingInterviewCheck, 'resume must be resolved before rejecting a closed pack');
  assert.match(migration, /where screening_pack_id = p_pack_id[\s\S]*candidate_user_id = p_candidate_user_id/);
  assert.match(migration, /return jsonb_build_object\('status', 'resumed', 'interview_id', existing_row\.id\)/);
  assert.match(migration, /return jsonb_build_object\('status', 'closed'\)/);
});

test('candidate invitation email explains the work sample without exposing evidence', () => {
  const email = buildScreeningInvitationEmail({
    companyName: 'Nour Clinic <script>',
    roleTitle: 'Receptionist',
    invitationUrl: 'https://trymuqabala.com/s/abc123?invite=opaque-token',
    expiresAt: '2026-09-14T12:00:00.000Z',
  });
  const rendered = `${email.subject}\n${email.text}\n${email.html}`;

  assert.match(rendered, /three questions/i);
  assert.match(rendered, /12 minutes/i);
  assert.match(rendered, /reviewed by the employer/i);
  assert.doesNotMatch(rendered, /transcript|video path|score|analysis|storage\/v1/i);
  assert.doesNotMatch(email.html, /<script>/i);
});
