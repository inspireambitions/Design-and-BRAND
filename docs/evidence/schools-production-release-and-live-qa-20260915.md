# Muqabala Schools production release and controlled live QA

Checked 15 September 2026 between 14:07 and 14:46 UTC. This report records the production database migration, pull-request merge, Vercel release and controlled live acceptance run requested by the owner. All production QA data described below is explicitly labelled fictional and adult-only.

## Release outcome

- Production URL: `https://trymuqabala.com/schools`
- Vercel deployment: `dpl_7Q2nfjc5HA7XjemwZBRbmVCfUR1c`
- Git merge commit: `9d9fae317b63ebe56ac695d4319c2c5cb5162beb`
- Pull request: `inspireambitions/Design-and-BRAND#21`
- Vercel state: `READY`
- Production aliases: `trymuqabala.com`, `www.trymuqabala.com`, `muqabala.vercel.app`, `muqabala-inspire14.vercel.app`
- Production Supabase project: `hmaxzpgsefzpflrwzopa`
- Applied migration: `20260915140637 schools_dashboard_performance`

The custom domain served the merged commit. Fresh Vercel checks after the live QA journey returned no grouped runtime errors, no HTTP 5xx entries and no error/fatal log entries for the new deployment in the checked 30-minute window.

## Pre-release gates

| Check | Result |
|---|---|
| TypeScript | Passed |
| Full resilience suite | 558/558 passed |
| Schools-focused tests | 65/65 passed |
| Production build | Passed |
| Strict bundle budget | Passed |
| Dependency audit | 0 known vulnerabilities |
| Schools lint | 0 errors, 0 warnings |
| Full-repository lint | 0 errors, 71 pre-existing warnings outside the Schools release surface |
| GitHub and Vercel checks on PR 21 | Passed |

The required release ancestors `b5d6241` and `47a076f` are present. The repository ancestry helper can falsely fail on this Mac because it invokes Apple's blocked `/usr/bin/git`; direct checks with the bundled Git client passed.

## Production database verification

The performance migration created all 28 expected Schools indexes and the three intended read policies (`schools_members_read`, `schools_cohort_members_read`, and `schools_support_read`). The owner separately approved persistent Schools founder access for the Muqabala control inbox. The controlled production fixture now contains:

- one fictional institution: `Muqabala Controlled QA – Neb Pilot`;
- one accepted institution administrator and one accepted educator control account;
- one cohort: `Neb Educators Suite – Controlled QA`;
- three approved `front-office-agent` question versions, each with four evidence elements;
- one published three-question assignment due 22 September 2026;
- one completed fictional smoke learner, one submitted attempt, one ready feedback record, one final adviser review and one closed support request;
- one separate, unused Neb enrolment grant.

No access token, invitation fragment, one-time sign-in code or recovery code is stored in this report or in Git.

## Populated email-worker proof

The live application queued an institution-administrator invitation and an educator invitation. The unattended one-minute Schools mail worker processed both once. Both messages reached the authorised Muqabala inbox with passing SPF, DKIM and DMARC authentication. Final database state: two sent, zero queued/sending/failed.

This closes the earlier gap where empty scheduled runs alone did not prove delivery. Privacy-notification delivery remains untested because no real deletion request was performed during this release.

## Controlled browser acceptance

The production UI was exercised through `trymuqabala.com`, not a Vercel preview:

1. Founder created and approved the clearly labelled fictional institution.
2. Administrator invitation was delivered and accepted using passwordless sign-in.
3. Administrator created the cohort and invited the separate educator control account.
4. Educator invitation was delivered and accepted; the educator was assigned to the cohort.
5. Educator approved three questions, reviewed all 12 rubric elements and published the assignment.
6. Enrolment was opened. Neb's email-free, single-use grant was created and loaded in a fresh unauthenticated session without redemption. The form preloaded the token and kept Continue disabled until the 18+ confirmation was selected.
7. A separate fictional smoke learner was enrolled so Neb's grant remained untouched. A signed-in-session attempt was rejected safely. After sign-out and the two-minute claim lock, the same grant redeemed successfully without duplication.
8. The learner received a one-time recovery code, opened the assignment, saved three fictional answers and refreshed. All answers persisted.
9. Submission completed once, locked the submitted fields and preserved the answers while feedback was pending.
10. Feedback reached `ready` in approximately 20 seconds and displayed 12/12 evidence elements with supporting excerpts and next-step guidance.
11. Educator metrics updated to one active learner, one submission and one awaiting review. The educator opened the submitted answers and feedback evidence, saved a review, used the 10-second Undo action successfully, then saved the final review.
12. Educator created a support note and then closed it. The cohort returned to zero open support requests.
13. Institution administration showed one active cohort, one enrolled learner, one submission, zero not submitted, zero awaiting review and zero open support. The overview exposed counts and dates only—not draft text, submitted answers, feedback evidence or adviser comments.
14. The learner signed out, recovered the email-free account using its saved recovery code, and opened the report. The final adviser comment and closed support note appeared correctly.

Final database evidence confirmed one submitted attempt, one ready feedback record, one review, one closed support request and exactly one live, unused Neb grant.

## Screenshot and browser evidence

Existing responsive evidence remains available in this folder:

- `schools-quality-20260915-desktop.png`
- `schools-quality-20260915-mobile.png`
- `schools-quality-browser-20260915.json`

The live acceptance run additionally inspected the actual production pages through the accessibility tree at desktop size. No screenshot containing Neb's private token or any recovery code was saved.

## Neb handoff

Neb's private grant expires at 22 September 2026, 14:33 UTC. It was verified as present, unexpired, unrevoked and unused after all smoke tests. The exact URL must be copied from the owner's private handoff message and sent only to Neb. It must not be pasted into Git, a public post, a third-party link-preview tool or a screenshot.

The single-use link grants the learner role only. It does not grant educator or institution-administrator access. If Neb is also expected to test those privileged interfaces, confirm his email address and explicitly authorise a separate educator invitation first.

## Remaining post-release evidence

1. Neb completes the live learner journey and returns timestamps, device/browser details, results and redacted screenshots.
2. Complete physical iPhone Safari and Android Chrome journeys. The Schools flow is typed; test keyboard, clipboard, refresh, interruption and reconnection rather than camera/microphone.
3. If desired, invite Neb separately as an educator after confirming the destination email and scope.
4. Recruit four additional consenting adult participants with separate single-use links, then review the five-person pilot before expanding.
5. Obtain independent human review of feedback usefulness; technical completion does not establish educational or hiring validity.
6. Exercise a populated privacy/deletion notification before claiming that external deletion messaging is proven.
7. Decide whether to fix or formally accept the 71 non-Schools lint warnings.
8. The restored verification project `pcicynthmmtcjsoupsfy` remains healthy and billable. Permanent deletion still requires a separate explicit instruction.

## Rollback

If a release-blocking regression appears, roll back the Vercel production alias to the previous known-ready production deployment `dpl_AAGx5x4H47HYeyHcqTRVUUmrhzg6` and preserve the controlled QA records for incident analysis. Do not reverse the database migration by dropping indexes during an active incident; the migration is additive and the release can be rolled back independently.
