# Educator & Schools Suite Status & Gap Analysis

Last Updated: 2026-09-16 18:50 UTC  
Baseline: PR #23 / Commit `8d5c8a2` (Production) + Commit `b073c45` (Unified Integration)

---

## 1. Executive Summary
The Educator & Schools Suite aims to provide institutional recruitment, candidate practice, and screening infrastructure tailored for private and international educational institutions in the Gulf region.

This document classifies every component of the Educator Suite into one of five rigorous operational categories:
1. **PRODUCTION VERIFIED**: Live on `trymuqabala.com`, validated against production database and browser QA.
2. **BUILT BUT UNVERIFIED**: Implemented and code-complete in integration branch, awaiting staging/preview testing.
3. **PARTIAL**: Basic foundation built, but core features or workflows remain incomplete.
4. **MISSING**: Required for full institutional product delivery, but not yet designed or implemented.
5. **BLOCKED**: Implementation or deployment prevented by an upstream dependency or policy gate.

---

## 2. Detailed Gap Analysis by Category

### A. PRODUCTION VERIFIED (Live at `trymuqabala.com`)

| Feature | Surface / Route | Technical Assets | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Institutional Landing Page** | `/schools` | `app/schools/page.tsx`<br>`components/schools/SchoolsLanding.tsx` | Browser QA, Lighthouse, live on `trymuqabala.com` |
| **Pilot Enquiry Form** | `/schools/pilot` | `app/schools/pilot/page.tsx`<br>`components/schools/PilotEnquiryForm.tsx` | Form validation test, live on `trymuqabala.com` |
| **Lead Capture API** | `/api/schools/pilot-enquiry` | `app/api/schools/pilot-enquiry/route.ts` | Validated in `schools-pilot-operations.test.mjs` |
| **Transactional Email Outbox** | Supabase DB | `supabase/migrations/20260916023211...sql`<br>Table: `schools_pilot_enquiry_outbox` | Deployed to production Supabase `hmaxzpgsefzpflrwzopa` |
| **Practice Retry Intent** | `/practice/teacher` | `components/interview/InterviewPractice.tsx`<br>LocalStorage: `practice_retry_intent` | Validated in `schools-practice-retry.test.mjs` |
| **Receipt Confirmation View** | `/schools/pilot/receipt` | `app/schools/pilot/receipt/page.tsx` | Validated in `schools-pilot-receipt.test.mjs` |
| **Institutional Access Routing** | Edge middleware / routing | `scripts/schools-access-routing.test.mjs` | 8/8 automated routing tests passing |

---

### B. BUILT BUT UNVERIFIED (In `integration/muqabala-unified-20260916`)

| Feature | Surface / Route | Technical Assets | Verification Status |
| :--- | :--- | :--- | :--- |
| **Recruiter Role Question Wizard** | `/employer/interviews/[id]` | `components/employer/CandidateRoleQuestions.tsx` | 20/20 unit tests pass; awaiting staging UI test |
| **Answer Summarization Engine** | `/api/employer/answer-summaries` | `app/api/employer/answer-summaries/route.ts`<br>Table: `employer_answer_summaries` | Contract tests pass; awaiting production DB migration |
| **Screening Outbox Delivery** | Outbox worker | `scripts/employer-delivery-sql.test.mjs`<br>Table: `employer_message_outbox` | 19/19 SQL tests pass; awaiting worker deployment |
| **Monotonic Migration** | Database DDL | `supabase/migrations/20260916120000_recruiter_assistance.sql` | Syntax & DDL verified; pending staging migration run |

---

### C. PARTIAL (Foundations Built, Needs Enhancement)

| Feature | Current State | Missing Functionality | Priority |
| :--- | :--- | :--- | :--- |
| **Educator-Specific Rubrics** | Uses standard candidate evaluation engine for `/practice/teacher`. | Needs specialized educator evaluation criteria (pedagogical methods, classroom management, curriculum standards like IB/British/American). | Medium |
| **School Administrator Portal** | Inquiries are captured in database outbox; recruiters can review individual candidate interviews. | No unified institutional dashboard for a school HR team to view all applicants in an active cohort. | High |
| **Bilingual Localization** | Arabic & English strings present in `lib/i18n.ts`. | Recruiter dictionary strings currently inflate the candidate bundle size (`/practice/accountant` is 201.7 KB gzipped). Needs code-splitting. | Medium |

---

### D. MISSING (Not Yet Implemented)

| Feature | Description | Planned Architecture |
| :--- | :--- | :--- |
| **Bulk Teacher Invitation Tool** | Ability for school HR to upload a CSV of candidate emails and issue batch video interview invitations. | New route `/schools/invites/bulk` with CSV parser and batch insert into `role_invites`. |
| **School Pilot Agreement Signing** | Automated contract generation or digital terms acceptance for schools moving from pilot to paid contract. | Integrated DocuSign / SignNow webhook or built-in agreement acceptance flow. |
| **Custom Institutional Branding** | Displaying school logo, school colors, and customized welcome video on candidate interview pages. | Extend `schools_pilot_enquiries` with `branding_assets` JSONB column. |
| **Batch Export of Teacher Scorecards** | One-click PDF or CSV export of all candidate scores for institutional hiring committees. | Headless PDF generation route `/api/schools/cohort/[id]/export`. |

---

### E. BLOCKED (Gated by External Dependencies)

| Feature | Blocker | Resolution Gate |
| :--- | :--- | :--- |
| **Recruiter Assistance Suite in Production** | Production deployment gate locked. | Requires user explicit sign-off on unified reconciliation, followed by preview deployment verification and staging database migration. |
| **Live Email Dispatch for Schools Outbox** | Resend API production keys required in outbox processor worker. | Outbox is capturing leads safely in Supabase; live dispatch worker requires verified Resend production sender domain. |
