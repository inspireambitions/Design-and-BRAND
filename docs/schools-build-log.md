# Schools pilot: Stage B build log

Started: 8 September 2026. Founder authorised Stage B and requested completion today.
Branch: codex/schools-pilot-20260908. Base: 5dee134.
Status: In progress, disabled, local only. No schools migration applied to any remote database.

## Implemented so far

- Separate schools storage, immutable submitted answers and versioned questions.
- RLS and restricted columns, with database-role tests for isolation and drafts.
- Server-only write transactions, revision checks and idempotent submission retries.
- Server-derived evidence validation against exact answer excerpts.
- Text-only student practice, timed autosave, explicit save, submission, support request and new-attempt retry.
- Private feedback interface and isolated OpenAI structured output adapter. Explicit SCHOOLS_FEEDBACK_MODEL required; no live supplier request tested.
- Cohort list and submitted-attempt review pages.
- Attempt-bound review edits and server-timed undo.
- Schools session registry, 12-hour idle rejection, current/all-session revocation.
- Existing email OTP callback integration for schools sessions; anonymous practice claim excluded.
- Default-off SCHOOLS_ENABLED gate on implemented pages and API handlers.
- Founder institution and DPA controls, institution-admin cohort creation and adviser-approved assignment picker.
- Evidence correction interface with recorded reasons, compatible attempt-1 answer comparison and support ownership/status actions.
- Private attempt reports with adviser comments, corrections and support status.
- Student-card action priorities, feedback/comment read markers and question-specific retry links.
- Cohort dashboard with current-assignment participation and review status. Drafts are excluded.
- Private response headers, disabled camera/microphone access and excluded general analytics on schools pages.
- Schools development screens retain English direction and labels even if a shared browser previously used Arabic in personal practice. The institution's language remains an activation dependency, not a confirmed product claim.

## Verification

- Full local resilience suite: 505 passed, zero failed. This includes existing product regression checks and schools database/domain cases.
- Updated production build and TypeScript checks passed with SCHOOLS_ENABLED=false.
- 55 actual HTTP checks passed against the local production build: implemented schools page/API methods returned 404; home, practice and hiring entry pages returned 200. Evidence: schools-disabled-http-check.json.
- Database tests cover synthetic cross-institution access, drafts, employer exclusion, removed students, session expiry/revocation, tampered assignments, client evidence, lost first-submission responses, review undo, support ownership and published-question immutability.
- These checks do not establish full pilot acceptance. PGlite tests do not substitute for hosted Supabase Auth and RLS checks.
- No preview or production deployment. No real student data used.
- Browser, model quality, recovery and supplier-operation verification remain pending.

## Remaining implementation and acceptance work

1. Complete institution admin onboarding, educator invitations/assignment, participation summary and enrolment controls.
2. Controlled email and pseudonymous enrolment, one-time recovery and educator-assisted recovery.
3. Role search, approved pilot content, assignment notification outbox and enrolment panel.
4. First-view support claiming, correction concurrency checks, complete report rubric labels and broader comparison checks.
5. Browser proof of 10-second autosave, interrupted submission, question-specific retries and read-marker behaviour.
6. Student deletion, retention queues, supplier-copy tracking and non-identifying deletion audit.
7. Marketing contact form, approved homepage changes, static OG assets and metadata.
8. Safe instrumentation, cost accounting and pilot metrics.
9. Full table-by-table write adversarial tests, session expiry/recovery tests, feature-off routing tests and regression checks.
10. Keyboard/mobile, Lighthouse, actual WhatsApp/iMessage/LinkedIn and live provider checks.

## Interpretation recorded during implementation

Unread adviser comments take priority over retry on a student card. Otherwise a comment could stay hidden until the due date. Draft continuation and first feedback opening keep their earlier priority. The table labels its attempt count as submitted attempts because educators cannot inspect drafts.

## Deadline status

This is a tested development checkpoint, not completion of the 31 to 44 working-day Stage B scope. The requested same-day deadline does not establish that missing identity recovery, privacy operations, supplier checks or device acceptance have passed. Enrolment remains closed and production is unchanged.

## Founder inputs still pending

Institution/contact, adult-only confirmation, language, approved initial question bank, signed DPA, evaluation period and thresholds, budget owner, continuation offer and Apple-device preview verification. English development copy and synthetic fixtures do not confirm an institution's teaching language.

## Rollback

Keep SCHOOLS_ENABLED unset or false. New code and migrations remain isolated until reviewed.
Before any activation, prove the default-off routes, production regressions and database compatibility.
If activated later, disable the flag and redeploy; revoke outstanding enrolment grants and pause ordinary schools jobs. Preserve submitted work and keep an authorised internal privacy-deletion path available. Never drop student tables as a rollback.
