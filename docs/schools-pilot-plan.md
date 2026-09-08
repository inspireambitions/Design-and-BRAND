# Schools pilot plan

Status: Awaiting founder inputs. No student enrolment is authorised by this document.

| Required decision | Status |
| --- | --- |
| Institution and contact | Not supplied |
| Adult students confirmed | Not supplied |
| One teaching language | Not confirmed |
| Adviser-approved initial role and question bank | Not supplied |
| Signed DPA reference and provider arrangements | Not supplied or verified |
| Evaluation start and end | Not supplied |
| Completion threshold | Not supplied |
| Retry threshold | Not supplied |
| Adviser review time threshold | Not supplied |
| Evidence disagreement threshold | Not supplied |
| Cost budget and budget owner | Not supplied |
| Paid continuation offer | Not supplied |

## Measures implemented locally, awaiting pilot validation

- Completion: students with submitted work divided by enrolled students in the evaluation cohort.
- Retry: students with at least two submitted attempts divided by students with submitted work.
- Adviser review time: median seconds from opening a review to saving it, excluding interrupted sessions under a documented rule.
- Feedback disagreement: evidence corrections divided by rubric elements reviewed. Agree whether repeated corrections count once per element before reporting.
- Cost per active learner: attributable feedback supplier spend divided by students with at least one submission. Missing cost values must remain unknown, never zero.

Define the evaluation cohort, removed-member treatment and time window before calculating each denominator. Do not publish names, contact details, answers or student comparisons in instrumentation.

Current implementation counts retries only when a student submits at least twice to the same assignment during the selected UTC period. Saved reviews provide a denominator of 12 rubric elements each; repeated changes to one element count once. Median review time excludes sessions longer than one hour and starts again when the review is reopened. The founder must accept these measurement rules before the pilot.

`SCHOOLS_INPUT_USD_PER_MILLION` and `SCHOOLS_OUTPUT_USD_PER_MILLION` must come from verified rates for the configured model. Missing rates or usage stay unknown. Recorded response estimates exclude provider calls without a returned usage receipt, so invoices must be reconciled before reporting actual spend.

Mail requires the existing provider settings and `SCHOOLS_DATA_KEY` (base64-encoded 32 bytes), or the existing protected `INTERVIEW_SECRET`. Do not place secrets in this file or source control. Rotation must preserve access to queued ciphertext until it is delivered or deliberately reissued.

Schools mail and retention endpoints require the existing cron secret. Scheduling is pending activation. Keep `SCHOOLS_ENABLED` unset or false until the hosted acceptance gates pass.

## Activation gates

All pilot acceptance tests must pass on the intended deployment and hosted database, including both account recovery paths, deletion, isolation, keyboard/mobile recovery and link previews. Confirm supplier contracts and retention before writing compliance claims. The founder must complete institution setup and DPA controls before opening enrolment.

Text input only. No video, speech, public report links, PDF, reminders or other Phase 2 work.
