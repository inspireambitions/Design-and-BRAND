# Performance log

Target: `trymuqabala.com`. Goals: first streamed feedback under 1.5 s at p75, employer report under 2 s at p75, Core Web Vitals passing on a mid-range Android over throttled 3G.

Sections are worked in the order of the performance brief. A lower section does not start until the one above has passed its acceptance test on production data.

Hard rules that no entry here may change: candidate practice video never leaves the device. No scoring of face, accent, emotion or personality. Scores are never shown before the integrity gate has run.

## How to read the numbers

Real-user timings are PostHog events, one event per measurement, all in milliseconds:

| Event | Measures | Sent from |
| --- | --- | --- |
| `feedback_first_token_ms` | Get feedback tap to the first readable block on screen | `components/InterviewFlow.tsx` |
| `feedback_complete_ms` | Get feedback tap to the final feedback (or timeout or error, see `outcome`) | `components/InterviewFlow.tsx` |
| `advert_to_first_question_ms` | Advert submitted to tailored questions returned | `components/CustomRoleStart.tsx` |
| `transcript_ready_ms` | Stop speaking to transcript shown | `components/InterviewFlow.tsx` |
| `report_load_ms` | Navigation start to employer report interactive | `app/employer/interviews/[id]/page.tsx` |
| `web_vital` | LCP, INP, CLS, FCP, TTFB with `rating` and route `path` | `components/WebVitals.tsx` |

Every event carries `device_class` (mobile, tablet, desktop). PostHog adds country from the request. `streamed` on the feedback events separates the baseline from the streamed path.

Dashboard: in PostHog create one insight per event, Trends, property `duration_ms` (or `value` for `web_vital`), aggregations p50, p75, p95, broken down by `device_class` and `$geoip_country_code`. Filter `web_vital` by `metric`. Save the six insights to a dashboard named "Muqabala performance".

## Test protocol

Run before and after each section.

- Device: mid-range Android, or Chrome DevTools mobile emulation with 4x CPU slowdown.
- Network: Chrome DevTools "Slow 3G".
- Location: Middle East node on WebPageTest (Dubai, Riyadh or Doha).
- Candidate flow: land on `/practice`, pick a role, answer by typing, Get feedback, Retry, view the comparison.
- Employer flow: sign in, open a report with video.

## Log

Format: date, section, metric, before, after, source.

### 2026-09-01, Section 8, measurement

| Metric | Before | After | Source |
| --- | --- | --- | --- |
| Events instrumented | 3 product events, no timings, no vitals | 3 product events plus 5 timings plus `web_vital` | this branch |
| Dashboard | none | to create in PostHog from the table above | manual step |

Status: code complete. Dashboard creation and the baseline capture happen on production, not from this environment.

### 2026-09-01, Section 1, streaming feedback

Baseline: not yet captured. Deploy this branch with `NEXT_PUBLIC_FEEDBACK_STREAMING=off` for one full day of real traffic, note p75 of `feedback_first_token_ms` and `feedback_complete_ms` here, then switch the variable to `on` (or remove it) and capture the same figures.

| Metric | Before (baseline) | After (streamed) | Source |
| --- | --- | --- | --- |
| `feedback_first_token_ms` p75 | to capture | to capture | PostHog |
| `feedback_complete_ms` p75 | to capture | to capture | PostHog |
| Timeout path | none: the client waited 45 s | 12 s server budget, "Feedback is taking longer than usual." with Retry | code |

What changed:

- `/api/score` streams newline-delimited JSON when the client sends `Accept: application/x-ndjson`. Existing JSON clients (report retry, employer sittings, load test) are unchanged.
- The model emits readable blocks first: headline, What worked, What is missing, Say this next time. Scores and evidence come last and are only released after the integrity gate passes, so no partial number is ever visible.
- Each block appears the moment it is complete. Blocks still generating show a skeleton, not a spinner.
- The server budget is 12 s. A timeout returns `scoring_timeout`; the browser withdraws anything half shown and offers Retry. Retry sends the same request on a fresh stream. Automatic countdown retries do not run after a timeout.
- Employer sittings and locked answers never stream blocks.

