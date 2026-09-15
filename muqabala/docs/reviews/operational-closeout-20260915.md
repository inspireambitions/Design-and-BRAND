# Muqabala operational closeout

Date: 15 September 2026  
Production branch at start: `claude/gulf-hospitality-video-interview-m9skfu`  
Production commit at start: `52dc3dc`  
Closeout branch: `codex/ops-closeout-20260915`

## Executive result

The production application is reachable, its latest deployed commit has a successful Vercel status, the database is healthy, the dependency audit reports no known vulnerabilities, and the full local regression suite passes. The previously broken `npm run lint` command is repaired for Next.js 16. An authenticated employer test proved the candidate panel, signed recording playback, and unsaved-note warning. That test also found a small scroll-position drift when the panel closed; the closeout branch now restores the exact stored coordinates and includes a regression assertion.

This document does not declare the entire pilot gate closed. Several items require evidence or authority that cannot be manufactured by a software run: physical iPhone and Android devices, five real testers, Sanity write authentication, a paid isolated backup-restore project, Schools pilot inputs, and access to the production Vercel team's runtime error data.

## Release checks

| Check | Result |
|---|---|
| `npm run lint` | Pass, 0 errors and 85 warnings. The warnings remain visible as legacy follow-up; four React Compiler rule groups are warnings rather than release-blocking errors. |
| `npm run typecheck` | Pass. |
| `npm run test:resilience` | Pass, 551 of 551 tests. |
| `npm run test:copy-quality` | Pass, 9 of 9 tests. |
| `npm run test:practice-plan` | Pass, 27 of 27 tests. |
| `npm run build` | Pass, 136 static pages generated. |
| `npm run check:bundle` | Pass across all 69 catalogue pages; `/practice` is 180.2 KB gzipped and `/practice/accountant` is 200.0 KB, strictly below the configured limit. |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities. |
| `npm run test:interaction-browser -- https://trymuqabala.com` | Pass at 390 px English/Arabic, RTL, reduced motion, FAQ disclosure and desktop practice entry. |

## Authenticated employer and candidate evidence

The production owner account showed eight roles and one submitted controlled-test candidate. Opening that candidate in the side panel retained the dashboard URL, loaded only employer-authorized evidence, and exposed seven submitted answers. Pressing Play produced a ready, error-free video element whose signed source was served by the configured Supabase host. Entering an unsaved test note and attempting to close produced the confirmation warning; no hiring decision was submitted and the note is not persisted without a decision.

The first close test recorded a 29.5 px focus-related scroll drift. `EmployerCandidatePanel` now captures `window.scrollX/window.scrollY` before opening, restores focus with `preventScroll`, and restores both coordinates on close. `scripts/interaction-improvements.test.mjs` asserts this contract. A post-deployment browser rerun is required to measure exact zero-drift behavior on production.

A separate controlled production role was created for the recovery journey. Chrome completed email verification, camera/microphone permission, a local sample recording, secure upload, refresh recovery, and three uploaded/scored answers. One follow-up recording repeatedly entered the truthful “recording kept, transcription needs attention” state. The database confirms the three stored answers are uploaded, timestamped and scored; the controlled interview remains in progress and was not presented as a completed submission.

Clipboard success was exercised and displayed “Link copied.” Clipboard-rejection fallback remains covered by source assertions but could not be forced reliably in the authenticated Chrome session. No physical iPhone, iPad or Android device is attached to this Mac, and `adb` is not installed. The iPhone 17 Pro simulator rendered the live Safari candidate page at phone width; simulator evidence is not physical-device evidence.

## Incident ledger status

