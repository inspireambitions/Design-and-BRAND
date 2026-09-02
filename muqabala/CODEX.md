# Muqabala — handover for Codex (or any AI collaborator)

Read this file first. It is the single briefing that lets another agent build on this
project or supervise work without re-deriving the strategy.

---

## 1. Getting access

The project lives inside the `inspireambitions/Design-and-BRAND` repository, in the
`muqabala/` directory, on branch `claude/gulf-hospitality-video-interview-m9skfu`.

```bash
git clone https://github.com/inspireambitions/Design-and-BRAND.git
cd Design-and-BRAND
git checkout claude/gulf-hospitality-video-interview-m9skfu
cd muqabala
npm install
npm run dev          # http://localhost:3000
```

To give Codex access, grant it the repository (GitHub → repo → Settings → Collaborators,
or connect the repo in the Codex/ChatGPT GitHub connector). Point it at `muqabala/CODEX.md`
as its entry point.

> **Planned move:** this app is staged inside `Design-and-BRAND` only because the
> automation that created it could not create a new repository. The intended long-term
> home is a dedicated `inspireambitions/muqabala` repo. When that repo exists, move the
> `muqabala/` directory to its root — nothing in the code depends on the current path.

**Environment variables** — copy `.env.example` to `.env.local`:

| Variable | Required? | Effect |
|---|---|---|
| `OPENAI_API_KEY` | No | **Production primary.** Direct OpenAI project key for scoring. Takes precedence over OpenRouter and Anthropic. Store only in `.env.local` and Vercel, never in Git or chat. |
| `OPENAI_SCORING_MODEL` | No | Direct OpenAI model id. Defaults to `gpt-5.6-sol`. Changing it requires the live consistency gate. |
| `OPENROUTER_API_KEY` | No | Optional fallback provider. Used only when no direct OpenAI key exists. |
| `SCORING_MODEL` | No | OpenRouter model slug. Defaults to `openai/gpt-5.6-sol`. |
| `ANTHROPIC_API_KEY` | No | Alternative provider: direct Anthropic API (`claude-opus-5`). Used only when neither OpenAI nor OpenRouter is configured. |
| `SCORING_REASONING` | No | Reasoning effort for OpenAI and OpenRouter: `low`/`medium`/`high`. Defaults to `medium`; benchmark changes with the consistency gate. |
| `OPENROUTER_RPM_LIMIT` | No | Local per-instance OpenRouter traffic ceiling. Defaults to 9, below the current new-account limit of 10 RPM. The live consistency gate is also paced by default. |
| `UPSTASH_REDIS_REST_URL` | Production | Upstash REST endpoint used for deployment-wide candidate and AI generation limits. Server-only. |
| `UPSTASH_REDIS_REST_TOKEN` | Production | Upstash write token used by the shared limits. Server-only. Never expose it through a `NEXT_PUBLIC_` variable. |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | Enables anonymous usage analytics (PostHog EU). Events are only the explicit calls in `lib/analytics.ts` — role ids, language, scores, ratings. Never transcripts, typed job titles, video, audio, or personal data. Autocapture, pageviews and session recording are disabled. The pre-interview disclosure covers this collection. |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | PostHog host; defaults to `https://eu.i.posthog.com`. |
| `SENTRY_DSN` | No | Enables server-only technical error reporting. `lib/sentry-server.ts` strips requests, users, breadcrumbs, contexts and extras. Scoring events contain only route, provider, model, status and failure code. |
| `RESEND_FEEDBACK_API_KEY` | Production | Sending-only Resend key restricted to `auth.trymuqabala.com`. Sends anonymous ratings and private written suggestions only to `hello@trymuqabala.com`. |
| `FEEDBACK_SHARE_SECRET` | No | Optional dedicated signing key for downloadable anonymous testimonial cards. Falls back to the domain-separated `INTERVIEW_SECRET`. |

With no key at all, the offline **structure checker** runs (English only, labelled as such in
the UI) and Arabic answers are declined with an explanation. The interview flow works end to
end without a key, but scoring is structural, not a competency assessment.

Provider precedence is **direct OpenAI → OpenRouter → Anthropic → no-key structure check**.

**Changing the scoring model or provider is gated, not free:** whatever serves scores to real
users must first pass `scripts/measure-consistency.mjs` (spread and ranking checks, including
the accented-answer fairness check) against a deployment using that model. The provider
abstraction lives in `app/api/score/route.ts` — both paths share one prompt and one
post-processing pipeline, so results stay comparable.

