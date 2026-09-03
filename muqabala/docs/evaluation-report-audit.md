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

The live Supabase schema was checked read-only on 3 September 2026. There is no evidence-record table or evidence-level timestamp/transcript-span column. `video_duration_seconds` is only the length of the whole recording. `response_saved_at` is a wall-clock save time and cannot identify where evidence occurs in a recording.

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

The current share model has creation, expiry, revocation and optional colleague response fields. It does not require a viewer email and does not log every open. It is therefore not sufficient for the proposed evaluation-report sharing rules.

Employer notes currently live inside `public.employer_decisions.note`. They are attributed through `reviewer_id` and timestamped through `created_at`, but there is no separate append-only report-note model or 24-hour edit rule.

## 4. Existing exports

The role-level export endpoint is `app/api/employer/roles/[roleId]/export/route.ts`.

- CSV uses `exportCsv()` from `lib/employer-volume/strip.ts`.
- PDF uses `buildPdf()` from `lib/employer-volume/pdf.ts`.
- Export events are stored in `public.export_log` with employer ID, role ID, format and time.

The PDF renderer is a minimal server-side text PDF writer. It is not an HTML-to-PDF renderer and cannot directly reuse the attached HTML and print CSS. The current PDF is a role summary, not a stored, versioned candidate evaluation.

## 5. Employer candidate page and buttons

`app/employer/page.tsx` contains the candidate actions:

- the new-submission list uses `Watch`
- the submitted-interview list uses `Open` after review and `Watch` before review

Both actions call `reviewInterview()` and open `/employer/interviews/<id>`.

The volume review screen is `components/CandidateReview.tsx`. It shows rubric ticks, recordings, whole transcripts, sharing and decision controls. It does not show a stored candidate evaluation object.

The alternative report view in `app/employer/interviews/[id]/page.tsx` renders AI-written feedback and numeric scores. Those fields cannot be reused for this brief because the proposed schema forbids scores and requires every line to cite a timed evidence record.

## 6. Marketing promise

`lib/marketing-content.ts` contains `volumeSecondary: 'See a real report'`.

`components/EmployerProofCreate.tsx` links that call to `#sample-report`. The section currently displays `/samples/employer-report.png` when the asset exists. It does not link to a public, fixture-backed evaluation-report route.

## 7. Evidence foundation added before Phase 2

The evidence foundation now provides:

1. Timed transcription output with segment offsets.
2. A service-only evidence-record table with stable identity, interview and answer IDs, competency ID, exact transcript span, start and end time, evidence strength and criterion results.
3. Deterministic checks that only supplied, ordered, continuous segment IDs are accepted and their times fit the recording.
4. A no-backfill policy. Existing interviews do not receive inferred offsets.
5. Tests covering schema bounds, recovery persistence, private access, continuous segment selection and server-side span construction.

Phase 2 may proceed for reports built only from `public.interview_evidence_records`.

## 8. Reference conflicts to resolve before rendering

The attached sample and the written rules conflict in three places:

1. The sample employer note contains `attitude`, which the rules forbid anywhere in rendered output.
2. The required footer contains `recommendation`, while the forbidden-word validator includes `recommend`. A substring-based CI grep would reject the required footer.
3. The sample shows question number and time but does not visibly show the required evidence-record ID. The future rendering contract must state whether the ID is displayed, embedded in the timestamp link or retained only as validated report data.

These conflicts do not change the Phase 1 evidence-storage failure, but they must be resolved before a future renderer and its forbidden-copy tests can agree.
