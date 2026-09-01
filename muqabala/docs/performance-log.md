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

### 2026-09-01, Sections 2 and 5

Region and caching (Section 2), page weight and rendering (Section 5). Measured on this branch with a clean `next build`, Node 22. Bundle figures come from `npm run check:bundle` (gzip level 9 of the first-load JavaScript: shared runtime plus root layout plus page chunks, legacy polyfill excluded). Lighthouse 13.4.1, mobile emulation, headless Chrome 148, against `next start` on this machine, so the absolute timings are not Gulf numbers; the deltas are what matter.

| Metric | Before | After | Source |
| --- | --- | --- | --- |
| `/practice` first-load JS, gzipped | 272.2 KB (over budget) | 193.1 KB | `npm run check:bundle` |
| `/practice/[roleId]` first-load JS, gzipped | 258.4 KB (over budget) | 176.8 KB | `npm run check:bundle` |
| Budget | none | 200 KB gzipped, fails CI | `scripts/check-bundle-size.mjs` |
| `posthog-js` in every route's first load | 79.7 KB gzipped, in the root layout chunk | 0 KB, fetched on idle after hydration | chunk inspection |
| `/practice` JS transferred (all scripts, gzip) | 448 KB | 368 KB | Lighthouse network audit |
| `/practice/front-office-agent` JS transferred | 435 KB | 355 KB | Lighthouse network audit |
| `/practice` Lighthouse mobile: Performance, Accessibility, CLS | 98, 93, 0 | 98, 93, 0 | Lighthouse, local |
| `/practice/front-office-agent` Lighthouse mobile: Performance, Accessibility, CLS | 97, 94, 0.011 | 98, 94, 0.011 | Lighthouse, local |
| `/practice/front-office-agent` Total Blocking Time | 150 ms | 100 ms | Lighthouse, local |
| Functions region | `iad1` (US East) | unchanged: Vercel refused to create the deployment with `"regions": ["dxb1"]` in `vercel.json` on the current plan | Vercel Git check on PR #13 |
| `/_next/static/*` Cache-Control | `public, max-age=31536000, immutable` | unchanged | `curl -I` on `next start` |
| `/icon.svg`, `/opengraph-image`, `/twitter-image` Cache-Control | `public, max-age=0, must-revalidate` | `public, max-age=31536000, immutable` | `curl -I` on `next start` |
| CI | none | typecheck, tests, build, bundle budget on PRs and the main branch | `.github/workflows/ci.yml` |

What changed:

- A Dubai (`dxb1`) function region was tried in `vercel.json` and Vercel rejected the deployment outright (the check linked to the function region documentation). Choosing a region other than the default needs the Pro plan and is then set in Vercel project settings, Functions, Region. The setting was removed so the branch deploys. The Supabase project region could not be confirmed from code and must be checked in the Supabase dashboard (Project settings, General); the functions should sit in the same region as the database, so decide both together. Nothing was migrated.
- Static asset caching. `/_next/static` chunks already had immutable headers (verified). `next.config.ts` now adds a one year immutable `Cache-Control` for `/icon.svg`, `/opengraph-image`, `/twitter-image` and the `/for-employers` pair. This is safe because the HTML links to them with a content hash in the query string, so a changed image gets a new URL. There is no `public/` folder, so nothing else needed a header. `/share/*` keeps `no-store`.
- `posthog-js` was the single largest item on every page (79.7 KB gzipped) because `WebVitals` in the root layout imported `lib/analytics` statically. `lib/analytics.ts` now imports `posthog-js` itself with `import()` inside `initAnalytics`, which `LanguageProvider` already ran on idle. Events fired before it loads still queue and flush; nothing else changed.
- `components/InterviewFlow.tsx`: `lib/speech` and `lib/media` are fetched together the first time the candidate speaks (or, on browsers with speech, when the on-device disclosure is checked at the device stage) and never on browsers without speech recognition. `ScoreRing`, `RatingCard`, `CoachingCard`, `EmailSignIn`, the retry comparison (new `components/RetryComparison.tsx`) and the share, print and copy block (new `components/ReportShareActions.tsx`, `lib/report-text.ts`) load with `next/dynamic`. The results-screen chunks are prefetched while the first feedback is on screen. Behaviour is unchanged; `startSpeechCapture` and the mock pause toggle became async to await the module load, and a failed download falls back to typing exactly like a browser without speech.
- Bundle budget: `scripts/check-bundle-size.mjs` reads the Turbopack client reference manifests (or `app-build-manifest.json` for webpack), prints the per-chunk breakdown, and exits 1 over 200 KB gzipped. Wired as `npm run check:bundle` and run in CI after the build.
- CI: `.github/workflows/ci.yml` runs `npm ci`, `npm run typecheck`, the node test runner over `scripts/*.test.mjs`, `npm run build` and `npm run check:bundle` in `muqabala` on Node 22, with no secrets. The build does not need any environment variable, and this was checked here with none set.

Checked, no change needed:

