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

## Sections not started

- Section 2, Middle East edge region: needs Vercel project settings and the Supabase region check. Do not migrate Supabase without confirmation.
- Section 4, build-time generation: `/practice/[roleId]` currently renders on demand; no model answers; no advert-hash cache.
- Section 5, page weight: no bundle budget in CI; `components/InterviewFlow.tsx` is the largest client module.
- Section 6, employer side: the report page runs per-request queries and signs video URLs on load.
- Section 7, database: `pg_stat_statements` and pooling need Supabase access.
