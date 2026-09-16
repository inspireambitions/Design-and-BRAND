# Architecture Decision Records (ADRs)

## ADR-001: Monotonic Migration Ordering
- **Date:** 2026-09-16
- **Status:** Accepted
- **Context:**
  The Recruiter Assistance Suite branch (`codex/recruiter-suite-20260915`) created a migration named `20260915120000_recruiter_assistance.sql`. Meanwhile, the Schools Pilot branch deployed migration `20260916023211_schools_pilot_enquiry_outbox.sql` to live production.
  If the recruiter migration kept its original timestamp, Supabase and migration runners would attempt to apply a migration dated September 15 *after* a migration dated September 16, violating chronological monotonic order.
- **Decision:**
  Re-timestamped the recruiter migration to `20260916120000_recruiter_assistance.sql`. Updated all test files referencing the migration filename (`employer-video-screening.test.mjs`, `employer-delivery-sql.test.mjs`, `recruiter-suite.test.mjs`).
- **Consequences:**
  Guarantees deterministic, forward-only migration sequence when applying to staging and production databases.

---

## ADR-002: Worktree Isolation Protocol for Multi-Agent Delivery
- **Date:** 2026-09-16
- **Status:** Accepted
- **Context:**
  Multiple agents work concurrently on separate features (Schools release, Recruiter suite, QA reviews). Working in a single working directory causes git index locks, uncommitted file overwrites, and accidental cross-branch contamination.
- **Decision:**
  All reconciliation and major feature integrations MUST occur in isolated git worktrees created with `/Library/Developer/CommandLineTools/usr/bin/git worktree add`.
  Specifically:
  - `muqabala-schools-finish-20260914`: Preserved production anchor.
  - `muqabala-app`: Preserved recruiter suite anchor.
  - `muqabala-integration`: Clean unified staging worktree.
- **Consequences:**
  Eliminates worktree thrashing. Preserves recovery points so any botched integration can be abandoned without touching source worktrees.

---

## ADR-003: Coexistence Strategy in `EmployerVideoInterview.tsx`
- **Date:** 2026-09-16
- **Status:** Accepted
- **Context:**
  Two feature branches modified `components/employer/EmployerVideoInterview.tsx`:
  1. Schools release added a confirmation modal when leaving the screening session (`<a className={styles.brand} href="/" onClick={handleBrandClick}>`).
  2. Recruiter suite added the custom role questions wizard (`<CandidateRoleQuestions />`) and associated question management state.
- **Decision:**
  Preserved both enhancements in their entirety. The brand navigation confirmation guard protects active recruiter sessions from accidental exit, while the role questions component provides recruiter customizability.
- **Consequences:**
  Both test suites (`scripts/employer-video-screening.test.mjs` and `npm run test:recruiter-suite`) pass with 100% assertions satisfied.

---

## ADR-004: Shared Multi-Agent Memory Architecture
- **Date:** 2026-09-16
- **Status:** Accepted
- **Context:**
  When multiple AI agents (Claude, Antigravity, etc.) or human engineers interact with the repository, context regarding production SHAs, active branches, and pending database changes is lost between sessions.
- **Decision:**
  Adopt a mandatory file-based contract:
  - `AGENTS.md`: Pre-flight protocol required before any edits.
  - `docs/PRODUCT_STATE.md`: Single source of truth for production, branches, deployments, and databases.
  - `docs/CURRENT_SPRINT.md`: Live task tracker and milestones.
  - `docs/DECISIONS.md`: Log of architectural decisions.
  - `docs/AGENT_HANDOFF.md`: Chronological agent handover log.
- **Consequences:**
  Any agent starting work immediately synchronizes with the true system state, preventing accidental regressions or double-work.

---

## ADR-005: Candidate Practice Bundle Budget & i18n Strategy
- **Date:** 2026-09-16
- **Status:** Accepted
- **Context:**
  Next.js build generates a warning that `/practice/accountant` is 201.7 KB gzipped, exceeding the target budget of 200.0 KB. Analysis reveals that the recruiter suite added extensive bilingual strings into the central `lib/i18n.ts` dictionary, which is imported into candidate practice components.
- **Decision:**
  Accept 201.7 KB for the immediate reconciliation since it was already present in the validated recruiter branch. In the upcoming sprint, decouple recruiter-specific dictionary keys into domain-specific modules (`lib/i18n/recruiter.ts`) loaded dynamically only on recruiter routes.
- **Consequences:**
  Candidate practice routes will drop back well under 190 KB gzipped once domain-level code-splitting is applied.
