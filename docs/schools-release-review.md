# Schools release advisory review

Reviewed: 8 September 2026. Scope: repository evidence, product copy, link metadata, existing test records and controlled tester guidance. This review did not deploy code, use physical devices or open messaging apps.

## Decision

The existing evidence supports further controlled synthetic testing. It does not yet prove every Stage B acceptance requirement or readiness for mass institutional enrolment. The release owner must update the build log with the final deployment and current checks before issuing individual tester access.

## Verified from repository evidence

- The build log records nine Schools staging migrations, default-off production behaviour, 526 local resilience checks and hosted isolation/recovery checks. These are recorded results, not checks rerun by this review.
- Hosted security evidence covers employer exclusion from all 16 public Schools tables, cross-institution educator access, tampered assignments, removed members and expired/revoked sessions.
- The preview metadata evidence records exact rendered metadata and three 1200 by 630 PNGs below 300 KB. Source is muqabala/lib/link-previews.ts; assets are muqabala/public/og/{home,schools,employers}.png.
- The staging email evidence and build log now record delivery to the authorised controlled inbox. Delivery alone does not prove sign-in or assignment/invitation outbox delivery.
- The two v2 feedback evidence files record twelve completed live examples. Five original repeats returned 11, 11, 11, 11 and 10. Five concrete examples in imperfect English returned 12; padding and an embedded instruction returned zero.

## Gates to close on the final deployment

| Gate | Evidence needed |
| --- | --- |
| Email sign-in and enrolment | A delivered email completes the correct invited identity's flow and cannot grant an unrelated identity access |
| Interrupted submission | Final preview preserves text and creates one attempt after a lost response or network interruption |
| Keyboard and mobile | Keyboard journey plus separately labelled physical iPhone and Android records |
| Operations | Actual invitation/assignment delivery, bounded retries, duplicate prevention, cleanup invocation and honest supplier-deletion status |
| Release integrity | Commit, pushed branch, migration record and verified preview deployment all refer to the intended changes |
| Larger groups | Bounded concurrency results, feedback response times, failure/rate-limit behaviour, spend basis and named monitoring owner |
| External previews | Public crawler access, three messaging platforms, one debugger and sanitised screenshots |

Each failed technical gate needs a fix or an explicit restricted test scope. Do not describe a simulated device as a physical-device pass. Do not mark supplier deletion complete without the supplier evidence.

## Link-preview constraint

Metadata currently uses absolute production URLs at https://trymuqabala.com, including all three images and canonical URLs. That matches the intended public domain. A protected staging page does not prove the public image URL is deployed, and messaging crawlers may encounter Vercel protection instead of metadata. Verify the actual public assets before claiming external preview acceptance. Keep authenticated Schools pages protected. This review does not recommend removing project protection to obtain a screenshot.

The local metadata script checks important tags and image dimensions but does not simulate WhatsApp, iMessage or LinkedIn rendering. The existing platformPreviewsVerified=false is accurate. schools-tester-guide.md contains the manual checklist.

## Adviser assessment findings

The sample on muqabala/app/schools/page.tsx correctly identifies a missing outcome and asks the student to recall what happened. It does not supply a finished achievement. The page uses fictional initials and separates adviser judgement from engine feedback.

Exact source extraction repairs invented quotations. It cannot prove that a rubric interpretation is correct or that the described event happened. One repeated original example changed by one element, so the evidence does not support a claim of identical interpretation. Confidence labels must not be described as calibrated probabilities.

Before real enrolment, the institution should approve each question's four descriptors and a few borderline examples. Adviser corrections should identify disagreement with the interpretation. They should not rewrite the original submitted answer. Retain comparisons only for matching question and rubric versions. The twelve synthetic checks are useful regression evidence, not a population fairness study.

## Controlled testers versus a real institution

Controlled testers use disposable accounts, fictional answers and a synthetic cohort. Give each person their own access privately. The plain staging alias is not an invitation. Do not commit secret links or distribute a shared administrator account.

A real pilot still requires the institution/contact, adult-only confirmation, teaching language, approved question bank, DPA and provider arrangements, evaluation period and thresholds, budget owner and continuation offer. Founder setup and DPA controls must stay closed for real institutions until those requirements are recorded. Synthetic fixture flags do not certify a real institution.

## Recommended release record

Record final commit and deployment, exact tests rerun, remaining manual checks, the test window, monitoring owner and rollback method. Keep the Schools production flag off while issuing the controlled staging test. Start with five people; expand only after their blocking issues and operating costs are reviewed. The count of five is a proposed staged test size, not a demonstrated capacity limit.
