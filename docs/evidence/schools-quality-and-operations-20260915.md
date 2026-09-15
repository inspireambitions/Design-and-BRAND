# Muqabala Educators quality and operations report

Checked 15 September 2026. This report covers the review branch `codex/schools-finish-20260914`, the isolated Supabase drill project, and previously recorded protected-preview evidence. Production was not deployed or modified.

## Release decision

The branch is ready for an updated protected preview after the final commit and review. Automated code, build, dependency, responsive-layout and isolated database-operation checks pass. The supervised pilot is not yet complete and must not be represented as complete.

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
| ESLint | Pass, 0 errors; 86 existing warnings after merging the latest base branch |
| TypeScript | Pass |
| Full resilience suite | Pass, 558/558 |
| Copy and Arabic parity | Pass, 9/9 |
| Employer navigation regression | Pass, 24/24 targeted tests |
| Next.js production build | Pass, 136 pages generated in the independently verified clean build |
| Bundle budget | Pass, 69 catalogue pages; largest entry displayed as 200.0 KB after rounding and remained below the strict 200 KB byte limit |

The sandboxed no-network build generated 116 static pages because it could not fetch live CMS guide entries. The independent clean build with CMS access generated 136 pages; both builds completed successfully.

The remaining ESLint warnings are visible debt, not hidden failures. Fifteen are in Schools-specific files, concentrated in `components/schools/Feedback.tsx` and `components/schools/Practice.tsx`. They should be reduced in a follow-up, but the current behavior is covered by the resilience and Schools suites.

## Browser evidence

The production build was started locally with the Educators feature enabled and inspected in Microsoft Edge at 390 x 844 and 1440 x 1200.

- Correct page title and H1 were present.
- Main content, pilot form and sample report were present.
- Mobile document width was 390 for a 390 viewport; desktop document width was 1440 for a 1440 viewport.
- No uncaught browser exceptions were recorded.
- One navigation-related React Server Component fetch was canceled with `net::ERR_ABORTED`; no uncaught exception or browser log warning was recorded, and rendering was unaffected.
- Screenshots: `schools-quality-20260915-mobile.png` and `schools-quality-20260915-desktop.png` in this evidence folder.

These are browser viewport checks. They do not replace tests on physical iPhone Safari or Android Chrome.

## Isolated Supabase operations drill

Project `dwpwxtfjrznqvmndfvkf` (`Muqabala Restore Drill 2026-09-15`, `ap-south-1`) was created at the approved USD 10 monthly project cost. Production project `hmaxzpgsefzpflrwzopa` was not modified during the drill.

All eleven Schools migrations, including `20260914052511_schools_dashboard_performance`, were applied to the isolated project. Temporary synthetic data covered one institution, administrator, educator, student, cohort, assignment, three questions, one submitted attempt and one support request.

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

Final isolated-project advisors reported zero errors and zero warnings. All temporary public, private and Auth rows were removed; the schema and migrations remain. No external email provider was contacted.

This is a schema-and-operations recovery drill, not proof that a real production backup was restored. Supabase restore-to-new-project also requires restoration of project settings and separately managed services; the production-backup restoration gate remains open until an actual backup clone is opened and checked.

## Existing hosted evidence and its boundary

- A prior protected staging deployment proved controlled staff and assignment emails reached the authorised inbox, including concurrent exactly-once handling and lost-receipt replay.
- The current pull-request build has not re-proved provider delivery after its later code changes.
- Existing emulated-browser evidence covers 30 route/viewport combinations and a complete keyboard journey, including autosave, refresh recovery, draft privacy, lost-response submission retry and recovery-code deletion.
- Published Sanity guide spelling is currently clean.

## Still open before a wider pilot

1. Reauthorise the Vercel connector for the `inspire14` team. It still returns HTTP 403, so grouped runtime-error monitoring and protected-preview administration cannot be inspected from this task.
2. Push the reviewed branch and wait for the updated protected preview checks. Do not promote it to production.
3. On that exact preview, send one controlled staff invitation and one assignment notification to the authorised inbox; verify provider acceptance, inbox receipt, scheduler invocation and privacy notification.
4. Complete one real production-backup clone/restore check in an isolated project, including Auth configuration, Storage, functions, secrets and project settings. Migration replay alone is insufficient proof.
5. Run physical iPhone Safari and Android Chrome journeys, including camera/microphone interruption and network recovery where applicable.
6. Complete the supervised five-person pilot with approved fictional adult-only content and independent human review of feedback usefulness. Expand only after the acceptance thresholds are recorded and passed.

## Rollback and cleanup

- Application: do not merge the review branch, or revert its release commits if a later review fails.
- Vercel: no production rollback is needed because production was not changed.
- Supabase production: no rollback is needed because it was not changed.
- Isolated drill project: keep it only while the real restore check is being completed; otherwise remove it to stop the approved USD 10 monthly cost.
