# Educator Suite Status & Institutional Gap Analysis

Last Updated: 2026-09-16 20:30 UTC  
Baseline: PR #23 / Commit `8d5c8a2` (Production) + Branch `integration/muqabala-unified-20260916` (P0-A & P0-B Code Complete + Real DB Integration Gate 7/7 Verified)

---

## 1. Executive Summary & Core Purpose
The Muqabala Educator Suite is an **institutional career-readiness and employability platform** designed for:
- Universities
- Colleges
- Vocational institutes
- Career centres
- Employability and placement teams
- Training institutions

Its primary mission is preparing students and learners for video and structured interviews across **diverse industries and occupations** (Finance, Engineering, Tech, Healthcare, Hospitality, Public Sector, Education, etc.). It is NOT architected as a teacher recruitment system; schools hiring teachers is simply one supported vocational use case running on the same flexible institutional architecture.

### Operational Categories:
1. **PRODUCTION VERIFIED**: Live on `trymuqabala.com`, validated against production database and live users.
2. **CODE COMPLETE / TESTED**: Implemented, contract-verified, and passing full domain unit/integration test suites on `integration/muqabala-unified-20260916` (Pending staging migration / production sign-off).
3. **P0-B (Next Up)**: Adviser workflow polish, evidence review, support requests queue.
4. **P1 (Future Roadmap)**: Cohort CSV/PDF exports, institutional branding, multi-campus admin roles.
5. **BLOCKED**: Gated by production safety policies or unapplied database migrations.

---

## 2. Detailed Gap Analysis by Category

### A. PRODUCTION VERIFIED (Live at `trymuqabala.com` on Commit `8d5c8a2`)

| Feature | Surface / Route | Technical Assets | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Institutional Landing Page** | `/schools` | `app/schools/page.tsx`<br>`components/schools/SchoolsLanding.tsx` | Browser QA, Lighthouse, live on `trymuqabala.com` |
| **Pilot Enquiry Form** | `#start-pilot` | `app/schools/page.tsx`<br>`app/api/schools/pilot-contact/route.ts` | Validated in `schools-pilot-operations.test.mjs` |
| **Transactional Email Outbox** | Supabase DB | `supabase/migrations/20260916023211...sql`<br>Table: `schools_pilot_enquiry_outbox` | Deployed to production Supabase `hmaxzpgsefzpflrwzopa` |
| **Student Practice & Retry** | `/schools/me/[id]` | `components/schools/Practice.tsx`<br>`app/schools/me/[id]/page.tsx` | Validated in `schools-practice-retry.test.mjs` |
| **Receipt Confirmation View** | `/schools/receipt` | `app/schools/receipt/page.tsx` | Validated in `schools-pilot-receipt.test.mjs` |
| **Access Routing & Enrolment** | `/schools/access`, `/schools/enrol` | `app/schools/access/page.tsx`<br>`scripts/schools-access-routing.test.mjs` | 8/8 automated routing tests passing |

---

### B. CODE COMPLETE / TESTED (Educator Suite P0-A & P0-B in `integration/muqabala-unified-20260916`)

> [!IMPORTANT]
> These features are verified with automated unit tests and compiled cleanly in the Next.js production build. They are **NOT** deployed to production and their database migrations (`20260916140000`, `20260916160000`) have **NOT** been applied to production Supabase.

