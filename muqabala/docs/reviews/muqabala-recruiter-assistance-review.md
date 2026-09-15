# Muqabala recruiter assistance implementation review

Prepared: 15 September 2026  
Review branch: `codex/recruiter-suite-20260915`  
Implementation commits: `9a667eb` (`Implement recruiter assistance suite`), `fae2aed` (`fix: close recruiter suite review findings`)
Base commit: `e09936a`  
Production deployed: **No**

## 1. Resulting user behaviour

The recruiter journey remains usable without chat:

1. A recruiter opens `/employer` and sees at most three owner-scoped, deterministic attention items above the existing roles.
2. Role creation at `/for-employers#create` now follows Role, Questions, Preview, and Share. Recruiters can choose English-only or bilingual questions, edit three to eight questions, and publish once with server-side idempotency.
3. Dashboard role cards and `/employer/roles/[roleId]` use one state-to-action resolver for copying an invitation, reviewing submissions, viewing a shortlist, or viewing results.
4. Candidate review opens in the existing accessible side panel. A compact extractive summary links every point to an original answer; the original answers and human decision controls remain primary.
5. A role can preview eligible reminder recipients and exclusions before any send. The server rechecks eligibility and duplicate protection immediately before queueing.
6. Candidates can read current published facts and explicitly send an unresolved question to the recruiter. Recruiters can reply, resolve, and separately prepare public FAQ wording.
7. Recruiters can open optional role-scoped help for three supported factual shortcuts. There is no inert or general-purpose chatbot.
8. Recruiters can edit the exact role closing date and time in the configured role timezone from the role page.

No production data was seeded, no candidate message was sent, no external service was purchased, and no production deployment was made.

## 1A. Independent review correction record

The first implementation was independently reviewed in `docs/reviews/muqabala-recruiter-assistance-independent-review.md`. Commit `fae2aed` addresses every required finding and the additional product-fit corrections without weakening public-link expiry or employer ownership checks.

| Finding | Correction and executable evidence |
|---|---|
| R1: 3–8 question mismatch | Creation, stored pack loading, and start-plan validation now share the 3–8 contract. Employer-reviewed questions run as the exact fixed sequence; dynamic intro and consent copy use the actual count. The real route/loader/start harness publishes and opens counts 3, 4, 5, 6, 7, and 8. |
| R2: expired role pages | Candidate participation still checks the database close time. Persistent recruiter reads use a signature-validating, expiry-independent stored-record path only after owner or active-pack authorization. Tests cover an expired public token, an authorized stored read, and a 30-day token at day 21. |
| R3: incorrect factual answers | Suggested questions send explicit intents. Free text uses conservative Unicode-aware matching; ambiguous and mixed-topic questions fall back to recruiter handoff. Adversarial English and Arabic examples are regression tested. |
| R4: unrelated inherited rubrics | Only unchanged reviewed question text retains validated competencies. Edited, new, and meaning-changed questions are unscored and explicitly routed to human employer review. New IDs, edited IDs, reordered questions, and English-only questions are tested. |
| R5: query failure shown as zero | Role and question pages handle pack, submission, invite, and question failures separately. Dependent counts and next actions are suppressed when their source is unavailable; visible rows are bounded and exact head counts are used. Source and browser error-state checks confirm no invented zero. |
| R6: failed reminders | Pending/uncertain and accepted/delivered messages remain protected. Terminal failed/cancelled recipients can be selected for a new batch. A repeated batch key returns its original result, including after role closure. The UI refreshes delivery data after queueing. Isolated PostgreSQL tests cover each case. |
| R7: Arabic FAQ and sources | FAQ matching is Unicode-aware. Candidate-visible deadline, format, location, salary, accommodation, interview, and FAQ facts have stable, exact source anchors. Exact Arabic FAQ retrieval and absent-fact behavior are tested. |
| R8: inaccessible attention items | The briefing retains the complete ordered collection and “View all attention items” expands every omitted item with its original action. The browser test verifies three initially visible items and all four after expansion. |
| Product-fit follow-ups | Added explicit English-only/bilingual setup, dirty-edit protection for suggestion requests, forced suggestion refresh, exact timezone preview, all optional published facts, question-action `try/finally`, concise product copy, and a discoverable closing-date editor. Browser checks cover English-only setup and the deadline editor. |

