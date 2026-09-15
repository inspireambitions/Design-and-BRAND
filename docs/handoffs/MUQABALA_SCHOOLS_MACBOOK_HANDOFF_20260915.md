# Muqabala Educators Suite full handoff

Last reconciled: 15 September 2026, 13:29 UTC / 21:29 UTC+8

This is the canonical handoff for the Muqabala Educators Suite and its remaining pre-pilot work. It supersedes earlier statements that the Vercel connector still returned HTTP 403 and earlier statements that the production-backup restore had not been proved.

## Owner release decision — 15 September 2026

Kim authorised a controlled production release so Neb can test through the custom `trymuqabala.com` domain instead of a protected Vercel preview. This changes the earlier sequencing that required the complete five-person pilot before any production release. The narrower safety boundary remains: fictional adult-only test data, one controlled Neb account, no wider enrolment, and no expansion beyond this test until Neb's feedback and physical-device evidence are reviewed.

Production promotion is still gated on the reviewed Schools performance migration. Supabase rejected the general release instruction as insufficiently specific for recreating three RLS policies, so explicit migration approval is still required. Do not bypass that control. At the latest pre-release check, TypeScript, the production build, all 558 resilience tests, all 65 Schools tests, the dependency audit and bundle budget passed. The seven Schools component files touched by the warning cleanup lint with zero warnings; repository-wide lint has zero errors and 71 pre-existing non-Schools warnings, accepted for this scoped release rather than refactored immediately before production.

## Executive status

The review branch is built, tested, deployed to a protected preview, and ready for controlled human QA. It has not been merged or deployed to production.

Two previously open infrastructure gates have changed:

1. **Vercel team/project access is fixed.** The connector can list the `INSPIRE` team, read the `muqabala` project, inspect deployments, and query grouped runtime errors and logs. The old 403 is not current.
2. **The database backup-restore gate is complete.** Supabase restored a real 15 September production backup into a separate healthy project, and read-only comparisons proved snapshot data, schema, migration, Auth, Storage metadata, and Schools-table parity.

The remaining work is controlled preview operations and human evidence: Neb needs Vercel SSO access, current-preview email/scheduler proof is still missing, physical iPhone and Android journeys are still missing, and the five-person supervised pilot has not run.

## Release boundary

| Item | Current state |
|---|---|
| Repository | `https://github.com/inspireambitions/Design-and-BRAND` |
| Application folder | `muqabala/` |
| Review branch | `codex/schools-finish-20260914` |
| Review head | `d89c8aa2113a4b294f4bec3910cb594b049e4405` |
| Base branch | `claude/gulf-hospitality-video-interview-m9skfu` |
| Current base head | `7c90f6bf77db578d6452f109d8a7fefd4581c973` |
| Pull request | `https://github.com/inspireambitions/Design-and-BRAND/pull/21` |
| PR state | Open, non-draft, `MERGEABLE`, `CLEAN` |
| Preview branch alias | `https://muqabala-git-codex-schools-finish-20260914-inspire14.vercel.app` |
| Current alias deployment | `dpl_CEs9B3Ahv8DMEDXdxzuLd7ji7fet`, `READY`, preview |
| Commit-linked preview | `dpl_4mQwbKSdiDQj5GsSFWuWSpithGRe`, `READY`, commit `d89c8aa` |
| Latest production deployment | `dpl_AAGx5x4H47HYeyHcqTRVUUmrhzg6`, `READY`, commit `7c90f6b` |
| Production change from PR 21 | None |

Do not merge PR 21, promote a preview, apply the review-branch migration to production, open enrolment, send real participant email, or modify production data without Kim's explicit approval for that action.

## GitHub and CI

PR 21 was rechecked live during this handoff. All reported checks are successful:

- `Lint, typecheck, test, build, bundle budget`
- two `validate-candidate-questions` jobs
- Vercel deployment status
- Vercel Preview Comments

The review head and base head are recorded above. Recheck them before a merge because both repository and provider state can change.

