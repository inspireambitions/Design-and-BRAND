# Independent review — recruiter assistance suite

Reviewed implementation: `9a667eb`; implementation report: `cf61c8e`.
Branch inspected: `codex/recruiter-suite-20260915`.
Decision: **Changes required before release approval.** No application code was changed during this review.

## Assessment

The implementation makes sensible use of deterministic queries, existing review controls, explicit message previews, and employer-scoped access. Its report accurately discloses that the browser walkthrough used a development fixture rather than a real authenticated database-backed journey. The deterministic role-help fallback and manual contact fallback are acceptable under the brief.

However, the passing checks miss incompatibilities between newly editable role questions and existing invitation/scoring behavior. There are also incorrect candidate answers, false empty states, and inaccessible historical role pages. These are functional issues, not visual preferences.

Review dimensions:

- **Correctness: changes required.** Findings R1–R5 affect core workflows and trustworthy output.
- **Security: promising structure, integration verification incomplete.** Reviewed routes enforce employer ownership and candidate-question reads filter by candidate identity; the migration enables RLS and restricts the reminder function to service_role. This is not a certification of all policies. A real two-account negative-access test remains necessary.
- **Performance: follow-up required.** New role-detail and reminder reads load full collections; add pagination or bounded retrieval for large roles and use exact aggregate counts where appropriate. No production-scale load testing was performed.
- **Maintainability: reasonable shared domain helpers, insufficient integration coverage.** Several tests assert source-code strings rather than execute the route/data contract. Shared helpers are useful but must be tested through their actual consumers.

## Required corrections

### R1 — P1: Newly supported four-to-seven-question roles produce unusable invitation links

Evidence: `app/api/screening/packs/route.ts:190` accepts and signs 3–8 questions. `lib/screening-pack.ts:45` still rejects any count other than 3 or 8. `app/s/[code]/page.tsx` calls `notFound()` for that unavailable result.

Reproduction: publish a four-question role, then open the resulting candidate invitation. The source path rejects it. Independent execution confirmed counts 4, 5, 6, and 7 pass the new question validator and signing function but fail the existing loader guard; counts 3 and 8 pass both. This was a function/contract reproduction, not an authenticated browser publication.

Fix: reconcile supported counts across creation, public loading, interview start/resume, recording, submit, and consent. Replace the candidate UI's hard-coded three/eight intro and consent copy with the real count. Also test the existing adaptive interview path: it currently overlays supplied questions onto an eight-question plan, so the preview must not promise an exact approved sequence/count that the candidate will not receive.

Acceptance: for each supported count, successfully publish through the real route, open the invitation, complete the expected sequence, submit, and review. Cover supported languages and adaptive mode on/off where applicable. At minimum add automated route-level coverage for the creation-to-load contract.

### R2 — P1: Recruiter role detail stops opening after the invitation token expires

Evidence: new `app/employer/roles/[roleId]/page.tsx:33` calls `verifyInterview(pack.signed_token)` and returns Not Found when it fails. `lib/interview-token.ts` signs proof tokens with a 14-day TTL and verification rejects expired tokens. The dashboard now directs review, shortlist, and results actions into this new page.

Reproduction: independent execution of the actual signer/verifier with a test-only secret and simulated day 15 returns null. Therefore a stored role that still belongs to the recruiter loses its detail page, including pending-review access through the new primary actions. Earlier token-lifetime issues may predate this change, but this newly added recruiter route must not inherit that restriction for historical review.

Fix: load persistent, authorized role metadata independently of candidate participation-token expiry. If parsing signed historical data is needed, use an explicitly scoped signature-validating historical-read path; do not weaken expiration checks for public participation or simply trust unverified decoded content.

Acceptance: an authorized recruiter can view pending submissions and results after token expiry; another employer still cannot. Closed candidate links remain closed. Include 21/30-day roles in the lifecycle check.

### R3 — P1: Broad keyword matching confidently answers the wrong candidate question

Evidence: `lib/recruiter-suite.ts:249` treats any “when” as an invitation-deadline question; line 258 treats any “long” or “question” as response format; line 266 treats “where” as workplace location. The API sets `canEscalate` to false for these supported answers.

Independently reproduced against actual code with missing salary/accommodation/interview facts:

