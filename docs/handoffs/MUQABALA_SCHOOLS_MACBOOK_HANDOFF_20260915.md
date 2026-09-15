# Muqabala Educators Suite MacBook handoff

Date: 15 September 2026

This is the working handoff for continuing the Muqabala Educators Suite on a MacBook. Start from this file and the named remote branch. Do not reconstruct the task from chat history.

## Release boundary

- Repository: `https://github.com/inspireambitions/Design-and-BRAND`
- Application folder: `muqabala/`
- Review branch: `codex/schools-finish-20260914`
- Handoff commit before this document: `51b5e6ec312b6d4f0e6b67a445f314b1f959d2d6`
- Base branch: `claude/gulf-hospitality-video-interview-m9skfu`
- Base branch head at handoff time: `fd469a7b621316e8932d3ba1c495ea45b8a41a53`
- Pull request: <https://github.com/inspireambitions/Design-and-BRAND/pull/21>
- PR state at handoff time: open, no conflicts, all five checks passed
- Protected branch preview: <https://muqabala-git-codex-schools-finish-20260914-inspire14.vercel.app>
- Protected stable preview: <https://muqabala-schools-pilot-20260908-inspire14.vercel.app>
- Corrected immutable deployment: <https://muqabala-puhd99s0i-inspire14.vercel.app>
- Corrected deployment ID: `dpl_CGZ13zZ8PL4yYSuyDeqeisX6yZNw`
- Production was not changed by this review branch.
- Supabase production was not changed by this review branch.

Do not merge the PR, apply the new migration to production, promote a deployment, expose enrolment, or send a real email without the owner's explicit approval for that action.

## Start on the MacBook

For a new checkout:

```bash
git clone https://github.com/inspireambitions/Design-and-BRAND.git
cd Design-and-BRAND
git fetch origin
git switch --track origin/codex/schools-finish-20260914
cd muqabala
npm ci
git status --short
git rev-parse HEAD
```

For an existing checkout:

```bash
cd /path/to/Design-and-BRAND
git fetch origin
git switch codex/schools-finish-20260914
git pull --ff-only
cd muqabala
npm ci
git status --short
git rev-parse HEAD
```

The documentation commit containing this handoff will make `HEAD` newer than `51b5e6e`. Record the fetched SHA. Confirm the working tree is clean before changing code. Fetch and inspect PR 21 before considering a rebase because the base branch moved after the application work was completed. Do not rebase merely because the earlier SHA differs.

Read these files before acting:

1. `AGENTS.md`
2. `docs/handoffs/MUQABALA_SCHOOLS_MACBOOK_HANDOFF_20260915.md`
3. `docs/evidence/schools-astra-handoff-20260914.md`
4. `docs/evidence/schools-preview-release-20260914.json`
5. `muqabala/docs/schools-release-status.md`

The sentence in `muqabala/docs/schools-release-status.md` saying a new preview is not deployed is superseded by the corrected deployment listed above. Recheck live state before updating that document.

## Access bootstrap

No password, token, API key, OTP or private browser session is stored in this repository. The MacBook must authenticate through each provider's normal private sign-in. Stop and let Kim complete any password, OTP or account-choice screen. Never paste a secret into chat, source code, a commit or command output.

### GitHub

- Sign in to the GitHub account that can access `inspireambitions/Design-and-BRAND`.
- Confirm access with `git fetch origin` or `git ls-remote origin`.
- Continue in this repository. Do not create a replacement repository or copy the application elsewhere.

### Vercel

- Required team: `INSPIRE`
- Team slug: `inspire14`
- Team ID: `team_IlZz8UvetUXPtSvI4hPqy6fn`
- Required project: `muqabala`
- Project ID: `prj_mLU2A8yiW61V4a4da54GryoIcSXX`
- Project root: `muqabala`

Sign in through Vercel OAuth, MCP or the CLI, then list the team and project before any write. A team with zero projects, a 403, or the old `Kim K's projects` account means the wrong Vercel identity is connected. Disconnect and reconnect, selecting `INSPIRE`.

Do not download, print or manually relay environment values. It is safe to list environment variable names and scopes. Any approved copy must happen server-side inside the same Vercel project.

### Supabase

- Production project ref: `hmaxzpgsefzpflrwzopa`
- Disposable staging project ref: `okrsezhospztwtptqhpo`
- Staging branch ID: `2314526a-087d-43d3-a84b-348582bad1dd`

Prefer Supabase MCP OAuth. Confirm the connected account can see both project refs. Work on `okrsezhospztwtptqhpo` only unless Kim explicitly approves a production database action. Production should remain read-only during review.

Never expose a service-role key. A `NEXT_PUBLIC_SUPABASE_*` value may be client-facing only when the application already treats it as public. Service credentials must stay private.