### Verified branch quality

| Check | Result |
|---|---|
| Clean dependency install | Pass; 1,432 packages audited |
| Dependency audit | Pass; 0 known vulnerabilities |
| ESLint | Pass; 0 errors and 86 warnings |
| TypeScript | Pass |
| Full resilience suite | Pass; 558/558 |
| Copy and Arabic parity | Pass; 9/9 |
| Employer navigation regression | Pass; 24/24 targeted tests |
| Next.js production build | Pass; 136 pages with live CMS access |
| Bundle budget | Pass; 69 catalogue pages; largest displayed as 200.0 KB after rounding but below the strict byte limit |
| Local Edge browser checks | Pass at 390×844 and 1440×1200; no horizontal overflow or uncaught exceptions |

These are recorded release results for commit `d89c8aa`; they were not rerun during this documentation-only reconciliation. The Mac currently blocks `/usr/bin/git` behind an unaccepted Xcode licence, which is a workstation setup issue rather than a Muqabala failure.

## Implemented scope

The branch includes:

- educator cohort participation summaries with active students, current assignment, due date, submitted and awaiting-review counts, and one next action;
- institution participation summaries with active cohorts, enrolment, submissions, missing submissions, awaiting review, open support, and active assignment dates;
- server-side institution membership verification before service-role aggregation;
- institution-admin views that exclude student drafts, answers, feedback evidence, and adviser comments;
- the institution dashboard 500 repair;
- 28 Schools foreign-key indexes and three RLS init-plan optimisations in `20260914052511_schools_dashboard_performance.sql`;
- resilient learner autosave, refresh recovery, exactly-once submission recovery, feedback retry, adviser correction/comment, support, and deletion coverage;
- a repaired ESLint 9 configuration and CI lint execution;
- the employer interview navigation-warning regression fix;
- dependency patching that reduced `npm audit` to zero known vulnerabilities;
- responsive and accessibility evidence across Schools routes;
- current Sanity guide spelling verification: 20 published guides checked and zero replacements required.

## Vercel current state

### Access correction

The prior statement “Vercel connector still returns 403” is obsolete.

- Team: `INSPIRE`
- Team slug: `inspire14`
- Team ID: `team_IlZz8UvetUXPtSvI4hPqy6fn`
- Plan: Pro
- Project: `muqabala`
- Project ID: `prj_mLU2A8yiW61V4a4da54GryoIcSXX`
- Framework: Next.js
- Configured Node version: 24.x

The connector successfully listed the team, read the project, listed deployments, resolved the branch alias, and queried telemetry.

### Preview access

The protected branch alias resolves to `dpl_CEs9B3Ahv8DMEDXdxzuLd7ji7fet`, which is `READY` and targets preview, not production.

The connector cannot currently create a temporary protection-bypass URL. Both protected fetching and bypass generation return `409 Conflict` while creating the protection bypass. This does not revoke team/project access and is not the old 403. Until resolved, Neb needs membership in the `INSPIRE` Vercel team and must authenticate through Vercel SSO.

### Runtime telemetry

The 24-hour check at approximately 13:29 UTC found:

- no grouped runtime-error clusters;
- no production `error` or `fatal` logs;
- no preview `error` or `fatal` logs.

The seven-day view still retains nine historical groups:

| Historical group | Count | Last occurrence UTC |
|---|---:|---|
| Schools mail invalid authorisation, 401 | 6 | 2026-09-14 04:49:16 |
| Schools retention invalid authorisation, 401 | 4 | 2026-09-14 04:49:16 |
| `/schools/admin` request error, 500 | 3 | 2026-09-14 06:43:56 |
| Institution details load error | 3 | 2026-09-14 06:43:56 |
| Schools mail missing cron secret, 503 | 2 | 2026-09-08 15:29:37 |
| Rejected evaluation evidence line | 2 | 2026-09-11 10:31:05 |
| Duplicate scoring competency | 1 | 2026-09-11 06:26:15 |
| Interview-brain 30-second timeout | 1 | 2026-09-10 14:31:24 |
| Schools retention missing cron secret, 503 | 1 | 2026-09-08 15:29:38 |