| Candidate asks | Actual answer |
|---|---|
| When will I be paid? | Invitation closing date |
| When is my interview? | Invitation closing date |
| How long is the employment contract? | Video response format |
| Where will my accommodation be? | Workplace location |

Fix: use explicit suggested-question intents and conservative matching for free text. Ambiguous or unmatched questions must allow clarification or recruiter handoff. Do not solve this by merely rearranging the same broad keyword checks.

Acceptance: adversarial and normal questions in English/Arabic return the correct fact or an honest unsupported response, with handoff available. Mixed-topic questions must not receive a misleading single-fact answer.

### R4 — P1: Arbitrarily edited questions inherit unrelated reviewed scoring criteria

Evidence: `lib/recruiter-suite.ts:330` looks up the original question by ID or falls back by array position. Line 335 copies all its fields, replaces only the text, and sets `validated: true`. The signed questions are then used by scoring; `app/api/score/route.ts:236` constructs the rubric from the inherited competency IDs.

Independent reproduction: changing “What makes your background relevant to this role?” to a fire-alarm evacuation question retains `communication` and `customer_focus`, and still marks the new question validated. New custom IDs also receive arbitrary position-based metadata.

Fix: preserve reviewed status and rubrics only when semantically justified. For arbitrary custom questions, provide explicit compatible criteria review or a manual-review/unscored path. Never silently certify edited text against a different question's rubric. Handle bilingual meaning consistently.

Acceptance: replacing a question with a different competency topic cannot yield automated scoring against unrelated inherited criteria. Test new IDs, edited IDs, reordered questions, and fallback suggestions.

### R5 — P1: Role-detail query errors are displayed as no candidates/no questions

Evidence: `app/employer/roles/[roleId]/page.tsx:36` destructures only data from three queries, ignoring their errors. Lines 41–46 derive counts and the next action from null-to-empty conversions. `app/employer/questions/page.tsx` similarly treats failed role/question reads as an empty queue.

Impact: a transient database failure can tell a recruiter there are zero submissions or no unresolved questions, and switch the role's main action to Copy invitation. Role help repeats those false counts. The dashboard attention error treatment does not protect these destination pages.

Fix: handle each query's failure explicitly. Show retryable unavailable states, preserve usable independent sections, and suppress derived counts/actions that depend on unavailable data. Distinguish missing records from infrastructure failure.

Acceptance: inject failures independently into submission, invitation, and question reads. No affected count appears as zero and no action is selected from a false empty state. Genuine empty results retain their useful empty-state copy.

### R6 — P2: Failed reminder recipients cannot be retried as promised

Evidence: `supabase/migrations/20260915120000_recruiter_assistance.sql:178` excludes any recent manual-reminder outbox record by creation time, regardless of failed/cancelled status. The unique batch key also prevents reinsertion of the same attempt. `components/ReminderPreview.tsx` has no explicit failed-recipient retry path; after enqueue it clears selection and does not refresh delivery data.

Impact: a terminal provider failure can block a corrected retry for 24 hours. The preview eligibility helper does not check the same outbox condition, so the UI can offer eligible recipients while the server queues zero. A lost queue-response followed by retry reports zero queued/all skipped instead of recovering the original batch outcome. Existing automatic retries for pending jobs do not resolve terminal failed-recipient recovery.

Fix: distinguish pending/uncertain delivery from definitively failed delivery, expose safe retry behavior, and return stable original-batch state on idempotent retries. Refresh delivery and eligibility after actions. Preserve duplicate protection for accepted or possibly delivered messages.

Acceptance: provider failure followed by a corrected retry handles only eligible failed recipients; successful recipients are not resent; repeated requests with one batch key recover the same logical result; preview and server eligibility agree.

### R7 — P2: Arabic published FAQs are not retrievable, and source links omit the cited facts

Evidence: `lib/recruiter-suite.ts:285` splits FAQ text with `/\W+/`, which removes Arabic letters as non-word characters. An independently tested exact Arabic FAQ question returned “The employer hasn't provided that detail” despite an approved answer being present. Also, all supported answers link to `#role-facts`, but `components/CandidateRoleQuestions.tsx` renders only title, location, deadline and question count there. Salary, accommodation, interview details and published FAQ text are not passed/rendered on this candidate page.

Fix: use Unicode-aware normalization and conservative FAQ matching, and render the actual approved candidate-visible source information with stable field/FAQ anchors. Never send internal facts to satisfy a source link.

