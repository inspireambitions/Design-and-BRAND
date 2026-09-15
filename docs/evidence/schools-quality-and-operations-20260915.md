# Muqabala Educators quality and operations report

Checked 15 September 2026. This report covers the review branch `codex/schools-finish-20260914`, the isolated Supabase drill project, and previously recorded protected-preview evidence. Production was not deployed or modified.

## Controlled live-release preparation

The owner subsequently changed the test sequence: Neb will use a private single-use account on the live `trymuqabala.com` domain after the technical release gates pass. This is controlled production QA with fictional adult-only data, not approval for public enrolment or a wider pilot.

Fresh pre-release checks passed: TypeScript, 558/558 resilience tests, 65/65 Schools tests, the Next.js production build, the strict bundle budget and `npm audit` with zero known vulnerabilities. Schools-specific lint now reports zero errors and zero warnings after correcting client state hydration, feedback prop mutation, autosave refs, retry dependencies and internal sign-out navigation. Full-repository lint reports zero errors and 71 warnings outside the Schools release surface; these are recorded as existing follow-up debt rather than changed immediately before release.

The application branch contains both required release ancestors. The repository ancestry script falsely reported a missing ancestor because it invoked Apple's blocked `/usr/bin/git`; direct checks with the bundled Git client prove both `b5d6241` and `47a076f` are ancestors. The production database migration remains unapplied until the owner gives the explicit migration-specific approval required by Supabase's safety control.

## Release decision

Pull request 21 is mergeable and its updated protected preview deployed successfully from release-code commit `35a1fc4`. GitHub CI, both question-pipeline jobs and Vercel passed. Automated code, build, dependency, responsive-layout and isolated database-operation checks pass. The supervised pilot is not yet complete and must not be represented as complete.

## Repairs completed

- Replaced the removed `next lint` command with an ESLint 9 flat configuration.
- Preserved the full-page home navigation during an active employer interview so the existing `beforeunload` warning still runs. Added a regression test for that behavior.
- Added `npm run lint` to the repository-root GitHub Actions workflow, which is the workflow GitHub actually runs.
- Pinned patched transitive dependency `adm-zip` `0.6.1`. A clean install reduced the audit from eight moderate findings to zero vulnerabilities.
- Confirmed the published Sanity dataset currently needs no spelling patch: 20 guide documents checked, zero remaining `practice`/`practise` replacements.

## Automated quality evidence

| Check | Result |
|---|---|
| Clean dependency install | Pass, 1,432 packages audited |
| Dependency audit | Pass, 0 vulnerabilities |
| ESLint | Pass, 0 errors; zero Schools warnings and 71 existing warnings outside the Schools release surface |
| TypeScript | Pass |
| Full resilience suite | Pass, 558/558 |
| Copy and Arabic parity | Pass, 9/9 |
| Employer navigation regression | Pass, 24/24 targeted tests |
| Next.js production build | Pass, 136 pages generated in the independently verified clean build |
| Bundle budget | Pass, 69 catalogue pages; largest entry displayed as 200.0 KB after rounding and remained below the strict 200 KB byte limit |

The sandboxed no-network build generated 116 static pages because it could not fetch live CMS guide entries. The independent clean build with CMS access generated 136 pages; both builds completed successfully.

The remaining ESLint warnings are visible debt, not hidden failures. The fifteen Schools-specific warnings were removed before release; the remaining 71 are outside the Schools release surface and are retained as follow-up debt to avoid a broad, unrelated refactor immediately before production.

## Browser evidence

The production build was started locally with the Educators feature enabled and inspected in Microsoft Edge at 390 x 844 and 1440 x 1200.

- Correct page title and H1 were present.
- Main content, pilot form and sample report were present.
- Mobile document width was 390 for a 390 viewport; desktop document width was 1440 for a 1440 viewport.
- No uncaught browser exceptions were recorded.
- One navigation-related React Server Component fetch was canceled with `net::ERR_ABORTED`; no uncaught exception or browser log warning was recorded, and rendering was unaffected.
- Screenshots: `schools-quality-20260915-mobile.png` and `schools-quality-20260915-desktop.png` in this evidence folder.

These are browser viewport checks. They do not replace tests on physical iPhone Safari or Android Chrome.

## Isolated Supabase operations drill and backup restore

The original schema-only drill project `dwpwxtfjrznqvmndfvkf` was removed after it was confirmed not to contain a production snapshot. The replacement project `pcicynthmmtcjsoupsfy` (`Muqabala Restore Verification 2026-09-15`, `ap-south-1`) was created through Supabase's production **Restore to new project** flow from the completed 15 September 2026 02:13:51 UTC backup. Supabase marked the restoration `COMPLETED`; the restored project is `ACTIVE_HEALTHY`. Production project `hmaxzpgsefzpflrwzopa` was not modified by this verification.

