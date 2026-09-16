# Schools enquiry and access correction — 16 September 2026

## Cause and evidence

The public Schools page labelled an enquiry as “Start a pilot”. Existing access appeared after the form. The prior tester handoff led with the public page and requested educator testing even though its private grant provided learner access only. A scoped production check found four saved enquiries from the tester. No personal addresses or invitation secrets are included here.

## Implemented

- Consistent “Enquire about a school pilot” wording and prominent existing-access links.
- Separate educator and student instructions, role-aware sign-in destination, and useful guidance for an accepted educator awaiting a cohort.
- Accessible validation, sending feedback, focused success confirmation, masked receipt and a reference retained for the browser session.
- Stable submission UUID for lost-response retries, including correction after a conflicting re-entry. An explicitly new enquiry gets a new UUID.
- Atomic enquiry and receipt/internal-notification jobs. No account, access grant or marketing subscription is created by an enquiry.
- Persisted email payloads, provider idempotency, exclusive leases, bounded retries and visible permanent failures.
- Founder inbox pagination, unanswered-first ordering, reply ownership, reference, received time and new/replied/closed status. Marking a status does not send a reply.
- Provider acceptance is distinguished from inbox delivery. Existing verified webhook events supply delivery/bounce information when available.
- Earlier enquiries remain visible and receive no retrospective automatic email.
- Retry-question URLs are consumed once and removed from browser history so refreshing a draft and submitting cannot silently create another draft.

Reply responsibility is assigned to the Muqabala Schools control inbox. A human must monitor it and reply; software cannot establish a staffed response-time commitment. No reply deadline is advertised.

## Verification

- Automated regression suite: **608/608 passed** after direct computer-use testing and the retry correction (603 previously; five new retry regression cases).
- Focused Schools suite: 102 passed at the initial run.
- TypeScript and production build passed.
- Dependency audit: zero known vulnerabilities.
- Repository lint: zero errors; 72 warnings in the follow-up run (71 previously). The revised retry effect adds one non-blocking `react-hooks/set-state-in-effect` warning; its async retry operation deliberately updates loading state. Warnings are not described as resolved.
- Release ancestry includes employer-reliability and design baselines. All 69 catalogue pages remain within the strict 200 KB gzipped bundle budget.
- Independent agent code review: no P0/P1 findings. Both P2 findings were repaired and browser-tested.
- Staging migration applied to `okrsezhospztwtptqhpo` before application deployment.
- Real staging PostgreSQL test: 12 concurrent API/RPC calls with one submission UUID returned one reference and exactly two outbox jobs. A changed payload was rejected. The generated test enquiry and its outbox jobs were removed afterward; other records were preserved.
- GitHub CI for PR 23 passed lint, typecheck, tests, build, bundle and question-validation checks.

### Browser checks

Chrome automation against localhost and the existing staging database passed:

1. Desktop and narrow-screen enquiry page; no horizontal overflow.
2. Validation, sending state, error recovery, retained UUID, masked receipt, refresh, explicit new enquiry, unavailable-mail fallback and disabled browser storage.
3. Lost response, refresh, incorrect re-entry conflict, corrected retry: original reference retained and no additional simulated email job.
4. Student and educator sign-in route to their appropriate workspaces.
5. Student draft autosave and refresh recovery.
6. Adviser cannot read a draft.
7. Lost submission response and retry preserve answers and create one submission.
8. Adviser review, Undo and final comment.
9. Student report displays the final adviser comment.
10. A different student receives HTTP 404 for the private report.
11. Founder enquiry inbox renders.

The automated student report used a deterministic, explicitly synthetic feedback fixture. This run does not establish live AI quality, physical-phone behaviour or human comprehension.

### Direct computer-use follow-up, 16 September 2026, 02:22 UTC

After the owner unlocked the Mac, the actual browser UI was exercised against localhost:3110 and staging. Student and adviser sessions used separate browsers and existing synthetic accounts; Neb's invitation was not redeemed.

