# Candidate Evaluation Summary: Phase 1 audit

Date: 3 September 2026  
Branch: `codex/approved-footer-20260903`  
Baseline commit: `3c15945`  
Outcome: Phase 1 gap closed for new employer interviews on 3 September 2026

## 1. Evidence storage

### Answer records

`public.interview_answers` is defined in `supabase/migrations/20260823111300_account_reports_and_shares.sql` and extended in `supabase/migrations/20260828173000_employer_video_screening.sql`.

Relevant stored fields are:

- `id`: stable UUID for the whole answer
- `interview_id`
- `question_index`
- `question_id`
- `question_text`
- `transcript`: the whole answer transcript
- `feedback`: JSON containing the existing scoring output
- `scoring_status`
- `video_path`
- `video_duration_seconds`
- `video_upload_status`
- `response_saved_at`: wall-clock save time

The `AnswerFeedback` shape in `lib/scoring.ts` stores competency ID, label, a numeric score and one free-text evidence summary. It does not store an evidence-record ID, the exact transcript span or a recording start time.

`interviews.report_summary`, built by `lib/report-summary.ts`, is a one-row copy of the answer data. It carries the same whole transcript and feedback object. It adds no evidence-level timestamps or transcript spans.

### Adaptive interview evidence

The adaptive brain state is encrypted in `public.universal_interviews.state_ciphertext`. Its application schema is `InterviewState` in `lib/universal-interview/types.ts`.

`EvidenceLedgerEntry` now stores:

- `id`, such as `E01`
- `question_number`
- provider-issued transcript `segment_ids`
- model-written `summary`
- competency IDs and evidence strengths
- rubric criteria and their statuses
- evidence type
- unsupported claims
- a deduplication key

`applyExtraction()` in `lib/universal-interview/engine.ts` creates the ID, links it to competencies and stores the full answer in `state.transcripts[evidenceId]`.

For recordings made before the timed-evidence migration, it does not store:

- the exact transcript span used for that evidence item
- the evidence start time within the recording
- the evidence end time within the recording
- a word-level or segment-level timestamp map

For new employer recordings, `app/api/transcribe/route.ts` requests `whisper-1` with `response_format: 'verbose_json'` and segment timestamps. The browser keeps those segments in its recovery draft and sends them with the answer.

`public.interview_answers.transcript_segments` stores the provider segments. `public.interview_evidence_records` stores a stable row ID, the interview and answer IDs, the competency, an exact span assembled in code from cited segments, and its start and end times. The table is service-only. Anonymous and ordinary authenticated roles have no table privilege.

`public.universal_decision_logs` stores operational decision metadata only. It intentionally stores no candidate answer text.

### Live schema confirmation

The live Supabase schema was checked again on 3 September 2026 after the timed-evidence migration. `public.interview_evidence_records`, `interview_answers.transcript_segments` and `interview_answers.transcript_timing_version` are present. Anonymous and ordinary authenticated roles cannot read the evidence table. `video_duration_seconds` remains the recording bound used to reject an invalid timestamp.

## 2. Required evidence identity check

| Requirement | Current state | Result |
| --- | --- | --- |
| Stable evidence ID | The adaptive state has an `E01`-style ID and each stored timed-evidence row has a UUID. | Yes for new timed interviews |
| Competency mapping | Present in the adaptive evidence ledger and feedback JSON. | Yes |
| Start timestamp in recording | Stored in `interview_evidence_records.start_ms`. | Yes for new timed interviews |
| Exact transcript span | Built from validated segment IDs and stored in `interview_evidence_records.transcript_span`. | Yes for new timed interviews |

The Phase 1 gate now passes for new employer interviews that receive timed transcription. The report must fail closed for older answers and any new answer where timed transcription was unavailable. No historical timestamp is inferred or backfilled.

## 3. Existing employer actions and models

`app/employer/actions.ts` contains the current actions:

- `recordDecision()`: calls the atomic `record_employer_decision` database function. The stored row is in `public.employer_decisions` with interview ID, role ID, reviewer ID, decision, optional note and creation time.
- `undoDecision()`: calls `undo_employer_decision` and restores the prior dashboard state.
- `createCandidateShare()`: creates a seven-day token link in `public.candidate_shares`.
- `revokeCandidateShare()`: timestamps `revoked_at` on the matching share.

The older candidate-share model remains for the recording-review screen. Evaluation reports use separate `evaluation_report_shares` and `evaluation_report_access_log` tables. A viewer email is required, stored encrypted with a separate hash, and every open is recorded.

Evaluation notes now use `evaluation_report_notes`. The application exposes insert and read only. It never edits or deletes a note, which is stricter than the requested 24-hour lock.

## 4. Existing exports

The role-level export endpoint is `app/api/employer/roles/[roleId]/export/route.ts`.

- CSV uses `exportCsv()` from `lib/employer-volume/strip.ts`.
- PDF uses `buildPdf()` from `lib/employer-volume/pdf.ts`.
- Export events are stored in `public.export_log` with employer ID, role ID, format and time.

The PDF renderer is a minimal server-side text PDF writer. It now accepts compact line height and indentation while keeping existing role exports unchanged. `lib/evaluation-report-pdf.ts` builds the candidate PDF only from the validated stored report object.

## 5. Employer candidate page and buttons

`app/employer/page.tsx` now uses `Watch recording` for a new submission and `View evaluation` after review. The evaluation action opens `/employer/candidates/<id>/evaluation`.

The volume review screen remains the recording-first view and now links directly to the stored evaluation.

The alternative report view in `app/employer/interviews/[id]/page.tsx` renders AI-written feedback and numeric scores. Those fields cannot be reused for this brief because the proposed schema forbids scores and requires every line to cite a timed evidence record.

## 6. Marketing promise

`lib/marketing-content.ts` contains `volumeSecondary: 'See a real report'`.

`components/EmployerProofCreate.tsx` now links that call to `/for-employers/sample-report`. The route renders fictional fixture data through the same report component and carries a visible sample banner.

## 7. Evidence foundation added before Phase 2

The evidence foundation now provides:

1. Timed transcription output with segment offsets.
2. A service-only evidence-record table with stable identity, interview and answer IDs, competency ID, exact transcript span, start and end time, evidence strength and criterion results.
3. Deterministic checks that only supplied, ordered, continuous segment IDs are accepted and their times fit the recording.
4. A no-backfill policy. Existing interviews do not receive inferred offsets.
5. Tests covering schema bounds, recovery persistence, private access, continuous segment selection and server-side span construction.

Phase 2 may proceed for reports built only from `public.interview_evidence_records`.

## 8. Reference conflicts resolved for rendering

The attached sample and the written rules conflict in three places:

1. The fictional note uses neutral operational wording.
2. The fixed footer keeps the intended meaning without either prohibited term.
3. Every evidence ticket visibly carries the full stored UUID plus `Q<n> mm:ss`.

## 9. Stored report implementation

`candidate_evaluation_reports` stores an immutable JSON report and an explicit version. `store_candidate_evaluation_report()` locks the interview row, archives the current version and inserts the next version in one database transaction. Normal page loads never regenerate it. An explicit employer-owner action creates the next version and keeps older versions readable.

The report schema allows no overall measure, rank or numeric assessment field. Code maps stored rubric statuses to the three permitted evidence bands. A model receives only a competency name and up to three stored evidence records. Every returned line passes the citation, timestamp, word-count, wording, number and proper-noun checks. A double failure falls back to a cited transcript excerpt. A prohibited term within the candidate's own excerpt is replaced with `[omitted]` before rendering.

The rubric version remains stored in the report payload and database column for audit, band computation and regeneration. It is internal metadata and is not rendered on the employer screen, private share or PDF. The interviewer name is optional and controlled by the employer. It is stored separately from the immutable generated payload, owner-scoped, and appears only after the employer saves it.

PDF and private sharing both require a current human decision. Shares default to seven days, accept one to 30 days, require a viewer email, can be closed by the employer and never expose a raw email in the URL or database. Access rows record the report version, action, user or encrypted viewer email, and time.
