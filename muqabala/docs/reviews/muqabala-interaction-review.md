# Muqabala interaction implementation review

Date: 15 September 2026  
Repository: `muqabala-app/muqabala`  
Branch: `claude/gulf-hospitality-video-interview-m9skfu`  
Base commit: `7131e88`  
Implementation commit: `b3ff01a`  
Deployment status: local only; not pushed and not deployed

## 1. Summary

All seven requested interaction improvements are implemented in the existing Next.js application. The work adds an employer candidate-review panel, server-confirmed decision interactions, a four-step role-creation flow, explicit practice and feedback states, reliable clipboard feedback, accessible FAQ/guide disclosures, and shared reduced-motion-aware transition tokens.

No animation package or other dependency was added. The transitions use CSS and the existing component stack. The implementation follows the short state-swap, panel-reveal, success-state, skeleton-reveal, and disclosure patterns in the free Transitions.dev guidance, adapted to Muqabala's existing design system and 120–220 ms motion budget.

## 2. Requested improvements

| # | Area | Status | What changed | Main files | Verification |
|---|---|---|---|---|---|
| 1 | HR candidate review panel | Complete | Dashboard review controls now open a right-side modal panel without navigating away. It loads only the signed-in employer's submitted candidate, shows role context, evidence coverage, submitted answers, transcript/video controls, full evaluation link, note, and decision actions. Includes Escape/backdrop/visible close, focus trap and restoration, body scroll lock, loading/error/empty states, unsaved-note warning, and full-screen mobile layout. | `components/EmployerCandidatePanel.tsx`, `components/EmployerCandidatePanel.module.css`, `app/employer/page.tsx`, `app/api/employer/interviews/[id]/route.ts`, `lib/employer-review.ts`, `app/employer/actions.ts` | Type/build and focused ownership/accessibility assertions pass. Authenticated browser smoke test remains recommended because no employer test session was fabricated locally. |
| 2 | Shortlist confirmation | Complete | Row and panel decisions block repeated taps, wait for the server before changing visible state, preserve prior state on failure, show `Added to shortlist` only after success, and refresh server data to reconcile counts/lists. | `components/DashboardDecisionActions.tsx`, `components/EmployerCandidatePanel.tsx`, `components/CandidateReview.tsx` | Focused ordering/duplicate-guard tests plus the full regression suite pass. |
| 3 | Role setup steps | Complete | Existing creation logic now presents Role → Questions → Preview → Share. Back/Continue retain component state. Invalid steps focus the first invalid field; successful transitions focus the new heading. Preview exposes the actual role, source, candidate limit, and expiry. Share names the role/company and supplies the generated link in email/WhatsApp actions. | `components/EmployerProofCreate.tsx`, `components/EmployerProofCreate.module.css`, `lib/i18n.ts` | Type/build and focused state/focus assertions pass; EN/AR key parity passes. |
| 4 | Practice state clarity | Complete | A real Question → Answer → Review → Feedback state indicator and short stage transition were added. Existing media controls, permission fallback, answer drafts, retries, and in-flight guards remain intact. Essential recording controls are not delayed by motion. | `components/InterviewFlow.tsx`, `app/globals.css` | Desktop browser entry flow passed. A manual Arabic typed-answer run reached Review; a local scoring failure retained the transcript and exposed retry/continue recovery. Existing media/recovery regression tests pass. Hardware camera/microphone paths were not re-recorded in this local run. |
| 5 | Truthful feedback loading | Complete | Feedback now uses a stable skeleton matching the expected card footprint, a live processing status, and smooth real-content reveal. After eight seconds it offers a stop/retry action; aborting keeps the answer available. No percentage, fake stage, or artificial delay is shown. A pre-existing selector mismatch that prevented streaming blocks from reserving height was corrected. | `components/InterviewFlow.tsx`, `components/FeedbackCard.tsx`, `app/globals.css` | Focused loading/recovery assertions, full regression suite, and production build pass. |
| 6 | Copy confirmation | Complete | Shared copy control awaits the clipboard promise, then shows a checkmark and success text for 2.5 seconds. Repeated taps reset the timer. Failure displays and focuses a selectable textarea plus a manual-select action; success is never shown on rejection. Employer dashboard and role-share actions use it. | `components/CopyButton.tsx`, `components/CopyButton.module.css`, `components/EmployerLinkActions.tsx`, `components/EmployerProofCreate.tsx` | Focused clipboard ordering/fallback assertions pass. Native browser clipboard rejection was not forced in the final headless run. |
| 7 | FAQ and guide disclosures | Complete | FAQ cards keep the first direct sentence visible and put only supplementary text in native `details`/`summary`. Guide articles remain fully visible and optionally gain a semantic `In this guide` disclosure linking to real `h2` IDs. | `app/faq/page.tsx`, `components/MarketingSite.tsx`, `components/GuideBody.tsx`, `app/globals.css` | 390 px browser run found all six direct answers, opened the first disclosure, and found no horizontal overflow. Arabic disclosure and RTL direction also passed. |

## 3. Git and diff references

- Branch: `claude/gulf-hospitality-video-interview-m9skfu`
- Base: `7131e88` (`Align fallback scoring with measured reasoning`)
- Implementation: `b3ff01a` (`feat: improve Muqabala interaction flows`)
- Review implementation: `git show --stat b3ff01a`
- Full implementation diff: `git diff 7131e88..b3ff01a -- muqabala`
- The implementation commit is local and is followed by this report's documentation commit. Nothing was pushed.

## 4. Modified files

