import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('employer volume flags default off and gate WhatsApp behind the volume flag', async () => {
  const flags = read('lib/employer-volume.ts');
  assert.match(flags, /EMPLOYER_VOLUME/);
  assert.match(flags, /WHATSAPP_ENABLED/);
  assert.match(flags, /employerVolumeEnabled\(\) && flag\(process\.env\.WHATSAPP_ENABLED\)/);

  const { employerVolumeEnabled, whatsAppEnabled } = await import('../lib/employer-volume.ts');
  delete process.env.EMPLOYER_VOLUME;
  delete process.env.WHATSAPP_ENABLED;
  assert.equal(employerVolumeEnabled(), false);
  assert.equal(whatsAppEnabled(), false);
  process.env.WHATSAPP_ENABLED = 'true';
  assert.equal(whatsAppEnabled(), false, 'WhatsApp never enables without the volume flag');
  process.env.EMPLOYER_VOLUME = 'true';
  assert.equal(employerVolumeEnabled(), true);
  assert.equal(whatsAppEnabled(), true);
  delete process.env.EMPLOYER_VOLUME;
  delete process.env.WHATSAPP_ENABLED;
});

test('section 1: employer page hero and sample block change only behind the flag', () => {
  const page = read('app/for-employers/page.tsx');
  const component = read('components/EmployerProofCreate.tsx');
  const copy = read('lib/marketing-content.ts');

  assert.match(page, /volume=\{employerVolumeEnabled\(\)\}/);
  assert.match(page, /production=\{process\.env\.NODE_ENV === 'production'\}/);
  assert.match(page, /samples\/employer-report\.png/);

  assert.match(component, /\{volume \? c\.volumeTitle : c\.title\}/);
  assert.match(component, /\{volume \? c\.volumePrimary : c\.primaryCta\}/);
  assert.match(component, /encodeURIComponent\('\/for-employers#create'\)/);
  assert.match(component, /volume && !production \?/);
  assert.match(component, /hidden in production/);

  assert.match(copy, /volumeTitle: '223 applications\. Seven worth your time\. 48 hours\.'/);
  assert.match(copy, /volumePrimary: 'Start a shortlist, free'/);
  assert.match(copy, /volumeSecondary: 'See a real report'/);
  assert.match(copy, /volumeTrust: 'No automatic rejection\. No accent, face or personality scoring\. You decide\.'/);
  assert.match(copy, /volumeSampleTitle: 'What you get after a candidate answers'/);

  const signIn = read('components/EmailSignIn.tsx');
  assert.doesNotMatch(signIn, /Promotions or Spam|emailDeliveryHelp/);
});

test('section 2: free text parsing accepts any separator, dedupes and reports invalid rows', async () => {
  const { parseContacts, summaryLine } = await import('../lib/employer-volume/contacts.ts');
  const input = 'a@example.com, b@example.com;c@example.com\nA@EXAMPLE.COM\t+971501234567\n+971 50 123 4567, bad@ 0501234567 hello';
  const result = parseContacts(input, 'text');
  assert.equal(result.found, 9);
  assert.equal(result.valid.length, 4, 'three emails and one phone');
  assert.equal(result.duplicates, 2, 'upper-case email and spaced phone are duplicates');
  assert.equal(result.invalid.length, 3);
  assert.deepEqual(result.invalid.map((row) => row.reason).sort(), ['bad_email', 'bad_phone', 'no_contact']);
  assert.equal(summaryLine(result), '9 found. 2 duplicates removed. 3 invalid.');
  assert.equal(result.valid.find((contact) => contact.phone)?.phone, '+971501234567');
});

test('section 2: SmartRecruiters and Workday CSV exports parse with no mapping step', async () => {
  const { parseContacts } = await import('../lib/employer-volume/contacts.ts');

  const smart = parseContacts(read('tests/fixtures/smartrecruiters-export.csv'), 'csv');
  assert.equal(smart.found, 8);
  assert.equal(smart.valid.length, 6);
  assert.equal(smart.duplicates, 1, 'Yusuf shares Amina phone; email differs so counted once as duplicate on phone');
  assert.equal(smart.invalid.length, 1, 'Rohit has no usable contact');
  const amina = smart.valid.find((contact) => contact.email === 'amina.hassan@example.com');
  assert.equal(amina?.name, 'Amina Hassan');
  assert.equal(amina?.phone, '+971501234567');
  const layla = smart.valid.find((contact) => contact.email === 'layla.haddad@example.com');
  assert.equal(layla?.phone, null, 'local number without country code is dropped, email kept');
  const sara = smart.valid.find((contact) => contact.email === 'sara.almansoori@example.com');
  assert.equal(sara?.name, 'Sara, Al Mansoori', 'quoted field with an embedded comma survives');
  assert.match(sara?.phone ?? '', /^\+971/);

  const workday = parseContacts(read('tests/fixtures/workday-export.csv'), 'csv');
  assert.equal(workday.found, 7);
  assert.equal(workday.valid.length, 6);
  assert.equal(workday.duplicates, 1, 'Chidi appears twice');
  assert.equal(workday.invalid.length, 0);
  assert.equal(workday.valid.find((contact) => contact.email === 'marvin.delacruz@example.com')?.phone, '+639175550134', '00 prefix becomes +');
  assert.equal(workday.valid.find((contact) => contact.phone === '+919876543210')?.name, 'Nair, Deepa');
});

