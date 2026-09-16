# Muqabala System Architecture

## 1. High-Level System Topology

```
                   +-----------------------------------------------+
                   |                Vercel Edge/CDN               |
                   |               trymuqabala.com                 |
                   +-----------------------------------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
+-----------------------------+                           +-----------------------------+
|    Candidate Experience     |                           |    Institutional Surfaces   |
|-----------------------------|                           |-----------------------------|
| /practice/[role]            |                           | /schools                    |
| /practice/[role]/interview  |                           | /schools/pilot              |
| WebRTC / Audio / Video      |                           | /employer/interviews/[id]   |
+-----------------------------+                           +-----------------------------+
         |                                                         |
         +----------------------------+----------------------------+
                                      |
                                      v
                   +-----------------------------------------------+
                   |           Next.js 14 App Router APIs         |
                   |-----------------------------------------------|
                   | /api/schools/pilot-enquiry                    |
                   | /api/employer/role-questions                  |
                   | /api/employer/answer-summaries                |
                   | /api/interview/session                        |
                   +-----------------------------------------------+
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
   +-----------------------------------+    +--------------------+
   |         Supabase Database         |    |   Resend Email     |
   |-----------------------------------|    |--------------------|
   | PostgreSQL with Row Level Security|    | Outbox worker /    |
   | Storage / Auth / Vault            |    | Transactional Mail |
   +-----------------------------------+    +--------------------+
```

---

## 2. Domain Segmentation & Role Boundaries

### A. Candidate Practice Engine
- **Path:** `app/practice/...`, `components/interview/...`
- **Responsibilities:**
  - Client-side browser media capture (microphone and camera).
  - Streaming speech recognition and question audio playback.
  - Evaluation rubric scoring and structured candidate feedback.
  - Isolated from institutional employer secrets or school enquiry pipelines.

### B. Schools & Educator Suite
- **Path:** `app/schools/...`, `components/schools/...`, `app/api/schools/...`
- **Responsibilities:**
  - Qualification and intake funnel for private and international schools.
  - Capturing school name, contact person, curriculum, estimated teacher headcount.
  - Atomic persistence into `schools_pilot_enquiries` and queuing email dispatch in `schools_pilot_enquiry_outbox`.
  - Intent preservation when teachers transition into practice mode (`practice_retry_intent`).

### C. Employer & Recruiter Assistance Suite
- **Path:** `app/employer/...`, `components/employer/...`, `app/api/employer/...`
- **Responsibilities:**
  - Candidate async video interview review.
  - Question authoring wizard (`<CandidateRoleQuestions />`) allowing recruiters to customize questions.
  - Answer summarization (`employer_answer_summaries`) for high-speed candidate screening.
  - Reminder message generation via transactional email outbox (`employer_message_outbox`).

---

## 3. Database Schema & Data Isolation

### Data Isolation Guarantees
1. **Zero Cross-Contamination:** Schools pilot records are stored in dedicated `schools_*` tables and never read by recruiter screening APIs.
2. **Referential Integrity with Safe Cascades:** Recruiter question sets and answer summaries link to candidate interviews via foreign keys with `ON DELETE CASCADE`.
3. **Additive-Only Evolution:** All schema migrations introduce new nullable columns or new tables, preventing disruption to active production queries.

```
+-----------------------------------------------------------------------------------+
|                               Supabase Schema                                     |
+-----------------------------------------------------------------------------------+
|  Candidates / Sessions:                                                           |
|    - interviews (id, candidate_name, role, status, score, created_at)            |
|    - interview_responses (id, interview_id, question_id, video_url, transcript)   |
|                                                                                   |
|  Schools Domain (Isolated):                                                       |
|    - schools_pilot_enquiries (id, school_name, contact_email, curriculum, status) |
|    - schools_pilot_enquiry_outbox (id, enquiry_id, payload, delivery_status)      |
|                                                                                   |
|  Employer / Recruiter Domain (Additive):                                          |
|    - screening_packs (id, employer_id, title, criteria, created_at)              |
|    - role_invites (id, screening_pack_id, candidate_email, token, expires_at)    |
|    - candidate_role_questions (id, role_invite_id, question_text, order_idx)     |
|    - employer_answer_summaries (id, response_id, summary_text, key_takeaways)     |
|    - employer_message_outbox (id, invite_id, message_type, status, attempts)     |
+-----------------------------------------------------------------------------------+
```

---

## 4. Security & Access Control

1. **Supabase Row Level Security (RLS):**
   - Every public table has RLS enabled by default.
   - Public submissions (`schools_pilot_enquiries`) use restricted `INSERT`-only policies with rate limits.
   - Recruiter review views require signed session tokens or authenticated employer roles.
2. **Input Validation:**
   - Server-side validation via strict schemas (Zod or type guards) on all API endpoints.
   - XSS sanitization for user-generated question text and school names.
3. **Outbox Pattern for External Services:**
   - Asynchronous operations (such as sending emails via Resend) are staged in database outbox tables first.
   - Background delivery jobs consume the outbox with idempotent retry logic, preventing duplicate sends or lost requests on external API failures.