These are historical records, not current reproductions. The clean 24-hour window supports “no recent recurrence”; it does not prove every route was exercised during that window. Some 401/503 entries are consistent with deliberate negative auth/config tests, but telemetry alone does not prove intent.

## Supabase current state

### Production

- Project: `Muqabala`
- Project ref: `hmaxzpgsefzpflrwzopa`
- Region: `ap-south-1`
- Status: `ACTIVE_HEALTHY`
- Database: PostgreSQL 17

Production was read only during this reconciliation.

### Genuine restore verification

- Project: `Muqabala Restore Verification 2026-09-15`
- Project ref: `pcicynthmmtcjsoupsfy`
- Region: `ap-south-1`
- Status: `ACTIVE_HEALTHY`
- Source: production's Supabase **Restore to new project** flow
- Recovery point: completed backup at 2026-09-15 02:13:51 UTC
- Provider result: restoration `COMPLETED`
- Quoted cost: USD 9.68/month compute plus USD 0.50/month disk

Read-only verification proved:

- 43/43 migration records match production;
- exactly 87 tables exist across `public`, `schools_private`, `auth`, and `storage`, with matching RLS settings;
- system table/index/RLS counts match by schema;
- the restore contains 55 Auth users, 91 interviews, 393 interview answers, 41 universal interviews, 2 Schools sessions, 2 Schools pilot contacts, and 250 Storage object metadata rows;
- current production contains 122 interviews, 426 interview answers, 42 universal interviews, and 253 Storage object metadata rows, consistent with changes after the selected backup;
- all 26 Schools table counts match between current production and the restored snapshot.

This closes the database backup-restoration proof. It does not automatically copy or validate every separately managed provider setting. Before treating the restore as a deployable disaster-recovery replacement, verify Auth configuration, actual Storage object retrieval, functions, secrets, custom domains, and third-party credentials.

The earlier empty/schema-only drill `dwpwxtfjrznqvmndfvkf` was permanently deleted. The genuine restore project remains billable and can now be deleted after Kim explicitly confirms that the evidence is accepted.

### Schools operations boundary

The isolated operations drill proved claim-once mail handling, duplicate rejection, failure closure, idempotent retention queuing, local purge boundaries, repeatable privacy completion, access controls, and institution isolation with synthetic data. No external provider was contacted in that drill.

Current production has zero rows in Schools mail outbox, privacy jobs, and privacy receipts. Therefore the following are not yet proved on the current branch preview:

- provider acceptance and inbox receipt for a fresh staff invitation and assignment notification;
- privacy-notification delivery;
- two actual unattended scheduler invocations;
- populated scheduled retention execution;
- genuine supplier-deletion and institution-notification receipts.

Historical staging evidence proves manual controlled staff/assignment delivery, exactly-once concurrency, and lost-receipt replay. Do not relabel that historical evidence as current-preview proof.

## CMS state

The live published Sanity dataset was checked read only:

- 20 guide documents checked;
- zero remaining `practice`/`practise` patches required;
- displayed spelling and stored published content are currently clean.

No new CMS publication is required for this issue. Retain the existing before-snapshot for audit history. A separate Sanity write receipt is unnecessary unless content is changed again.

## What Neb can test now

Neb can begin controlled preview QA as soon as Vercel SSO access is confirmed. The remaining operational and pilot gates do not need to be hidden from Neb; they should be tested and recorded through the controlled protocol.

Use the prepared message:

`docs/neb-educators-suite-test-message-20260915.md`

Required human coverage:

