# Schools operations acceptance

Checked on 8 September 2026. Synthetic staging only. This report does not authorise institution enrolment or claim production readiness.

## Changes from this review

- Schools mail uses its own `SCHOOLS_RESEND_API_KEY`. It cannot silently use the shared practice or employer sender. `SCHOOLS_EMAIL_FROM` defaults to `Muqabala <hello@auth.trymuqabala.com>`.
- The mail provider must be configured before a job is claimed, so missing credentials do not consume delivery attempts.
- Migration `20260908151320_schools_mail_delivery_guards.sql` records the first delivery attempt. Automatic and founder retries stop after 23 hours from that attempt. This leaves a margin inside Resend's documented 24-hour idempotency window: <https://resend.com/docs/dashboard/emails/idempotency-keys>.
- Expired fifth-attempt leases become failed, so the founder can see them instead of leaving them stuck in sending.
- Removing a member cancels pending assignment mail. Claiming also rejects notifications for expired assignments or inactive members. An email already accepted by the supplier cannot be recalled; record access still checks current membership.
- Mail and retention failures emit safe operational events with category and count only. They do not log answers, email addresses, credentials or raw supplier errors.

## Evidence completed

`node --experimental-strip-types --test --test-isolation=none scripts/schools-foundation.test.mjs scripts/schools-operations.test.mjs` passed 38 tests. Existing tests cover local deletion, retention deadlines, shared Auth preservation, orphan account cleanup, access isolation and provider receipt state. Five new queue checks cover overlapping callers, exhausted leases, retry age, backoff and removed recipients. The total includes test containers.

The local concurrency check uses PGlite and verifies state transitions. It is not evidence of independent Postgres backend concurrency.

The hosted test `scripts/schools-hosted-concurrency.mjs` sent 20 parallel database requests to reserve feedback for one synthetic attempt. Exactly one request acquired the claim. Median latency was 278 ms; the observed 95th percentile was 295 ms; the batch took 384 ms. The three-claim retry ceiling held. It made zero model calls and sent zero emails. The disposable assignment and attempt were deleted. Results are in `docs/evidence/schools-hosted-concurrency.json`. The first run stopped with suppressed private error details; a fresh rerun passed. This does not establish full application throughput or supplier capacity.

## Background job configuration and live checks

Update at 16:45 UTC: protected staging deployment `dpl_B5JiJZ23geUtr2VYGPxoGCxj9fMp` passed actual staff and assignment worker delivery. Both messages arrived in the authorised Gmail inbox. Two concurrent worker requests sent the single staff message once. Simulating a lost receipt returned the same Resend message id on retry; a third invocation sent nothing. Both workers rejected missing cron authentication with HTTP 401. Evidence: `docs/evidence/schools-worker-preview.json` and `docs/evidence/schools-assignment-worker-preview.json`. Test invitations and outbox records were cleaned up. Actual scheduled triggers and supplier deletion receipts remain unverified.

Auth SMTP and application mail are separate paths. A received sign-in email does not prove the application worker works.

Before tester invitations, verify the exact staging deployment has the dedicated Schools sending key, approved sender, stable origin, stable invitation encryption secret, and cron authentication. Root release work owns this configuration and the actual controlled inbox delivery checks.

The worker sends at most three messages per invocation. Each send times out after 15 seconds. Claims last two minutes. Failures back off exponentially and automatic attempts stop at five. A stable message id supplies the provider idempotency key. A lost receipt can safely retry only inside the bounded window. Outside that window, inspect provider delivery records before reissuing an invitation.

Retention queues at most 100 memberships and processes at most three jobs per invocation, with a 35-second loop guard. It removes expired invitation material and uses active last-activity or archived-cohort dates. Local deletion is distinct from supplier deletion and final institution notification.

Schools jobs are not in the existing `vercel.json` schedule. Preview deployment alone does not schedule them. For a controlled test session, invoke the authenticated staging endpoints and verify results before and after the session. Before unattended operation, configure a staging scheduler and verify at least two recorded invocations. Use a one-minute mail cadence if the provider plan permits it; a 30-message burst then needs at least ten worker runs. Record the chosen cadence and provider limits before claiming a delivery target. Keep production Schools schedules disabled until activation approval.

Actual staff invitation, assignment delivery, timeout retry, duplicate provider receipt and scheduled-trigger evidence must be attached by release validation. Do not substitute these local tests for inbox evidence.

## Supplier deletion and privacy limits

Local deletion does not prove deletion from backups or suppliers. The application deliberately leaves supplier verification pending until the founder records a checked receipt. OpenAI requests use `store:false`; this alone is not proof of zero supplier retention. Confirm the relevant account's data controls and retention terms. Supabase backup expiry and Resend message retention also need documented handling. Sentry events must retain only scrubbed operational categories. Pilot one has no Schools audio, video, exports or public reports.

Do not mark a privacy job fully complete until local records, dedicated Auth handling, supplier handling and institution notification are checked. Preserve shared personal-practice or employer Auth identities.

## Capacity, cost and monitoring gates

- Feedback reserves at most one active generation per attempt and at most three automatic attempts. The provider timeout is 35 seconds and output limit is 6,000 tokens. Founder resets are explicit and should follow diagnosis.
- This is not a global spending cap. Configure a provider budget and review usage before expanding beyond five testers. No evidence in this review establishes capacity for simultaneous full model generations from 30 students.
- `SCHOOLS_INPUT_USD_PER_MILLION` and `SCHOOLS_OUTPUT_USD_PER_MILLION` must reflect the selected model's verified prices. Missing prices stay unknown rather than becoming zero. Record budget owner and a pause threshold in the pilot plan.
- Check `schools_mail_failed`, `schools_retention_failed` and feedback failure categories during the test session. Confirm the staging Sentry destination and notification route with one controlled event. Runtime logging alone is not confirmed alert delivery.
- For five testers, inspect queued and failed work before and after the session. Expand to 30 only after full journeys and real delivery are verified. Run a bounded concurrent generation check with an explicit cost ceiling before describing mass testing as ready.

## Rollback

Set `SCHOOLS_ENABLED=false` and stop Schools schedule triggers. This hides Schools pages and rejects its endpoints. Leave additive tables and this migration in place so queued delivery history and retry timestamps remain intact. Do not remove first-attempt timestamps or reset message ids as a rollback shortcut. Existing personal practice and employer mail provider selection are unchanged.