The remaining release gate is an authenticated, migrated preview environment for a full create → candidate record/upload → submit → recruiter review run with two separate employer accounts. No such credentials or preview database were available, so this report does not claim that integration proof.

## 2. Discovery map and capability gaps

### Existing route and data map

| Area | Existing source used | Implementation decision |
|---|---|---|
| Recruiter dashboard | `/employer`, `screening_packs`, `employer_interviews`, `employer_decisions` | Kept current navigation and added attention, filters, and shared role actions. |
| Role setup and invitation | `/for-employers`, `/api/screening/packs`, signed `/s/[code]` links | Extended the existing creation API and public invitation format; no parallel role system. |
| Candidate submission | `/s/[code]`, private recordings, timed transcripts and employer-shared interviews | Candidate questions are attached only to an authenticated candidate's employer invitation. Private practice remains separate. |
| Review and shortlist | Dashboard panel, `/employer/interviews/[id]`, existing decision actions | Reused the panel, owner checks, note protections, and human decision RPCs. |
| Messaging | `role_invites`, Postgres outbox, Resend worker and webhook | Reused email delivery. WhatsApp remains an external/manual handoff. |
| Permissions | Supabase Auth, owner filters, RLS and security-definer RPC conventions | Every new employer read and mutation verifies the signed-in role owner; public candidate reads expose only published facts and the candidate's own questions. |
| Analytics | Existing allowlisted `track()` and optional PostHog | Added event names and non-sensitive properties only. No answer, name, email, phone, role title, or message body is tracked. |
| AI providers | Existing OpenAI/Anthropic configuration in other product paths | Role suggestions use reviewed deterministic templates first. Summaries are extractive. Role help is deterministic. No candidate data was added to a model-provider request. |

### Gaps found during discovery

- Muqabala tracks identifiable invitees only when `role_invites` contains an authorized contact. A public invitation link cannot identify non-submitters, so the UI supplies reusable manual reminder text without claiming recipient knowledge.
- Resend is the only implemented direct provider for this workflow. There is no direct WhatsApp provider and no candidate-question reply delivery integration.
- The employer workspace is not fully localized in its current architecture. Candidate questions, reminder preview, summary labels, and role setup have English/Arabic strings and RTL checks; several existing and new employer-page headings remain English.
- There is no constrained role-chat service. The brief's permitted deterministic fallback was implemented instead of presenting an unsupported text box.
- No isolated authenticated Supabase test account or migrated preview database was available. Persistent end-to-end writes were verified at the service, route-source, and isolated PostgreSQL levels, while the browser walkthrough used a development-only fictional fixture.

## 3. Feature status A to G