1. educator assignment, enrolment, dashboard, review, correction/comment, undo/save, and support flows;
2. learner invitation, adult confirmation, autosave, refresh, interruption/retry, exactly-once submission, feedback, retry, adviser comment, recovery, and deletion flows;
3. institution-admin totals and dates, plus proof that learner drafts/answers/feedback/comments are not exposed;
4. cross-institution denial, expired/reused link, unavailable request, and refresh-during-save failure states;
5. one full physical iPhone Safari journey and one full physical Android Chrome journey;
6. WhatsApp, iMessage, and LinkedIn preview-card checks without public posting;
7. independent educator review of feedback usefulness, evidence grounding, rubric alignment, borderline answers, and imperfect English.

Every issue report must include exact timestamp and timezone, device, OS, browser/version, role, URL, steps, expected result, actual result, and screenshot or short recording. Never include passwords, recovery codes, private invitation fragments, or real student data.

## Remaining actions in order

### P0 — Enable Neb's preview access

Add Neb to the `INSPIRE` Vercel team/project through the provider's normal access controls. Do not send credentials or private cookies. Re-test the temporary bypass-link tool separately; its current 409 is a convenience/access-sharing problem, not an application outage.

### P1 — Re-prove current-preview operations

Using fictional adult-only English data and only the controlled `hello@trymuqabala.com` inbox:

1. confirm the current preview has Preview-scoped `SCHOOLS_RESEND_API_KEY`, `SCHOOLS_EMAIL_FROM`, and `CRON_SECRET` without printing values;
2. send one temporary staff invitation and one assignment notification;
3. prove provider acceptance and inbox receipt separately;
4. run two concurrent authorised worker claims and prove exactly one send;
5. replay the job and prove the stored provider ID is reused;
6. prove an additional claim sends zero messages;
7. capture two real unattended scheduler invocations;
8. run a populated synthetic retention/privacy case and capture notification/receipt evidence;
9. clean only the temporary QA data.

No real student data and no production write are authorised by this handoff.

### P2 — Neb device and usability QA

Execute the prepared Neb protocol on the protected preview. Physical devices are mandatory; desktop emulation is supporting evidence only.

### P3 — Five-person supervised pilot

Run five consenting adult testers with approved fictional content. Record acceptance thresholds and have at least two educators independently review feedback validity. Current approved defaults are English, staging only, synthetic data only, and USD 0 AI spend for operations-only checks. DPA approval remains pending, so do not use real participant/student data.

### P4 — Production decision

Only after P0–P3 pass:

- recheck PR 21, base ancestry, CI, preview, telemetry, and database drift;
- approve and apply the review-branch performance migration to production;
- approve merge and production deployment explicitly;
- verify production email, schedules, monitoring, privacy, and rollback;
- expand beyond five testers only after written acceptance of the pilot evidence.

### Cleanup — Restore project cost

After Kim accepts the restore evidence, permanently delete `pcicynthmmtcjsoupsfy` to stop the quoted USD 10.18/month charge. Deletion is irreversible and requires explicit confirmation.

## Safe local verification

From the repository root:

```bash
cd muqabala
npm ci
npm run lint
npm run typecheck
npm run test:resilience
npm run build
npm run check:bundle
node --experimental-strip-types --test --test-isolation=none scripts/schools-dashboard.test.mjs
```

On this Mac, `/usr/bin/git` currently exits with an Xcode licence prompt. Kim or the machine administrator must review and accept the Xcode licence before Git commands will run. Do not bypass that prompt through destructive repository manipulation.

## Rollback and safety

- Application: PR 21 is unmerged; the safest rollback is to leave it unmerged. If merged later, revert the merge or named release commits through normal Git review.
- Vercel: PR 21 has not changed production. No production rollback is required for this branch.
- Supabase production: no write occurred during restore verification. No production rollback is required.
- Supabase restore project: delete only after explicit confirmation; deletion is irreversible.
- QA data: use unique prefixes and delete only records created for the controlled test.
- Secrets: never place keys, tokens, OTPs, authenticated share parameters, or private invitation fragments in chat, screenshots, logs, or commits.

## Evidence index

