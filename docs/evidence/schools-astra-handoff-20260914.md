# GPT-6 Astra inspection handoff

Date: 14 September 2026

## Scope and release boundary

- Repository: `inspireambitions/Design-and-BRAND`
- App: `muqabala/`
- Base branch: `claude/gulf-hospitality-video-interview-m9skfu`
- Review branch: `codex/schools-finish-20260914`
- Institution dashboard fix commit: `d809e88`
- Pull request: <https://github.com/inspireambitions/Design-and-BRAND/pull/21>
- Protected preview: <https://muqabala-schools-pilot-20260908-inspire14.vercel.app>
- Immutable preview deployment: <https://muqabala-puhd99s0i-inspire14.vercel.app>
- Production was not changed.
- Supabase production was not changed.
- The database migration was applied only to the disposable Supabase branch `okrsezhospztwtptqhpo`.

## What changed

- Added an educator cohort summary with active students, current assignment, due date, submitted count, awaiting-review count and one next action.
- Added an institution participation overview with active cohorts, enrolled students, submissions, missing submissions, awaiting review, open support and active assignment dates.
- Kept institution administration out of student drafts, answers, feedback, evidence and adviser comments.
- Added 28 missing foreign-key indexes for the Schools tables.
- Rewrote three Schools RLS policies to use the Supabase init-plan pattern without changing access predicates.
- Updated the Schools release document and the root release guide so future agents see the current public, private and human-gate boundaries.
- Added reusable dashboard, responsive, accessibility and five-call feedback checks.
- Fixed the institution dashboard to use its server-only service client for operational cohort columns only after the signed-in user is verified as an institution administrator. The learner-safe database grant remains limited to cohort ID and name.

## Automated evidence

- Full test suite: 543 passed, 0 failed.
- TypeScript: passed.
- Production build: passed, 135 routes generated.
- Bundle gate: passed on all 69 catalogue pages. Largest recorded entry was 198.3 KB gzipped against the strict 200 KB limit.
- Release ancestry: passed for required commits `b5d6241` and `47a076f`.
- Lighthouse accessibility: 100 on `/schools`, student home, cohort, review and institution admin.
- Responsive browser check: 30 of 30 route and viewport combinations passed at 320, 375, 390, 768, 1280 and 1440 pixels.
- Synthetic student journey: timed autosave, refresh recovery, adviser draft privacy and exactly-once retry after a lost submission response passed.
- Database security suite includes cross-institution denial, employer denial, draft privacy, direct-write denial, idle and revoked session denial, deletion and retention boundaries.
- The corrected Vercel preview built all 135 routes and passed fresh live checks on the protected Schools landing page, learner dashboard, adviser cohort dashboard and institution dashboard. Each returned HTTP 200.

## Bounded provider evidence

- Five full synthetic feedback journeys were started concurrently.
- Exactly five model calls completed.
- All five HTTP responses succeeded and all five feedback records reached `ready`.
- Stored usage: 5,240 input tokens and 1,815 output tokens.
- Verified GPT-4.1 mini rate: USD 0.40 per million input tokens and USD 1.60 per million output tokens.
- Estimated total: USD 0.005.
- This is a bounded preview-path check. It is not proof of classroom-scale or provider-wide capacity.

## Supabase evidence

- Before the migration: 28 `unindexed_foreign_keys` findings and three `auth_rls_initplan` findings affected Schools.
- After the migration: both finding types are absent.
- New unused-index information notices are expected until real query traffic uses the indexes.
- Service-only tables continue to use RLS with no browser policies by design.
- The unrelated project-level leaked-password warning remains unchanged.
- The staging migration history currently contains two safe, idempotent executions named `schools_dashboard_performance`. This happened because the staging branch was reset and the migration was reapplied. Production contains neither execution.

## External actions completed

- The review branch was pushed and pull request 21 is open and mergeable.
- The corrected Schools build was deployed to a protected Vercel preview using the staging-only Supabase credential.
- The stable protected preview alias points to deployment `dpl_CGZ13zZ8PL4yYSuyDeqeisX6yZNw`.
- Production was not deployed or promoted by this work.

## Remaining protected action

- No real email was sent. The old email-configured preview did not contain the current mail route, so the test stopped at HTTP 404 and the temporary invitation was cleaned up.
- The corrected preview needs the existing preview-only settings `SCHOOLS_RESEND_API_KEY`, `SCHOOLS_EMAIL_FROM` and `CRON_SECRET` copied from the old Schools branch. Values must not be printed. This narrower secret transfer requires explicit owner approval.
- After that approval, run exactly one temporary staff invitation to the controlled test inbox. Record provider acceptance, concurrent-worker exactly-once behaviour and replay idempotency. Inbox receipt must remain labelled unverified unless the inbox is read back.

## Human gates

- Physical iPhone Safari and Android Chrome.
- WhatsApp, iMessage and LinkedIn preview cards on the real services.
- Supervised five-person pilot with approved fictional content.
- Independent review of feedback usefulness and assessment validity.
- Founder inputs listed in `muqabala/docs/schools-release-status.md`.

## Rollback

- Application: do not merge the review branch, or revert its commits if merged later.
- Vercel: no production rollback is needed because production was not changed.
- Supabase production: no rollback is needed because the migration was not applied there.
- Supabase staging: reset the disposable branch to the production migration head. Reapply the migration only if the review continues.

## Astra decision requested

Inspect tenant isolation, draft privacy, the membership check before service-role reads on the institution page, the dashboard aggregation rules, the 28 indexes, the three RLS policy rewrites, responsive accessibility and the release claims. Do not approve production from this handoff alone. Require provider-accepted email evidence and the listed human gates first.