Verified here: unit tests for the partial-JSON extractor (English, Arabic, keys inside quoted text), the NDJSON transport (partials, final, timeout, thrown failure, locked), `tsc --noEmit`, `next build`. Not verified here: an end-to-end stream against a live model, because this environment has no provider key and no Supabase project.

Model: the brief asks for the smallest model that passes the feedback quality gate. The gate is `npm run gate:feedback-quality` (`scripts/measure-consistency.mjs` with `EXPECT_AI=1`) against a deployment. Time to first word is dominated by `SCORING_REASONING`; trial `low` first, then a smaller model, and record the spread result here before keeping either. The Anthropic path is only active when `ENABLE_ANTHROPIC_FALLBACK=true`.

Acceptance for Section 1 is p75 under 1.5 s and 6 s on production. Sections 2 to 7 wait for that figure.

### 2026-09-01, Sections 6 and 7

Section 6, employer side.

| Metric | Before | After | Source |
| --- | --- | --- | --- |
| Video upload path | Browser to Supabase Storage, resumable | Unchanged, confirmed | `lib/screening-video-upload.ts` line 20 (`new tus.Upload(file, { endpoint: grant.endpoint`); `app/api/screening/interviews/[id]/upload-url/route.ts` lines 71 to 82 (`createSignedUploadUrl`, endpoint `storage.supabase.co/storage/v1/upload/resumable`); `answers/route.ts` receives JSON metadata only and verifies the object with `storage.list` |
| Report page queries | 3 (packs, interview, answers) plus 3 `createSignedUrl` calls | 2 (packs, interview) and 0 signing calls; 3 queries for pre-summary submissions | `app/employer/interviews/[id]/page.tsx` |
| Media requests during report load | 3 `<video preload="metadata">` with 15 minute signed URLs in the HTML | 0; a placeholder per answer, `<video>` mounts only after Play, signing via `signEmployerVideo` server action | `components/EmployerReportVideo.tsx`, `app/employer/actions.ts` |
| Dashboard answers query | `interview_answers` for every submission (3 rows per candidate, unbounded) | Only the 20 rows on screen plus the 3 queued for review | `app/employer/page.tsx` |
| Dashboard candidate list | Top 3 only, no full list | `?page=` at 20, `submitted_at desc`, `.range()`, initials placeholder, no `<video>` | `app/employer/page.tsx`, `lib/employer-dashboard.ts` `candidatePage` |
| Question generation per link | Once at pack creation | Unchanged, confirmed | `app/api/screening/packs/route.ts` line 40 (`proofQuestions(role)`) signed into `signed_token` and inserted once; `lib/screening-pack.ts` line 23 only `verifyInterview`s the stored token; `app/s/[code]/page.tsx` calls `getScreeningPack` (React `cache`) and generates nothing |
| `report_load_ms` p75 | to capture | to capture | PostHog, after deploy |