- `docs/evidence/schools-quality-and-operations-20260915.md`
- `docs/evidence/schools-astra-handoff-20260914.md`
- `docs/evidence/schools-preview-release-20260914.json`
- `docs/evidence/schools-quality-browser-20260915.json`
- `docs/evidence/schools-responsive-browser.json`
- `docs/evidence/schools-feedback-concurrency.json`
- `docs/evidence/schools-quality-20260915-mobile.png`
- `docs/evidence/schools-quality-20260915-desktop.png`
- `docs/neb-educators-suite-test-message-20260915.md`
- `muqabala/docs/schools-release-status.md`
- `muqabala/docs/schools-pilot-plan.md`
- `muqabala/docs/PILOT_CHECKLIST.md`

The current handoff and quality report include live provider checks performed after commit `d89c8aa`; those documentation corrections may be local until the Mac Xcode licence is accepted and Git can commit them.

## PR 21 changed-file manifest

```text
.github/workflows/ci.yml
docs/evidence/schools-astra-handoff-20260914.md
docs/evidence/schools-authenticated-accessibility.json
docs/evidence/schools-authenticated-browser.json
docs/evidence/schools-feedback-concurrency.json
docs/evidence/schools-preview-release-20260914.json
docs/evidence/schools-quality-20260915-desktop.png
docs/evidence/schools-quality-20260915-mobile.png
docs/evidence/schools-quality-and-operations-20260915.md
docs/evidence/schools-quality-browser-20260915.json
docs/evidence/schools-responsive-browser.json
docs/evidence/schools-staging-fixture.json
docs/handoffs/MUQABALA_SCHOOLS_MACBOOK_HANDOFF_20260915.md
docs/neb-educators-suite-test-message-20260915.md
muqabala/CODEX.md
muqabala/app/schools/admin/page.tsx
muqabala/app/schools/cohorts/page.tsx
muqabala/app/schools/schools.css
muqabala/components/EmployerVideoInterview.tsx
muqabala/components/ScreeningEmailVerification.tsx
muqabala/components/schools/PilotContact.tsx
muqabala/docs/RELEASE.md
muqabala/docs/schools-release-status.md
muqabala/lib/schools/admin-participation.ts
muqabala/lib/schools/dashboard.ts
muqabala/package-lock.json
muqabala/scripts/employer-video-screening.test.mjs
muqabala/scripts/schools-accessibility.mjs
muqabala/scripts/schools-dashboard.test.mjs
muqabala/scripts/schools-deploy-preview.mjs
muqabala/scripts/schools-feedback-concurrency.mjs
muqabala/scripts/schools-foundation.test.mjs
muqabala/scripts/schools-landing-review.mjs
muqabala/scripts/schools-responsive-browser.mjs
muqabala/scripts/schools-staging-qa.mjs
muqabala/supabase/migrations/20260914052511_schools_dashboard_performance.sql
```

## Copyable continuation prompt

```text
Continue the Muqabala Educators Suite from docs/handoffs/MUQABALA_SCHOOLS_MACBOOK_HANDOFF_20260915.md in https://github.com/inspireambitions/Design-and-BRAND, branch codex/schools-finish-20260914, app folder muqabala, PR 21. Read AGENTS.md and the handoff fully before acting. Start read-only: recheck PR head/base/checks, Vercel INSPIRE/inspire14 project muqabala and its branch alias, the last 24 hours of runtime telemetry, Supabase production hmaxzpgsefzpflrwzopa, and restore project pcicynthmmtcjsoupsfy. The old Vercel 403 is resolved; do not report it as current. The database backup restore is proved; do not repeat it. Current open work is Neb SSO access, current-preview email/scheduler/privacy proof, physical iPhone/Android QA, independent feedback review, and the five-person supervised synthetic adult pilot. Do not expose secrets, delete the restore project, merge, migrate production, promote production, open enrolment, or send real participant email without the exact owner approval described in the handoff. Stop at any password, OTP, or private account-choice screen.
```
