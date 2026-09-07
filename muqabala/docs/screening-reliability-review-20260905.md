# Screening reliability review fixes

Local changes, 5 September 2026. No production deployment or database migration was performed.

## Behaviour

- Cleanup preserves interview rows when answer lookup or Storage removal fails. Partial failures return HTTP 503 and emit an operational failure code. A successful lookup returning zero paths can still remove an empty expired interview.
- Sign-out clears screening recovery recordings and transcripts from IndexedDB before leaving the page. A failed local purge stays visible and does not pretend the browser is clear. Network sign-out errors also remain visible.
- Recovery writes and deletes wait for transaction completion. A transaction abort after a successful request rejects the operation.
- Screening startup and draft restoration remove local recovery copies older than seven days. Browser storage cannot be cleaned while the site is closed; the next screening visit performs expiry cleanup. Uploaded copies continue to be removed after server confirmation.
- Notification recovery drains up to twelve existing five-job leases, for a maximum of 60 messages per invocation. It stops opening batches after 20 seconds and stops on a batch failure. A final batch can consume five seven-second provider timeouts, leaving limited headroom within the existing 60-second route. Unbounded database delays can still exhaust the route; existing five-minute leases allow recovery.

## Scheduling verification

The coordinating review verified INSPIRE's Vercel plan as Pro through the authenticated team API. The fix branch changes notification recovery from daily to every five minutes. Vercel's official cron usage documentation supports intervals down to one minute on Pro: https://vercel.com/docs/cron-jobs/usage-and-pricing.

The new schedule is configuration only until an approved production deployment. Verify actual scheduler delivery and candidate/employer receipt arrival after deployment. A passing synthetic batch test is not live email delivery proof.

## Validation

Command:

```text
node --experimental-strip-types --test --test-isolation=none scripts/screening-reliability.test.mjs scripts/screening-notifications.test.mjs scripts/employer-video-screening.test.mjs scripts/account-security.test.mjs
```

Result: 40 passed, zero failed. Eight new behavioural tests cover lookup failure, storage deletion ordering, 60-message drain capacity, worker stop conditions, late IndexedDB abort, commit-before-resolution, purge abort and abandoned draft expiry. Existing tests include source assertions and simulations.

Initial isolated typecheck could not run because dependencies were not yet installed. The coordinating agent must complete typecheck and build after installation. Physical-browser persistence, live cron execution, real provider retry, and authorised retention fixtures remain separate verification work.