Read-only comparison proved this is a real restored snapshot rather than another migration replay:

- all 43 migration history entries match production exactly;
- all 87 tables across `public`, `schools_private`, `auth`, and `storage` are present with matching RLS settings;
- the restore contains 55 Auth users, 91 interviews, 393 interview answers, 41 universal interviews, 2 Schools sessions, 2 Schools pilot contacts, and 250 storage object metadata rows;
- current production contains 122 interviews, 426 answers, 42 universal interviews, and 253 storage object metadata rows, which is consistent with production activity after the selected backup;
- all 26 Schools table counts match between the restored snapshot and production at verification time.

The restore was quoted at USD 9.68/month compute plus USD 0.50/month disk. It is no longer needed for evidence collection and remains billable until the owner explicitly approves permanent deletion.

Before the original schema-only drill project was removed, all eleven review-branch Schools migrations, including `20260914052511_schools_dashboard_performance`, were applied there. Temporary synthetic data covered one institution, administrator, educator, student, cohort, assignment, three questions, one submitted attempt and one support request.

The drill proved:

- assignment and staff mail jobs can be claimed once;
- duplicate completion is rejected;
- five controlled staff failures close in the expected failed state;
- retention creates one job and a second run creates no duplicate;
- local purge removes the learner membership, attempt and support request while retaining a non-dedicated Auth identity;
- privacy completion is repeatable and creates exactly one receipt;
- all supplier, institution-notification and completion timestamps are populated;
- anonymous and authenticated roles cannot read the private outbox or execute the mail worker;
- the service role can perform those operations;
- institution visibility is allowed for the administrator and assigned educator and denied to the student and expired session.

Final advisors on that schema-only drill reported zero errors and zero warnings. All temporary public, private and Auth rows were removed before the project itself was deleted. No external email provider was contacted.

The database backup restoration gate is complete. Project-level configuration and external services remain separately managed: Auth configuration, Storage object retrieval, functions, secrets, custom domains, and provider credentials must still be checked or recreated before the restored project could serve as a disaster-recovery replacement.

## Existing hosted evidence and its boundary

- A prior protected staging deployment proved controlled staff and assignment emails reached the authorised inbox, including concurrent exactly-once handling and lost-receipt replay.
- The current pull-request build has not re-proved provider delivery after its later code changes.
- Existing emulated-browser evidence covers 30 route/viewport combinations and a complete keyboard journey, including autosave, refresh recovery, draft privacy, lost-response submission retry and recovery-code deletion.
- Published Sanity guide spelling is currently clean.

## Still open before a wider pilot

1. Give Neb Vercel SSO access to the `INSPIRE` team for `https://muqabala-git-codex-schools-finish-20260914-inspire14.vercel.app`. Team and project access now work, but temporary protection-bypass generation currently fails with `409 Conflict`.
2. On that exact preview, send one controlled staff invitation and one assignment notification to the authorised inbox; verify provider acceptance, inbox receipt, two unattended scheduler invocations and privacy notification.
3. Run physical iPhone Safari and Android Chrome journeys, including camera/microphone interruption and network recovery where applicable.
4. Complete the supervised five-person pilot with approved fictional adult-only content and independent human review of feedback usefulness. Expand only after the acceptance thresholds are recorded and passed.
5. After retaining the restore evidence, explicitly approve deletion of `pcicynthmmtcjsoupsfy` to stop its monthly charge.

## Current Vercel verification

Rechecked 15 September 2026 at approximately 13:29 UTC:

- the connector lists `INSPIRE` / `inspire14` (`team_IlZz8UvetUXPtSvI4hPqy6fn`) and reads project `muqabala` (`prj_mLU2A8yiW61V4a4da54GryoIcSXX`) successfully;
- the newest branch deployment `dpl_CEs9B3Ahv8DMEDXdxzuLd7ji7fet` is `READY`;
- the branch-alias deployment for commit `d89c8aa2113a4b294f4bec3910cb594b049e4405` is `READY`;
- grouped runtime errors for the last 24 hours returned none;
- production and preview error/fatal log queries for the last 24 hours returned none;
- historical seven-day error groups remain in telemetry, but their latest occurrence is before the verified 24-hour window;
- creating a temporary authenticated share URL fails with `409 Conflict`. This is a share-link-generation issue, not a team-access `403`.

## Rollback and cleanup

- Application: do not merge the review branch, or revert its release commits if a later review fails.
- Vercel: no production rollback is needed because production was not changed.
- Supabase production: no rollback is needed because it was not changed.
- Restored verification project: retain only until the evidence is accepted, then permanently delete `pcicynthmmtcjsoupsfy` after explicit owner confirmation to stop its monthly cost.