```text
app/api/employer/interviews/[id]/route.ts
app/employer/EmployerDashboard.module.css
app/employer/actions.ts
app/employer/page.tsx
app/faq/page.tsx
app/globals.css
components/CandidateReview.tsx
components/CopyButton.module.css
components/CopyButton.tsx
components/DashboardDecisionActions.tsx
components/EmployerCandidatePanel.module.css
components/EmployerCandidatePanel.tsx
components/EmployerLinkActions.tsx
components/EmployerProofCreate.module.css
components/EmployerProofCreate.tsx
components/FeedbackCard.tsx
components/GuideBody.tsx
components/InterviewFlow.tsx
components/MarketingSite.tsx
docs/reviews/assets/faq-mobile-ar.png
docs/reviews/assets/faq-mobile-en.png
docs/reviews/assets/faq-mobile-reduced-motion.png
docs/reviews/assets/practice-desktop-en.png
lib/employer-review.ts
lib/i18n.ts
package.json
scripts/employer-review-recovery.test.mjs
scripts/employer-video-screening.test.mjs
scripts/evaluation-report.test.mjs
scripts/interaction-improvements.test.mjs
scripts/verify-interactions-browser.mjs
```

This report is added in the follow-up documentation commit.

## 5. Browser evidence and local preview

Evidence:

- [English FAQ, 390 px](assets/faq-mobile-en.png)
- [Arabic FAQ/RTL, 390 px](assets/faq-mobile-ar.png)
- [Reduced-motion FAQ, 390 px](assets/faq-mobile-reduced-motion.png)
- [English practice entry, 1280 px](assets/practice-desktop-en.png)

The repeatable browser check is `npm run test:interaction-browser -- http://127.0.0.1:3101`.

To open the local production preview:

```bash
cd "/Users/kim/Library/CloudStorage/OneDrive-Personal/Code/muqabala-app/muqabala"
npm run build
npm start -- -p 3101
```

Then open `http://localhost:3101`.

## 6. Checks and results

| Check | Result |
|---|---|
| `git diff --check` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass; 116 static pages generated |
| Full Node regression suite (`scripts/*.test.mjs`) | Pass; 551 tests, 0 failed/skipped |
| `npm run test:copy-quality` | Pass; 9 tests, including EN/AR key parity |
| `npm run check:bundle` | Pass; `/practice` 180.2 KB, largest catalogue route just below 200 KB |
| `npm run test:interaction-browser -- http://127.0.0.1:3101` | Pass; mobile FAQ, disclosure, no overflow, reduced motion, Arabic RTL, desktop practice entry |
| `npm run lint` | Not available: the existing script invokes removed/unsupported `next lint` behavior and exits with `Invalid project directory .../lint`; this task did not add ESLint dependencies |

During verification, the first bundle result was 200.1 KB on `/practice/accountant`. Duplicate flow labels were replaced with existing translations; the rebuilt page passes below the strict 200 KB threshold. One browser rerun used a stale server process after rebuilding and failed its RTL assertion; restarting the local production server produced a clean pass. These were verification-environment findings, not suppressed failures.

The Node test runner emits existing `MODULE_TYPELESS_PACKAGE_JSON` warnings for TypeScript modules. The checks still pass.

## 7. Accessibility, mobile, motion, and RTL

- Panel uses `role="dialog"`, `aria-modal`, an accessible name/description, focus containment, Escape close, initial close-button focus, opener restoration, and live status/error messaging.
- Interactive controls use native buttons, links, `details`/`summary`, `aria-pressed`, `aria-current`, and status/alert regions. New primary touch controls are at least 44 px.
- The panel becomes full-screen at 42 rem and below. The 390 px browser checks reported `scrollWidth === viewport` in English and Arabic.
- Shared motion tokens are 120 ms, 180 ms, and 220 ms. Under `prefers-reduced-motion: reduce`, animation distance is removed and duration resolves to 1 ms. Functionality does not depend on animation.
- New English and Arabic strings have exact key parity. Role/share content and candidate-provided text use logical layout, `dir="auto"`, or `bdi` where appropriate. The browser check confirmed `html[lang="ar"][dir="rtl"]` and Arabic disclosure text.
- The accessibility review followed WCAG 2.1 AA-oriented semantics, focus order, keyboard access, visible state, reduced motion, and touch-target checks.

## 8. Dependencies

No package dependency was added. CSS transitions and existing Phosphor icons were sufficient. This avoids additional client weight and respects the existing stack.

## 9. Backend, permission, and data handling changes

- `GET /api/employer/interviews/[id]` was added beside the existing delete handler. It requires a current user, a submitted interview, database row-level access, and an explicit `screening_packs.employer_id === user.id` check.
- The response is private/no-store and deliberately minimal. It returns a `hasVideo` boolean, never a storage path or signed URL. Video remains signed only when the employer explicitly presses Play through the existing authorized action.
- `markInterviewReviewed` updates only an employer-owned submitted interview after its review payload loads.
- Decision writes continue through the existing authenticated `record_employer_decision` RPC and are reflected in the UI only after confirmation.
- Candidate private-practice routes and data were not connected to the employer panel.

## 10. Remaining verification and follow-up

The implementation is complete, with these explicit follow-ups before production release:

1. Use a dedicated staging employer account with seeded candidates to browser-test panel focus trapping, list filter/sort/scroll preservation, video-on-click, empty/failure states, unsaved-note warning, and shortlist count reconciliation end to end.
2. Run physical iOS Safari and Android Chrome checks for clipboard permission rejection and real microphone/camera interruption. The code paths and regression checks exist, but the final local evidence did not use physical hardware.
3. Repair the repository's existing `lint` script separately by selecting and configuring a supported ESLint command. No lint dependency was added implicitly in this interaction task.
4. Have the reviewing agent inspect `b3ff01a`, rerun the commands above, and only then decide whether to push/deploy.
