# Student feedback fixes, 8 September 2026

Scope: Schools staging only. Existing employer and personal practice paths are unchanged.

## Changes

1. Feedback starts on opening a submitted attempt. A separate authenticated, owner-filtered status endpoint checks every four seconds without calling the AI provider. Ready feedback appears without reloading. Waiting, delayed, failed and expired-session states give clear next steps. Automatic waiting stops after two minutes; a student can check again. This is a waiting allowance, not a measured speed promise.
2. The feedback retry button creates a separate prefilled draft directly. The retry URL does the same, then focuses the chosen question. Both preserve submitted attempts and their reviews.
3. Navigation checks the signed-in user's cohort assignment. Students see no Cohorts link. The cohort list rejects users without an assigned cohort.
4. Form fields inherit the page font. Narrow containers, headings and fields wrap within the viewport.
5. Feedback instructions require short, plain action sentences and prohibit the reported jargon. New outputs record contract schools-text-evidence-v3. Historical feedback stays unchanged.
6. Student feedback shows confidence only when medium or low. The adviser review retains every confidence value.
7. Confirmed wording disagreement on the controlled fictional Q3: the answer explicitly describes the tutor's criticism and later praise, all four elements are present, but the improvement asks what feedback was given. This is an improvement-text error, not a missing-evidence error. Logged here for adviser review; no evidence values or historical reviews were changed. The new instructions require checking all excerpts and avoiding requests for details already supplied.
8. Enrolment shows indeterminate progress immediately and a longer-wait message after ten seconds. The request times out after 45 seconds and retains the code for retry.

## Verification

- TypeScript passed.
- 541 regression tests passed, zero failures.
- Production webpack build passed.
- Browser check: 848px and 375px enrolment, no horizontal overflow; visible progress; simulated delayed failure retains the code.
- Browser check: student Cohorts link absent; direct request returns 404.
- Browser check: simulated pending-to-ready feedback appears without reload; high confidence hidden and medium confidence retained.
- Browser check against real synthetic staging storage: retry button and retry URL each create one draft, preserve the prior submitted attempts and keep answers prefilled.
- Feedback status rejects an inaccessible attempt.

Evidence: docs/evidence/schools-student-ux-fixes.json. Browser emulation does not replace physical iPhone and Android acceptance. Hosted deployment and real-model regression results will be appended below.
