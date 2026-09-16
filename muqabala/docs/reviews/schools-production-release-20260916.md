# Schools production release — 16 September 2026

## Outcome

The owner explicitly approved `schools_pilot_enquiry_outbox` and deployment of PR 23. Both are complete. This release record supersedes the pending-production status in `schools-enquiry-fix-20260916.md`; that document retains implementation and staging evidence.

- Production: https://trymuqabala.com/schools
- Existing-user access: https://trymuqabala.com/schools/access
- PR: https://github.com/inspireambitions/Design-and-BRAND/pull/23 — merged at 02:32:38 UTC.
- Reviewed head: `5744e2955096c1d4020a3a59894c2af6fa1ee904`.
- Production merge revision: `8d5c8a2eab65cd80301921b3816af55bc02e4721`.
- Vercel deployment: `dpl_HPJZP8J54AEB3GeCnshPAa15np8L`, READY, production aliases assigned, no alias error.
- Deployment inspection: https://vercel.com/inspire14/muqabala/HPJZP8J54AEB3GeCnshPAa15np8L
- Production migration receipt: `schools_pilot_enquiry_outbox`, version `20260916023211`, project `hmaxzpgsefzpflrwzopa`.

## What is live

Clear enquiry-versus-access wording; prominent existing-user access; student and educator instructions; role-aware routing; receipt reference and refresh recovery; duplicate-safe enquiry submissions; acknowledgement/internal email queue; founder enquiry status and mail tracking; the retry-after-refresh correction.

## Verification

### Pre-release

- 608/608 regression tests passed, including five retry-navigation cases.
- Typecheck, build and strict bundle budget passed.
- Lint: zero errors, 72 non-blocking warnings. Warnings remain outstanding, not silently accepted as resolved.
- Direct computer-use student/adviser journeys passed on local application plus staging: draft save/refresh, adviser draft privacy, submission, review and student-visible comment. See implementation report for the synthetic-feedback limitation.
- Required PR checks passed before the merge.

### Production database

- The migration succeeded before merge/deployment.
- Four pre-existing enquiries were preserved; zero historical emails were queued by the migration.
- Outbox row-level security is enabled. Anonymous and authenticated roles cannot read it; anonymous cannot invoke the submission RPC; service role can invoke it.
- The controlled browser enquiry created exactly two mail jobs, acknowledgement and internal notification, under one reference.

### Production browser and mail checks

- Actual public Schools page displays “Enquire about a school pilot” and prominent existing-access links.
- Access hub explains that student private links do not provide adviser access.
- Submitted one explicitly fictional release enquiry to the owner's own Muqabala inbox.
- Receipt displayed a masked reply address, a reference and a warning not to resubmit. Refresh preserved the same reference.
- Scheduled cron at 02:34:10 UTC reported `pilotAccepted: 2`, `failed: 0`, `scheduled: true`, HTTP 200. Both provider receipts were recorded at 02:34:12 UTC, each on attempt 1.
- Both emails were found in Gmail's INBOX at 02:34:12 UTC with the same reference. This proves inbox receipt, not merely provider acceptance. Their Reply-To is `hello@trymuqabala.com`; SPF, DKIM and DMARC headers passed. This single controlled test is not a universal deliverability guarantee.
- Controlled educator login using a real emailed OTP landed at `/schools/cohorts` and displayed only its assigned fictional QA cohort. Signed out afterward.
- Eight public HTTP checks returned 200: `/`, `/schools`, `/schools/access`, both role-specific sign-in URLs, `/schools/enrol`, `/practice`, `/for-employers`.
- Error/fatal log aggregation and HTTP 5xx aggregation returned no entries for the new deployment in the short checked post-release window starting 02:33:18 UTC. This is not a long-term stability claim.
- Synthetic enquiry `b4af296c-9db9-4167-a096-cd5ed521f790` was marked closed through the founder-authorized status RPC. It and its two mail receipts remain as audit evidence; nothing was deleted. All four original enquiries remain unchanged.
- Merged-commit CI passed: https://github.com/inspireambitions/Design-and-BRAND/actions/runs/35048392517
- Merged-commit question pipeline passed: https://github.com/inspireambitions/Design-and-BRAND/actions/runs/35048392482

### Screenshots

Local, excluded from Git; no access tokens or recovery codes:

- `output/schools-enquiry-20260916/live-enquiry-receipt.png`
- `output/schools-enquiry-20260916/live-adviser-dashboard.png`
- Earlier staging evidence: `cua-student-report.png`, `cua-adviser-review.png` in the same folder.

## Neb handoff

The private replacement student invitation remains unused and unrevoked. It expires 23 September at 01:54:58 UTC (09:54 Manila). The assignment closes earlier, at 22 September 23:59 UTC (23 September 07:59 Manila). Recommend completing the test by 22 September Manila time.

The link and updated send-ready message are in the owner's private handoff file outside Git. No message was sent to Neb. His invitation was not redeemed during testing. It provides student access only; adviser access still requires the separate pending approval and invitation.

## Still outstanding

- Neb's real-world feedback and physical iPhone/Android testing.
- Separate authorization/invitation if Neb should test the adviser role.
- New live student AI-feedback generation was not re-tested in this release pass. Staging feedback fixtures do not establish live AI quality.
- 72 lint warnings.
- Unrelated historical operational tasks are not declared fixed by this release (for example restore-project cleanup, CMS receipts and completion of the five-person pilot).

## Recovery guidance

If the application must be rolled back, the preceding production deployment is `dpl_7Q2nfjc5HA7XjemwZBRbmVCfUR1c`, revision `9d9fae3`. The migration preserves the old four-argument enquiry RPC. Leave the additive database migration and receipt records intact while investigating; do not drop the queue or replay accepted emails. An old application worker will not process the new queue, so inspect queued jobs before and after any rollback.