If Supabase MCP is not ready, confirm `https://mcp.supabase.com/mcp` is reachable, complete OAuth privately, then reload the session. An unauthenticated HTTP 401 confirms the endpoint is reachable but not signed in. Do not create another project or branch.

### Resend and inbox verification

The immediate email check should reuse the existing preview-only Vercel configuration. A separate Resend login is not required if Vercel performs the approved server-side copy.

Gmail access is required only to prove inbox receipt. Let Kim complete private Gmail sign-in and any OTP. Provider acceptance is not the same as inbox receipt. Never claim inbox receipt without reading the controlled test inbox.

## What is completed and verified

- The Educators Suite is substantially built and isolated from the employer and practice products.
- The educator cohort dashboard shows active students, current assignment, due date, submitted count, awaiting-review count and one next action.
- The institution participation dashboard shows active cohorts, enrolled students, submissions, missing submissions, awaiting review, open support and active assignment dates.
- Institution administrators cannot see student drafts, answers, feedback, evidence or adviser comments through the dashboard.
- An institution dashboard preview HTTP 500 was fixed. Operational cohort columns are now read with a server-only service client only after institution-admin membership is verified. The learner-safe grant remains limited to cohort ID and name.
- Migration `muqabala/supabase/migrations/20260914052511_schools_dashboard_performance.sql` adds 28 missing Schools foreign-key indexes and optimises three RLS policies without changing access predicates.
- The migration is applied only to staging. Staging has two idempotent history entries named `schools_dashboard_performance` because the branch was reset and reapplied. Production contains neither entry.
- Post-migration staging checks found no Schools `unindexed_foreign_keys` or `auth_rls_initplan` findings. Service-only no-policy notices and unused-index information remain expected. The unrelated leaked-password warning remains unchanged.
- The full automated suite passed 543 tests with zero failures.
- TypeScript passed.
- The production build passed with 135 routes.
- The bundle gate passed all 69 catalogue pages. The largest entry was 198.3 KB against the strict 200 KB limit.
- Release ancestry passed for required commits `b5d6241` and `47a076f`.
- Lighthouse accessibility scored 100 on the Schools landing page, student home, cohort, review and institution admin pages.
- Thirty route and viewport checks passed at 320, 375, 390, 768, 1280 and 1440 pixels. They found no horizontal overflow, browser errors or hidden keyboard focus.
- A synthetic student journey passed timed autosave, refresh recovery, adviser draft privacy and exactly-once submission after a lost response.
- Database security checks cover cross-institution denial, employer denial, draft privacy, direct-write denial, idle and revoked session denial, deletion and retention boundaries.
- Five concurrent synthetic feedback journeys made exactly five model calls. All succeeded and reached `ready`. Usage was 5,240 input and 1,815 output tokens, estimated at USD 0.005 using the verified GPT-4.1 mini rates.
- Live protected-preview checks returned HTTP 200 for `/schools`, learner dashboard, adviser cohort dashboard and institution dashboard.

The five-call check is bounded evidence only. It does not prove classroom-scale or provider-wide capacity.

## Pending work in priority order

### P0: Fresh current-preview email proof

Historical email evidence on the old configured preview proves provider acceptance, inbox receipt, exactly-once delivery and replay idempotency. It is not fresh proof for the corrected branch.

This session found seven queued messages, proved by aggregate queries that all seven were synthetic, then removed only those synthetic staging rows. A fresh attempt against the old email-enabled deployment returned HTTP 404 because that deployment did not contain the current `/api/schools/mail` route. The temporary staff invitation was cleaned. No new email was sent.

The corrected review branch still needs these existing preview-only variables copied from `codex/schools-pilot-20260908` to `codex/schools-finish-20260914`:

- `SCHOOLS_RESEND_API_KEY`
- `SCHOOLS_EMAIL_FROM`
- `CRON_SECRET`

The values must never be shown. The target must be Preview only and branch `codex/schools-finish-20260914`. Production must not change.

Kim has not yet given the exact approval required for this three-variable copy and controlled send. Ask for this exact approval before acting:

> Approve copying `SCHOOLS_RESEND_API_KEY`, `SCHOOLS_EMAIL_FROM` and `CRON_SECRET` from the old Schools preview branch to the new preview branch without printing their values, then send one temporary staff invitation to the controlled Gmail test inbox.

After approval:

1. Reconfirm Vercel team and project IDs.
2. Copy the three values server-side without printing them.
3. Scope them to Preview and `codex/schools-finish-20260914` only.
4. Redeploy the corrected review branch.
5. Create one temporary staff invitation for the controlled QA inbox.
6. Verify an unauthorised mail-worker request returns 401.
7. Run two concurrent authorised worker calls and prove exactly one provider acceptance.
8. Prove the provider message ID is stored.
9. Replay the same job and prove the same provider ID is returned.
10. Run a third claim and prove it sends zero messages.
11. Verify the retention endpoint rejects missing cron authorisation.
12. Clean the temporary invitation and outbox data.
13. Report provider acceptance separately from inbox receipt.

