# Employer volume build: current state and changes

Working record for the employer volume brief. Written before any code, then updated after each section. British English. No em dashes.

## Current state

### What a "role" is

There is no `roles` table. A role is a row in `public.screening_packs`. Each pack holds one signed three-question interview (`signed_token`, kind `proof`), the company name (`workplace`), an optional recruiter name inside the token, a public code, an expiry, a candidate capacity (`max_candidates`, `starts_used`) and the owning `employer_id`. Everything in this brief that says `role_id` maps to `screening_packs.id`.

Packs are created from `/for-employers` in three calls: `POST /api/screening/job-description` (optional draft), `POST /api/interview` (tailored eight-question interview from the advert, returns a practice token), then `POST /api/screening/packs`, which cuts the interview to three questions with `proofQuestions`, re-signs it as a proof pack and inserts the row. The candidate link is `${origin}/s/${public_code}`.

### Candidate flow

`/s/[code]` resolves the pack, asks the candidate to verify an email (`/api/screening/auth/*`), then runs `EmployerVideoInterview`: name, device check, three video answers of up to 120 seconds, consent (`employer-video-v1`), submit. Writes go through service-role RPCs: `start_screening_interview` (11-argument overload, keyed by `(pack, candidate_user_id)` and an idempotency hash), `save_screening_video_answer`, `submit_screening_interview`. Videos live in the private `screening-videos` bucket. Submit sets `expires_at` to 90 days and enqueues two rows in `screening_notification_outbox` (candidate receipt, employer alert).

One candidate is one row in `public.interviews` with `mode = 'screening'`, `screening_pack_id`, `candidate_name`, `candidate_user_id`, `submitted_at`, `consented_at`, `locked_at`. Answers are rows in `public.interview_answers` with `video_path`, `video_upload_status`, `transcript` and `feedback jsonb`.

### Scoring and rubric evidence

`/api/score` writes `AnswerFeedback` into `interview_answers.feedback`. It contains `competencies: { id, label, score 0 to 10, evidence: string | null }[]`. `evidence` is a quoted line from the candidate, or null when nothing in the answer demonstrates that competency. At submit, `buildReportSummary` copies each answer's feedback into `interviews.report_summary`. The employer report today renders headline, a score out of 100, strengths and improvements. Competency evidence is stored but not shown.

A generated role has three to five competencies. There is no fixed set of four.

### Employer review and decisions

`/employer` lists packs the employer owns (RLS: `auth.uid() = employer_id`) with counts from `lib/employer-dashboard.ts`. `/employer/interviews/[id]` shows one submitted candidate: videos via 15-minute signed URLs, transcripts, AI block. Decisions are two server actions in `app/employer/actions.ts`, `reviewInterview` and `setEmployerDecision`, writing three columns on `interviews`: `employer_reviewed_at`, `employer_decision` (`shortlisted` or `not_proceeding`), `employer_decided_at`. There is no decision log, no reviewer id, no note, no undo.

### Auth

Passwordless: `POST /api/auth/request` sends an OTP and a magic link; `/auth/confirm` verifies `token_hash` and redirects to a safe `next`. `/auth/screening-confirm` does the same for candidates and lands on `/s/{code}`. A land-on-page magic link pattern therefore already exists and can be reused.

### Background work

Vercel crons in `vercel.json`, authenticated with `Authorization: Bearer ${CRON_SECRET}`: `/api/cron/screening-cleanup` (daily) and `/api/cron/screening-notifications` (daily, also run opportunistically with `after()`). Email goes through Resend from `Muqabala <hello@auth.trymuqabala.com>` using `RESEND_TRANSACTIONAL_API_KEY`. Queues are Postgres outbox tables claimed with `FOR UPDATE SKIP LOCKED`. Rate limiting is Upstash with an in-memory fallback (`lib/rate-limit.ts`).

### Providers

Email: Resend, configured. WhatsApp: none. The only WhatsApp use is a `wa.me` deep link for the coaching CTA. Payments: none. `ROLE_PRICE` is not set.

### Analytics

`track(event, props)` in `lib/analytics.ts` posts to PostHog when `NEXT_PUBLIC_POSTHOG_KEY` is set. Props are whitelisted; names, emails, phone numbers, transcripts and job titles are never sent. New events must be added to the `EventName` union.

### Public paths already taken

`/s/[code]` is the candidate work-sample page. `/share/[token]` is the candidate practice report share. Neither is free for a new public route.

### Feature flags

Env-driven booleans, read with `process.env` on the server and passed as props to client components. `NEXT_PUBLIC_*` values are baked at build time.

## Changes to existing behaviour required by this brief

Listed before building, as the brief requires.

1. **Share route path.** The brief specifies `/s/[token]` for the shared candidate page. That path is the live candidate interview route and cannot be reused. The share page is built at `/c/[token]` instead.

2. **Candidate identity per invite.** The candidate flow today identifies a candidate by verified email. An invite link needs to bind the resulting interview to a `role_invites` row so status, reminders and the shortlist email work. The invite link is `${origin}/s/${public_code}?i=${invite_token}`. `POST /api/interviews` (screening start) accepts an optional invite token, verifies it against the hashed token on the invite, and stamps `interviews.invite_id` and `role_invites.started_at`. Submit stamps `role_invites.submitted_at`. Candidates who arrive by the plain link without a token behave exactly as today.

3. **Decision log.** The brief needs reviewer id, timestamp, decision, note and a 10-second undo. A new table `employer_decisions` becomes the log. To keep the existing dashboard counts working, the existing `interviews.employer_decision` and `employer_decided_at` columns are written through from the latest log row and cleared on undo. Decision values become `shortlist`, `pass`, `later`; the existing `shortlisted` and `not_proceeding` values are mapped for old rows when read.

4. **Rubric coverage of four.** Roles have three to five competencies. Coverage shows the first four competencies of the role in order, each a tick when at least one of the three answers has non-null evidence for it, else a cross. A role with three competencies shows three items. No number out of 100 appears on any new surface.

5. **Sample report image path.** Section 1.2 names `/public/samples/employer-report.png`. The earlier brief used `/public/marketing/employer-sample-report.png`. The new path is used and the old lookup removed.

6. **Hero copy.** The headline "223 applications. Seven worth your time. 48 hours." is a framing supplied by the brief, not a measured figure. It is shipped as written behind the flag. Note this against the earlier rule of no invented statistics.

7. **Flag scope.** `EMPLOYER_VOLUME` gates every new surface including the Section 1 hero and layout changes, so that with the flag off the site is unchanged.

## Provider decisions

- `WHATSAPP_ENABLED` defaults to `false`. No provider exists. The channel row, per-channel response rate and WhatsApp reminders are built behind the flag and never render or send while it is false. Email is built fully.
- Section 6 (pricing) is skipped because `ROLE_PRICE` is not set. Noted again in the section log below.
- No email client preview tooling exists. A non-production preview route `/dev/email/shortlist` is added for Section 4.1.

## Section log

Updated after each section is committed.