test('section 2: 250 pasted emails parse well inside the budget', async () => {
  const { parseContacts } = await import('../lib/employer-volume/contacts.ts');
  const emails = Array.from({ length: 250 }, (_, index) => `candidate${index}@example.com`).join('\n');
  const started = performance.now();
  const result = parseContacts(emails, 'text');
  const elapsed = performance.now() - started;
  assert.equal(result.valid.length, 250);
  assert.ok(elapsed < 1000, `parse took ${elapsed}ms`);
});

test('section 2: invite copy fits the channel and stays bilingual', async () => {
  const { inviteSubject, inviteText, inviteWhatsApp } = await import('../lib/employer-volume/invite-message.ts');
  const input = { employerName: 'Nour Clinic', roleTitle: 'Receptionist', link: 'https://trymuqabala.com/s/abc123?i=' + 'x'.repeat(43) };
  assert.equal(inviteSubject(input), 'Nour Clinic: three questions for the Receptionist role');
  const text = inviteText(input);
  assert.match(text, /About 12 minutes\. No account needed\. Your video stays on your device/);
  assert.match(text, /----------/);
  assert.match(text, /نحو ١٢ دقيقة/);
  assert.ok(inviteWhatsApp(input).length <= 300);
  const long = { ...input, roleTitle: 'Senior Front Office and Guest Relations Supervisor (Night Shift, Palm Jumeirah Resort and Residences)' };
  assert.ok(inviteWhatsApp(long).length <= 300);
});

