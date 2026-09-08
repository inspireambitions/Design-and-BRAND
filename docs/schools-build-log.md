# Schools pilot: Stage B build log

Started: 8 September 2026. Founder authorised Stage B and requested completion today.
Branch: codex/schools-pilot-20260908. Base: 5dee134.
Status: Controlled staging verification completed for core journeys and manual mail delivery. Ten migrations applied to staging only. Production Schools remains disabled. Current consolidated findings are in schools-agent-report-20260908.md; older investigation notes below are historical.

## Implemented so far

- Separate schools storage, immutable submitted answers and versioned questions.
- RLS and restricted columns, with database-role tests for isolation and drafts.
- Server-only write transactions, revision checks and idempotent submission retries.
- Server-derived evidence validation against exact answer excerpts.
- Text-only student practice, timed autosave, explicit save, submission, support request and new-attempt retry.
- Private feedback interface and isolated OpenAI structured output adapter. Explicit SCHOOLS_FEEDBACK_MODEL required. Twelve live checks passed after the excerpt-selection repair.
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

- Full local resilience suite: 526 passed, zero failed. The focused database suite has 32 passing checks. This includes existing product regression checks and schools database/domain cases.
- Updated production build and TypeScript checks passed with SCHOOLS_ENABLED=false.
- 105 actual HTTP checks passed against the latest local production build: implemented schools page/API methods returned 404; home, practice and hiring entry pages returned 200. Evidence: schools-disabled-http-check.json.
- Database tests cover synthetic cross-institution access, drafts, employer exclusion, removed students, session expiry/revocation, tampered assignments, client evidence, lost first-submission responses, review undo, support ownership and published-question immutability.
- These checks do not establish full pilot acceptance. PGlite tests do not substitute for hosted Supabase Auth and RLS checks.
- A protected Vercel preview is available for controlled verification. No production deployment or real student data used.
- Desktop and 390 by 844 mobile landing layouts inspected. Mobile keyboard enquiry entry and recovery after the local service rejects a request passed. Synthetic form contents remain intact and no horizontal overflow was detected. Script: muqabala/scripts/verify-schools-contact-browser.js.
- Lighthouse generated a valid report with accessibility 100 on the local /schools page. The CLI then exited with a Windows temporary-profile cleanup error. This is evidence for that page only, not a clean full CLI run or acceptance of authenticated screens.
- Development browser initially used 127.0.0.1, which Next.js rejected for HMR. Rechecking on localhost fixed the development-origin issue. The rejected API response in the recovery check is expected because no hosted service credentials were supplied.
- Turbopack rejected the local node_modules junction. The production build uses `npm run build -- --webpack` for this isolated checkout. TypeScript passed. Vercel builds with normal installed dependencies have also passed.
- Hosted Auth/recovery passed on staging. Real model quality and supplier-operation verification remain pending.

## Remaining implementation and acceptance work

1. Complete preview-deployment acceptance with the synthetic staging identities. Eight migrations have passed on staging. Both recovery paths, replay rejection, session revocation, idle expiry and actual native Auth deletion passed.
2. Atomic Auth deletion guard, orphan cleanup, verified privacy receipts, expired grant/ciphertext cleanup and operation-data retention are implemented. Native pseudonymous Auth deletion passed. Hosted concurrent cross-product writes need a separate controlled check.
3. Failed-mail retry controls are implemented and tested. Verify actual provider delivery and supplier deletion evidence. Privacy jobs deliberately remain externally pending.
4. Schedule mail and retention only during an approved activation. Endpoints exist but vercel.json has no Schools cron entries. Calling disabled Schools endpoints must remain 404.
5. Institution metadata editing, educator email labels and support management before submission are implemented. Include them in the tester checklist.
6. Authenticated browser checks passed for timed autosave, refresh recovery, draft privacy, lost submission response, duplicate prevention, exact review undo and question retry without carrying over a review. Finish the full keyboard and email enrolment journeys on the preview.
7. Lighthouse Accessibility 100 passed on cohort view, review and student home, in addition to the landing page. Validate all three previews in WhatsApp, iMessage, LinkedIn and a platform debugger. Current screenshots are page layouts, not messaging-app previews.
8. Confirm approved pilot questions and language. Run live feedback examples, disagreement review and provider cost reconciliation. Failed supplier calls without usage receipts are not included in the estimate.
9. Hosted checks passed for employer exclusion from all 16 public Schools tables, cross-institution educator isolation, tampered assignment rejection, removed-member access and expired/revoked sessions. Extend these checks on the deployed preview before enrolment.

## Staging evidence from this continuation

Staging ref: okrsezhospztwtptqhpo, existing branch staging-release-gate. Production ref hmaxzpgsefzpflrwzopa was not migrated. Synthetic fixture identities and record IDs contain no credentials. Session cookies, enrolment secrets and recovery codes stay in process memory and are excluded from saved evidence.

