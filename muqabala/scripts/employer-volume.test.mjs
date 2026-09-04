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
  assert.equal(inviteSubject(input), 'Nour Clinic: adaptive interview for the Receptionist role');
  const text = inviteText(input);
  assert.match(text, /Allow about 25 minutes\. Verify your email/);
  assert.match(text, /----------/);
  assert.match(text, /نحو ٢٥ دقيقة/);
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
  assert.doesNotMatch(read('lib/server/employer-messages.ts'), /inviteLink\([^)]*token_hash/, 'invite links are built from the sealed token, never the hash');
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
  const cronAuth = read('lib/server/cron-auth.ts');
  assert.match(route, /rejectUnauthorisedCron\(request, 'employer_volume'\)/);
  assert.match(cronAuth, /Bearer \$\{secret\}/);
  assert.match(cronAuth, /cron_secret_missing/);
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

test('section 4: rubric coverage is ticks from stored evidence, never a number, and orders candidates', async () => {
  const { coverageFor, compareCandidates, coverageMarks } = await import('../lib/employer-volume/coverage.ts');
  const competencies = [
    { id: 'communication', label: 'Communication' },
    { id: 'ownership', label: 'Ownership' },
    { id: 'problem_solving', label: 'Problem solving' },
    { id: 'evidence', label: 'Specific evidence' },
    { id: 'customer_focus', label: 'Customer focus' },
  ];
  const scored = (pairs) => ({ feedback: { status: 'scored', competencies: pairs.map(([id, evidence]) => ({ id, evidence })) } });
  const full = coverageFor(competencies, [
    scored([['communication', 'I explained'], ['ownership', null]]),
    scored([['ownership', 'I took charge'], ['problem_solving', 'I found a room']]),
    scored([['evidence', 'twenty minutes'], ['customer_focus', 'the guest smiled']]),
  ]);
  assert.equal(full.total, 4, 'first four competencies only');
  assert.equal(full.covered, 4);
  assert.equal(full.full, true);
  assert.equal(coverageMarks(full), '\u2713 \u2713 \u2713 \u2713');
  assert.doesNotMatch(JSON.stringify(full), /\/100|"score"/, 'no number out of 100');

  const partial = coverageFor(competencies, [scored([['communication', 'yes'], ['ownership', '  ']]), { feedback: { status: 'pending' } }]);
  assert.equal(partial.covered, 1, 'blank evidence and pending answers do not count');
  assert.equal(partial.full, false);

  const list = [
    { id: 'b', coverage: partial, submittedAt: '2026-09-01T10:00:00Z' },
    { id: 'a', coverage: full, submittedAt: '2026-09-02T10:00:00Z' },
    { id: 'c', coverage: coverageFor(competencies, [scored([['communication', 'x'], ['ownership', 'y'], ['problem_solving', 'z']])]), submittedAt: '2026-09-01T09:00:00Z' },
    { id: 'd', coverage: full, submittedAt: '2026-09-01T08:00:00Z' },
  ].sort(compareCandidates).map((item) => item.id);
  assert.deepEqual(list, ['d', 'a', 'c', 'b'], 'full coverage first, then count, then earliest submission');
});

