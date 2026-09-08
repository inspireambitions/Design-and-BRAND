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
- Controlled individual and batch email enrolment links, using the shared contact parser. Cohort codes alone cannot create accounts. Links are bound to the verified recipient.
- Pseudonymous enrolment, once-shown hashed recovery secrets, adviser-assisted recovery, secret rotation and revocation of previous Schools sessions. Recovery rechecks current adviser access.
- Institution staff invitations with encrypted delivery payloads, verified-email acceptance and current issuer-authority checks. Institution admin can create cohorts and assign accepted educators.
- Assignment email outbox, including students who join an existing assignment. Worker leases, bounded retries and stable provider idempotency keys. Delivered invitation ciphertext is cleared.
- Student deletion page, immediate local purge path, retention queue, shared Auth account preservation checks and non-identifying deletion audit. Supplier verification remains pending, not marked complete.
- Removal and archive controls. Removed members immediately lose RLS access; archival closes enrolment and starts archived retention.
- First-view support claiming and stale evidence-correction rejection. Claiming does not replace another adviser's ownership.
- Founder operations view for failed email and pending privacy work; pilot metrics with explicit denominators and unknown costs retained as unknown. Recorded response costs are estimates, not reconciled supplier spend.
- Schools contact page, fictional sample, gated home navigation/product strip/footer links and static metadata assets for home, schools and hiring teams.
- Static PNG link-preview images at public/og, each 1200 by 630 and below 300 KB. No runtime image generation for these three previews.
- Rendered metadata checks passed for home, schools and hiring pages in local production builds, including exact titles/descriptions, absolute image URLs, locale and Twitter card. All three fetched PNG dimensions and file sizes passed. Evidence: evidence/schools-preview-check.json. Messaging-app rendering remains unverified.
- Local browser check found pre-hydration form submission could fall back to a query string. Schools client forms now use POST; the pilot enquiry button waits for hydration.

## Verification

- Full local resilience suite: 520 passed, zero failed. This includes existing product regression checks and schools database/domain cases.
- Updated production build and TypeScript checks passed with SCHOOLS_ENABLED=false.
- 103 actual HTTP checks passed against the local production build: implemented schools page/API methods returned 404; home, practice and hiring entry pages returned 200. Evidence: schools-disabled-http-check.json.
- Database tests cover synthetic cross-institution access, drafts, employer exclusion, removed students, session expiry/revocation, tampered assignments, client evidence, lost first-submission responses, review undo, support ownership and published-question immutability.
- These checks do not establish full pilot acceptance. PGlite tests do not substitute for hosted Supabase Auth and RLS checks.
- No preview or production deployment. No real student data used.
- Desktop and 390 by 844 mobile landing layouts inspected. Mobile keyboard enquiry entry and recovery after the local service rejects a request passed. Synthetic form contents remain intact and no horizontal overflow was detected. Script: muqabala/scripts/verify-schools-contact-browser.js.
- Lighthouse generated a valid report with accessibility 100 on the local /schools page. The CLI then exited with a Windows temporary-profile cleanup error. This is evidence for that page only, not a clean full CLI run or acceptance of authenticated screens.
- Development browser initially used 127.0.0.1, which Next.js rejected for HMR. Rechecking on localhost fixed the development-origin issue. The rejected API response in the recovery check is expected because no hosted service credentials were supplied.
- Turbopack rejected the local node_modules junction. The production build uses `npm run build -- --webpack` for this isolated checkout. TypeScript passed. Deployment build compatibility must still be checked with normal installed dependencies.
- Hosted Auth/recovery, real model quality and supplier-operation verification remain pending.

## Remaining implementation and acceptance work

1. Hosted migration and Auth validation with synthetic identities, including internal pseudonymous addresses, both recovery paths, 12-hour expiry and global sign-out. No remote migration has been applied.
2. Harden orphan Auth provisioning cleanup and the check/delete race before deleting a dedicated Auth identity. The current guard preserves references found in other public product tables, but an atomic cross-product guarantee is not yet proved.
3. Finish privacy supplier-receipt and final-completion workflow. Review failed-job recovery, expired grant/ciphertext cleanup and retention of operation metadata. Privacy jobs deliberately remain externally pending.
4. Schedule mail and retention only during an approved activation. Endpoints exist but vercel.json has no Schools cron entries. Calling disabled Schools endpoints must remain 404.
5. Complete institution metadata editing and a useful educator display label, and provide a support-management entry for students who have not submitted any attempt.
6. Test authenticated browser autosave, interrupted submit, question-specific retries, read markers and all requested keyboard journeys. Only the public contact form has browser recovery evidence so far.
7. Run Lighthouse on cohort, review and student home. Validate all three previews in WhatsApp, iMessage, LinkedIn and a platform debugger. Current screenshots are local page layouts, not messaging-app previews.
8. Confirm approved pilot questions and language. Run live feedback examples, disagreement review and provider cost reconciliation. Failed supplier calls without usage receipts are not included in the estimate.
9. Recheck all client-visible and private tables, RPC paths and shared-product regressions against the intended hosted database before enrolment. Database tests use PGlite and synthetic fixtures.

## Interpretation recorded during implementation

Unread adviser comments take priority over retry on a student card. Otherwise a comment could stay hidden until the due date. Draft continuation and first feedback opening keep their earlier priority. The table labels its attempt count as submitted attempts because educators cannot inspect drafts.

## Deadline status

This is a tested development checkpoint, not completion of every Stage B acceptance requirement. Recovery, privacy and mail code now exist, but the requested deadline does not establish that hosted provider checks or device acceptance passed. Enrolment remains closed and production is unchanged.

## Founder inputs still pending

Institution/contact, adult-only confirmation, language, approved initial question bank, signed DPA, evaluation period and thresholds, budget owner, continuation offer and Apple-device preview verification. English development copy and synthetic fixtures do not confirm an institution's teaching language.

## Rollback

Keep SCHOOLS_ENABLED unset or false. New code and migrations remain isolated until reviewed.
Before any activation, prove the default-off routes, production regressions and database compatibility.
If activated later, disable the flag and redeploy; revoke outstanding enrolment grants and pause ordinary schools jobs. Preserve submitted work and keep an authorised internal privacy-deletion path available. Never drop student tables as a rollback.
