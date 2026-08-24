# Muqabala release QA board report

Date: 23 August 2026

## Executive verdict

GO for a controlled Preview and final inbox testing. Security and candidate-journey reviewers found no remaining source-level deployment blocker after remediation. Reliability approves controlled staging, but does not approve a claim of 1,000 concurrent users or zero outage until the planned load, soak and failure tests have passed against configured production infrastructure.

## High-severity findings resolved before Preview

### QA-SEC-01: Scoring can bypass the report lock

- Location: `app/api/score/route.ts`
- Evidence: `interviewId` and `questionIndex` are optional, so a caller can request real feedback without an authorised stored attempt.
- Impact: Questions after Question 1 can be scored without email verification, and unauthorised AI spend is possible.
- Fix: require an authorised stored attempt whenever Supabase persistence is configured. Derive and verify the question against the stored attempt.

### QA-SEC-02: The browser chooses the public first question

- Location: `app/api/interviews/route.ts`, `lib/interviews.ts`
- Evidence: the server persists the question order supplied by the browser while the lock treats index zero as public.
- Impact: a caller can move a target question into index zero and reconstruct private feedback.
- Fix: rebuild or validate the complete question plan on the server. The opener, closer, length and every question must come from the trusted catalogue or a signed tailored-interview token.

### QA-SEC-03: Email claiming is not securely bound to the intended attempt

- Location: `app/api/auth/request/route.ts`, `app/auth/confirm/route.ts`, `lib/server/claim-attempt.ts`
- Evidence: claiming relies only on the anonymous attempt cookie at verification time.
- Impact: verification on another device cannot claim the report. A forwarded magic link can also cause the wrong browser session to claim an attempt.
- Fix: issue a short-lived, single-use hashed claim ticket tied to the attempt and requested email, then redeem it atomically after verification.

## Reliability and journey blockers

- Restore the unfinished transcript during cross-device resume.
- Make answer and progress persistence atomic, acknowledged and retryable.
- Add Arabic translations for the lock, sign-in, account, report and sharing journey.
- Use a real keyboard-accessible sign-in form and announce errors as alerts.
- Add OpenAI to Claude failover after Claude passes the fixed fairness and consistency gate.
- Replace process-local scoring idempotency and concurrency controls with shared controls.
- Add share-link limits, idempotency, truthful revocation results and `noindex` protection.
- Replace the one-question load script with a realistic eight-question persistence, authentication and reporting journey.
- Add privacy-scrubbed monitoring for database, authentication, Redis, autosave and sharing failures.

## Controls that passed

- Anonymous report projection returns only Question 1 and removes Questions 2 onward, their improvement areas and the overall score.
- RLS is enabled on all three current public tables and owner policies are present.
- Authenticated client roles have read-only database grants.
- Service-role credentials remain server-only.
- Attempt and share tokens use 256-bit randomness and only hashes are stored.
- Share expiry and revocation checks exist.
- Mutation routes use strict canonical-origin checks.
- Private JSON responses use `private, no-store` and `Vary: Cookie`.
- TypeScript, the 93-route production build, all 8 security tests and all 20 resilience tests pass.
- `npm audit --omit=dev` reports zero known vulnerabilities.

## Live verification completed

- The two reviewed Supabase migrations were applied only to project `hmaxzpgsefzpflrwzopa`, Muqabala in Inspire Ambitions Production.
- Live migration verification confirmed four required functions, RLS on `auth_claims`, service-role-only claim redemption, scoring claim hashes and stored role snapshots.
- The Vercel Preview deployment `dpl_6Gy222KtwLUrSdmFKeMk5Wkj2k8i` reached READY without changing production traffic.
- The protected Preview returned 200 with HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a restrictive permissions policy and `X-Robots-Tag: noindex`.
- One real anonymous eight-question Preview journey created an interview, saved all eight answers and completed successfully.
- Question 1 feedback was visible. Question 2 feedback was locked and its improvement list was empty in the anonymous response.
- The completed anonymous report returned one visible answer and seven locked answers.
- The live Supabase magic-link template now uses Muqabala branding, English and Arabic copy, a six-digit OTP and the signed return-to-report callback.
- Supabase allows only the production callback and the current Preview callback. The obsolete Preview callback was removed.
- Resend shows `auth.trymuqabala.com` as verified and the dedicated `Muqabala Supabase Auth SMTP` key as sending-only with recent activity.

## Release gate

Before production promotion, finish the real inbox and account journey with a fresh email address: verify delivery and spam placement, same-device return, cross-device resume, full report unlock, save-to-account, WhatsApp share and sign-out. Repeat email delivery checks in Gmail, Outlook, Yahoo and iCloud. Configure Upstash before load testing. Keep Claude disabled until the fixed fairness and scoring gate passes. Then run the 500, 1,000 and 1,500-user tests, a sustained soak and the planned dependency-failure drills before making a 1,000-user or zero-outage claim.
