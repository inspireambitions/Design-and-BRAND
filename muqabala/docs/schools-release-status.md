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
- This migration must remain on staging until Astra has reviewed the pull request and the owner has approved any production release.
- The full automated suite passes 548 of 548 tests. ESLint passes with zero errors and 83 visible warnings. TypeScript, the production build, release ancestry and the bundle limit pass.
- A clean dependency install reports zero vulnerabilities after the patched `adm-zip` transitive version was pinned.
- An isolated Supabase schema-and-operations drill applied all eleven Schools migrations and passed populated synthetic mail, retention, privacy, idempotency and role-isolation checks. This is not yet proof of an actual production-backup restore.
- Lighthouse accessibility is 100 on the public Schools page, student home, cohort page, review queue and institution administration page.
- Thirty responsive route and viewport checks pass from 320 to 1440 pixels with no horizontal overflow, browser errors or hidden keyboard focus.
- Five simultaneous synthetic feedback journeys completed with five model calls. Stored usage was 5,240 input tokens and 1,815 output tokens. At the verified GPT-4.1 mini rates, the estimated total was USD 0.005.
- A clean synthetic student journey proved timed autosave, refresh recovery, adviser draft privacy and exactly-once submission after a lost response.
- A new Vercel preview is not deployed yet. Its release requires explicit approval to send the staging service credential to the protected preview environment. Production is unchanged.

## Human gates still open

- Physical iPhone Safari and Android Chrome journeys.
- WhatsApp, iMessage and LinkedIn preview checks on real services.
- A supervised five-person pilot using approved fictional test content before any wider group.
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

Do not invent these inputs. Do not open real enrolment until they are recorded and the supervised pilot gate has passed.
