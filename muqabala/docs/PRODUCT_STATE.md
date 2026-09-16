# Muqabala Product State (Single Source of Truth)

Last Updated: 2026-09-16 18:50 UTC

## 1. Production Environment Baseline

| Attribute | Current Value | Notes |
| :--- | :--- | :--- |
| **Live URL** | `https://trymuqabala.com` | Active production service |
| **Production Git Commit** | `8d5c8a2eab65cd80301921b3816af55bc02e4721` | GitHub PR #23 merge commit |
| **Production Git Branch** | `claude/gulf-hospitality-video-interview-m9skfu` | Remote default branch on GitHub |
| **Deployed Source Tree** | Commits `5744e29` / `315a758` | Includes Schools Pilot Release & retry clarity |
| **Vercel Project** | `muqabala` (Team: `inspire14` / `team_IlZz8UvetUXPtSvI4hPqy6fn`) | Production hosting |
| **Vercel Active Deployment** | `dpl_HPJZP8J54AEB3GeCnshPAa15np8L` | Deployed 2026-09-16 |
| **Supabase Project** | `hmaxzpgsefzpflrwzopa` (AWS `eu-west-1`) | PostgreSQL + Auth + Storage + RLS |
| **Production Migration State** | Up to `20260916023211_schools_pilot_enquiry_outbox.sql` | Applied to production Supabase |

---

## 2. Active Worktrees & Branches

```
Worktree Directory                  Branch                                 Head Commit  Status
----------------------------------  -------------------------------------  -----------  ---------------------
muqabala-schools-finish-20260914    codex/schools-enquiry-clarity-20260916  315a758      Clean, Preserved
muqabala-app                        codex/recruiter-suite-20260915         1443e30      Clean, Preserved
muqabala-integration                integration/muqabala-unified-20260916  b073c45      Clean, Unified Build
```

1. **`muqabala-schools-finish-20260914`**:
   - Holds the exact source baseline matching production commit `8d5c8a2`.
   - Preserved as a recovery anchor. Never modify or delete.

2. **`muqabala-app`**:
   - Holds the original isolated Recruiter Assistance Suite branch (`codex/recruiter-suite-20260915`).
   - Clean, preserved as a recovery anchor.

3. **`muqabala-integration`**:
   - Dedicated integration worktree created on 2026-09-16.
   - Branch `integration/muqabala-unified-20260916` merges both the production Schools release and all 8 Recruiter Suite commits with monotonic migrations.
   - Current unified HEAD.

---

## 3. Product Domain Statuses

### A. Candidate Practice & Assessment
- **Status:** **LIVE IN PRODUCTION**
- **Routes:** `/practice`, `/practice/[role]`, `/practice/[role]/interview`, `/feedback`
- **Capabilities:**
  - Real-time video/audio mock interview simulator.
  - Streaming question delivery and voice interaction.
  - AI evaluation rubric and performance scorecards.
- **Bundle Health:** `/practice/accountant` is 201.7 KB gzipped (target budget <= 200 KB). Monitored under ADR-005.

### B. Schools & Educator Suite
- **Status:** **LIVE IN PRODUCTION (PR #23)**
- **Routes:** `/schools`, `/schools/pilot`, `/schools/pilot/receipt`, `/api/schools/pilot-enquiry`
- **Capabilities:**
  - Dedicated institutional landing page explaining pilot terms.
  - Comprehensive enquiry intake form capturing school tier, headcount, curriculum.
  - Transactional email outbox (`schools_pilot_enquiry_outbox`) via Resend.
  - Candidate practice retry intent persistence.
  - Verification test coverage: 50/50 automated tests passing.

### C. Employer & Recruiter Suite
- **Status:** **RECONCILED & VERIFIED (Branch: `integration/muqabala-unified-20260916`)**
- **Routes:** `/employer/interviews/[id]`, `/employer/dashboard`, `/api/employer/...`
- **Capabilities in Integration Branch:**
  - Interactive role questions wizard (`<CandidateRoleQuestions />`).
  - Structured recruiter scorecard authoring and candidate response summaries.
  - Transactional message outbox for candidate reminders.
  - Monotonic migration `20260916120000_recruiter_assistance.sql`.
  - Verification test coverage: 63/63 recruiter and delivery tests passing.
- **Next Gate:** Pending human approval for staging preview deployment.

---

## 4. Database Migration Status

| Migration File | Timestamp | Applied to Prod? | Purpose |
| :--- | :--- | :---: | :--- |
| `20260916023211_schools_pilot_enquiry_outbox.sql` | 2026-09-16 02:32:11 | **YES** | Outbox table and RLS for schools pilot leads |
| `20260916120000_recruiter_assistance.sql` | 2026-09-16 12:00:00 | **NO (Pending)** | Recruiter role questions, answer summaries, outbox extensions |

*Note: Migration was re-timestamped from `20260915120000` to `20260916120000` to preserve monotonic ordering after production's `20260916023211`.*