- Fonts: all three `next/font/google` families use `display: 'swap'`; the subsets are `latin` for Bricolage Grotesque and Public Sans and `arabic` only for IBM Plex Sans Arabic, which also has `preload: false`. No font files were added.
- Images: the only `<img>` tags are the two marketing screenshots in `components/EmployerProofCreate.tsx`. They render only when `hasPublicAsset()` finds the file, and there is no `public/` folder, so they never render today. They were left as they are because `next/image` needs the real width and height, which do not exist until the screenshots do. Convert them when the captures are added.
- Edge runtime for marketing routes: not done. The Edge Runtime is deprecated in Next.js 16 (`node_modules/next/dist/docs`, "Edge Runtime Deprecated") and every static (○) route (`/`, `/about`, `/faq`, `/how-it-works`, `/practice`, `/progress` and so on) is already prerendered at build time and served from the Vercel CDN, so a runtime change would add nothing. The static pages also share `MarketingSite`, which is fine on either runtime, so the constraint was the deprecation, not the imports.

Still on the table:

- `/practice` ships the whole role catalogue twice: 30.7 KB gzipped of JavaScript in `lib/roles` (via `HomeView`) and about 200 KB of HTML because the full `Role` objects, questions included, are passed as props. A slim card list would take `/practice` well under 170 KB. This belongs with Section 4.
- `react-dom` and the Next client runtime are 111 KB gzipped of the remaining 177 KB; that is the floor without changing frameworks.
- Lighthouse Accessibility is held at 93 and 94 by two audits on both pages: a colour contrast warning and a missing `<main>` landmark. Neither is a performance item; both are quick fixes.
- Section 2 acceptance (TTFB from a Gulf node before and after `dxb1`) can only be measured on production, with WebPageTest from Dubai or Riyadh, once this branch is deployed.
### 2026-09-01, Section 4, build-time generation

| Metric | Before | After | Source |
| --- | --- | --- | --- |
| `/practice/[roleId]` route type | ƒ dynamic, rendered on every request | ● SSG, 69 role pages prerendered | `next build` |
| `/practice/custom` route type | ƒ dynamic | ○ static | `next build` |
| `/guides` and `/guides/[slug]` revalidation | every 60 s, a Sanity fetch per minute per page | on demand from a signed Sanity webhook, 1 d safety net | `next build`, `app/api/revalidate/route.ts` |
| Tailored interview, same advert pasted again | full model call every time (20 to 50 s) | Upstash hit, sign and return (tens of ms) | `lib/advert-cache.ts` |
| `advert_to_first_question_ms` p75 | to capture | to capture, split by `outcome` | PostHog |

Build output before:

```text
├ ○ /guides                                            1m      1y
├   /guides/[slug]
│ ├ ● /guides/phone-interview-practice                 1m      1y
├ ƒ /practice/[roleId]
├ ƒ /practice/custom
```

Build output after:

```text
├ ○ /guides                                            1d      1y
├   /guides/[slug]
│ ├ ● /guides/phone-interview-practice                 1d      1y
├ ○ /practice
├   /practice/[roleId]
│ ├ ● /practice/front-office-agent
│ ├ ● /practice/waiter
│ ├ ● /practice/housekeeping-attendant
│ └ ● [+66 more paths]
├ ○ /practice/custom
├ ○ /sitemap.xml
├ ƒ /api/revalidate
```

What changed:

- Role pages. `app/practice/[roleId]/page.tsx` awaited `searchParams` for `focus` and `lang`, which made every role page render on demand even though `generateStaticParams` was present. The page no longer reads the query string. `components/PracticeInterviewFromSearch.tsx` reads `focus` and `lang` with `useSearchParams()` inside a `Suspense` boundary and applies the same rules as before (`focus` at most 160 characters, `lang` only `en` or `ar`, a repeated parameter ignored). The Suspense fallback is the same interview without the two parameters, so the static HTML still contains the full page; the browser applies the parameters on hydration. `/practice/custom` had the same pattern and now uses `CustomRoleStartFromSearch`. `/practice` was already static.
- Guides. `revalidate = 60` is replaced by `revalidate = 86400` as a safety net, with `dynamicParams = true` so a guide published after the build renders on first request and is then cached. `app/api/revalidate/route.ts` verifies the Sanity webhook signature with `@sanity/webhook` (now a direct dependency; `next-sanity/webhook` exports only `parseBody`) against `SANITY_REVALIDATE_SECRET`, then revalidates `/guides`, `/guides/<slug>` and `/sitemap.xml`. Without a slug in the payload it revalidates every guide page. The webhook settings are documented in `.env.example`. Manual step: create the webhook in Sanity and set the secret in Vercel.
- Advert cache. `lib/advert-cache.ts` normalises the pasted advert (lower case, whitespace collapsed, punctuation and symbols removed, trimmed; letters in any script untouched) and hashes it with SHA-256 together with the generation model and `ADVERT_CACHE_VERSION` into `advert:v1:<hash>`. The job title is included in the normalised text because it is part of the prompt. The route looks the key up in Upstash after the per-candidate rate limit and before the daily budget, so a hit spends no budget. On a hit the stored title, industry, competencies and questions are re-signed with `signInterview()`, so the three hour token expiry is unchanged. On a miss the interview is generated, validated and signed as before, then stored for 30 days. Fallbacks (`tailored: false`), rejected interviews and signing failures are never stored. The value never contains the advert text, the candidate session, an IP address or an account. Without Upstash credentials the cache is skipped silently; a Redis error or a call over 1 s counts as a miss. Bump `ADVERT_CACHE_VERSION` whenever the prompt, output schema or validation rules change.
- Model answers. The brief asks for model answers to be pre-generated at build time and never live. The app has no model answers today and nothing generates them live, so there is nothing to move. No generation pipeline was built.
- Arabic. Role content in `lib/roles/*.ts` ships `titleAr`, `industryAr`, `blurbAr`, `textAr`, `hintAr`, `labelAr` and `anchorAr` alongside every English field, all in the bundle at build time. Nothing to change.