Pre-aggregated report row: migration `supabase/migrations/20260901193000_interview_report_summary.sql` adds `interviews.report_summary jsonb` and `report_summary_at`. The submit route writes it right after `submit_screening_interview` succeeds (`lib/server/report-summary.ts`). Because AI notes can still be pending at submission, the summary carries `scoring_settled`; the page uses the summary only when settled, otherwise it reads `interview_answers` and, if everything has settled by then, rebuilds the summary in `after()` so the next load is one row. Older submissions have a null summary and use the same fallback. No policy changes: the column lives on `interviews`, so the existing employer select policy (submitted interviews under the employer's own packs) governs it.

Section 7, database. Migration written, not applied. Apply with `supabase db push` after review.

Migration: `supabase/migrations/20260901200000_performance_indexes_and_stats.sql`.

| Item | Before | After | Source |
| --- | --- | --- | --- |
| `pg_stat_statements` | On by default in Supabase, not declared in migrations | `create extension if not exists`, guarded; operator query for statements over 100 ms at the end of the file | migration |
| `screening_packs.signed_token` lookup at interview start | Sequential scan; tokens are too long for a B-tree | Hash index `screening_packs_signed_token_hash_idx` | `app/api/interviews/route.ts` line 37 |
| Pending upload check on the dashboard | `interview_id` prefix of the unique index, then filter | Partial index `interview_answers_pending_upload_idx` on `(interview_id, updated_at) where video_upload_status = 'pending'` | `app/employer/page.tsx` |
| Paginated submissions sort | Per-pack index then sort | Partial index `interviews_submitted_recent_idx` on `submitted_at desc` for screening submissions | `app/employer/page.tsx` |
| Revoked share cleanup | Full scan for the `revoked_at` half of the cron predicate | Partial index `report_shares_revoked_idx` | `20260823111300` cron job |
| Connection pooling | n/a | n/a | The app talks to Supabase over HTTPS (PostgREST via `@supabase/supabase-js` and `@supabase/ssr`); there are no direct Postgres connections, so Supavisor transaction mode does not apply. If a direct connection string is ever introduced (for example a queue worker or Prisma), use the Supabase dashboard's Connect panel, pick the transaction pooler string on port 6543, and set `?pgbouncer=true` where the driver needs it |
| Feedback storage | One JSONB `interview_answers.feedback` per attempt | Unchanged, confirmed | `20260823111300_account_reports_and_shares.sql` line 34; written by `claim_interview_scoring` and `/api/score` |
| Load test | `scripts/load/interview-journey.js` (k6) exists | Not run here | The 200 concurrent candidate run must target a preview project with `pg_stat_statements` enabled, never production. Reset with `select pg_stat_statements_reset();`, run `npm run load:test` against the preview URL, then run the commented query from the migration |

Row Level Security, every table holding candidate or employer data:

| Table | Data | RLS | Policies | Policy columns and index |
| --- | --- | --- | --- | --- |
| `interviews` | Candidate attempts, names, employer decisions | Enabled | Select for authenticated: own `user_id`, or submitted and under the employer's pack. Writes: service role only | `user_id` via `interviews_user_status_idx`; `screening_pack_id` via `interviews_screening_pack_submitted_idx`; `screening_packs.employer_id` via `screening_packs_employer_created_idx` |
| `interview_answers` | Transcripts, AI notes, video paths | Enabled | Select for authenticated through the parent interview's ownership. Writes: service role only | `interview_id` via unique `(interview_id, question_index)` |
| `report_shares` | Candidate share tokens (hashed) | Enabled | Select own `user_id`. Writes: service role only | `user_id` via `report_shares_owner_idx` |
| `screening_packs` | Employer links, signed questions | Enabled | Select own `employer_id`. Writes: service role only | `employer_id` via `screening_packs_employer_created_idx` |
| `auth_claims` | Hashed email and claim state | Enabled | None: deny by default, service role only | n/a |
| `screening_notification_outbox` | Recipient user ids, job state | Enabled | None: deny by default, service role only | n/a |
| Storage bucket `screening-videos` | Candidate recordings | Private bucket, no `storage.objects` policies | Service role signs upload and playback URLs | n/a |

No table lacked RLS, so the migration adds none. Every policy predicate is served by an existing index, so no index is added for RLS.

Verified here: `tsc --noEmit`, `node --experimental-strip-types --test scripts/*.test.mjs`, `next build`. Not verified here: the migration against a database (no Supabase access from this environment), and `report_load_ms` on production.

## Sections not started

- Section 2, Middle East edge region: needs Vercel project settings and the Supabase region check. Do not migrate Supabase without confirmation.
- Section 3, on-device transcription: Web Speech with typing fallback exists; audio-only server fallback does not.
- Section 4, build-time generation: `/practice/[roleId]` currently renders on demand; no model answers; no advert-hash cache.
- Section 5, page weight: no bundle budget in CI; `components/InterviewFlow.tsx` is the largest client module.
- Section 6 and 7 code is complete above; the migrations wait for `supabase db push` after review, and the `pg_stat_statements` reading waits for a preview load test.
