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

---

## ADR-006: Flexible Institutional Hierarchy & Multi-Industry Assignment Engine (Educator Suite P0-A)
- **Date:** 2026-09-16
- **Status:** Accepted
- **Context:**
  The Educator Suite was originally conceived narrowly around schools hiring teachers. However, its primary institutional purpose is a career-readiness and employability platform for universities, colleges, vocational institutes, and career centres across diverse industries (Finance, Engineering, Tech, Healthcare, Hospitality, etc.).
  Institutions differ significantly in organisational structure: a large university has `Campus -> Faculty/School -> Programme -> Cohort`, whereas a vocational training centre may operate flat cohorts directly under the institution.
  Additionally, educator assignments must support 3 to 8 interview questions with role descriptions and competencies, and cohort tracking must strictly protect student privacy by never exposing peer rankings or comparative leaderboards.
- **Decision:**
  1. Made `campus`, `faculty`, and `programme` fully optional nullable fields on `schools_cohorts`. Flat institutions leave them `null` without friction.
  2. Preserved the SQL table names (`schools_*`) for database safety, avoiding risky table renames while generalizing the domain model in TypeScript (`InstitutionalHierarchy`, `FlexibleAssignmentPayload`, `INSTITUTIONAL_INDUSTRIES`).
  3. Upgraded the assignment schema and engine from a rigid 3-question limit to 3–8 dynamic questions with customizable role titles, job descriptions, and competencies across 10 industry tracks.
  4. Expanded student Practice, feedback evaluation (`calculateEvidence`, `schoolsFeedbackSchema`), and review interfaces to dynamically handle 3–8 questions and rubrics.
  5. Built a robust CSV roster import parser supporting UTF-8 BOM, Arabic student names/headers (`الرقم الجامعي`, `الاسم`, `البريد الإلكتروني`), delimiter autodetection, and dry-run validation before access link provisioning.
  6. Implemented aggregate cohort progress metrics with zero comparative student rankings.
- **Consequences:**
  The platform seamlessly accommodates both deep collegiate structures and flat training programmes, eliminates the teacher recruitment bias, and provides a scalable foundation for multi-industry career-readiness assignments while strictly protecting student privacy.

---

## ADR-007: First-Class Programme Model, Assessment Immutability, and Factual Intervention Engine (Educator Suite P0-B)
- **Date:** 2026-09-16
- **Status:** Accepted
- **Context:**
  Institutional educators need to organize learners into curricula (`BSc Computer Science`, `Diploma in Accounting`), assign practice tasks, track completion, identify learners needing support, and inspect individual progress over time.
  Three critical architectural requirements emerged:
  1. *Curriculum Structure:* Programmes must be proper first-class institutional entities supporting both deep collegiate hierarchies (`University -> Faculty -> Programme -> Cohort`) and flat vocational structures (`Training Institution -> Programme -> Cohort` or direct cohorts).
  2. *Evaluation Fairness & Immutability:* If an educator edits assessment questions, competencies, or attempt limits while students are actively completing an assignment, historical attempts become invalidated and evaluation fairness is broken.
  3. *Intervention Ethics & Explainability:* Career centres need to identify students falling behind or struggling, but must NEVER label, rank, or diagnose students psychologically or medically. Every intervention signal must be 100% explainable from stored facts.
- **Decision:**
  1. Created `schools_programmes` table (`id`, `institution_id`, `name`, `code`, `campus`, `faculty`, `description`, `status`) with index on `(institution_id, status)`. Linked `schools_cohorts.programme_id` as an optional foreign key (`ON DELETE SET NULL`), maintaining strict multi-tenant RLS isolation.
  2. Implemented explicit assignment lifecycle states (`draft`, `published`, `closed`). Implemented strict assessment immutability in `schools_manage` (`edit_assignment`): once any student attempt exists, mutations to `question_ids`, `role_id`, `competencies`, `job_title`, `job_description`, and `max_attempts` are permanently rejected with a 409 conflict. Educators can still adjust `due_at`, `instructions`, and `status`. To modify assessment parameters, educators must use `duplicate_assignment`, which creates version $N+1$ in `draft` state linked to the parent via `duplicated_from_id`.
  3. Built a pure, deterministic Intervention Engine (`lib/schools/intervention.ts`) that detects 5 factual signals: `deadline_unstarted`, `stalled_draft`, `low_evidence`, `stagnant_attempts`, and `support_requested`. Every signal cites concrete stored evidence (hours since draft, attempt count, rubric elements present) with zero psychometric diagnoses and zero peer comparisons.
  4. Built `buildStudentInbox` and upgraded `/schools/me` to separate assignments into "Due & In Progress" vs "Completed & Reviewed", surfacing relative deadlines, attempt limits, and educator instructions.
  5. Built learner progression profile at `/schools/cohorts/[id]/students/[studentId]`, tracking attempt-over-attempt evidence deltas.
- **Consequences:**
  Institutional curriculum organization is first-class; assessment fairness and auditability are guaranteed; educators receive explainable intervention queues; students get clarity on remaining attempts and adviser instructions; and privacy is strictly preserved.