- Inspected the public enquiry/access distinction and student email sign-in instructions.
- Student authentication reached `/schools/me`; adviser authentication reached `/schools/cohorts`.
- Opened a question retry, edited a fictional answer, saved and refreshed: the text persisted. Adviser review still displayed only attempt 1, not the new draft.
- Found an additional defect: refreshing a draft with `?retry=1` left the automatic retry effect armed, so submitting immediately opened another draft and replaced the confirmation. The submission itself was saved, but the screen was misleading.
- Fixed the defect by consuming the URL intent once and removing only the `retry` parameter. Added five component regression cases covering refreshed drafts, submitted attempts, empty assignments, closed assignments and retry failure.
- Repeated refresh and submission after the fix: the UI displayed “Your answers have been submitted” and attempt 3 stayed submitted after another refresh. Adviser saw that exact new answer and a fresh review state.
- Saved an adviser comment for the new attempt. The student assignment list showed “Read your adviser's comment”; following it displayed the exact saved comment in the private report.
- New staging submissions remain awaiting feedback processing. No live AI worker or email delivery was claimed or simulated in these direct UI checks.

The direct computer-use gap is now closed for these desktop journeys. Physical iPhone/Android checks, live AI processing and production email delivery remain separate release evidence requirements.

Local screenshots and machine-readable evidence:

- `output/schools-enquiry-20260916/landing-mobile.png`
- `output/schools-enquiry-20260916/adviser-cohort.png`
- `output/schools-enquiry-20260916/adviser-review.png`
- `output/schools-enquiry-20260916/student-report.png`
- `output/schools-enquiry-20260916/founder-inbox.png`
- `output/schools-enquiry-20260916/results.json`
- `output/schools-enquiry-20260916/cua-student-report.png`
- `output/schools-enquiry-20260916/cua-adviser-review.png`
- `/tmp/muqabala-cua-regression-20260916.log`
- `/tmp/muqabala-cua-lint-20260916.log`
- `/tmp/muqabala-schools-landing-review/results.json`

Generated screenshots and browser credentials are excluded from Git. Credentials and Neb's access fragment must never be copied into this report.

## Release and tester handoff

Implementation revision: `719596798170a95da0aa43d6cc51255501ff6ac6`.

Pull request: https://github.com/inspireambitions/Design-and-BRAND/pull/23 — open, not merged.

Vercel preview `dpl_BkYnfYwKCf2zGpX7YMVV9m9pwCzV` built successfully. Its protected `/schools` route returns 404 because the new preview branch does not have Schools enabled. This is not a verified hosted Schools preview. The successful functional browser evidence above is local application + existing staging database.

The production migration was rejected by automatic approval review. The stated reason was that the earlier explicit production approval covered the dashboard-performance migration, not this new schema/permission/RPC/email-outbox change. A specific approval request for `schools_pilot_enquiry_outbox` and the application release is pending. No workaround was attempted and production was not deployed.

Production remains deployment `dpl_7Q2nfjc5HA7XjemwZBRbmVCfUR1c`, revision `9d9fae3`. Live receipt/internal-notification delivery for this new implementation remains unverified until production approval and deployment.

A fresh replacement learner invitation was created through the existing live educator UI for the already-authorised fictional Neb cohort. It expires 23 September 2026 at 01:54 UTC. Database verification confirmed it is unrevoked and unused. The private URL is stored outside Git and returned directly to the owner. No invitation was emailed to Neb. A separate educator invitation requires the pending role approval; the learner URL alone does not grant it.

The public starting page for existing access is `/schools/access`. A learner must receive a private enrolment link or use an existing recovery code. An educator requires their own accepted staff invitation and assigned cohort. A learner link cannot grant educator privileges.

## Preview instructions

Use Node 24. Run `node scripts/schools-staging-qa.mjs --serve` with the existing authenticated Supabase CLI. This starts localhost:3110 against the explicitly guarded staging branch, not production. Set `SCHOOLS_QA_PLAYWRIGHT` to an installed Playwright module and run `scripts/schools-landing-review.mjs` for mocked form checks or `scripts/schools-enquiry-journeys.mjs` for synthetic staging workflows.

Production requires the new enquiry migration before the application release, the existing Schools sender configuration and the one-minute Schools mail cron. Existing sender credentials are reused; no production credentials are moved into local/staging configuration.
