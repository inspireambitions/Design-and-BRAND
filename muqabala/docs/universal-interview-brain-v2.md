# Universal Interview Brain V2

Status: implemented behind a release flag. Not production-ready.

The V2 engine is a separate, text-scored competency interview path at `/practice/universal`. Candidates can type or record an optional local video. It does not replace the live Coach path until the human evaluation gate passes.

## What is implemented

- deterministic JD quality gate, injection stripping and answer prechecks
- candidate-set seniority and a mandatory five-competency confirmation step
- four JSON role packs: Front Desk Agent, Software Engineer, Sales Manager and Graduate Trainee
- an eight-question planning pool, reduced to six balanced questions for entry roles and kept at eight for higher levels
- encrypted Evidence Ledger, coverage matrix, transcript store and interview state
- separate account-link table, approved 90-day maximum retention and immediate candidate deletion
- deterministic sufficiency rules, dedupe, two-probe limit and executive ownership-probe limit
- a hard two-model-call budget shared by extraction, validation retry and question generation
- end-only feedback with code-owned bands and one optional retry
- optional two-minute camera rehearsal using `getUserMedia` and `MediaRecorder`
- local-only video playback with a temporary audio-only transcription request
- typed fallback when permission, recording or transcription is unavailable
- prompt versions, decision logs, stage latency logs and daily operational views
- a 300-turn human gold-set gate and metric evaluator
- feature flag: `NEXT_PUBLIC_UNIVERSAL_BRAIN_V2=on`

## Server flow

1. `POST /api/universal-interview/discover` runs the JD gate and P1.
2. `POST /api/universal-interview/confirm` requires exactly five known competency ids and runs P2.
3. `POST /api/universal-interview/turn` runs prechecks, T1, the code decision table and T2 only when needed.
4. `POST /api/universal-interview/feedback` runs F1 after completion.
5. `POST /api/universal-interview/retry` accepts one replacement answer.
6. `DELETE /api/universal-interview/[id]` immediately deletes the encrypted record and linked logs.

All mutating routes require the same origin, ownership, shared rate limits and an expiring database claim. A duplicate request cannot process the same interview at the same time.

## Release gate

Keep the feature flag off until all of these are complete:

1. Apply `20260902120000_universal_interview_brain_v2.sql` to an isolated staging Supabase project.
2. Add `UNIVERSAL_INTERVIEW_DATA_KEY` as a server-only secret.
3. Add a named reviewer and review date to every role pack.
4. Build at least 300 human-reviewed turns with two independent raters.
5. Reach at least 80% rater agreement.
6. Run `npm run gate:universal-gold`.
7. Produce model results and run `npm run eval:universal`.
8. Pass the targets in the approved specification.
9. Run 30 external candidate tests.
10. Verify P95 latency from `universal_interview_metrics_daily`.

The repository contains four starter cases only. The gate fails by design until the human set exists.

## Approved product defaults

1. Candidate interview data expires after no more than 90 days.
2. ENTRY interviews use six questions. PROFESSIONAL, MANAGER, SENIOR_MANAGER and EXECUTIVE interviews use eight.
3. P1, P2, T1, T2 and F1 default to `OPENAI_SCORING_MODEL`. Each remains separately configurable.
4. Every role pack must have an author, reviewer and review date before launch. Reviewers are not invented or assigned without their agreement.
5. One retry is free.

## Product Council check

- Mariam: the English-only boundary is explicit. Arabic is deferred by the approved MVP scope. Data residency still needs live staging verification.
- Rohit: typing remains the low-bandwidth default. Optional video stays on the device. Agency and bulk workflows are outside Coach V2.
- Layla: the blueprint is confirmed before Question 1, feedback waits until the end, and one retry is available.
- Priya: content units drive coverage. Schema validation, deterministic bands, evidence ids and fairness pairs are gated. The 300-turn set is still missing.
- Daniel: the engine is role-independent and supports an unknown-role fallback. Publishable proof cannot be claimed before the gate passes.
- Fatima: candidate identity is separated from encrypted practice state. Immediate deletion exists. The approved retention period is 90 days; live staging still needs legal and residency verification.

## Current verification

- focused V2 tests pass
- the complete repository regression suite passes
- TypeScript passes
- the Next.js production build passes with webpack
- the gold-set gate fails because only four starter cases exist
- production dependency audit still reports inherited advisories through Sanity tooling and `fast-uri`; no dependency versions were changed in this build