**Commands**

```bash
npm run dev        # local dev server
npm run build      # production build — must pass before any push
npm run typecheck  # tsc --noEmit — must pass before any push
npm run test:resilience # provider, schema, malformed input and privacy failure simulations
npm run start      # serve the production build
```

---

## 2. What this product is

**Muqabala Coach** — AI interview practice for people applying to jobs in the Gulf
(UAE, Saudi, Qatar, Oman, Bahrain, Kuwait). Candidates are typically in the Philippines,
India, Pakistan, Nepal, Kenya, Nigeria and Egypt, on low-end Android phones and prepaid
data, and English is often their second or third language.

The user records answers to real interview questions, gets specific feedback on the
**content** of what they said, and retries until the score climbs.

**This is one of two strictly separated products.** **Muqabala Coach** is private practice.
**Muqabala Screening** is an employer-issued, video-only work sample reached through a
short `/s/[code]` link. Never let an employer see Coach practice or let a candidate see
Screening analysis.

### The two emotional requirements (these are the product spec, not decoration)

1. **Candidates must feel *less* scared, not more.** Every screen is judged on that.
   Unlimited retries, visible progress, plain-language rules, warm and specific feedback.
2. **HR managers must eventually say "I love this tool."** That is the phase-two goal;
   protect it by never shipping anything in the coach that would embarrass the B2B product
   (bias, creepy surveillance, unexplainable scores).

---

## 3. Hard rules — do not violate these

These come from the advisory board that shaped the product. Breaking one is a bug even if
the code works.

1. **Score the content of the answer only.** Never facial expression, emotion, eye contact,
   attractiveness, accent, pronunciation, or grammar fluency. A candidate with imperfect
   English who tells a specific, structured story must score *higher* than a fluent but vague
   speaker. This lives in the system prompt at `app/api/score/route.ts` **and** must stay
   visible to candidates as `scoringPolicy` in `lib/i18n.ts` — a policy users cannot read is
   not a policy.
1b. **Never score a language you cannot score fairly.** If a scoring path cannot judge a
   language properly, decline with an explanation in that language (see `arabicUnavailable`
   in `lib/scoring.ts`). An unfair score is worse than no score.
1d. **Never claim to measure what you cannot measure.** The offline path is a *structure
   check* (`structureCheck` in `lib/scoring.ts`), not a competency assessment, and the UI
   says so. It must also refuse text that games it — a checker that ranks keyword soup above
   a real answer destroys trust the moment a candidate notices. Never present its output as
   role competence.
1e. **Declining is not a zero.** `AnswerFeedback.status` is `'scored' | 'unscored'`. When
   unscored, render no score at all. A zero ring tells a candidate they failed when nothing
   was assessed.
1c. **Never fabricate evidence.** `CompetencyScore.evidence` is nullable. If nothing in the
   answer demonstrates a competency, return null — never quote an unrelated sentence.
2. **Never penalise a candidate for a bad transcript.** Speech recognition is worse on some
   accents. If a transcript is too short or too garbled to judge, say so honestly and score 0
   with an explanation — never assign a low score to a garbled answer.
3. **Nothing leaves the device without saying so.** In Coach, the transcript is sent for
   scoring and browser speech recognition may send audio to the browser vendor. Coach video
   remains local. In an employer-issued Screening interview, the candidate's name, video,
   audio and any browser-generated transcript are uploaded as the candidate progresses.
   The employer can open them only after the candidate gives final consent and submits.
   Screening video is the source evidence. The UI states these facts before device access.
   If you change what is sent, change the copy in the same commit.
4. **AI recommends, humans decide.** Never build automated rejection.
5. **Feedback must be actionable and specific.** Every improvement must quote or reference
   what the candidate actually said and be doable on the next attempt. No generic advice.
6. **No dark patterns.** No fake urgency, no hidden retake limits, no score inflation to
   drive upgrades.

---

## 4. Architecture

The first version shipped without persistence. The live product now has **accounts,
Supabase storage, magic-link/OTP sign-in, and private report sharing**. Coach video remains
local. Employer-issued Screening videos are stored in the private `screening-videos` bucket
and are visible only to the employer that owns the link after final submission. Do not
treat older notes in this file as current if they say there is no database or no video upload.

**Production identity**

