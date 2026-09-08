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

## Additional submission fault found during hosted verification

Clicking Submit immediately after typing could blur the field, start an autosave and disable the button before its click reached the handler. The synthetic Q3 run remained a draft, so no AI request started. The form now keeps Submit available during autosave and queues one submission behind an in-flight save. A failed save retains the answer and requires retry. A browser test with a deliberately delayed draft request passed with one click.

The full desktop keyboard journey passed on the first deployed fixes: enrolment, draft refresh, lost submission response recovery without duplicate attempts, real feedback, attempt-bound adviser review and private comment, sign out everywhere, recovery and deletion.

## Final staging result

Deployed product commit: 864d14e. Vercel deployment: dpl_75JbhwgAnuxdJ3mmHYK4AyeQ43mH, https://muqabala-qjdk8pmy6-inspire14.vercel.app. The existing Schools staging alias points to this deployment. No production deployment or database migration was needed.

The final hosted test returned real AI feedback automatically in 17 seconds from Submit, with no manual reload. This is one observed run, not a service guarantee. The exact fictional Q3 no longer asked what feedback was given. It returned: "Say how the feedback changed the way you work in later presentations." All four Q3 elements remained present. Hosted retry created one editable draft while preserving the submission, and the student cohort route returned 404.

The visible-error enrolment check was tightened to avoid Next.js's empty route announcement. It passed at 848px and 375px, including delayed failure and code retention. The delayed autosave submission, direct retry button, retry URL and automatic feedback checks also passed again.

Evidence: docs/evidence/schools-hosted-student-fixes.json, docs/evidence/schools-student-ux-fixes.json and docs/evidence/schools-preview-keyboard-desktop.json. TypeScript, both local and Vercel builds, and 541 regression tests passed.

## Remaining limits

All reported issues have an implemented fix or, for the engine disagreement, a recorded case and verified prompt correction on a new attempt. Original feedback and reviews were not rewritten. No claim is made that every future AI suggestion will be correct. Physical iPhone and Android testing and messaging-app link previews remain unverified. Real-institution onboarding and wider pilot readiness gates remain separate from this fix release. Continue with controlled individual testers on staging.

Rollback: point the staging alias back to muqabala-dn7s108ap-inspire14.vercel.app if these changes need to be withdrawn. This restores the previous product and also restores its known student UX faults. Production Schools stays disabled.