Inspect the existing Schools email QA scripts before running them. Several scripts were written for the old branch and must not be run unchanged if they hard-code `codex/schools-pilot-20260908`.

### P1: Astra review and PR decision

GPT-6 Astra should inspect:

- tenant and institution isolation
- adviser draft privacy
- membership verification before service-role reads
- dashboard aggregation rules
- the 28 indexes
- the three RLS init-plan rewrites
- responsive and accessibility evidence
- exact release claims

PR 21 was open, conflict-free and green at handoff time. Fetch the current base and recheck the PR before merging because the base branch moved. Do not treat green automation as production approval. Merge only on Kim's explicit instruction.

### P2: Human device and sharing checks

Still required:

- one complete journey on a physical iPhone using Safari
- one complete journey on a physical Android device using Chrome
- real WhatsApp preview-card check
- real iMessage preview-card check
- real LinkedIn preview-card check
- assistive-technology review beyond automated Lighthouse

Record the device, browser, route, expected result and actual result. Do not call emulation a physical-device test.

### P3: Supervised pilot and founder inputs

Run a supervised five-person pilot using approved fictional content before any wider cohort. Large-group AI capacity is not proven.

Kim must supply or approve:

- institution name and authorised contact
- written adult-only confirmation
- teaching language
- adviser-approved roles, questions and rubric descriptors
- signed data-processing terms and approved suppliers
- evaluation dates, success thresholds and named owner
- AI budget and stop rule
- paid continuation offer if the pilot succeeds

Also obtain independent review of feedback usefulness and assessment validity. Do not invent these inputs.

### P4: Production release, only after the gates above

Before any production release:

- reverify the production branch, deployment and database state live
- prove the current-preview email flow
- complete the physical-device and sharing checks
- complete the supervised five-person pilot
- confirm supplier deletion receipts, retention handling, backup expiry and final institutional privacy position
- prove two actual unattended schedule invocations if schedules will be relied on
- obtain explicit production deployment and production migration approval

Production currently has the public `/schools` page and Schools migrations recorded by the existing release status, but private enrolment is closed and there is no live institution, cohort, student, assignment or feedback pilot. Reverify this live before relying on it because provider and production state can change.

## Safe verification commands

Run from `muqabala/`:

```bash
npm ci
npm run typecheck
npm run test:resilience
npm run build
npm run check:bundle
node --experimental-strip-types --test --test-isolation=none scripts/schools-dashboard.test.mjs
```

Do not run `npm audit fix --force`. The last clean install reported 1,212 audited packages and eight moderate vulnerabilities. Review upgrades separately without forcing breaking dependency changes.

## Evidence files

- `docs/evidence/schools-astra-handoff-20260914.md`
- `docs/evidence/schools-preview-release-20260914.json`
- `docs/evidence/schools-worker-preview.json`
- `docs/evidence/schools-assignment-worker-preview.json`
- `muqabala/docs/schools-release-status.md`
- `muqabala/docs/schools-pilot-plan.md`
- `docs/schools-build-log.md`

The two worker evidence files are historical proof from the earlier configured preview. Do not present them as fresh proof for the corrected branch.

## First response expected from the new session

Perform a read-only orientation first. Report a compact table with `DONE`, `PENDING` and `BLOCKED` for:

- GitHub access and fetched branch SHA
- PR 21 state and current base SHA
- Vercel team and project access
- corrected preview health
- Supabase production and staging visibility
- production unchanged status
- fresh email proof
- physical-device checks
- supervised pilot gates

Then continue with P0 if Kim gives the exact approval above. If a private login or OTP appears, stop for Kim to complete it. Do not ask Kim to restate the project.

## Copyable continuation prompt

```text
Continue the Muqabala Educators Suite from the repository handoff at docs/handoffs/MUQABALA_SCHOOLS_MACBOOK_HANDOFF_20260915.md. Use https://github.com/inspireambitions/Design-and-BRAND, branch codex/schools-finish-20260914, app folder muqabala, and PR https://github.com/inspireambitions/Design-and-BRAND/pull/21. Read AGENTS.md and the handoff fully before acting. Start with a read-only access and current-state check for GitHub, Vercel team INSPIRE/inspire14 project muqabala, and Supabase production hmaxzpgsefzpflrwzopa plus staging okrsezhospztwtptqhpo. Do not expose secrets, create replacement projects, merge, migrate production, promote production, open enrolment or send email without the exact approval required in the handoff. Stop for me at any password, OTP or private account-choice screen. Report DONE, PENDING and BLOCKED, then continue from the first authorised pending action without asking me to restate the project.
```
