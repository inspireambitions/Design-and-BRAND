# Current release workflow

Updated 7 September 2026. This file supersedes older branch and release status in CODEX.md and historical review notes.

## Source of truth

- Repository: `inspireambitions/Design-and-BRAND`, app directory `muqabala`.
- Vercel project: `muqabala`, team `inspire14`, Root Directory `muqabala`.
- Configured Git production branch: `claude/gulf-hospitality-video-interview-m9skfu`. Keep that branch as the canonical integration target; no force-push or history rewrite.
- Current integration work: `codex/pilot-readiness-20260907`. Merge it through a reviewed pull request into the configured branch once its preview and release checks pass.
- Required ancestors: employer reliability release `b5d6241` and design/spelling release `47a076f`. The design branch alone omitted the 12 employer release commits. They are reunited in this branch.
- Run `node scripts/check-release-ancestry.mjs` before any deployment. Do not deploy another checkout merely because it has the newest-looking branch name.

## Gates

1. Confirm a clean tree and required ancestry. Read the current workspace release record.
2. Run `npm run test:resilience`, `npm run typecheck`, `npm audit` and `npm run build`.
3. Run `npm run check:bundle`. All 69 catalogue routes and practice entry must stay below 200 KB gzipped. The checker reads emitted HTML, including preload hints, and excludes legacy nomodule code.
4. Deploy from the repository root, using the existing Vercel project link. Check the preview before production. Do not move production secrets into preview.
5. Scoring: run the fixed 25-attempt AI consistency gate and the substance-over-padding gate. Require all AI results, no missing or unscored attempts, spread at most 10, and the intended quality ordering. Preserve frozen transcripts and evidence verification rules. Use the tested `SCORING_REASONING=low` setting; configuration is part of the release, not an assumption.
6. Obtain production approval for a new release unless the current task already explicitly authorises it. Deploy the tested commit with production settings, then rerun the public-domain checks and live scoring gates.
7. Record commit, deployment ID, domain, tests, measured bundles and unresolved checks. Update the workspace handoff before ending work.

## Current product behaviour

Coach practice is private. Screening belongs to the inviting employer and uploads video only after the disclosed consent flow. Universal Brain V2 is deployed; verify flags separately in each environment. Never describe implementation as physical-device proof.

Keep the updated report timestamp handling, legacy-report recovery, microphone playback check, transcription retry, invitation transactions, atomic delivery timestamps and fail-closed retention cleanup together. The production database already has the September 5 reliability migrations; inspect migration history before applying anything again.

## Pilot boundary

Five controlled testers precede the remaining 25. Human phone recording, playback listening and feedback usefulness cannot be replaced by automated tests. Use Nebiyu's authorised personal Gmail for the controlled test; keep personal addresses and access links out of committed files. Record each outstanding check as unverified until evidence exists. Technical tests do not establish hiring validity or real candidate outcomes.