| Priority | Item | Current evidence and status |
|---|---|---|
| 1 | Blocked employer report | **Open.** Interview `8e95d8ea-e2e4-484b-97a0-2fc55554e165` still has three uploaded original recordings without genuine transcript segments (question indexes 14, 17 and 19). A report cannot be generated safely until those recordings are re-transcribed with real timestamps. No timestamps were invented. |
| 2 | Recorded HTTP 504 | **Not reproduced as a 504.** The controlled run did reproduce a recoverable transcription-attention state, while refresh retained the recording. Production runtime logs are needed to identify the historical 504's exact provider/request cause. |
| 3 | Scoring failures | **No active completed-answer failure found in the database snapshot.** The new controlled answers are scored. Four submitted historical interviews have no report; three are legacy/untimed and one is the specific three-segment recovery case above. |
| 4 | Upload recovery and full phone journey | **Partial.** Upload, server acknowledgement and refresh retention were proved in desktop Chrome; responsive Safari was proved in the iOS simulator. Physical iPhone interruption, Android Chrome recovery, final submission, notification delivery and employer playback of that same new submission remain unproved. |
| 5 | Schools feedback accuracy | **Code is reviewed, but operational gate remains open.** Pull request 21 is mergeable and all CI/Vercel checks pass. It is intentionally not merged without approved pilot inputs and populated end-to-end evidence. |
| 6 | Security maintenance | **Application dependencies pass.** `npm audit` reports zero vulnerabilities. Supabase's current security advisor still warns that leaked-password protection is disabled; this is an account-level setting, not a package finding. |
| 7 | Backup and Schools jobs | **Open.** The existing staging branch has no production data and is not a restore proof. Supabase prices a separate project at USD 10 per month for this organisation; creation requires explicit cost approval. Schools mail, privacy-job and receipt tables are empty, so empty cron runs cannot prove delivery or deletion. |
| 8 | Stored CMS spelling | **Open and exactly scoped.** The read-only Sanity dry run found 20 guides needing changes: 19 `body` fields and one guide's `excerpt` plus `body`. Applying the audited patch requires a Sanity user token/owner session. |
| 9 | Controlled pilot | **Open.** No evidence of five completed monitored human testers exists. Software automation and a simulator cannot replace this gate. |

## Platform access findings

- GitHub reports the production commit's Vercel deployment as successful.
- The connected Vercel integration exposes only `Kim K's projects`. A direct runtime-error query against the `inspire14` Muqabala project returns HTTP 403, so the historic grouped errors cannot be declared gone from Vercel telemetry.
- The production Supabase project is active and healthy on PostgreSQL 17.6. All public tables inspected have row-level security enabled.
- The production snapshot contains 121 interviews, 423 answers, 28 screening packs and 14 evaluation-report rows representing 13 interviews.
- Screening notification jobs in the inspected snapshot are accepted. Schools operational mail/retention evidence is empty.

## Changes in this closeout branch

- Replaced the removed Next.js 16 `next lint` command with ESLint 9 flat configuration using the matching Next.js 16.3.3 rules.
- Added compatible development dependencies `eslint@9.39.2` and `eslint-config-next@16.3.3`.
- Corrected seven JSX apostrophe errors and replaced three internal anchors with Next.js `Link` components so lint has zero errors.
- Added exact employer-panel scroll restoration and a regression assertion.
- Added this evidence report.

## Gates that require the owner

1. Authorize a USD 10/month isolated Supabase project before running a real restore drill. Never restore over production merely to prove backups.
2. Authenticate the Sanity CLI with an owner-capable account, review the 20-document dry-run list, then run the existing `--apply` mode and its verification.
3. Reconnect the Vercel integration to the `inspire14` team so grouped runtime errors and logs can be queried.
4. Supply the Schools pilot institution/contact, adult-only confirmation, languages, approved roles/questions/rubrics, DPA/supplier approvals, dates, success thresholds, AI budget/stop rule and paid-offer decision before merging pull request 21 and seeding operational tests.
5. Connect a physical iPhone and Android phone and identify five consenting testers before those evidence gates can be closed.

## Safety notes

- No production report timestamp, score, candidate evidence or pilot result was fabricated.
- No real candidate was shortlisted, rejected or annotated during testing.
- No production database restore was attempted.
- No paid project, API key, persistent credential or public CMS edit was created without explicit authorization.
