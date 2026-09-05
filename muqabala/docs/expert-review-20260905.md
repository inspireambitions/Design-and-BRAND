# Muqabala applicant and employer review

Date: 5 September 2026. Three specialist agents reviewed employer experience, assessment quality, and privacy/reliability. The coordinating agent tested live applicant pages and integrated the fixes. This is an agent-led engineering review, not independent human assessor certification.

## Baseline and scope

- Live URL: https://trymuqabala.com
- Verified live deployment: dpl_73aXPXv7zyLYxMvvnf99i7ZiAN3d, Ready, production.
- Original app: v2-implementation/muqabala, clean at d03e183.
- Fix worktree: expert-review-20260905/muqabala.
- Fix branch: codex/expert-review-20260905.
- Production branch setting still names claude/gulf-hospitality-video-interview-m9skfu. No branch merge or production deployment was performed.

## Findings and implemented fixes

| ID | Priority | Applicant or employer impact | Evidence | Fix |
|---|---|---|---|---|
| A1 | P2 | Role card promises five questions in five minutes, default opens eight in 25 to 30 minutes | Live /practice and /practice/nurse, HomeView | Describe both current modes |
| A2 | P1 | Strong answer appears to receive a poor score | Live typed guided answer scored 85, visible Readiness 15; computeReadiness counts unanswered bank criteria | Show answer score upfront; remove bank coverage from answer feedback header; label coverage honestly on results and share cards |
| A3 | P2 | Email gate surprises someone promised no sign-up | Live guided results requests verification after landing says No sign-up | Qualify first-feedback promise and clarify full report verification |
| A4 | P1 | Refresh loses an unsent adaptive answer silently | Live /practice/universal fictional unsent draft lost after reload | Warn on refresh, Back and same-tab links, without storing answer text |
| A5 | P1 | Temporary restore error discards the saved interview pointer | UniversalInterview source | Preserve pointer and offer retry |
| A6 | P1 | Feedback failure leaves a loading dead end | UniversalInterview source | Retry feedback without resubmitting answers; label retry answer field |
| A7 | P2 | Adaptive profile/JD submission lacks upfront data notice | Live adaptive setup | Notice before blueprint action |
| A8 | P2 | Arabic role cards create horizontal scrolling on a narrow phone screen | Browser measured scroll width 454px for client width 375px | Allow flex cards and grid items to shrink within the viewport |
| E1 | P2 | Signed-in dashboard button opens creation section | EmployerProofCreate source | Direct link to employer dashboard |
| E2 | P2 | Seeking a video can navigate to another candidate | CandidateReview page-wide touch handler | Remove page-wide swipe, keep explicit Next |
| E3 | P2 | Enabled employer dashboard omits early deletion | Volume flag confirmed live; conditional review source | Restore existing controlled delete action |
| E4 | P2 | Hold appears merely reviewed; exports expose pass/later | Dashboard and actual CSV/PDF tests | Shared Shortlisted / Not proceeding / Hold labels |
| E5 | P1 | Interrupted decision leaves buttons stuck | Component action rejection reproduction | Catch/finally, preserve notes, refresh saved state, clear error |
| E6 | P2 | Playback errors have no retry | Component signing/media failure reproduction | Fresh signed URL on retry |
| E7 | P2 | Employer copy suggests an unverified 48-hour hiring outcome and Arabic still promises three answers | Rendered enabled employer page and bilingual copy | Remove numeric outcome promise, label sample report, align Arabic with eight main questions |
| S1 | P1 | Quoted I don't know discards a valid detailed answer | Executed sanitise/engine path | Match a complete no-example response only |
| S2 | P1 | Missing adaptive evidence earns 40 points and full coverage | Executed adapter and coverage reproduction | No invented credit or shared-summary evidence for absent competency |
| S3 | P1 | AI failure becomes no evidence and lowers review order | Executed coverage model and ordering | Explicit unavailable state; chronological cohort order until analysis completes; preserve Unknown in share/export/email |
| R1 | P1 | Cleanup can orphan videos after lookup error | Cleanup control flow and failure-injection tests | Fail closed, preserve storage references |
| R2 | P2 | Five daily retry jobs cannot recover a pilot backlog promptly | Worker lease size plus cron configuration | Bounded drain up to 60, five-minute schedule supported by verified Pro plan |
| R3 | P1 | Shared browser keeps recordings after sign-out | IndexedDB store and sign-out source | Purge on sign-out; always attempt auth sign-out independently; show separate cleanup failure |
| R4 | P1 | UI claims a recovery save before transaction commits | Late-abort reproduction | Resolve only after commit; atomic expiry cursor; expire old drafts on next screening visit |

## QA inventory and evidence

Applicant checks: landing expectations; guided mode selection; explicit Start; typed answer preservation through review; confirmed AI feedback; expanded evidence; guided completion/email gate; mobile layout; adaptive setup/confirmation; refresh loss reproduction. All live test text was fictional. No camera permission, personal recordings, email sends or real employer decisions were used.

Code and failure-path checks: actual adaptive feedback conversion, no-example classification, incomplete-analysis ordering, employer decision interruption, video signing/media retry, CSV/PDF labels, cleanup failures, transaction aborts, cross-tab replacement, sign-out partial failures, Universal restore/feedback/navigation recovery. Existing privacy/security and question-copy gates also apply.

Second reviewers caught two regressions during implementation: purge failure could prevent auth sign-out, and draft expiry could delete a fresh cross-tab replacement. Both were corrected and covered before preview.

## Validation

- Full resilience suite: 414 passed, zero failed after integration.
- Security suite: 63 passed, zero failed.
- Final typecheck, question-copy check and whitespace check passed.
- Final webpack production build passed, generating 120 pages.
- Preview browser evidence is recorded separately after deployment.
- npm audit: 10 inherited findings, nine moderate and one high, through Sanity and its tooling tree. The suggested automated fixes include major downgrades. No forced dependency changes were made in this journey-fix release.

## Remaining proof and boundaries

- Authenticated employer/candidate journey needs controlled inboxes. Asked Kim to identify test inboxes; no email sent.
- Physical iPhone Safari, Android Chrome, desktop media and WhatsApp in-app recording remain unproven by this review.
- Provider scoring consistency and English/Arabic fairness require the paced corpus gate. Component tests do not prove model behaviour.
- Preview cron configuration does not prove production scheduler execution, real email delivery, retention deletion or interrupted physical-device uploads.
- Previously stored incorrect assessment summaries were not rewritten. Inspect controlled records before any authorised correction.
- No claim that all possible faults have been found, or that the 30-person pilot is complete.

## Product council check

- Arabic parity: translations added; physical Arabic media and human assessment review remain.
- Volume hiring: review/retry/export behaviour improved; real low-bandwidth journey remains.
- Candidate experience: clearer promises and scores; recovery warnings added.
- AI quality: invented coverage fixed and provider failures kept separate; live consistency remains.
- Pilot readiness: engineering findings addressed in preview first; five monitored people before 30.
- Privacy and consent: upfront disclosure, cleanup integrity and local purge improved; actual production deletion still needs controlled proof.
