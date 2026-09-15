# Muqabala for Schools and Colleges release status

Updated 15 September 2026. This is the current evidence boundary for the Educators suite.

## Current production state

- The public `/schools` marketing page is live.
- Private enrolment is closed. There is no live institution, cohort, student, assignment or feedback pilot in production.
- Ten Schools migrations are applied in production.
- Vercel schedules exist for Schools mail and retention work.
- Empty scheduled runs have been observed. A populated production mail run and a populated production retention run have not been re-proved.
- The feedback groundedness defect was fixed in pull request 20. Five repeated staging generations then passed the evidence checks.

## Current release work

- The educator cohort list now shows active students, the current assignment, its due date, submitted work, work awaiting review and one next action.
- The institution page now shows privacy-safe participation totals and active assignment dates. It does not show drafts, answers, feedback, evidence or adviser comments.
- Migration `20260914052511_schools_dashboard_performance.sql` adds the missing Schools foreign-key indexes and optimises three RLS policies without changing their access rules.
- The review is complete and the owner has authorised a controlled production release for Neb's live-domain QA. Supabase still requires explicit migration-specific approval before the performance migration can be applied; do not bypass that safety control.
- The full automated suite passes 558 of 558 tests after merging the latest base branch, and the focused Schools suite passes 65 of 65. Schools-specific ESLint passes with zero errors and zero warnings; repository-wide ESLint passes with zero errors and 71 pre-existing non-Schools warnings. TypeScript, the production build, direct release-ancestry checks and the bundle limit pass.
- A clean dependency install reports zero vulnerabilities after the patched `adm-zip` transitive version was pinned.
- An isolated Supabase schema-and-operations drill applied all eleven Schools migrations and passed populated synthetic mail, retention, privacy, idempotency and role-isolation checks. A separate restore project then proved an actual production-backup restore and remains billable until the owner explicitly approves its permanent deletion.
- Lighthouse accessibility is 100 on the public Schools page, student home, cohort page, review queue and institution administration page.
- Thirty responsive route and viewport checks pass from 320 to 1440 pixels with no horizontal overflow, browser errors or hidden keyboard focus.
- Five simultaneous synthetic feedback journeys completed with five model calls. Stored usage was 5,240 input tokens and 1,815 output tokens. At the verified GPT-4.1 mini rates, the estimated total was USD 0.005.
- A clean synthetic student journey proved timed autosave, refresh recovery, adviser draft privacy and exactly-once submission after a lost response.
- The reviewed branch has a ready protected Vercel preview. Production remains on commit `7c90f6b` until the performance migration is explicitly approved and the branch is promoted.

## Human gates intentionally retained for Neb and post-release review

- Physical iPhone Safari and Android Chrome journeys.
- WhatsApp, iMessage and LinkedIn preview checks on real services.
- Neb's controlled production QA using approved fictional test content, followed by four additional consenting adults before any wider group.
- Independent review of feedback usefulness and hiring validity.
- Provider-accepted email delivery to the controlled inbox. The test needs explicit approval because the invitation contains a temporary access secret.

## Founder inputs still required

- Institution name and authorised contact.
- Written confirmation that all pilot students are adults.
- Teaching language for the pilot.
- Adviser-approved role and question bank.
- Signed data-processing terms and approved suppliers.
- Evaluation dates, success thresholds and named owner.
- AI cost budget and stop rule.
- The paid continuation offer, if the pilot succeeds.

Do not invent these inputs. The owner has approved one controlled, pseudonymous Neb QA account on production, but not general enrolment, real student data or a wider institutional pilot. Review Neb's findings before expanding.
