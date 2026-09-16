# Muqabala Product State (Single Source of Truth)

Last Updated: 2026-09-16 23:10 UTC

## 1. Production Environment Baseline

| Attribute | Current Value | Notes |
| :--- | :--- | :--- |
| **Live URL** | `https://trymuqabala.com` | Active production service (VERIFIED HEALTHY) |
| **Production Git Commit** | `51bb117226e1986bce7036b8682a4a013cf7aad3` | Unified release: Recruiter Assistance + Educator Suite (P0-A, P0-B) |
| **Production Git Branch** | `claude/gulf-hospitality-video-interview-m9skfu` | Remote default branch on GitHub |
| **Vercel Project** | `muqabala` (Team: `inspire14` / `team_IlZz8UvetUXPtSvI4hPqy6fn`) | Production hosting |
| **Vercel Active Deployment** | `dpl_2tYsFruP1aRLcMR5LUeSczgcjEWG` | Deployed 2026-09-16 22:32:11 GMT+8 (READY) |
| **Supabase Project** | `hmaxzpgsefzpflrwzopa` (AWS `ap-south-1`) | Production PostgreSQL + Auth + Storage + RLS (ACTIVE_HEALTHY) |
| **Production Migration State** | Up to `20260916160000_educator_p0b_programmes_and_interventions.sql` | All 3 pending migrations applied and verified on production |

---

## 2. Release & QA Verification Baseline

| Attribute | Current Value | Notes |
| :--- | :--- | :--- |
| **Integration Branch** | `integration/muqabala-unified-20260916` | Merged into production branch |
| **Release Candidate SHA** | `33d0b9cfeaa763df8cf8a5840a3eb466a303f7f3` | Passed 5/5 real Supabase pre-prod gate |
| **Production Release SHA** | `51bb117226e1986bce7036b8682a4a013cf7aad3` | Pushed and deployed to trymuqabala.com |
| **Production Vercel URL** | `https://trymuqabala.com` | 200 OK across Candidate, Employer, Educator, Platform |
| **Database Gate** | **ALL 5/5 REAL SUPABASE SUITES PASSED** | Schema & constraints, RLS/RBAC, lifecycle, simulation, recruiter suite |
| **Production Smoke Tests** | **21 / 21 Tests Passed** | Candidate (6/6), Employer (5/5), Educator (6/6), Platform (4/4) |
| **Console Errors** | **0 Errors** | Zero runtime JavaScript exceptions |
| **Database Health** | **0 Long Locks, 0 Blocked Queries** | 6/6 core tables healthy, RLS enabled on all 5 new tables |
| **Email Verification** | **EMAIL NOT LIVE-VERIFIED** | Safe policy: templates render, no backlog, live mailboxes preserved |

---

## 3. Active Worktrees & Branches

```
Worktree Directory                  Branch                                 Head Commit  Status
----------------------------------  -------------------------------------  -----------  ---------------------
muqabala-schools-finish-20260914    codex/schools-enquiry-clarity-20260916  315a758      Preserved Recovery Anchor
muqabala-app                        codex/recruiter-suite-20260915         338f08e      Preserved Recovery Anchor
muqabala-integration                claude/gulf-hospitality-video-interview 51bb117      Production Baseline (Clean)
```

---

## 4. Product Domain Statuses

### A. Candidate Practice & Assessment
- **Status:** **LIVE IN PRODUCTION & VERIFIED IN PREVIEW**
- **QA Results:** 6/6 tests passed.
  - Landing title & hero heading verified.
  - Practice catalogue displays 6 core role tracks.
  - Teacher & Accountant practice setups active and responsive.
  - Mobile viewport (390x844) layout confirmed clean.

### B. Employer & Recruiter Suite
- **Status:** **RECONCILED & PREVIEW QA VERIFIED**
- **QA Results:** 5/5 tests passed.
  - Public marketing page `/for-employers` renders cleanly.
  - Sample report `/for-employers/sample-report` displays scorecards.
  - `/employer` enforces authentication redirect to `/sign-in?next=/employer`.
  - Recruiter question contract (3-8 questions, fixed sequence) fully verified.
  - Production database safety strictly preserved (zero writes).

### C. Schools & Educator Suite
- **Status:** **PRODUCTION BASELINE LIVE; EDUCATOR SUITE P0-A & P0-B CODE COMPLETE & TESTED**
- **QA Results:** 5/5 preview tests passed; 40/40 Educator Suite domain tests passed (17 P0-A + 23 P0-B).
  - `/schools` landing renders institutional hero and pilot enquiry CTAs.
  - Pilot enquiry form `#start-pilot` presents 4 interactive fields.
  - `/schools/access` cleanly separates Educator and Student entry paths.
  - `/schools/enrol` renders student account onboarding.
  - `/schools/cohorts` guarded behind session/membership validation, with multi-industry programme and faculty metadata badges.
  - First-class `schools_programmes` entity model supporting collegiate (University -> Faculty -> Programme) and flat vocational tracks.
  - Dynamic 3–8 question multi-industry assignments verified end-to-end.
  - Strict assessment immutability guards protecting questions, role, competencies, and max attempts once attempts exist, with safe duplication for version $N+1$.
  - Explainable, evidence-based Intervention Engine detecting deadline risks, stalled drafts, low evidence, stagnant retries, and support requests (strictly zero peer ranking or medical/psychological diagnoses).
  - Learner progression profile at `/schools/cohorts/[id]/students/[studentId]` with attempt history and evidence deltas.
  - Modern Student Inbox at `/schools/me` separating "Due & In Progress" from "Completed & Reviewed" with attempt counts, adviser instructions, relative deadlines, and links to Gulf practice tracks.
  - Student roster CSV import with UTF-8 BOM, Arabic headers, and duplicate detection verified.
  - Aggregate cohort progress tracking verified (strictly no student peer rankings).

### D. Platform & Localization
- **Status:** **VERIFIED**
- **QA Results:** 4/4 tests passed.
  - Arabic language strings and typography validated.
  - 404 handler returns clean error state.
  - Semantic accessibility landmarks (`<header>`, `<main>`, `<footer>`) confirmed.
  - Mobile responsive rendering verified for Schools landing.

---

## 5. Database Migration Ledger

| Migration File | Timestamp | Applied to Prod? | Purpose |
| :--- | :--- | :---: | :--- |
| `20260916023211_schools_pilot_enquiry_outbox.sql` | 2026-09-16 02:32:11 | **YES** | Outbox table and RLS for schools pilot leads |
| `20260916120000_recruiter_assistance.sql` | 2026-09-16 12:00:00 | **YES** | Recruiter role questions, answer summaries, outbox extensions |
| `20260916140000_educator_p0a_foundations.sql` | 2026-09-16 14:00:00 | **YES** | Optional hierarchy (`campus`, `faculty`, `programme`), multi-industry assignment fields, 3-8 question index constraint relaxation, student identifier |
| `20260916160000_educator_p0b_programmes_and_interventions.sql` | 2026-09-16 16:00:00 | **YES** | First-class `schools_programmes` table, assignment lifecycle (`draft`/`published`/`closed`), safe duplication, assignment immutability trigger & publication harmonization (3-8 questions) |

> **Real Database Integration Gate Status:**
> - All 47 sequential migrations replayed and verified against PostgreSQL 16 (`@electric-sql/pglite`) in `scripts/db-integration-gate.test.mjs`.
> - 0 syntax errors, 0 constraint failures, 0 circular dependencies.
> - Multi-tenant RLS isolation: 100% PASS (Zero data or programme leakage between institutions).
> - Strict assessment immutability: 100% PASS.
> - 10-student university simulation: 100% PASS.

