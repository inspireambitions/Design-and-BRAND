# Muqabala employer work samples

Current production specification, 30 August 2026.

## Purpose

Muqabala helps a hiring team see how a candidate would approach a role before shortlisting. The employer sends one secure link. Each candidate records the same three role-specific answers. A person reviews the evidence and makes the decision.

This flow stays separate from Muqabala Coach. Private practice answers never appear in the employer dashboard.

## Employer journey

The employer must sign in before creating a link.

The creation form asks for:

- Company name, required
- Recruiter name, optional
- Job title, required
- A pasted job description or an AI-generated draft
- Candidate capacity from 1 to 1,000
- Link expiry from 1 to 30 days

The employer can edit a generated description before creating the link. The link stays disabled until the company, title and job description meet the validation rules.

The invitation uses the company name and optional recruiter name stored in the signed work-sample token. The candidate cannot alter either value.

## Candidate journey

An employer work sample uses video and audio only. It does not offer typing, audio-only answers or a choice of answer method.

Before question one:

1. The candidate sees the company, role, question count, timing and privacy information.
2. The candidate enters their name.
3. The candidate tests the camera and microphone.
4. The timed question stays locked until both devices work.

Each work sample contains three questions. The candidate gets two minutes per question. The page shows the question number, progress, recording state, time remaining and save state.

At zero, the recorder stops and keeps everything captured up to that point. The app uploads the answer and moves on only after the server confirms the save. Failed uploads keep the recorded blob in the page and show a retry action.

The page warns the candidate before they refresh, close or leave an active interview.

## Consent and submission

The final button says **Submit to employer**. It stays disabled until the candidate accepts this text:

> I agree to submit my interview responses and video recordings to the employer who invited me. I understand that the employer will use them to review my application.

Final submission records consent and submission time. It locks the interview against changes.

The completion message says:

> Your interview has been submitted successfully. The employer will review your responses and contact you directly if there is a next step.

The page does not promise an outcome or response date.

## Candidate visibility

Candidates do not see:

- Answer analysis
- Scores
- Recommendations
- Strengths or concerns
- The employer report

The candidate sees only recording, save and final-submission confirmation.

## Employer Evidence Desk

Only the signed-in employer who owns the link can open its submissions.

The dashboard shows:

- Active links and link health
- Capacity used and places remaining
- Expiry date
- Candidate list
- Interview status
- Submission date and time
- Completion rate
- A report link for each submitted interview

Each report shows the candidate's recorded evidence separately from AI-generated analysis. The report labels AI analysis as unverified and tells the recruiter to check it against the recording.

The employer can play every submitted video with audio and delete an interview.

## Storage and retention

The browser uploads employer-work-sample recordings to the private Supabase Storage bucket `screening-videos`. Vercel and Postgres do not store the video binary.

Postgres stores the private object path, upload status, duration and submission metadata.

Employer playback uses a server-generated signed URL that expires after 15 minutes. Playback responses use a 60-second cache period.

Submitted videos are scheduled for deletion after 90 days. The cleanup process removes Storage objects before deleting the database record. An employer can delete an interview earlier.

## Rules

- A human makes every hiring decision.
- Muqabala never auto-rejects a candidate.
- Muqabala does not score faces, appearance, accent, voice or emotion.
- Employer evidence and private Coach practice never mix.
- One candidate cannot access another candidate's interview.
- The system must not expose private Storage URLs.
- Missing or failed AI analysis must not block recorded evidence.
- AI analysis must never appear as verified fact.

## Routes

| Route | Purpose |
|---|---|
| `/for-employers` | Create a work sample and secure candidate link |
| `/s/[code]` | Candidate camera test, three recordings, consent and submission |
| `/employer` | Employer Evidence Desk |
| `/employer/interviews/[id]` | Employer-owned report and signed video playback |

## Release gate

Before a production change to this flow, run one complete interview on a physical phone:

1. Create a link with a set capacity and expiry.
2. Open it outside the employer session.
3. Test camera and microphone.
4. Record three answers.
5. Let one answer reach the two-minute limit.
6. Submit consent.
7. Confirm the Evidence Desk receives the interview.
8. Play every video with sound.
9. Confirm the capacity decreases once.
10. Delete the interview and confirm playback stops.

Keep production unchanged until this loop passes on the preview deployment.