| Feature | Surface / Route | Technical Assets | Verification Status |
| :--- | :--- | :--- | :--- |
| **Optional Institutional Hierarchy** | Data model & API | `supabase/migrations/20260916140000_educator_p0a_foundations.sql`<br>`lib/schools/types.ts` (`campus`, `faculty`, `programme`) | Supports 4-tier universities down to flat training centres; zero forced hierarchy fields |
| **Multi-Industry Assignment Engine** | `/schools/cohorts/[id]/assign` | `components/schools/Assign.tsx`<br>`app/api/schools/manage/route.ts` | 10 industry tracks, role titles, competencies, attempt limits; 4/4 contract tests pass |
| **Dynamic 3–8 Question Slots** | Assignment & Practice UI | `components/schools/Assign.tsx`<br>`components/schools/Practice.tsx`<br>`app/schools/me/[id]/page.tsx` | Supports 3 to 8 customizable questions with dynamic reordering; verified end-to-end |
| **Student Roster CSV Import** | `/api/schools/roster` | `lib/schools/roster-import.ts`<br>`app/api/schools/roster/route.ts` | 7/7 unit tests pass (UTF-8 BOM, Arabic student names/headers, delimiters, duplicate detection, dry-run preview) |
| **Batch Enrolment Provisioning** | `/api/schools/roster` (`operation: commit`) | `app/api/schools/roster/route.ts`<br>RPC: `schools_issue_access` | Reuses existing private enrolment link architecture without outbox spam; zero unrequested emails |
| **Core Cohort Tracking Engine** | `/schools/cohorts/[id]` | `lib/schools/dashboard.ts` (`calculateCohortProgress`) | 3/3 tests pass (enrolled, participating, submitted, attempts, rates, coverage). **STRICT PRIVACY: Zero peer ranking.** |
| **Dynamic Evidence & Rubrics** | `/api/schools/feedback` | `lib/schools/evidence.ts`<br>`components/schools/Feedback.tsx` | 3/3 tests pass (evaluates 3–8 questions, dynamic element counts, validates rubric coverage) |
| **First-Class Programme Entity** | `/api/schools/programmes` | `schools_programmes` table<br>`components/schools/ProgrammeModal.tsx`<br>`components/schools/CohortModal.tsx` | 4/4 unit tests pass; validates university and vocational tracks, cohort linkage, non-destructive archiving |
| **Assignment Lifecycle & Immutability** | `/api/schools/manage` | `schools_manage` RPC<br>`lib/schools/types.ts`<br>`components/schools/Assign.tsx` | 4/4 unit tests pass; protects assessment params when attempts exist; safe version duplication |
| **Explainable Intervention Queue** | `/schools/cohorts/[id]` | `lib/schools/intervention.ts`<br>`components/schools/InterventionQueue.tsx` | 5/5 unit tests pass; 5 factual signals; **strictly zero peer ranking or psychological diagnosis** |
| **Student Inbox Upgrade** | `/schools/me` | `lib/schools/student-inbox.ts`<br>`app/schools/me/page.tsx` | 4/4 unit tests pass; categorizes Due vs Completed; tracks attempts, adviser instructions, relative deadlines |
| **Learner Progression Profile** | `/schools/cohorts/[id]/students/[studentId]` | `app/schools/cohorts/[id]/students/[studentId]/page.tsx` | Full attempt history, rubric evidence deltas, support requests, and attempt progression |
| **Institutional Tenant & Role RBAC** | Institutional Data Layer | RLS policies & RPC checks | 6/6 tests pass; cross-institution denial, student analytics exclusion, draft privacy |

---

### C. P0-C (Next Up — Adviser Workflow & Support Queue)

| Feature | Description | Technical Assets | Status |
| :--- | :--- | :--- | :--- |
| **Adviser Review Polish** | Ability for career advisers to review student answers, add private feedback, and track attempt revisions. | `app/schools/cohorts/[id]/review/page.tsx`<br>`components/schools/Review.tsx` | Updated for 3-8 questions; requires review workflow verification |
| **Adviser Evidence Corrections** | Interface for educators to mark missing or present rubric elements with reasons. | `components/schools/EvidenceReview.tsx`<br>`app/api/schools/route.ts` (`correct`) | Updated for 3-8 questions; requires full UX test |
| **Live Support Resolution** | In-app resolution and reply for students requesting adviser support. | `app/schools/cohorts/[id]/support/[studentId]`<br>`components/schools/Support.tsx` | Existing baseline; needs cohort-level support view |

---

### D. P1 (Future Institutional Roadmap)

| Feature | Description | Planned Architecture |
| :--- | :--- | :--- |
| **Cohort Roster & Report CSV/PDF Export** | One-click export of cohort aggregate progress and student submission status for academic reporting. | `/api/schools/cohorts/[id]/export` |
| **Custom Institutional Branding** | White-labeling with university/college logo, theme accents, and custom onboarding instructions. | Extend `schools_institutions` table with branding metadata |
| **Multi-Campus / Faculty Permissions** | RBAC scoping institutional admins to specific faculties or campuses. | Extend `schools_staff` with faculty/campus assignment scopes |
| **LMS / SIS Integration** | LTI 1.3 or webhook integration with Canvas, Blackboard, or Moodle for cohort roster sync. | LTI 1.3 Advantage tool endpoints |

---

### E. BLOCKED (Gated by External Dependencies & Safety Gates)

| Feature | Blocker | Resolution Gate |
| :--- | :--- | :--- |
| **P0-A Database Foundations Migration in Prod** | Production migration gate strictly locked. | Requires explicit human user approval to apply `20260916140000_educator_p0a_foundations.sql` to Supabase `hmaxzpgsefzpflrwzopa`. |
| **Recruiter Assistance Suite in Production** | Production deployment gate locked. | Requires explicit user sign-off on PR merge into default branch. |
| **Production Email Dispatch** | Live Resend API key and verified institutional sender domain required. | Uses pseudonymous private access links; email dispatch remains staged until keys are configured. |
