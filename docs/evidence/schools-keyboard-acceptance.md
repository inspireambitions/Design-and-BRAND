# Schools keyboard and network acceptance

Checked on 8 September 2026 against the protected staging alias after it was assigned to deployment `dpl_7gpWsx2ry1dfCCwGLHeDQJkrYLXS`.

## Result

Both desktop Chrome and Chrome with a 390 by 844 mobile viewport and touch emulation passed the complete student and adviser journey. These were automated browser checks, not tests on physical phones.

- Enrol through a private pseudonymous invitation using the keyboard, confirm adult status and acknowledge the recovery code.
- Enter three answers with the keyboard. Verify all three saved answers in staging storage and after a refresh.
- Allow the server to accept a submission, then deliberately discard its successful response. Show the actual error, retry with the keyboard and verify exactly one new submitted attempt.
- Request and read live feedback, including the first suggested improvement.
- Save an adviser judgement and comment using keyboard controls. Read the comment in the student's private report.
- Sign out everywhere and verify that a subsequent protected action returns 401.
- Recover with the private recovery code and delete the disposable learner.

## Interrupted-submission diagnosis

The previous harness selected the first element with `role="alert"`. Next.js supplies a route announcer with that role, so the check continued before a submission error existed. It then tried to reach a Submit button that was still disabled while the first request ran.

The harness now waits for the visible, non-empty practice error paragraph. The same lost-response scenario then passed on both browser configurations. No change to the practice application was needed for this fault.

The checks also exposed a separate enrolment limit: all access operations shared a five-request IP bucket. The release coordinator corrected that limiter. Fresh enrolment checks passed after the corrected preview was deployed.

## Evidence and limits

- `schools-preview-keyboard-desktop.json`
- `schools-preview-keyboard-mobile-emulation.json`
- Screenshots under `muqabala/output/playwright/schools-preview-keyboard-feedback-*.png`

Only synthetic answers and identities were used. Recovery codes, cookies and private links were not saved in evidence. Four learners left by interrupted diagnostic runs were also deleted through the existing privacy workflow after the final runs.

Physical iPhone, physical Android, Safari, screen-reader use and messaging-app link previews remain separate manual checks. These browser results do not stand in for them.
