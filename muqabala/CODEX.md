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
| `OPENROUTER_API_KEY` | No | **Primary provider (approved architecture).** Present → answers scored via OpenRouter using `SCORING_MODEL`. Takes precedence over the Anthropic key. |
| `SCORING_MODEL` | No | OpenRouter model slug for scoring. Defaults to `openai/gpt-5.6-sol` (verified slug). Changing the model requires re-running `scripts/measure-consistency.mjs` before trusting its scores. |
| `ANTHROPIC_API_KEY` | No | Alternative provider: direct Anthropic API (`claude-opus-5`). Used only when no OpenRouter key is set. |
| `SCORING_REASONING` | No | Reasoning effort for the OpenRouter path: `low`/`medium`/`high`. Defaults to `medium`; benchmark against `high` with the consistency gate before changing. |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | Enables anonymous usage analytics (PostHog EU). Events are only the explicit calls in `lib/analytics.ts` — role ids, language, scores, ratings. Never transcripts, typed job titles, video, audio, or personal data. Autocapture, pageviews and session recording are disabled. The pre-interview disclosure covers this collection. |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | PostHog host; defaults to `https://eu.i.posthog.com`. |

With no key at all, the offline **structure checker** runs (English only, labelled as such in
the UI) and Arabic answers are declined with an explanation. The interview flow works end to
end without a key, but scoring is structural, not a competency assessment.

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

**This is product one of two.** The same scoring engine later powers **Muqabala Screening**,
a B2B employer product built to displace Spark Hire in the Gulf. Coach ships first because
it has no sales cycle, earns revenue immediately, and calibrates the scoring rubrics on real
accents and answers before the first employer demo. Do not build employer features into the
coach unless explicitly asked.

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
3. **Nothing leaves the device without saying so.** What actually leaves: the **transcript**
   (to `/api/score`, and onward to Anthropic when a key is set), and the **audio** when
   voice-to-text runs without confirmed on-device recognition — browser speech recognition
   sends audio to the browser vendor's service by default. The video is never uploaded.
   The UI states exactly this and offers typing instead. Two earlier versions got this
   wrong ("nothing leaves your phone", then "your audio never leaves this device") and both
   were caught in review. If you change what is sent, change the copy in the same commit.
4. **AI recommends, humans decide.** Never build automated rejection.
5. **Feedback must be actionable and specific.** Every improvement must quote or reference
   what the candidate actually said and be doable on the next attempt. No generic advice.
6. **No dark patterns.** No fake urgency, no hidden retake limits, no score inflation to
   drive upgrades.

---

## 4. Architecture

Deliberately minimal so it could ship in a day. **No database, no auth, no file storage.**

```
muqabala/
├── app/
│   ├── layout.tsx              # fonts, LanguageProvider, metadata
│   ├── page.tsx                # landing → HomeView
│   ├── globals.css             # ALL styling — design tokens + components, light & dark
│   ├── icon.svg                # favicon
│   ├── practice/[roleId]/      # the interview itself (prerendered per role)
│   ├── progress/               # attempt history from localStorage
│   └── api/score/route.ts      # the only server code: scoring
├── components/
│   ├── LanguageProvider.tsx    # EN/AR context, sets <html dir> for RTL
│   ├── TopBar.tsx, HomeView.tsx, ProgressView.tsx
│   ├── InterviewFlow.tsx       # the state machine — the heart of the app
│   ├── FeedbackCard.tsx, ScoreRing.tsx
└── lib/
    ├── roles/                  # the catalogue, split by industry group
    │   ├── shared.ts           # types, competency sets, q() helper, opener/closer
    │   ├── hospitality.ts      # hospitality, F&B, aviation
    │   ├── trades.ts           # construction and trades
    │   ├── operations.ts       # logistics, retail, facilities, beauty
    │   ├── care.ts             # healthcare and domestic care
    │   ├── office.ts           # corporate, finance, sales, education, tech
    │   ├── industrial.ts       # oil, gas & energy, automotive
    │   ├── creative.ts         # marketing, design, photography
    │   ├── custom.ts           # the catch-all interview for any job
    │   └── index.ts            # assembles ROLES, getRole, INDUSTRIES
    ├── scoring.ts              # types + the deterministic heuristic scorer
    ├── speech.ts               # Web Speech API dictation wrapper
    ├── i18n.ts                 # all UI strings, EN + AR
    └── storage.ts              # localStorage read/write
```

**Stack:** Next.js (App Router) + TypeScript + hand-written CSS (no Tailwind — one less
build dependency). `@anthropic-ai/sdk` + `zod` for structured scoring output.

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

Two interchangeable paths behind one response shape (`AnswerFeedback`):

- **AI path** — `claude-opus-5` via `client.messages.parse()` with a zod schema, so the JSON
  always validates. Uses the role's competency rubric anchors from `lib/roles.ts`.
- **Demo path** — `demoScore()`, a deterministic heuristic scorer. Rewards specific situations,
  first-person ownership ("I" vs "we"), concrete numbers, and a stated outcome; penalises
  vagueness, filler and rambling. Verified to separate a weak answer (35) from a strong
  one (93) on the same question.

Any AI error, refusal, or missing key silently falls back to the demo scorer. The UI always
labels which one produced the score.

---

## 5. Known gaps / roadmap

**Shipped:** 69 roles across 20 industries plus a catch-all interview for any job, bilingual EN/AR with RTL, camera + live transcript,
unlimited retries, evidence-based feedback, progress tracking, works with or without an API key.

**Deliberately not built yet** (in rough priority order):

1. **Arabic heuristic scoring.** The heuristic scorer is English-only. Arabic answers are
   currently *gated*, not scored: `route.ts` detects Arabic (via the `lang` field or Arabic
   script in the transcript) and returns `arabicUnavailable()` — an honest Arabic explanation —
   rather than a near-floor score. With a key set, Arabic reaches Claude properly. **Next step:**
   add Arabic-aware heuristics (first-person markers, Arabic-Indic digits ٠-٩, outcome
   connectives) so demo mode works in Arabic too, then remove the gate. Do not remove the gate
   before the heuristics exist — an unfair score is worse than an honest refusal.
2. **Payments.** No Stripe/Paddle yet — everything is free. Pricing plan: free first mock,
   AED 29 role pack, AED 79 unlimited 30 days.
3. **Accent benchmark.** Priya's non-negotiable: measure transcription word-error rate per
   accent group and publish it. Not started.
4. **Scoring consistency measurement.** Run the same answer N times, publish the variance.
5. **Analytics** (PostHog), error tracking (Sentry), WhatsApp share links.
6. **Server-side persistence.** localStorage means history is lost if the user clears their
   browser. Supabase is the intended destination when accounts are added.

---

## 6. Working with the advisory board

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