test('section 2: invites table is owner-scoped, tokens are hashed and the candidate link binds an invite', () => {
  const migration = read('supabase/migrations/20260902120000_employer_volume_invites.sql');
  assert.match(migration, /create table if not exists public\.role_invites/);
  assert.match(migration, /candidate_ref text not null unique check \(candidate_ref ~ '\^MQ-/);
  assert.match(migration, /token_hash text not null unique check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
  assert.match(migration, /role_invites_role_email_key on public\.role_invites \(role_id, lower\(email\)\)/);
  assert.match(migration, /role_invites_role_phone_key on public\.role_invites \(role_id, phone\)/);
  assert.match(migration, /alter table public\.role_invites enable row level security/);
  assert.match(migration, /revoke all on public\.role_invites from public, anon, authenticated/);
  assert.match(migration, /for select to authenticated[\s\S]*p\.employer_id = auth\.uid\(\)/);
  assert.doesNotMatch(migration, /for (insert|update|delete) to authenticated/, 'JWT roles never write invites');
  assert.match(migration, /status in \('invited', 'started', 'submitted', 'expired'\)/);
  assert.match(migration, /bind_invite_to_interview/);
  assert.match(migration, /p\.expires_at <= now\(\)[\s\S]*status = 'expired'/, 'token expires when the role closes');

  const rlsTest = read('supabase/tests/role_invites_rls.sql');
  assert.match(rlsTest, /set local role authenticated/);
  assert.match(rlsTest, /other_by_token <> 0 then raise exception/);

  const route = read('app/api/employer/roles/[roleId]/invites/route.ts');
  assert.match(route, /if \(!employerVolumeEnabled\(\)\) return Response\.json\(\{ error: 'Not available\.' \}, \{ status: 404 \}\)/);
  assert.match(route, /pack\.employer_id !== user\.id/);
  assert.match(route, /newInviteToken\(\)/);
  assert.match(route, /processEmployerMessages\(/);
  assert.match(route, /whatsAppEnabled\(\) \? parsed\.data\.channel : 'email'/);

  const start = read('app/api/interviews/route.ts');
  assert.match(start, /bind_invite_to_interview/);
  const candidatePage = read('app/s/[code]/page.tsx');
  assert.match(candidatePage, /This link has closed/);
  const inviteToken = read('lib/server/invite-token.ts');
  assert.match(inviteToken, /aes-256-gcm/);
  assert.doesNotMatch(read('lib/server/employer-messages.ts'), /token_hash.*link/);
});

test('section 2: add candidates screen renders the channel row only behind the WhatsApp flag', () => {
  const screen = read('components/AddCandidates.tsx');
  assert.match(screen, /Paste emails or phone numbers, or upload a CSV from your applicant system\./);
  assert.match(screen, /\{whatsApp && \(\s*<fieldset/);
  assert.match(screen, /hasPhone \? 'both' : 'email'/);
  assert.match(screen, /disabled=\{!canSend\}/);
  assert.match(screen, /Sent to \{sent\.sent\}/);
  const page = read('app/employer/roles/[roleId]/candidates/add/page.tsx');
  assert.match(page, /if \(!flags\.volume\) notFound\(\)/);
});

test('section 3: reminders fire at 48h and 120h, cap at three messages, and stop when toggled off or the role closes', async () => {
  const { dueReminder, reminderOutcome, reminderOutcomeLine } = await import('../lib/employer-volume/reminders.ts');
  const invitedAt = new Date('2026-09-01T09:00:00Z');
  const at = (hours) => new Date(invitedAt.getTime() + hours * 60 * 60 * 1000);
  const role = { expires_at: '2026-09-30T00:00:00Z', reminders_enabled: true };
  const invite = {
    status: 'invited', invited_at: invitedAt.toISOString(),
    first_reminder_at: null, second_reminder_at: null, completion_reminder_at: null,
    started_at: null, last_activity_at: null,
  };

  assert.equal(dueReminder(invite, role, at(47.9)), null, 'nothing before 48h');
  assert.equal(dueReminder(invite, role, at(48)), 'reminder_1');
  const afterFirst = { ...invite, first_reminder_at: at(48).toISOString() };
  assert.equal(dueReminder(afterFirst, role, at(100)), null, 'nothing between reminders');
  assert.equal(dueReminder(afterFirst, role, at(120)), 'reminder_2');
  const afterSecond = { ...afterFirst, second_reminder_at: at(120).toISOString() };
  assert.equal(dueReminder(afterSecond, role, at(500)), null, 'three messages is the cap');

  const started = { ...invite, status: 'started', started_at: at(10).toISOString(), last_activity_at: at(12).toISOString() };
  assert.equal(dueReminder(started, role, at(30)), null, 'active within 24h');
  assert.equal(dueReminder(started, role, at(36.5)), 'completion');
  assert.equal(dueReminder({ ...started, completion_reminder_at: at(36.5).toISOString() }, role, at(200)), null, 'one completion reminder only');
  assert.equal(dueReminder({ ...afterSecond, status: 'started', started_at: at(121).toISOString(), last_activity_at: at(121).toISOString() }, role, at(200)), null, 'cap holds across kinds');

  assert.equal(dueReminder(invite, { ...role, reminders_enabled: false }, at(72)), null, 'toggle off suppresses all');
  assert.equal(dueReminder(invite, { ...role, expires_at: at(60).toISOString() }, at(72)), null, 'closed role suppresses all');
  assert.equal(dueReminder({ ...invite, status: 'submitted' }, role, at(72)), null);

  const outcome = reminderOutcome([
    { first_reminder_at: at(48).toISOString(), second_reminder_at: null, completion_reminder_at: null, submitted_at: at(50).toISOString() },
    { first_reminder_at: at(48).toISOString(), second_reminder_at: null, completion_reminder_at: null, submitted_at: null },
    { first_reminder_at: null, second_reminder_at: null, completion_reminder_at: null, submitted_at: at(20).toISOString() },
    { first_reminder_at: at(48).toISOString(), second_reminder_at: at(120).toISOString(), completion_reminder_at: null, submitted_at: at(30).toISOString() },
  ]);
  assert.deepEqual(outcome, { reminded: 3, answeredAfter: 1 });
  assert.equal(reminderOutcomeLine(outcome), 'Reminded 3. 1 more answered.');
});

test('section 3: hourly cron is registered, gated by the flag and the toggle is owner-scoped', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const cron = vercel.crons.find((entry) => entry.path === '/api/cron/employer-volume');
  assert.ok(cron, 'employer volume cron registered');
  assert.match(cron.schedule, /^\d+ \* \* \* \*$/, 'runs hourly');
  const route = read('app/api/cron/employer-volume/route.ts');
  assert.match(route, /Bearer \$\{secret\}/);
  assert.match(route, /if \(!employerVolumeEnabled\(\)\) return Response\.json\(\{ enabled: false \}/);
  const migration = read('supabase/migrations/20260902130000_employer_volume_reminders.sql');
  assert.match(migration, /reminders_enabled boolean not null default true/);
  assert.match(migration, /grant update \(reminders_enabled\) on public\.screening_packs to authenticated/);
  const actions = read('app/employer/actions.ts');
  assert.match(actions, /export async function setRemindersEnabled/);
  const dashboard = read('app/employer/page.tsx');
  assert.match(dashboard, /role="switch" aria-checked=\{remindersOn\}/);
  assert.match(dashboard, /reminderOutcomeLine\(reminders\)/);
});

test('no em dashes in employer volume copy or docs', () => {
  for (const path of ['lib/employer-volume.ts', 'docs/employer-volume-changes.md', 'scripts/employer-volume.test.mjs']) {
    assert.doesNotMatch(read(path), /\u2014/, `${path} contains an em dash`);
  }
  const copy = read('lib/marketing-content.ts');
  assert.doesNotMatch(copy, /\u2014/);
});