- evidence/schools-authenticated-browser.json: autosave, interrupted submission and duplicate prevention.
- evidence/schools-review-browser.json: exact undo, retry and attempt-bound review.
- evidence/schools-hosted-security.json: native Auth sessions and hosted RLS isolation.
- evidence/schools-hosted-recovery.json: both recovery paths and native identity deletion.
- evidence/schools-authenticated-accessibility.json: three authenticated pages at 100.
- Browser screenshots live in muqabala/output/playwright. Review feedback in those captures is explicitly synthetic and does not prove model quality.

The initial broad production-secret read was rejected by automatic approval review. A safer metadata-only read succeeded after the CLI refreshed its saved login. The OpenAI setting is enabled for previews, but its plaintext value is unavailable through the single-setting API. Live feedback will be tested in Vercel without exporting that key.

## Interpretation recorded during implementation

Unread adviser comments take priority over retry on a student card. Otherwise a comment could stay hidden until the due date. Draft continuation and first feedback opening keep their earlier priority. The table labels its attempt count as submitted attempts because educators cannot inspect drafts.

## Deadline status

This is not yet completion of every Stage B acceptance requirement. Hosted recovery, privacy deletion, core browser journeys and accessibility now have evidence. Provider, deployed-preview and device acceptance remain open. Real enrolment remains closed and production is unchanged.

## Founder inputs still pending

Institution/contact, adult-only confirmation, language, approved initial question bank, signed DPA, evaluation period and thresholds, budget owner, continuation offer and Apple-device preview verification. English development copy and synthetic fixtures do not confirm an institution's teaching language.

## Rollback

Keep SCHOOLS_ENABLED unset or false. New code and migrations remain isolated until reviewed.
Before any activation, prove the default-off routes, production regressions and database compatibility.
If activated later, disable the flag and redeploy; revoke outstanding enrolment grants and pause ordinary schools jobs. Preserve submitted work and keep an authorised internal privacy-deletion path available. Never drop student tables as a rollback.

## Latest provider and staging email checks

- Current preview deployment: dpl_5nycUiuMta3SZFDoV2EScHtnsedm. The final local excerpt length and Unicode boundary changes still need deployment.
- Root cause of feedback retries: the model sometimes paraphrased a supporting quotation, which the exact-source validator correctly rejected. The v2 provider contract selects numbered source excerpts. The server extracts the original text and still validates every supporting quotation.
- Twelve live v2 checks passed. Five repeated original examples produced counts of 11, 11, 11, 11 and 10. Five concrete imperfect-English examples produced 12 each. Fluent padding and an embedded instruction produced zero each. These synthetic checks do not establish calibrated fairness or identical model interpretation.
- Staging Auth redirects now point to the protected Schools preview. Email requests still fail. The founder approved a staging-only SMTP transfer, but Supabase did not return a usable source credential. No SMTP setting was copied.
- A proposed fallback to the exact Vercel production Resend sender key was blocked by automatic approval review because it is a different sensitive source. Separate approval is pending. No Vercel sender key was retrieved or transferred.
- A browser harness failure exposed one disposable synthetic student's cookies and the preview share token in tool output. All Schools sessions for that user were revoked, cohort access removed, and Auth refresh sessions deleted. The preview share token was revoked and replaced. Browser QA now suppresses raw private errors and cleans up route handlers. No real student or production credential was involved.

## Approved sender transfer result

The founder explicitly approved the exact Vercel RESEND_FEEDBACK_API_KEY transfer into staging SMTP. The single-setting API returned its metadata only: type sensitive, with no value field. The script stopped before the staging PATCH. No SMTP settings or production settings changed. Staging email remains blocked until a usable sender credential is supplied through a protected configuration interface. This is credential unavailability, not pending approval of the same transfer.

## Staging SMTP resolved

The founder approved a dedicated sending-only staging key. Created Muqabala Schools staging SMTP 20260908, restricted to the verified auth.trymuqabala.com domain. Transferred through tested non-echoing console input into staging Auth only. No key was printed or saved to files. Production settings remain unchanged.

The protected preview sign-in request returned HTTP 200 with sent=true. Gmail independently confirmed receipt in the authorised inspireambition.com@gmail.com inbox at 2026-09-08T14:58:41Z, from Muqabala Schools staging <hello@auth.trymuqabala.com>. Evidence: evidence/schools-email-check.json. This verifies email delivery, not completion of the email sign-in journey or all Stage B acceptance requirements.

## Team acceptance update

541 regression tests and 105 feature-flag-off HTTP checks passed. Local Webpack and Vercel builds passed. Email sign-in and enrolment, fresh desktop/mobile-width keyboard journeys, adviser review, recovery and deletion passed. Real staff/assignment mail delivery, concurrent worker suppression and identical provider receipts on replay passed.

Final runtime verification uses staging deployment dpl_B5JiJZ23geUtr2VYGPxoGCxj9fMp at muqabala-gwap8cs6c-inspire14.vercel.app. It uses the same product source as dpl_7gpWsx2ry1dfCCwGLHeDQJkrYLXS with corrected GitHub branch environment association. Mail and cron credentials remain preview-branch-only. Ten staging migrations are applied.

See schools-agent-report-20260908.md for the current passed/pending split. Controlled access is prepared for hello@trymuqabala.com. Physical devices, external messaging previews, automatic scheduled execution, supplier receipts and larger-group AI budget/capacity remain open. No public production activation.