- Website: `https://trymuqabala.com`
- Vercel team: `INSPIRE` (`inspire14`, `team_IlZz8UvetUXPtSvI4hPqy6fn`)
- Vercel project: `muqabala` (`prj_mLU2A8yiW61V4a4da54GryoIcSXX`)
- Domains on that project: `trymuqabala.com`, `www.trymuqabala.com`, `muqabala.vercel.app`, plus leftover `muqabala-kim-ks-projects.vercel.app`
- Git: `inspireambitions/Design-and-BRAND`, root directory `muqabala`, production branch `claude/gulf-hospitality-video-interview-m9skfu`
- Git auto-deploy: linked on `muqabala` only. Pushes and pull requests create Preview deployments; merges to the production branch create Production. Leftover INSPIRE project `design-and-brand` (`prj_acAWgVwV7sxVymwHdBsFZvh6Xaw8`) still exists with old aliases such as `design-and-brand-orpin.vercel.app`, but **Git is unlinked** — ignore it; it is not `trymuqabala.com`. Do not pause it (pause would 503 leftover aliases).
- Supabase project: `Muqabala` (`hmaxzpgsefzpflrwzopa`)
- Cursor MCP config: repo-root `.cursor/mcp.json` (Vercel OAuth + read-only Supabase)

**Application tables** (names only): `interviews`, `interview_answers`, `report_shares`,
`screening_packs`, `auth_claims`. Schema lives in `supabase/migrations/`.

```
muqabala/
├── app/
│   ├── layout.tsx, page.tsx, globals.css
│   ├── practice/[roleId]/      # interview
│   ├── s/[code]/               # employer-issued, video-only candidate sitting
│   ├── employer/               # employer-owned submissions and video reports
│   ├── account/                # saved interviews and reports
│   ├── share/[token]/          # time-limited private report links
│   ├── sign-in/, auth/confirm/
│   └── api/
│       ├── score/              # scoring; requires a stored interview when persistence is on
│       ├── interviews/         # create, save answers, report, share, delete
│       ├── interview/          # tailored interview from a job advert
│       ├── screening/          # pack creation, video upload, consent and submission
│       ├── cron/               # Storage API cleanup for expired screening videos
│       └── auth/               # request, verify, sign-out
├── components/                 # InterviewFlow, FullReport, EmailSignIn, marketing
├── lib/
│   ├── roles/                  # catalogue + custom/tailored interviews
│   ├── scoring.ts, scoring-provider.ts
│   ├── interviews.ts, session-draft.ts, storage.ts
│   ├── supabase/               # server, admin, client, config
│   └── server/                 # origin checks, interview access, rate limits
└── supabase/migrations/        # RLS, claims, persistence hardening
```

**Stack:** Next.js (App Router) + TypeScript + hand-written CSS. Anthropic/OpenAI/OpenRouter
for scoring. Zod for structured output. Supabase for auth and interview persistence.
Upstash Redis for shared rate limits in production.

**Adding a role** is pure data: add an entry to the right file in `lib/roles/`, reusing a
shared competency set and the shared `opener`/`closer`. Give it three role-specific questions
with real English and Arabic text. Prioritise by how many people actually interview for the
job in the Gulf, not by even coverage across industries — the catalogue deliberately leans
towards trades, hospitality, logistics and care because that is where the employment mass is.

**The catch-all** (`lib/roles/custom.ts`, surfaced at `/practice/custom`) exists because no
catalogue can list every job. Never remove it in favour of "just adding more roles" — it is
what stops a candidate hitting a dead end. Its next evolution is Daniel Chen's JD→interview
generator: paste a job advert instead of typing a title.

### The interview state machine (`components/InterviewFlow.tsx`)

```
check → prep → record → review → feedback → (next question | retry) → done
```

- `check` — camera/mic test plus the transparency screen (question count, timings, retake rules)
- `prep` — countdown before answering; candidate can start early
- `record` — live transcript via Web Speech API, countdown, video preview (never uploaded)
- `review` — candidate can **edit the transcript** before submitting (this is the fallback for
  every speech-recognition failure, and why the app works even in browsers with no Web Speech API)
- `feedback` — score, per-competency evidence, strengths, improvements, one coach tip
- `done` — whole-interview results, saved to localStorage

### Scoring (`app/api/score/route.ts` + `lib/scoring.ts`)

Four paths behind one response shape (`AnswerFeedback`):

- **Direct OpenAI AI path** — production primary, `gpt-5.6-sol` via the Responses API,
  medium reasoning, strict Zod structured output, with SDK retries and `Retry-After` handling.