Verified here: `tsc --noEmit`, 134 tests passing (`scripts/advert-cache.test.mjs` added to `test:resilience`), `next build` output above, 70 prerendered HTML files under `.next/server/app/practice`. Not verified here: a cache hit against live Upstash and a live Sanity webhook, because this environment has neither.
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

### 2026-09-01, Section 3

| Metric | Before | After | Source |
| --- | --- | --- | --- |
| `transcript_ready_ms` on-device (Web Speech) | measured, no `outcome` property | unchanged path, now tagged `outcome: device` | `components/InterviewFlow.tsx` |
| `transcript_ready_ms` without Web Speech (Firefox, some in-app browsers) | not measured: the candidate was silently switched to typing | tagged `outcome: server` (or `server_failed`); p75 to capture on production | `components/InterviewFlow.tsx`, PostHog |
| Candidates who chose Speak or Video in a browser without live captions | forced to type | speak as normal, audio only is written up on finish, then confirmed in the textarea | this branch |
| Video bytes on the network from practice | zero | zero, now enforced twice (see below) | `lib/audio-capture.ts`, `app/api/transcribe/route.ts` |
| Audio upload size | none | Opus at 24 kbps, about 180 KB per minute of speech; hard cap 6 MB | `lib/audio-capture.ts`, `lib/transcription-upload.ts` |

What changed:

- `POST /api/transcribe` (Node runtime) accepts one `audio` file plus `lang`, transcribes with OpenAI (`TRANSCRIPTION_MODEL`, default `gpt-4o-mini-transcribe`, automatic `whisper-1` fallback if the SDK rejects the model), 20 s budget, private no-store headers, per-IP limit of 20 per 10 minutes. The recording lives in memory for the length of the request; neither the audio nor the words are logged or stored. Without `OPENAI_API_KEY` it returns 503 `transcription_unavailable` and the browser falls back to typing.
- When Web Speech is missing, choosing Speak or Video no longer silently switches to typing. The browser shows "Live captions are not available in this browser. We will write up your words when you finish.", records audio only while the candidate answers, uploads it on finish, shows a "Writing up your words" skeleton, then fills the transcript textarea for the candidate to confirm. In Video mode the local preview still stays on the device exactly as before.
- Recordings are discarded on unmount, on `pagehide`, on retry, on the STAR follow-up and when the answer is completed. Nothing is written to IndexedDB or localStorage.
- Where Web Speech is supported nothing changes except the `outcome: device` tag on the existing timing.

Zero video bytes is enforced at both ends: the fallback recorder opens its own microphone-only stream (`getUserMedia({ audio: true, video: false })`) and refuses a stream that carries a video track, and the endpoint rejects any `video/*` type with 415 before reading the body. Unit tests cover the MIME selection and the server-side MIME and size validation (`scripts/transcription.test.mjs`).

Verified here: `tsc --noEmit`, the full test suite, `next build`, `/practice/[roleId]` within the 200 KB first-load budget. Not verified here: the Firefox fallback path end to end, because this environment has no provider key and no browser. It needs a manual check on the preview deployment: open `/practice/[roleId]` in Firefox, pick Speak, answer, and confirm the skeleton then the written words appear; repeat in Video mode and confirm in the network panel that the only upload is one `audio/*` request to `/api/transcribe`.

## Open items that need production access

All eight sections have code in place. These steps cannot be done from a build environment.

- Baseline: run one day with `NEXT_PUBLIC_FEEDBACK_STREAMING=off`, record p75 figures above, then switch on.
- PostHog: create the dashboard from the event table at the top of this file.
- Section 2: confirm the Supabase project region in the dashboard. Moving functions to Dubai needs the Vercel Pro plan and the project settings page; keep functions and database in the same region.
- Section 2: measure TTFB from Dubai, Riyadh and Doha on WebPageTest after the region change is live.
- Section 3: check the Firefox fallback on a preview as described in the Section 3 entry.
- Section 4: create the Sanity webhook to `/api/revalidate` and set `SANITY_REVALIDATE_SECRET` in Vercel.
- Sections 6 and 7: apply the two migrations with `supabase db push` after review, then run the k6 load test against a preview and read `pg_stat_statements` for statements over 100 ms.
- Section 1 model choice: trial `SCORING_REASONING=low` and a smaller model, gated by `npm run gate:feedback-quality`.
