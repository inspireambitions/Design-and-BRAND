# Nebiyu employer feedback enhancements

Prepared 7 September 2026. Base: 2ddc18a. Branch: codex/nebiyu-enhancements-20260907.

## Implemented locally

- New report versions carry forward the current interviewer name and notes, preserving original authors and dates. Failed copying rolls back the whole version.
- Name and note actions lock the interview before resolving the current report, preventing a stale browser tab from choosing an archived report.
- Current report controls list private links for all versions. The owner can close an older version's link, with its actual version recorded in the access log.
- Saved names have explicit Edit, Save changes and Cancel controls. Note corrections append attributed context identifying the original note; they do not erase it.
- Refresh report wording explains that it uses the same evidence. Failed actions release controls and retain drafts.
- Dashboard labels accurately say All time. Removed the false link-open stage. Actual interview records supply starts.
- Active / Closed or full / All role filters work, with four-row pagination exposing older roles. Candidate and role page selections preserve one another.

## Verification

- Full resilience suite: 475 passed, zero failed, skipped or cancelled.
- Final production webpack build and its TypeScript check passed, generating 122 pages.
- PostgreSQL/PGlite execution verifies copy preservation, original metadata, rollback, current-version edits, ownership denial and service-only execution. Both orderings of edits versus refresh are tested; a real multi-session database race was not simulated.
- Synthetic real-browser component checks passed: save/edit name, first-note correction, retaining original note, old-link closure, failed-request draft recovery.
- Actual component and CSS fit 390px and 1280px with no horizontal overflow. Screenshots are in muqabala/out/evaluation-controls-fixture (gitignored).
- git diff --check passed.

The browser fixture uses fake local actions. It proves interface behaviour, not a hosted authenticated database journey. No real candidate records were changed.

## Release status and order

Not deployed. No live migration applied. Automatic approval review rejected uploading the source to the existing inspire14 Muqabala Vercel project because it requires explicit approval for that external source upload. Do not retry through another route without approval.

After upload approval: create and verify a preview. Apply migration 20260907181818_preserve_evaluation_reviewer_context.sql to the intended database before releasing the updated actions, because they call its two new RPCs. Verify with controlled synthetic data, then promote only within authorised release scope.

The migration adds service-only RPCs and replaces the existing version-storage function. It does not delete data, change table policies or expose execution to anonymous/authenticated clients. It preserves context for future revisions; it does not backfill historical versions that already lack context.

## Deliberately separate follow-up work

Optional date range filters, detecting no-change report refreshes, a full version comparison, structured correction links, name-change history and changing archived decision semantics remain separate enhancements. Legacy interviews retain the existing explanation and saved-recordings route. No scoring implementation changed.

## Repeat local browser checks

Run from muqabala:

    node scripts/build-evaluation-controls-fixture.mjs
    node scripts/serve-evaluation-controls-fixture.mjs 3118

Open http://127.0.0.1:3118 with playwright-cli. Run scripts/verify-evaluation-controls-browser.js via run-code --filename, then scripts/verify-evaluation-controls-layout.js. Fixtures contain synthetic data only.