- **OpenRouter AI path** — the configured `SCORING_MODEL`, currently GPT-5.6 Sol, with strict
  JSON schema output and server-side Zod validation.
- **Anthropic AI path** — `claude-opus-5` via `client.messages.parse()` with the same Zod schema.
- **No-key path** — the deterministic English-only structure checker. It is clearly labelled
  as writing structure guidance, never as role-competency scoring. Arabic is declined fairly.

**A configured AI provider may never silently fall back to a numeric structure score.** On
429, 503, timeout, credit exhaustion, invalid JSON or schema failure, the endpoint returns a
non-scored error. The browser retains the answer, blocks duplicate submissions, retries
temporary failures twice with a countdown, and offers a manual retry. OpenRouter calls use
bounded `Retry-After` handling and `require_parameters: true`. The fixed-corpus gate is paced
below 10 RPM by default. Provider failures log only technical tags to Sentry; candidate text
is scrubbed before an event leaves the server.

**Rate limiting:** production uses Upstash Redis so every Vercel instance shares the same
per-candidate scoring limit, tailored-interview limit and daily generation ceiling. Candidate
IP addresses are hashed before becoming Redis keys. The Upstash client times out after one
second and falls back to an in-process brake, so a Redis incident does not stop an interview.
Local development also uses the in-process brake when no Upstash credentials are set.

**Direct OpenAI production acceptance gate, 20 August 2026:** `gpt-5.6-sol`, medium
reasoning, five runs per frozen answer against `https://design-and-brand-orpin.vercel.app`,
all served by the AI path. Strong English mean 100.0 (spread 0), medium 78.0 (spread 0),
weak 13.2 (spread 5), accented strong 93.0 (spread 0), strong Arabic 94.8 (spread 7).
Result: PASS. `OPENAI_API_KEY` is configured as a sensitive Vercel variable for Production
and Preview; local development uses the ignored `.env.local` copy. The generated deployment
URL is Vercel-protected, so run future public gates against `https://trymuqabala.com`.

---

## 5. Known gaps / roadmap

### Universal Interview Brain V2

The approved text-only adaptive engine is implemented on branch
`codex/universal-interview-brain-v2-20260902` behind
`NEXT_PUBLIC_UNIVERSAL_BRAIN_V2=off`. Its hand-off and release checklist are in
`docs/universal-interview-brain-v2.md`. Do not enable or merge it as a production
feature until the 300-turn human gold set, open product decisions, staging migration,
external testing and latency gate are complete.

**Shipped:** 69 roles across 20 industries plus a catch-all interview for any job, bilingual EN/AR with RTL, camera + live transcript,
unlimited retries, evidence-based feedback, progress tracking, accounts + Supabase persistence,
private report sharing, employer-issued video work samples with an owner-only Evidence Desk,
optional PostHog/Sentry, and a scoring consistency gate
(`scripts/measure-consistency.mjs`). Works with or without an API key.

**Deliberately not built yet** (in rough priority order):

1. **Arabic heuristic scoring.** The heuristic scorer is English-only. Arabic answers are
   currently *gated*, not scored: `route.ts` detects Arabic (via the `lang` field or Arabic
   script in the transcript) and returns `arabicUnavailable()` — an honest Arabic explanation —
   rather than a near-floor score. With a key set, Arabic reaches the configured AI provider.
   **Next step:** add Arabic-aware heuristics (first-person markers, Arabic-Indic digits ٠-٩, outcome
   connectives) so no-key mode works in Arabic too, then remove the gate. Do not remove the gate
   before the heuristics exist — an unfair score is worse than an honest refusal.
2. **Payments.** No Stripe/Paddle yet — everything is free. Pricing plan: free first mock,
   AED 29 role pack, AED 79 unlimited 30 days.
3. **Accent benchmark.** Priya's non-negotiable: measure transcription word-error rate per
   accent group and publish it. Not started.
4. **Published scoring-variance report.** The measurement script and a live acceptance gate exist;
   a public-facing variance write-up is not shipped.
5. **Richer Gulf interview guides.** `/blog` exists as a marketing stub, not a guide library.

---

## 6. Working with the advisory board

The formal **Product Council** charter, operating rhythm and active mandates live in
[`docs/product-council.md`](./docs/product-council.md). Use it when evaluating significant
product bets or reviewing external tester feedback.

Product decisions on this project are reviewed against six standing advisors. When Codex is
asked to **supervise** or review work, evaluate against their non-negotiables and say which
are met, missing, or not yet applicable:

| Advisor | Vantage point | Cares about |
|---|---|---|
| **Mariam Al-Suwaidi** | Group HR Director, Riyadh | Arabic parity, nationalization (Nitaqat/Emiratisation), data residency, no extra logins |
| **Rohit Menon** | Dubai volume-recruitment agency | Bulk/agency workflows, WhatsApp journey, resumable low-bandwidth uploads |
| **Layla Haddad** | Candidate-experience researcher | Practice-until-ready, transparency up front, feedback to everyone, candidate dignity |
| **Priya Nair** | AI product lead | Accent robustness, scoring consistency, quoted evidence, anti-cheat as signals not rejections |
| **Daniel Chen** | SaaS go-to-market | Free top-of-funnel hook, pilot playbook, publishable proof metrics, self-serve pricing |
| **Fatima Al-Farsi** | Employment & data-protection counsel | Consent/retention/deletion as features, per-country question packs, no face or emotion scoring |

## Decisions from the first outside-adviser feedback (August 2026)

A trusted adviser reviewed the live app. What we took, and what we decided:

- **Question bank + rotation (built).** He found that practising a role twice gives
  the identical five questions — a real defect in the "practise until ready"
  promise. Catalogue roles now carry a shared bank per competency family
  (`lib/roles/banks.ts`); each attempt draws a fresh set (`lib/interview-draw.ts`),
  deterministically, seeded by the device's completed attempts. Scoring accepts
  bank ids; a drawn question can never 404. Attempt one always gets the curated
  core set. Full Interview is now the primary journey: eight questions, one at
  a time, no coaching or scores between questions, and a full report at the end.
  Quick Guided Practice remains available with five questions, immediate
  feedback and retakes.
- **"From anywhere in the world" (built).** He read the app as Gulf-residents-only.
  It is for people anywhere applying TO Gulf jobs — the hero and the meta
  description now say so. This also removed the false "Free first interview"
  claim from the meta description. Full internationalisation was considered and
  deliberately deferred: the Gulf focus is the moat; only two strings couple the
  question set to the Gulf, so widening later is cheap. Do not genericise the
  product to chase "international" before the Gulf position is won.
- **Personal coaching door (built, dormant).** His larger point — people trust
  people; the founder should coach, with the app as the assistant. We are not
  betting the product on it, but the results screen now shows an optional
  "ask about coaching" card that opens the candidate's own WhatsApp. It renders
  ONLY when NEXT_PUBLIC_COACHING_WHATSAPP is set, so current deployments are
  unchanged. It also measures demand for the coaching thesis before anyone
  commits to it.
- **Pricing (open).** He warned AED 79 is real money for a candidate earning
  AED 1,500-2,500/month. Unresolved; the standing options are candidate-cheap +
  employer-paid (phase two) or coaching-funded. Do not ship candidate pricing
  without revisiting this.

The full strategy document these came from is the "Beating Spark Hire" board artifact; ask the
project owner for the link if the reasoning behind a decision is unclear.

**Run this review at every stage, not once.** Before shipping any significant change, walk the
six advisors and state for each: what is met, what is missing, what is legitimately deferred to
the B2B product. The first such review caught a fairness defect (Arabic answers scoring ~50
points below identical English ones) and a false privacy claim that had already shipped — both
fixed in commit `8416612`. Be adversarial: verify claims against the code, not against this
document. If a rule here is weaker than an advisor's non-negotiable, the advisor wins and this
document should be corrected.

**Known open items from the last review** (none block English-language testing):
candidates cannot rate the experience; ASR confidence is captured by the Web Speech API but
discarded rather than used to flag shaky transcripts; declined scores render as a `0` ring even
when the headline says "too short to score"; there is no analytics, so completion rate is
currently uncapturable because abandoned interviews write nothing.

---

## 7. House rules for contributions

- `npm run typecheck` and `npm run build` must both pass before any push.
- Work on branch `claude/gulf-hospitality-video-interview-m9skfu` unless told otherwise.
- Match the existing style: hand-written CSS using the tokens in `globals.css`, no new UI
  framework, no new dependency without a stated reason.
- Every user-facing string goes in `lib/i18n.ts` with both an English and an Arabic value —
  never hardcode copy into a component.
- Both light and dark themes must work; define colours as tokens, never inside a media query only.
- Test on a 390px-wide viewport first. Most users are on phones.