| Feature | Status | Implemented behaviour and routes/components | Evidence |
|---|---|---|---|
| A. Attention briefing | **Complete locally** | Owner-scoped data on `/employer`; configurable three-item limit and 48-hour threshold; review, unresolved-question, interrupted-upload, and closing-role items; combined filtered destinations; hidden empty state; explicit retry without false zero; expandable complete item list. `AttentionBriefing`, `buildAttentionItems`. | Focused tests; populated, expanded, empty, and error browser assertions; dashboard and error screenshots. |
| B. Guided role setup | **Implemented locally; authenticated preview pending** | Four steps at `/for-employers#create`; title/location first; optional approved facts; three to eight English-only or bilingual questions; add/remove/reorder; deterministic reviewed fallback; dirty-edit protection; optional existing JD generation; exact timezone/facts preview; explicit publish; server idempotency and unique employer/publish key; draft retained on back and failure. Employer-reviewed questions are fixed and custom questions require human review. | Real creation route → stored row → public loader → start-plan test for every count 3–8. Browser covers language selection, custom edit, back, preview, and simulated publish failure. A live authenticated database journey remains pending. |
| C. Contextual role action | **Complete locally** | One resolver used by role cards and `/employer/roles/[roleId]`; covers all brief rows including closed roles with pending review; submission units and timezone-aware closing data. Failed source queries suppress dependent counts/actions. `resolveAvailableRoleNextAction`, `RoleNextActionControl`. | Full state-table and unavailable-count tests; browser role-action assertion. |
| D. Review and answer summary | **Complete locally** | Existing accessible side panel retained; focus containment, Escape, focus/scroll restoration, unsaved-note warning, original answers, notes, and human shortlist controls preserved. New versioned extractive summaries cache by answer hash, label candidate claims, link to answer anchors, fail independently, and accept inaccuracy reports. `/api/employer/interviews/[id]/summary*`. | Browser confirms panel, two summaries, two original answers, source labels, and focus restoration; security and resilience tests cover ownership and failed decisions. |
| E. Reminder preview | **Partial: implementation complete, provider integration unverified** | `/employer/roles/[roleId]` loads recipient eligibility, exclusions, delivery state, editable copy, deselection, explicit recipient count, failed-recipient retry, and manual fallback. POST rechecks owner, role expiry, contact permission, submit/withdraw/delete/opt-out state, delivery uncertainty, and 24-hour duplicate protection in one database function. Stable batch keys recover the original result. Webhook records delivered/failed status. | Isolated PostgreSQL and worker tests cover late submission/withdrawal, repeat batches, terminal failure retry, successful-recipient protection, partial state, provider absence, and delivery updates. Browser confirms preview and honest provider state. No real message sent. |
| F. Candidate questions and handoff | **Partial: persisted queue and contact handoff complete; automatic reply delivery unavailable** | Collapsed disclosure below the candidate's primary journey on `/s/[code]`; explicit intents and conservative Unicode matching over candidate-visible facts; exact unknown/ambiguous fallback; fact-specific source links; explicit handoff; authenticated own-question history; rate limit and dedupe hash. `/employer/questions` and role detail support reply and resolve separately with recoverable failures. Public FAQ reuse requires separate wording and rejects contact details. | Focused English/Arabic adversarial tests cover ambiguity, exact Arabic FAQs, source anchors, scope, dedupe boundaries, and FAQ PII rejection. Browser confirms all candidate-visible fact anchors plus reply/resolve separation and blank public fields. |
| G. Optional role help | **Partial by design** | Secondary role-scoped panel on `/employer/roles/[roleId]` supports the three requested deterministic questions with source/navigation actions. No free-text input, hidden mutation, or cross-role query. Open-ended conversation is explicitly unavailable. `RoleHelpPanel`. | Focused tests confirm deterministic scope and no text box; browser confirms the answer and no general chat input. |

## 4. Schema, APIs, permissions and integrations

### Migration

`supabase/migrations/20260915120000_recruiter_assistance.sql` is backward-compatible and additive:

- Adds role location, timezone, published facts, questionnaire language, reviewed question source, and employer-scoped `publish_key` uniqueness to `screening_packs`.
- Adds contact permission, opt-out, withdrawal, deletion, and manual-reminder timestamps to `role_invites`.
- Extends outbox records with message body, batch key, delivered timestamp, manual reminder kind, and delivered status.
- Adds `candidate_role_questions`, `employer_answer_summaries`, `employer_summary_feedback`, and `recruiter_audit_events`, with RLS and parent-delete cascades.
- Adds the server-only `queue_manual_employer_reminders` function. Browser JWT roles cannot call it directly. It rechecks eligibility, prevents recent or concurrent duplicate reminders, permits a new attempt only for terminal failures, and recovers the original outcome for repeated batch keys.

The migration executed successfully in the repository's isolated PGlite/PostgreSQL test harness. It was **not** applied to staging or production.

### New or extended APIs

- `POST /api/screening/question-suggestions`: authenticated reviewed question catalogue.
- `POST /api/screening/packs`: extended role/fact/question validation, optional AI enrichment, audit, and idempotent publication.
- `GET|POST /api/screening/roles/[code]/questions`: candidate-visible facts, own queue, deterministic answers, and explicit recruiter escalation.
- `GET /api/employer/interviews/[id]/summary`: owner-scoped cached extractive summary.
- `POST /api/employer/interviews/[id]/summary/feedback`: owner-scoped inaccuracy report.
- `GET|POST /api/employer/roles/[roleId]/reminders`: owner-scoped preview and server-rechecked queueing.
- Existing employer actions now support candidate-question reply, resolve, and separately validated FAQ publication.
- Existing Resend webhook now records delivered and failed provider state for outbox rows.

### Audit, analytics and dependencies

- Consequential publish, question, answer, resolve, FAQ, reminder, and summary-feedback mutations write minimal audit events without copying sensitive message content.
- Added analytics for role-creation duration, review delay, attention clicks, reminder preview/queue, fact-answer outcome, escalation, question resolution, summary reports, and role-help use. Real baselines and medians remain intentionally unreported until production samples exist.
- No new runtime dependency was added. Existing Supabase, Resend, PostHog, Next.js, and test tooling are reused.