test('section 4: shortlist email subject, snippet, ordering and magic link', async () => {
  const { shortlistSubject, shortlistText, shortlistHtml, firstAnswerSnippet, pickShortlistRows } = await import('../lib/employer-volume/shortlist-message.ts');
  const cov = (n) => ({ items: Array.from({ length: 4 }, (_, i) => ({ id: String(i), label: 'x', labelAr: 'x', covered: i < n })), covered: n, total: 4, full: n === 4 });
  const input = {
    roleTitle: 'Receptionist', employerName: 'Nour Clinic', invited: 223, answered: 41, fullCoverage: 7,
    rows: [{ displayName: 'Aisha R.', coverage: cov(4), firstAnswer: 'Hello there', openUrl: 'https://trymuqabala.com/auth/confirm?token_hash=abc&type=magiclink&next=%2Femployer%2Finterviews%2F1' }],
  };
  assert.equal(shortlistSubject(input), 'Receptionist: 41 answered, 7 to review');
  assert.match(shortlistText(input), /223 invited\. 41 answered\. 7 with full rubric coverage\./);
  assert.match(shortlistHtml(input), /auth\/confirm\?token_hash=abc&amp;type=magiclink/);
  assert.doesNotMatch(shortlistHtml(input), /\/100/);
  assert.equal(firstAnswerSnippet('a'.repeat(200)).length, 93, '90 characters plus an ellipsis');
  assert.equal(firstAnswerSnippet('  short   answer '), 'short answer');
  const picked = pickShortlistRows(Array.from({ length: 14 }, (_, i) => ({ id: i, coverage: cov(i % 5), submittedAt: `2026-09-0${(i % 9) + 1}T00:00:00Z` })));
  assert.equal(picked.length, 10);
  assert.ok(picked[0].coverage.covered >= picked[9].coverage.covered);

  const sender = read('lib/server/employer-messages.ts');
  assert.match(sender, /generateLink\(\{\s*type: 'magiclink'/);
  assert.match(sender, /token_hash=\$\{encodeURIComponent\(hashed\)\}&type=magiclink&src=shortlist&role=\$\{encodeURIComponent\(roleId\)\}&next=/);
  const scheduler = read('lib/server/employer-shortlist.ts');
  assert.match(scheduler, /SHORTLIST_AFTER_HOURS = 48/);
  assert.match(scheduler, /if \(!submissions\) continue/, 'only when at least one submission exists');
  assert.match(scheduler, /shortlist_close_sent_at/);
  const preview = read('app/dev/email/shortlist/route.ts');
  assert.match(preview, /if \(process\.env\.NODE_ENV === 'production'\) notFound\(\)/);
});

test('section 4: decisions are logged with reviewer, undo deletes the row, and the review screen is one candidate', () => {
  const actions = read('app/employer/actions.ts');
  assert.match(actions, /\.rpc\('record_employer_decision'/);
  assert.match(actions, /export async function undoDecision/);
  assert.match(actions, /\.rpc\('undo_employer_decision'/);
  assert.doesNotMatch(actions, /export async function setEmployerDecision/);
  assert.match(actions, /export async function createCandidateShare/);
  assert.match(actions, /7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(actions, /\/c\/\$\{token\}/);

  const review = read('components/CandidateReview.tsx');
  assert.match(review, /const UNDO_MS = 10_000/);
  assert.match(review, /decide\('shortlist'\)[\s\S]*decide\('pass'\)[\s\S]*decide\('later'\)/);
  assert.match(review, /start - end > 80\) goNext\(\)/, 'swipe left advances');
  assert.match(review, /maxLength=\{280\}/);
  assert.doesNotMatch(review, /\/100/);
  const dashboardActions = read('components/DashboardDecisionActions.tsx');
  assert.match(dashboardActions, /recordDecision\(\{ interviewId, decision \}\)/);
  assert.match(dashboardActions, /selected === normalised/);
  assert.match(dashboardActions, /router\.refresh\(\)/);
  assert.match(dashboardActions, /role=\{error \? 'alert' : 'status'\}/);
  const css = read('components/CandidateReview.module.css');
  assert.match(css, /\.decisionBar \{[\s\S]*position: fixed;[\s\S]*bottom: 0;/);
  assert.match(css, /width: min\(100% - 2rem, 40rem\)/, 'centred at 640px on desktop');

  const migration = read('supabase/migrations/20260902140000_employer_volume_review.sql');
  assert.match(migration, /create table if not exists public\.employer_decisions/);
  assert.match(migration, /decision in \('shortlist', 'pass', 'later'\)/);
  assert.match(migration, /create table if not exists public\.candidate_shares/);
  assert.match(migration, /response in \('recommend', 'not_this_one'\)/);
  assert.match(migration, /revoke all on public\.candidate_shares from public, anon, authenticated/);

  const consistencyMigration = read('supabase/migrations/20260903170412_employer_decision_consistency.sql');
  assert.match(consistencyMigration, /create or replace function public\.record_employer_decision/);
  assert.match(consistencyMigration, /when 'shortlist' then 'shortlisted'/);
  assert.match(consistencyMigration, /when 'pass' then 'not_proceeding'/);
  assert.match(consistencyMigration, /create or replace function public\.undo_employer_decision/);
  assert.match(consistencyMigration, /grant execute on function public\.record_employer_decision[\s\S]*to service_role/);
});

test('section 4: shared page is public, shows no contact details and closes when revoked', () => {
  const page = read('app/c/[token]/page.tsx');
  assert.match(page, /if \(share\.revoked_at \|\| new Date\(share\.expires_at\)\.getTime\(\) <= Date\.now\(\)\) return <Closed \/>/);
  assert.match(page, /This link has closed/);
  assert.doesNotMatch(page, /email|phone/i, 'no contact details are selected or rendered');
  assert.doesNotMatch(page, /currentUser|redirect\('\/sign-in/, 'no login step');
  assert.doesNotMatch(page, /\/100/);
  const respond = read('app/api/c/[token]/respond/route.ts');
  assert.match(respond, /\.is\('revoked_at', null\)/);
  assert.match(respond, /status: 410/);
});

test('section 5: strip numbers reconcile with invites and decisions from fixtures', async () => {
  const { roleStrip, actionLabel, timeSavedHours, timeSavedLine, responseRateLine } = await import('../lib/employer-volume/strip.ts');
  const invites = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, channel: 'email', status: i < 2 ? 'submitted' : 'invited' })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `w${i}`, channel: 'whatsapp', status: i < 2 ? 'submitted' : 'started' })),
    { id: 'b0', channel: 'both', status: 'submitted' },
    { id: 'x0', channel: 'email', status: 'expired' },
  ];
  const candidates = [
    { interviewId: 'c1', inviteId: 'e0', coverageFull: true, reviewedAt: '2026-09-02T10:00:00Z', decision: 'shortlist' },
    { interviewId: 'c2', inviteId: 'e1', coverageFull: true, reviewedAt: '2026-09-02T10:05:00Z', decision: 'pass' },
    { interviewId: 'c3', inviteId: 'w0', coverageFull: false, reviewedAt: '2026-09-02T10:10:00Z', decision: 'later' },
    { interviewId: 'c4', inviteId: 'w1', coverageFull: false, reviewedAt: null, decision: null },
    { interviewId: 'c5', inviteId: 'b0', coverageFull: true, reviewedAt: null, decision: null },
    { interviewId: 'c6', inviteId: null, coverageFull: false, reviewedAt: '2026-09-02T11:00:00Z', decision: 'shortlisted' },
  ];
  const strip = roleStrip(invites, candidates);
  assert.deepEqual(strip, { invited: 12, answered: 6, fullCoverage: 3, shortlisted: 2, decided: 4, unreviewed: 2, openedInReview: 4 });
  assert.equal(actionLabel(strip), 'Review 2 new answers');
  assert.equal(actionLabel({ ...strip, unreviewed: 0 }), 'Add candidates');
  assert.equal(actionLabel({ ...strip, unreviewed: 1 }), 'Review 1 new answer');
  assert.equal(timeSavedHours(strip, 4), 0.5, '(12 - 4) * 4 minutes = 32 minutes = 0.5 hours');
  assert.equal(timeSavedLine(strip, 15), 'Time saved: 2.0 hours');
  assert.equal(responseRateLine(invites), 'Email 38 percent. WhatsApp 60 percent.', 'email pool 8 incl. both, whatsapp pool 5 incl. both');
});

test('section 5: export of 500 candidates builds in well under the budget and is formula-safe', async () => {
  const { exportCsv, EXPORT_COLUMNS } = await import('../lib/employer-volume/strip.ts');
  const rows = Array.from({ length: 500 }, (_, i) => ({
    candidate_ref: `MQ-${String(i).padStart(6, 'A')}`, name: i === 3 ? '=HYPERLINK("x")' : `Candidate ${i}`, email: `c${i}@example.com`, phone: null, channel: 'email',
    invited_at: '2026-09-01T09:00:00Z', first_reminder_at: null, second_reminder_at: null, submitted_at: '2026-09-02T09:00:00Z',
    rubric: [true, false, true, true], decision: 'shortlist', reviewer: 'kim@example.com', decided_at: '2026-09-02T10:00:00Z', note: 'Strong, "quoted" note', share_response: null, share_responded_at: null,
  }));
  const started = performance.now();
  const csv = exportCsv(rows);
  assert.ok(performance.now() - started < 2000);
  assert.ok(csv.startsWith('\uFEFF'), 'UTF-8 BOM so Excel opens Arabic names correctly');
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 501);
  assert.equal(lines[0], EXPORT_COLUMNS.join(','));
  assert.match(lines[1], /,true,false,true,true,shortlist,kim@example\.com,/);
  assert.match(lines[4], /'=HYPERLINK/, 'formula prefix neutralised');
  assert.match(lines[1], /"Strong, ""quoted"" note"/);

  const { buildPdf } = await import('../lib/employer-volume/pdf.ts');
  const pdf = buildPdf([{ text: 'Muqabala', bold: true }, ...Array.from({ length: 120 }, (_, i) => ({ text: `Row ${i}` }))]);
  const bytes = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
  assert.match(bytes, /^%PDF-1\.4/);
  assert.match(bytes, /\/Count 3/, 'three pages for 121 lines');
  assert.match(bytes, /%%EOF\n$/);
});

test('section 5: summary image and exports are owner-only, logged, and the image carries no personal data', () => {
  const summary = read('app/api/employer/roles/[roleId]/summary/route.tsx');
  assert.match(summary, /pack\.employer_id !== user\.id/);
  assert.match(summary, /format: 'summary_png'/);
  assert.doesNotMatch(summary, /candidate\.displayName|candidate_name|\.email|\.phone|loadExportRows/, 'no names or contact details reach the image');
  assert.match(summary, /width: 1080, height: 1350/);
  const exportRoute = read('app/api/employer/roles/[roleId]/export/route.ts');
  assert.match(exportRoute, /from\('export_log'\)\.insert\(\{ employer_id: user\.id, role_id: pack\.id, format \}\)/);
  assert.doesNotMatch(exportRoute, /email:|phone:/, 'the PDF summary has no contact details');
  const dashboard = read('app/employer/page.tsx');
  assert.match(dashboard, /\['Invited', strip\.invited\], \['Answered', strip\.answered\], \['Full coverage', strip\.fullCoverage\], \['Shortlisted', strip\.shortlisted\], \['Decided', strip\.decided\]/);
  assert.match(dashboard, /\{whatsApp && <small>\{responseRateLine/);
  assert.match(dashboard, /name="minutes"/);
});

test('section 7: every brief event exists and no event carries a name, email or phone', () => {
  const analytics = read('lib/analytics.ts');
  for (const event of ['employer_landing_viewed', 'sample_report_opened', 'role_created', 'invites_sent', 'reminder_sent', 'candidate_answered', 'shortlist_email_opened', 'review_started', 'decision_made', 'candidate_shared', 'summary_shared', 'export_downloaded', 'payment_completed']) {
    assert.match(analytics, new RegExp(`'${event}'`), `${event} in EventName`);
  }
  assert.match(analytics, /flag_state: 'on' \| 'off'/);
  assert.match(analytics, /device: DeviceClass \| 'server'/);
  assert.doesNotMatch(analytics, /email:\s*string|phone:\s*string|name:\s*string/, 'no personal fields in the props whitelist');

  const server = read('lib/server/analytics.ts');
  assert.match(server, /\$process_person_profile: false/);
  assert.doesNotMatch(server, /\b(email|phone|name|candidate_name)\s*:/i, 'no personal property keys on the server props type');

  const fired = [
    ['components/EmployerProofCreate.tsx', ['employer_landing_viewed', 'sample_report_opened', 'role_created']],
    ['components/AddCandidates.tsx', ['invites_sent']],
    ['lib/server/employer-messages.ts', ['reminder_sent']],
    ['app/api/screening/interviews/[id]/submit/route.ts', ['candidate_answered']],
    ['app/auth/confirm/route.ts', ['shortlist_email_opened']],
    ['components/CandidateReview.tsx', ['review_started', 'decision_made', 'candidate_shared']],
    ['components/RoleCardTools.tsx', ['summary_shared', 'export_downloaded']],
  ];
  for (const [file, events] of fired) {
    const source = read(file);
    for (const event of events) assert.match(source, new RegExp(`'${event}'`), `${event} fired from ${file}`);
  }
  const invites = read('components/AddCandidates.tsx');
  assert.match(invites, /track\('invites_sent', employerVolumeProps\(true, \{ role_id: roleId, channel: 'email', count: body\.byEmail \}\)\)/);
  assert.doesNotMatch(invites, /track\([^)]*(email:|phone:|name:)/, 'no contact details in invite events');
});

test('no em dashes in employer volume copy or docs', () => {
  for (const path of ['lib/employer-volume.ts', 'docs/employer-volume-changes.md', 'scripts/employer-volume.test.mjs']) {
    assert.doesNotMatch(read(path), /\u2014/, `${path} contains an em dash`);
  }
  const copy = read('lib/marketing-content.ts');
  assert.doesNotMatch(copy, /\u2014/);
});
