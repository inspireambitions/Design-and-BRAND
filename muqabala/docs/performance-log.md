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

## Sections not started

- Section 2, Middle East edge region: needs Vercel project settings and the Supabase region check. Do not migrate Supabase without confirmation.
- Section 3, on-device transcription: Web Speech with typing fallback exists; audio-only server fallback does not.
- Section 5, page weight: no bundle budget in CI; `components/InterviewFlow.tsx` is the largest client module.
- Section 6, employer side: the report page runs per-request queries and signs video URLs on load.
- Section 7, database: `pg_stat_statements` and pooling need Supabase access.