Acceptance: exact and supported variants of an Arabic FAQ resolve correctly. Each returned source link opens the visible fact or FAQ used to answer, including salary and accommodation; absent information remains absent.

### R8 — P2: “View all attention items” does not reveal the omitted items

Evidence: `components/AttentionBriefing.tsx:15` links to `/employer#roles`. The builder only returns the first three items. The link scrolls to the normal role listing rather than showing the remaining attention items, which can belong to other role pages or filters.

Fix: expand the complete attention list or navigate to a real attention view containing those items, preserving their actions and counts.

Acceptance: create more than three attention items across multiple role pages. Every omitted item becomes reachable from View all without manually discovering/filtering roles.

## Additional product-fit corrections

- **English-only recruiters face a new publishing obstacle.** Every new question requires an Arabic translation in both `questionsReady` and the server validator. The interface should make question-language configuration explicit and support an English-only questionnaire, or provide a reviewed translation path. A recruiter should not have to author another language to use Add question. Treat this as a product-scope choice to settle, not a silent validation requirement.
- **Remove implementation commentary from product copy.** Examples include “no role is selected arbitrarily,” “Your roles have not been shown as zero,” and “The complete workflow remains available through the sections above.” Replace them with concise task guidance. Keep engineering rationale in the report.
- **Question suggestions can overwrite edits.** The step becomes editable before its suggestion request returns; completion replaces the full question array. Protect dirty edits or prevent editing until the initial request resolves. The suggestion refresh button also clears state then immediately invokes a closure that still sees the old `suggestedFor`, so refreshing suggestions for the same title can do nothing.
- **Review preview fidelity.** The preview does not display all approved employer facts or the exact closing time, and formats the date without the chosen role timezone while displaying that timezone beside it. Reuse candidate-visible rendering where possible.
- **Question reply actions need error recovery.** `QuestionCard.run` lacks try/finally around server actions; a rejected request leaves the card busy and disabled. Preserve the reply and provide retry.
- **Deadline editing remains undiscoverable from role detail.** The brief specified an available secondary Edit closing date action, but the new role page provides no such control. Link/reuse the existing supported setting or explicitly report it as missing.

## Coverage against the brief

| Feature | Review status |
|---|---|
| A — attention briefing | Useful foundation; R5/R8 and task copy require correction. |
| B — role setup | Not complete: R1/R4; suggestion/edit protection and candidate preview need work. |
| C — next actions | Resolver exists; destinations fail for aged roles (R2), and error-derived actions are misleading (R5). |
| D — review and summaries | Source-linked extractive summary is a reasonable first version; end-to-end access and scoring semantics need the corrections above. |
| E — reminders | Honest manual fallback is good; safe terminal-failure/idempotent recovery needs R6. |
| F — candidate questions/handoff | Persisted queue is useful; R3/R7 must be corrected before exposing free-text factual answers. |
| G — role help | Deterministic shortcuts meet the permitted fallback scope, but must not repeat failed-query counts. |

## Verification performed by this reviewer

- Confirmed review checkout at `cf61c8e` with implementation commit `9a667eb`; working tree was clean before this review document.
- Read the implementation report, relevant new/modified routes, domain helpers, migration, candidate/recruiter components, and related scoring/token behavior.
- Independently reran `npm run test:recruiter-suite`: **11/11 passed**.
- Independently executed candidate question examples, Arabic FAQ matching, edited-question rubric behavior, valid question-count/signing versus loader guard, and simulated historical-token verification.
- Inspected the submitted role-preview screenshot. Did not treat fixture screenshots as evidence of successful persistent publication.
- Did not independently rerun the reported 64 security/566 resilience tests, production build, or authenticated browser journey. The original report's results remain implementer-reported.
- No database migrations, real messaging, production operations, or application fixes were performed.

## Resubmission requirements

Address R1–R8 with behavior-level regression checks and revise completion claims accordingly. Resolve the product-fit items or explicitly report justified remaining scope. Preserve existing authorization boundaries and do not relax public token checks globally to fix historical recruiter access.

Return the correction commit(s), updated implementation report, new regression results, and actual route-level creation/loading evidence. A full isolated authenticated create → candidate-submit → recruiter-review path remains a release gate when staging credentials are available. No need to send real email: an isolated provider stub can verify request behavior and recovery.
