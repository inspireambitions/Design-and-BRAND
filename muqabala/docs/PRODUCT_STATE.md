# Muqabala Product State (Single Source of Truth)

Last Updated: 2026-09-16 19:25 UTC

## 1. Production Environment Baseline

| Attribute | Current Value | Notes |
| :--- | :--- | :--- |
| **Live URL** | `https://trymuqabala.com` | Active production service (UNTOUCHED) |
| **Production Git Commit** | `8d5c8a2eab65cd80301921b3816af55bc02e4721` | GitHub PR #23 merge commit |
| **Production Git Branch** | `claude/gulf-hospitality-video-interview-m9skfu` | Remote default branch on GitHub |
| **Deployed Source Tree** | Commits `5744e29` / `315a758` | Includes Schools Pilot Release & retry clarity |
| **Vercel Project** | `muqabala` (Team: `inspire14` / `team_IlZz8UvetUXPtSvI4hPqy6fn`) | Production hosting |
| **Vercel Active Deployment** | `dpl_HPJZP8J54AEB3GeCnshPAa15np8L` | Deployed 2026-09-16 |
| **Supabase Project** | `hmaxzpgsefzpflrwzopa` (AWS `eu-west-1`) | PostgreSQL + Auth + Storage + RLS |
| **Production Migration State** | Up to `20260916023211_schools_pilot_enquiry_outbox.sql` | Applied to production Supabase |

---

## 2. Preview Environment Baseline (Integration Branch)

| Attribute | Current Value | Notes |
| :--- | :--- | :--- |
| **Preview Branch** | `integration/muqabala-unified-20260916` | Pushed to GitHub `origin` |
| **Preview Commit SHA** | `dc31b149e4aef26a2230094e32190e475e9d21f8` | Includes unified code + memory contracts |
| **Vercel Preview URL** | `https://muqabala-git-integration-muqabala-unified-20260916-inspire14.vercel.app` | Built & Deployed successfully |
| **Vercel Inspection URL**| `https://vercel.com/inspire14/muqabala/4GxMaNtm2UhKwo9zKG1Fyoj6rX1j` | Status: `success` |
| **Vercel Protection** | Vercel SSO Deployment Protection Active | Accessible by logged-in team or share token |
| **Connected Database** | `hmaxzpgsefzpflrwzopa` (Production Supabase) | Project env vars inherited |
| **Database Safety State** | **STRICT READ-ONLY / NO-MIGRATION** | Migration `20260916120000` NOT applied |
| **E2E Browser QA** | **20 / 20 Tests Passed** | Verified across Candidate, Employer, Educator, Platform |

---

## 3. Active Worktrees & Branches

```
Worktree Directory                  Branch                                 Head Commit  Status
----------------------------------  -------------------------------------  -----------  ---------------------
muqabala-schools-finish-20260914    codex/schools-enquiry-clarity-20260916  315a758      Clean, Preserved Anchor
muqabala-app                        codex/recruiter-suite-20260915         1443e30      Clean, Preserved Anchor
muqabala-integration                integration/muqabala-unified-20260916  dc31b14      Clean, Deployed to Preview
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
- **Status:** **PRODUCTION BASELINE LIVE; EDUCATOR SUITE P0-A CODE COMPLETE & TESTED**
- **QA Results:** 5/5 preview tests passed; 17/17 P0-A domain tests passed (Roster, Tracking, Multi-Industry Assignments, Dynamic Evidence).
  - `/schools` landing renders institutional hero and pilot enquiry CTAs.
  - Pilot enquiry form `#start-pilot` presents 4 interactive fields.
  - `/schools/access` cleanly separates Educator and Student entry paths.
  - `/schools/enrol` renders student account onboarding.
  - `/schools/cohorts` guarded behind session/membership validation.
  - Optional institutional hierarchy (`campus`, `faculty`, `programme`) active in schema and API.
  - Dynamic 3–8 question multi-industry assignments verified end-to-end.
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
| `20260916120000_recruiter_assistance.sql` | 2026-09-16 12:00:00 | **NO (Pending)** | Recruiter role questions, answer summaries, outbox extensions |
| `20260916140000_educator_p0a_foundations.sql` | 2026-09-16 14:00:00 | **NO (Pending)** | Optional hierarchy (`campus`, `faculty`, `programme`), multi-industry assignment fields, 3-8 question index constraint relaxation, student identifier |