## 5. Browser preview and reproduction

From `muqabala/`:

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3102
```

Open `http://127.0.0.1:3102/dev/recruiter-suite` in development. The route returns Not Found when `NODE_ENV=production`. It contains clearly labeled fictional records and suppresses database writes and external messages.

Run the automated browser walkthrough:

```bash
npm run test:recruiter-browser -- http://127.0.0.1:3102
```

The walkthrough verifies populated/expanded/empty/error attention states; no general chat input; reminder preview and exclusions; role help; the closing-date editor; recruiter reply/resolve/FAQ separation; candidate-visible source anchors; side-panel summary/original answers/focus restoration; English-only and bilingual question setup; role edits/back/preview/publish failure preservation; 390 px Arabic RTL; reduced motion; horizontal overflow; and console errors.

For a real authenticated staging walkthrough after migration, use `/for-employers#create`, copy the resulting `/s/[code]` link, submit a fictional candidate recording, then review it at `/employer`. Use only an isolated staging account and a provider-suppressed email domain.

## 6. Screenshots

All screenshots use fictional data.

- [Dashboard attention and role actions](./assets/recruiter-suite/dashboard-desktop.png)
- [Reminder preview and role-scoped help](./assets/recruiter-suite/reminder-and-role-help-desktop.png)
- [Candidate handoff and evidence-linked review](./assets/recruiter-suite/candidate-review-desktop.png)
- [Four-step role preview](./assets/recruiter-suite/role-creation-preview-desktop.png)
- [Arabic RTL, 390 px, reduced motion](./assets/recruiter-suite/mobile-arabic-reduced-motion.png)
- [Attention query failure without false zero](./assets/recruiter-suite/attention-error-state.png)

No interaction recording was captured.

## 7. Verification results

| Check | Actual result |
|---|---|
| `npm run test:recruiter-browser -- http://127.0.0.1:3102` | **Pass**. All assertions true; zero browser console errors. Includes expanded attention, fact/FAQ anchors, closing-date editor, English-only setup, desktop, 390 px Arabic RTL, reduced motion, empty/error states, and retained draft after a failed publish. |
| `npm run test:recruiter-suite` | **17/17 pass**. Includes execution of the actual creation route, stored pack loader, and trusted start-plan contract for each question count 3–8. |
| `npm run test:security` | **64/64 pass**. |
| `npm run test:resilience` | **573/573 pass**. |
| Isolated delivery SQL and worker coverage within resilience suite | **16/16 SQL checks pass**, plus sender/worker checks. Migration executes; owner scope, stable batch idempotency, late contact withdrawal, terminal failure retry, successful-recipient protection, provider rejection, and delivery state are covered. |
| `npm run typecheck` | **Pass**. |
| `npm run lint` | **Pass with zero errors**. The repository reports 87 existing warnings; this work did not attempt an unrelated repository-wide warning cleanup. |
| `npm run build` | **Pass**. Next.js 16.3.5 production build compiled, typechecked, and generated all 117 static pages. |
| `git diff --check` before commit | **Pass**. |

### Not verified

- No production or shared staging deployment was made, as required.
- No migration was applied outside the isolated test database.
- No real Supabase-authenticated create/publish/candidate-record/upload/submit/review transaction was executed in the browser because no isolated migrated test account or preview database was provided. The actual creation route, row contract, public loader, and start-plan logic were executed in an isolated in-memory route harness instead; that is not represented as full integration proof.
- No Resend message or webhook was sent to a real address. No WhatsApp delivery exists.
- Physical iPhone Safari and Android Chrome were not available. The mobile check used headless Chromium at 390 px.
- Newly drafted Arabic copy needs human language review. Employer workspace localization remains partial. Automated tests prove parity/RTL mechanics, not linguistic approval.
- Real analytics baselines, task completion rates, and usability findings require actual consented usage; none were invented.

## 8. Changed files and reviewable diff

Review the implementation with:

```bash
git show --stat 9a667eb
git show --stat fae2aed
git diff e09936a..fae2aed -- muqabala
```

Changed files, grouped by responsibility:

- Dashboard and role pages: `app/employer/page.tsx`, `app/employer/questions/page.tsx`, `app/employer/roles/[roleId]/page.tsx`, `app/employer/roles/[roleId]/page.module.css`.
- Candidate and employer APIs: `app/api/screening/packs/route.ts`, `app/api/screening/question-suggestions/route.ts`, `app/api/screening/roles/[code]/questions/route.ts`, `app/api/employer/interviews/[id]/summary/route.ts`, `app/api/employer/interviews/[id]/summary/feedback/route.ts`, `app/api/employer/roles/[roleId]/reminders/route.ts`, `app/api/webhooks/resend/route.ts`, `app/employer/actions.ts`.
- Role setup and invitation: `components/EmployerProofCreate.tsx`, `components/EmployerProofCreate.module.css`, `components/EmployerVideoInterview.tsx`, `app/s/[code]/page.tsx`, `lib/interview-token.ts`, `lib/interview-plan.ts`, `lib/screening-pack.ts`.
- Recruiter components: `AttentionBriefing*`, `EmployerCandidatePanel*`, `RecruiterQuestions*`, `ReminderPreview*`, `RoleHelpPanel*`, `RoleNextActionControl.tsx`.
- Role maintenance: `RoleDeadlineEditor*`, `lib/timezone.ts`, and the owner-scoped closing-date action in `app/employer/actions.ts`.
- Candidate components: `CandidateRoleQuestions.tsx`, `CandidateRoleQuestions.module.css`.
- Domain and infrastructure: `lib/recruiter-suite.ts`, `lib/scoring.ts`, `lib/analytics.ts`, `lib/i18n.ts`, `lib/rate-limit.ts`, `lib/screening-pack-request.ts`, `lib/server/employer-messages.ts`, `supabase/migrations/20260915120000_recruiter_assistance.sql`.
- Verification fixture and tests: `app/dev/recruiter-suite/page.tsx`, `components/RecruiterSuiteFixture*`, `scripts/recruiter-suite.test.mjs`, `scripts/recruiter-route-contract.test.mjs`, `scripts/verify-recruiter-suite-browser.mjs`, extended employer/security tests, `package.json`, and the screenshots under `docs/reviews/assets/recruiter-suite/`.
- Review records: this report and `docs/reviews/muqabala-recruiter-assistance-independent-review.md`.

Initial implementation commit: **53 files changed, 3,129 insertions, 162 deletions**. Review-correction commit `fae2aed`: **51 files changed, 1,153 insertions, 219 deletions**.

## 9. Safe rollout, rollback and remaining decisions

### Recommended rollout

1. Review commits `9a667eb` and `fae2aed`, the independent review record, and this report.
2. Have an Arabic reviewer approve the new candidate/reminder/setup copy.
3. Apply the additive migration to an isolated preview Supabase project.
4. Configure preview-only Supabase credentials. Configure Resend only after first validating the manual fallback; use a suppressed test domain and verify the webhook secret.
5. Run the real first-time path with fictional records and two accounts to verify cross-organization denial.
6. Re-run the listed checks, inspect PostHog's allowlisted event payloads, and only then prepare a separate production release decision.

### Rollback

- Revert the application commit to remove the visible features and routes.
- The additive migration can remain safely unused during an application rollback. Do not drop tables or columns until any question, summary, audit, or outbox data has passed its retention window and been exported if required.
- If a database rollback is later required, revoke the manual reminder function first, stop workers, then remove new constraints/tables in reverse dependency order. This was not executed.

### Decisions still needed

- Choose whether candidate-question replies should be delivered automatically by email, and define the approved sender, reply-to, consent, and failure policy.
- Confirm retention periods for candidate questions, derived summaries, summary feedback, and recruiter audit events.
- Decide whether to localize the complete employer workspace before release or launch the new employer surfaces in English while candidate-facing Arabic is reviewed.
- Decide whether open-ended recruiter help is valuable enough to fund and govern a constrained provider integration. The current deterministic shortcuts are functional without it.
- Obtain real-user baselines before claiming faster role creation, higher reminder conversion, or reduced review time.

Ready for review. Report: `docs/reviews/muqabala-recruiter-assistance-review.md`. Preview: run `npm run dev -- --hostname 127.0.0.1 --port 3102`, then open `http://127.0.0.1:3102/dev/recruiter-suite`.
