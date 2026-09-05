# Delivery, scoring and dependency follow-up

## Changes ready for review

- Invitation creation checks email configuration before writing. Phone-only contacts and the unimplemented WhatsApp channel no longer appear to succeed.
- Candidate and outbox creation share one database transaction. Repeated contacts retain their original token. Retrying repairs a legacy invite with no queue row without sending duplicates.
- The employer can check role-wide counts for queued, accepted by the email service, failed and cancelled invitations. Acceptance is explicitly not inbox delivery. Status queries check ownership and return no contact data.
- Interrupted employer jobs regain a lease. Active jobs are skipped; exhausted jobs become failed. Claims are capped at five and cron drains bounded batches. Provider and database failures are reported instead of returning a successful cron result.
- Reminder inserts use a target-free conflict clause matching the actual partial unique index. Shortlist schedule markers and jobs commit together. Closed roles do not receive a late 48-hour shortlist email.
- The shared sign-in email uses neutral English and Arabic wording. This local template is not yet applied to hosted Supabase Auth.
- Practice scoring explicitly requires continuous verbatim extracts, preserving the original language, grammar and numbers. Evidence checks remain unchanged. Rubric version is 2026-09-05.
- The consistency script now validates full interview snapshots before sending, requires five finite scores per case, and records each result. Frozen transcripts are unchanged.

## Validation before deployment

- 430 resilience checks passed, including 16 new checks for the SQL and message worker.
- SQL tests execute the original invite schema and new migration in isolated PGlite PostgreSQL. They cover rollback, deduplication, repair, lease expiry, retry exhaustion, JWT-role denial, ownership, reminder stop conditions and shortlist recovery. They do not prove multi-connection concurrency under production load.
- Worker tests use fake database/provider boundaries; no test emails are sent. They cover missing configuration, lookup failure, 429 retries with the same idempotency key, permanent rejection, successful acceptance and failed state persistence.
- Typecheck and question-copy checks passed. Final build/deployment results and live scoring outcomes are recorded in the workspace audit handoff.

## Dependency changes

The fresh audit initially reported 10 findings (nine moderate, one high). Narrow overrides now use js-yaml 3.15.2 and smol-toml 1.8.0 under @vercel/frameworks, and uuid 11.1.1 under typeid-js 1.2.0. Sanity remains on version 6.11.0. The resulting npm audit reports zero findings. A 1,000-iteration TypeID UUID-v7 generation/conversion check passed. This does not guarantee absence of undisclosed vulnerabilities.

Advisories: [YAML](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [TOML](https://github.com/advisories/GHSA-v3rj-xjv7-4jmq), [UUID](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

## Live baseline and release boundary

The production five-repeat run failed: the numeric spreads were 0, 5, 3, 0 and 2, but strong English answers included unverified evidence and one Arabic request returned HTTP 504. The live semantic padding test also encountered an unverified result. No failed request is counted as a pass. Vercel logs confirmed invented_evidence validation failures; no transcript logging was enabled.

Production has RESEND_FEEDBACK_API_KEY. Preview does not. Do not copy production secrets into Preview or drain the shared queue from a preview just to obtain a green result.

The migration 20260905061702_employer_invite_delivery_reliability.sql is local only. Apply it with explicit production approval before deploying the changed invitation and scheduler routes. Apply the neutral sign-in template separately through the authorised Auth configuration. Confirm actual provider acceptance, inbox arrival, scheduler execution and deletion of controlled expired records after approval. Do not treat local simulations as proof of those live operations.

The tester's existing immutable preview link remains unchanged. Phone recording, submission, playback and report review still await the controlled tester journey.
