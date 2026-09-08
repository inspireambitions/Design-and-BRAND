# Schools and Colleges: agent test report

8 September 2026. Current decision: small supervised staging tests using fictional answers. Public production Schools remains disabled. This is not mass institutional launch approval.

## Passed

| Area | Evidence |
| --- | --- |
| Regression checks | 541 passing tests, zero failures |
| Feature flag off | 105 HTTP checks: Schools returns 404; existing public entry pages return 200 |
| Build | Local Webpack and Vercel Turbopack builds passed |
| Email sign-in | Delivered code verified, correct invited email enrolled, assignment visible, used invitation rejected |
| Student journey | Fresh desktop Chrome and mobile-width Chrome enrolment, save, refresh, submit, feedback, recovery and deletion |
| Interrupted submission | Lost successful response followed by keyboard retry creates exactly one submission |
| Adviser journey | Keyboard review of the submitted attempt and private student comment display |
| Mail delivery | Staff and assignment messages reached the controlled inbox |
| Mail duplication | Two concurrent workers send once; replay after a lost receipt returns the same provider message ID |
| Feedback reservation | 20 concurrent requests produce exactly one claim; no model spend in this database test |
| Feedback examples | Twelve live source-selection checks passed; interpretation can vary by one element |
| Isolation | Hosted checks cover employer exclusion, cross-institution access, removed users, tampered assignment and expired sessions |

## Fixes made

- Replaced model-written quotations with server-extracted original answer excerpts.
- Separated Schools enrolment limits so a classroom connection is not limited to five combined requests.
- Fixed stale mail leases, retries outside the safe duplicate-prevention window and pending notifications for removed students.
- Separated Schools mail credentials from existing product mail.
- Corrected the browser test to wait for an actual visible error, rather than Next.js's empty route announcer.
- Added the Vercel GitHub branch metadata required to attach preview-only mail and cron settings.
- Contained a synthetic browser-test credential exposure: revoked its sessions and membership, replaced the preview share token, and suppressed private error details.

## Not yet signed off

- Physical iPhone/Safari and Android testing. Browser emulation is not a physical-device test.
- WhatsApp, iMessage and LinkedIn previews. Protected staging blocks public crawlers and metadata points to production assets.
- Automatic scheduling. Workers have been invoked and verified manually; unattended trigger execution remains unverified.
- Supplier deletion receipts, backup expiry and final institutional privacy confirmation.
- Simultaneous AI generations for a large group, an agreed provider budget and verified alert delivery.
- Real institution setup, adult-only confirmation, language, adviser-approved question bank, signed DPA, evaluation thresholds and budget owner.

## Detailed reports

- evidence/schools-keyboard-acceptance.md
- schools-operations-acceptance.md
- schools-release-review.md
- schools-tester-guide.md

Start with a small supervised group, collect device and step-specific feedback, fix blockers, then consider expansion. Private access links are delivered by email and excluded from this repository.
