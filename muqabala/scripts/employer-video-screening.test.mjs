import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ScreeningAnswerSchema,
  ScreeningSubmitSchema,
  ScreeningUploadRequestSchema,
} from '../lib/interviews.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('employer video payloads reject audio, oversized files and missing consent', () => {
  assert.equal(ScreeningUploadRequestSchema.safeParse({ questionIndex: 0, mimeType: 'audio/webm' }).success, false);
  assert.equal(ScreeningUploadRequestSchema.safeParse({ questionIndex: 0, mimeType: 'video/webm' }).success, true);
  assert.equal(ScreeningAnswerSchema.safeParse({
    questionIndex: 0,
    transcript: '',
    videoPath: 'pack/interview/0-video.webm',
    mimeType: 'video/webm',
    sizeBytes: 50 * 1024 * 1024 + 1,
    durationSeconds: 120,
  }).success, false);
  assert.equal(ScreeningSubmitSchema.safeParse({ consent: false, consentVersion: 'employer-video-v1' }).success, false);
  assert.equal(ScreeningSubmitSchema.safeParse({ consent: true, consentVersion: 'employer-video-v1' }).success, true);
});

test('employer candidate page uses a separate video-only flow with a two-minute limit', () => {
  const page = read('app/s/[code]/page.tsx');
  const flow = read('components/EmployerVideoInterview.tsx');
  assert.match(page, /EmployerVideoInterview/);
  assert.doesNotMatch(page, /InterviewFlow/);
  assert.match(flow, /const ANSWER_SECONDS = 120/);
  assert.match(flow, /startVideoAnswerRecording/);
  assert.match(flow, /video and audio will be shared only with the employer/i);
  assert.doesNotMatch(flow, /<textarea/);
  assert.doesNotMatch(flow, /type my answer/i);
  assert.match(flow, /Submit to employer/);
});

test('candidate consent and receipt match the approved wording', () => {
  const flow = read('components/EmployerVideoInterview.tsx');
  assert.match(flow, /I agree to submit my interview responses and video recordings to the employer who invited me\. I understand that the employer will use them to review my application\./);
  assert.match(flow, /Your interview has been submitted successfully\./);
  assert.match(flow, /The employer will review your responses and contact you directly if there is a next step\./);
  assert.match(flow, /kept for up to 90 days/);
});

test('candidate APIs do not expose employer analysis or reports', () => {
  const scoreRoute = read('app/api/score/route.ts');
  const reportRoute = read('app/api/interviews/[id]/report/route.ts');
  const brainRoute = read('app/api/screening/interviews/[id]/brain/route.ts');
  const employerBrain = read('lib/universal-interview/employer.ts');
  assert.match(scoreRoute, /mode === 'screening'[\s\S]*saved: true/);
  assert.match(reportRoute, /mode === 'screening'[\s\S]*status: 404/);
  assert.match(brainRoute, /publicEmployerBrainState\(state\)/);
  assert.doesNotMatch(brainRoute, /publicInterviewState\(state\)/);
  assert.doesNotMatch(employerBrain.match(/export function publicEmployerBrainState[\s\S]*?\n\}/)?.[0] ?? '', /coverage|evidence_ledger|final_feedback/);
});

test('employer ownership, final consent and private video storage are enforced in the migration', () => {
  const migration = read('supabase/migrations/20260828173000_employer_video_screening.sql');
  assert.match(migration, /employer_id uuid references auth\.users/);
  assert.match(migration, /submitted_at is not null/);
  assert.match(migration, /screening-videos/);
  assert.match(migration, /public = false/);
  assert.match(migration, /submit_screening_interview/);
  assert.match(migration, /video_upload_status = 'uploaded'/);
});

test('employer dashboard separates recorded evidence from AI analysis', () => {
  const report = read('app/employer/interviews/[id]/page.tsx');
  const actions = read('app/employer/actions.ts');
  const deleteControl = read('components/EmployerDeleteInterview.tsx');
  const deleteRoute = read('app/api/employer/interviews/[id]/route.ts');
  assert.match(report, /Candidate’s recorded evidence/);
  assert.match(report, /AI-generated analysis/);
  assert.match(report, /not a verified fact or an automatic decision/);
  assert.match(actions, /createSignedUrl/);
  assert.match(report, /Kept for up to 90 days/);
  assert.match(deleteControl, /Delete this interview and all its recordings/);
  assert.match(deleteRoute, /currentUser/);
  assert.match(deleteRoute, /not\('submitted_at', 'is', null\)/);
  assert.match(deleteRoute, /storage\.from\('screening-videos'\)\.remove/);
  assert.match(deleteRoute, /from\('universal_interviews'\)[\s\S]*\.delete\(\)/);
  assert.match(deleteRoute, /\.eq\('screening_pack_id', interview\.screening_pack_id\)/);
});

test('private playback cache is shorter than the signed employer link', () => {
  const upload = read('lib/screening-video-upload.ts');
  const actions = read('app/employer/actions.ts');
  assert.match(upload, /body\.append\('cacheControl', '60'\)/);
  assert.match(actions, /createSignedUrl\(answer\.video_path, 15 \* 60\)/);
});

test('employer report renders evidence text first and signs video only on play', () => {
  const report = read('app/employer/interviews/[id]/page.tsx');
  const player = read('components/EmployerReportVideo.tsx');
  const actions = read('app/employer/actions.ts');
  const upload = read('lib/screening-video-upload.ts');
  const uploadRoute = read('app/api/screening/interviews/[id]/upload-url/route.ts');

  // No media request is part of the server render: no <video>, no signing.
  assert.doesNotMatch(report, /<video/);
  assert.doesNotMatch(report, /createSignedUrl/);
  assert.match(report, /<EmployerReportVideo/);
  assert.match(report, /report_summary/);
  assert.match(report, /usableReportSummary\(interview\.report_summary\)/);
  assert.match(report, /from\('interview_answers'\)/);

  // The player mounts <video> only after the employer taps play.
  assert.match(player, /'use client'/);
  assert.match(player, /signEmployerVideo\(interviewId, questionIndex\)/);
  assert.match(player, /if \(url\) \{[\s\S]*<video/);
  assert.match(player, /Play recording/);

  // Signing checks ownership through the RLS-scoped client before the admin signs.
  assert.match(actions, /export async function signEmployerVideo/);
  assert.match(actions, /const owned = await ownedSubmittedInterview\(interviewId\);\s*if \(!owned\) return \{ error/);

  // Video bytes go from the browser to a one-file Supabase signed URL; no Next route reads them.
  assert.match(upload, /new XMLHttpRequest\(\)/);
  assert.match(upload, /request\.open\('PUT', grant\.signedUrl\)/);
  assert.match(upload, /request\.setRequestHeader\('x-upsert', 'true'\)/);
  assert.match(upload, /body\.append\('cacheControl', '60'\)/);
  assert.match(upload, /body\.append\('', file\)/);
  assert.match(upload, /const retryDelays = \[0, 1_000, 3_000\]/);
  assert.match(upload, /request\.status === 429/);
  assert.doesNotMatch(upload, /tus-js-client|upload\/resumable/);
  assert.match(uploadRoute, /createSignedUploadUrl\(path, \{ upsert: true \}\)/);
  assert.match(uploadRoute, /signedUrl: signed\.signedUrl/);
});

test('submitting writes the one-row report summary the employer page reads', () => {
  const submitRoute = read('app/api/screening/interviews/[id]/submit/route.ts');
  const migration = read('supabase/migrations/20260901193000_interview_report_summary.sql');
  assert.match(submitRoute, /rpc\('submit_screening_interview'[\s\S]*refreshReportSummary\(access\.admin!, id\)/);
  assert.match(migration, /add column if not exists report_summary jsonb/);
  assert.match(migration, /add column if not exists report_summary_at timestamptz/);
  assert.doesNotMatch(migration, /create policy/);
});

test('screening questions are signed once per link and the adaptive engine owns follow-ups', () => {
  const packRoute = read('app/api/screening/packs/route.ts');
  const packLookup = read('lib/screening-pack.ts');
  const candidatePage = read('app/s/[code]/page.tsx');
  const brainRoute = read('app/api/screening/interviews/[id]/brain/route.ts');
  assert.match(packRoute, /const questions = role\.questions\.slice\(0, 8\);/);
  assert.match(packRoute, /signProofPack\(\{[\s\S]*questions,/);
  assert.match(packRoute, /insert\(\{[\s\S]*signed_token: signedToken/);
  assert.match(packLookup, /select\('(id, )?signed_token/);
  assert.match(packLookup, /verifyInterview\(data\.signed_token\)/);
  assert.doesNotMatch(packLookup, /proofQuestions|signProofPack/);
  assert.doesNotMatch(candidatePage, /proofQuestions|signProofPack/);
  assert.match(brainRoute, /processUniversalTurn\(state, answer\.transcript/);
  assert.match(brainRoute, /employerBrainQuestionSnapshot\(state\.current_question/);
  assert.match(brainRoute, /processed_answer_count/);
});

test('adaptive screening resumes safely after an answer was uploaded but the next question was interrupted', () => {
  const flow = read('components/EmployerVideoInterview.tsx');
  const brainRoute = read('app/api/screening/interviews/[id]/brain/route.ts');
  assert.match(flow, /status\.questionCount <= status\.currentQuestion/);
  assert.match(flow, /questionIndex: status\.currentQuestion - 1/);
  assert.match(flow, /draft\.questionIndex < nextIndex/);
  assert.match(brainRoute, /if \(questionIndex === processed\)/);
  assert.match(brainRoute, /if \(questionIndex > processed\)/);
  assert.match(brainRoute, /snapshot\.length === current\.current_question/);
});

test('adaptive screening never presents a saved response as a failed upload', () => {
  const flow = read('components/EmployerVideoInterview.tsx');
  const brainRoute = read('app/api/screening/interviews/[id]/brain/route.ts');
  const turnProcessor = read('lib/universal-interview/process-turn.ts');
  const employerBridge = read('lib/universal-interview/employer.ts');
  assert.match(turnProcessor, /new ModelCallBudget\(2\)/);
  assert.doesNotMatch(turnProcessor, /new ModelCallBudget\(3\)/);
  assert.match(brainRoute, /allowDeterministicExtractionFallback: true/);
  assert.match(brainRoute, /code: 'analysis_unavailable'/);
  assert.doesNotMatch(brainRoute, /Retry without recording again/);
  assert.match(flow, /type SaveFailureKind = 'upload' \| 'analysis' \| null/);
  assert.match(flow, /responseConfirmed \? 'analysis' : 'upload'/);
  assert.match(flow, /analysisFailed: 'Your response is saved\. Its analysis needs another try\.'/);
  assert.match(flow, /retryAnalysis: 'Retry analysis'/);
  assert.match(employerBridge, /automatedAnalysisUnavailable/);
  assert.match(employerBridge, /if \(!evidence \|\| automatedAnalysisUnavailable\)/);
  assert.match(employerBridge, /status: 'unscored'/);
});

test('employer creation form generates the description before unlocking the link action', () => {
  const form = read('components/EmployerProofCreate.tsx');
  const styles = read('components/EmployerProofCreate.module.css');
  const copy = read('lib/i18n.ts');
  const generatePosition = form.indexOf("t('proofGenerateAdvert')");
  const createPosition = form.indexOf("t('proofCreateAction')");

  assert.match(form, /fetch\('\/api\/screening\/job-description'/);
  assert.match(form, /const canCreate = companyReady && titleReady && jobReady && settingsReady/);
  assert.match(form, /type="submit" className=\{styles\.submit\} disabled=\{!canCreate\}/);
  assert.ok(generatePosition >= 0 && createPosition > generatePosition);
  assert.match(styles, /\.actions\s*\{[\s\S]*grid-template-columns:/);
  assert.match(styles, /@media \(max-width: 40rem\)[\s\S]*\.heroActions,\s*\.actions,\s*\.linkActions\s*\{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(form, /t\('proofRecruiterValue'\)/);
  assert.match(form, /const \[recruiterName, setRecruiterName\] = useState\(''\)/);
  assert.match(form, /recruiterName: recruiterName\.trim\(\) \|\| undefined/);
  assert.match(form, /t\('proofRecruiterLabel'\)/);
  assert.match(form, /proofCandidateInvite/);
  assert.match(form, /proofRecommendMessage/);
  assert.match(form, /proofEmailSubject/);
  assert.match(form, /mailto:\?subject=/);
  assert.match(copy, /Learn how each candidate would approach the role before you shortlist\./);
  assert.match(copy, /Your job description is saved\. Please try again\./);
  assert.doesNotMatch(copy, /Check the job description and try again\./);
  assert.match(copy, /I used Muqabala for \{title\} at \{company\}\./);
  assert.doesNotMatch(read('components/EmailSignIn.tsx'), /Promotions or Spam|emailDeliveryHelp/);
  assert.match(form, /\{hasReportShot \? \(/);
  assert.match(form, /volume && !production \?/);
  assert.match(form, /\{hasCandidateShot && \(/);
});

test('current screening documentation cannot restore the old typed-answer flow', () => {
  const spec = read('docs/screening-v1.md');
  const handover = read('CODEX.md');
  assert.match(spec, /uses video and audio only/);
  assert.match(spec, /does not offer typing, audio-only answers/);
  assert.match(spec, /Employer Evidence Desk/);
  assert.match(spec, /private Supabase Storage bucket `screening-videos`/);
  assert.doesNotMatch(spec, /candidate speaks or types|video never leaves the phone|no employer dashboard/i);
  assert.match(handover, /employer-issued video work samples with an owner-only Evidence Desk/);
  assert.doesNotMatch(handover, /Employer product is phase two\. Coach only for now/);
});

test('employer link settings are compact and enforced atomically in the database', () => {
  const form = read('components/EmployerProofCreate.tsx');
  const styles = read('components/EmployerProofCreate.module.css');
  const packRoute = read('app/api/screening/packs/route.ts');
  const startRoute = read('app/api/interviews/route.ts');
  const migration = read('supabase/migrations/20260828184014_screening_pack_capacity_expiry.sql');

  assert.match(form, /DEFAULT_MAX_CANDIDATES = 100/);
  assert.match(form, /DEFAULT_EXPIRY_DAYS = 14/);
  assert.match(form, /proofLinkSettingsLabel/);
  assert.match(styles, /\.linkSettingsGrid\s*\{[\s\S]*grid-template-columns: repeat\(2/);
  assert.match(packRoute, /parsed\.data\.expiryDays/);
  assert.match(packRoute, /max_candidates: parsed\.data\.maxCandidates/);
  assert.match(startRoute, /rpc\('start_screening_interview'/);
  assert.match(startRoute, /result\?\.status === 'full'/);
  assert.match(migration, /for update/);
  assert.match(migration, /starts_used >= pack_row\.max_candidates/);
  assert.match(migration, /insert into public\.interviews/);
  assert.match(migration, /set starts_used = starts_used \+ 1/);
  assert.match(migration, /grant execute on function public\.start_screening_interview[\s\S]*to service_role/);
});

test('completed recordings survive interruption and only advance after server readback', () => {
  const flow = read('components/EmployerVideoInterview.tsx');
  const draftStore = read('lib/screening-draft-store.ts');
  const uploader = read('lib/screening-video-upload.ts');
  const statusRoute = read('app/api/screening/interviews/[id]/status/route.ts');
  const uploadRoute = read('app/api/screening/interviews/[id]/upload-url/route.ts');

  assert.match(draftStore, /indexedDB\.open/);
  assert.match(draftStore, /probeScreeningRecordingStore/);
  assert.match(draftStore, /blob: Blob/);
  assert.match(draftStore, /transcriptSegments: TranscriptSegment\[\]/);
  assert.match(draftStore, /transcriptTimingVersion/);
  assert.match(flow, /await saveScreeningRecordingDraft/);
  assert.match(flow, /await readStatus\(interviewId\)/);
  assert.match(flow, /await deleteScreeningRecordingDraft/);
  assert.match(flow, /error !== c\.recoveredRecording/);
  assert.match(uploader, /file\.size > grant\.maxBytes/);
  assert.match(uploader, /request\.upload\.onprogress/);
  assert.match(uploader, /secure video upload was interrupted/i);
  assert.match(uploader, /caught instanceof ScreeningUploadError && caught\.retryable/);
  assert.match(flow, /Recorded on this device/);
  assert.match(flow, /Received by Muqabala/);
  assert.match(statusRoute, /question_index,video_upload_status,response_saved_at/);
  assert.doesNotMatch(statusRoute, /transcript|video_path|feedback/);
  assert.match(uploadRoute, /state: 'received'/);
});

test('current OpenAI models receive no unsupported temperature option', () => {
  const advertRoute = read('app/api/interview/route.ts');
  const adaptiveModel = read('lib/universal-interview/model.ts');
  const reportLanguage = read('lib/server/evaluation-report-language.ts');
  for (const source of [advertRoute, adaptiveModel, reportLanguage]) {
    assert.doesNotMatch(source, /temperature\s*:/);
  }
  assert.match(advertRoute, /reportOperationalFailure\('interview_generation_failed'/);
  assert.match(read('app/api/screening/packs/route.ts'), /reportOperationalFailure\('screening_pack_creation_failed'/);
});

test('timed evidence storage is private and rolls out through a compatible save function', () => {
  const migration = read('supabase/migrations/20260903175653_timed_interview_evidence.sql');
  const answerRoute = read('app/api/screening/interviews/[id]/answers/route.ts');
  const brainRoute = read('app/api/screening/interviews/[id]/brain/route.ts');
  assert.match(migration, /add column if not exists transcript_segments jsonb/);
  assert.match(migration, /create table public\.interview_evidence_records/);
  assert.match(migration, /alter table public\.interview_evidence_records enable row level security/);
  assert.match(migration, /revoke all on public\.interview_evidence_records from public, anon, authenticated/);
  assert.match(migration, /create or replace function public\.save_screening_video_answer_v2/);
  assert.match(answerRoute, /rpc\('save_screening_video_answer_v2'/);
  assert.match(answerRoute, /p_transcript_segments/);
  assert.match(answerRoute, /p_transcript_timing_version/);
  assert.match(brainRoute, /TranscriptSegmentsSchema\.safeParse/);
  assert.match(brainRoute, /entry\.segment_ids/);
  assert.match(brainRoute, /selected\.map\(\(segment\) => segment\.text\)\.join\(' '\)/);
  assert.match(brainRoute, /start_ms: selected\[0\]\.startMs/);
  assert.match(brainRoute, /end_ms: selected\.at\(-1\)!\.endMs/);
  assert.doesNotMatch(brainRoute, /start_ms:\s*entry|end_ms:\s*entry/);
});

test('screening retries keep one capacity place and return a durable receipt', () => {
  const startRoute = read('app/api/interviews/route.ts');
  const resumeRoute = read('app/api/screening/resume/route.ts');
  const submitRoute = read('app/api/screening/interviews/[id]/submit/route.ts');
  const recoveryMigration = read('supabase/migrations/20260901120000_screening_upload_recovery.sql');
  const notificationMigration = read('supabase/migrations/20260901040619_screening_submission_notifications.sql');

  assert.match(startRoute, /email_confirmed_at/);
  assert.match(startRoute, /p_candidate_user_id: user!\.id/);
  assert.match(startRoute, /p_start_idempotency_hash/);
  assert.match(resumeRoute, /eq\('candidate_user_id', candidate\.id\)/);
  assert.match(notificationMigration, /interviews_screening_candidate_pack_idx/);
  assert.match(notificationMigration, /for update/);
  assert.match(recoveryMigration, /start_idempotency_hash = null/);
  assert.match(submitRoute, /screeningReceiptReference/);
  assert.match(notificationMigration, /interview_row\.submitted_at is not null and interview_row\.locked_at is not null/);
  assert.match(submitRoute, /notificationsQueued: true/);
});

test('employer sees aggregate interrupted uploads without pre-consent identity', () => {
  const dashboard = read('app/employer/page.tsx');
  assert.match(dashboard, /Upload interrupted/);
  assert.match(dashboard, /Date\.parse\(answer\.updated_at\) <= staleBefore/);
  assert.match(dashboard, /select\('id,screening_pack_id,started_at,submitted_at'\)/);
  assert.doesNotMatch(dashboard, /technicalInterviewRows[\s\S]{0,400}candidate_name/);
});

test('JobStrike is absent from the complete employer flow', () => {
  const files = [
    'app/for-employers/page.tsx',
    'app/s/[code]/page.tsx',
    'app/employer/page.tsx',
    'app/employer/interviews/[id]/page.tsx',
    'components/EmployerProofCreate.tsx',
    'components/EmployerVideoInterview.tsx',
  ];
  assert.doesNotMatch(files.map(read).join('\n'), /jobstrike/i);
});

test('candidate email verification keeps employer context and avoids full-link friction', () => {
  const page = read('app/s/[code]/page.tsx');
  const verification = read('components/ScreeningEmailVerification.tsx');
  const callback = read('app/auth/screening-confirm/route.ts');
  const flow = read('components/EmployerVideoInterview.tsx');
  assert.match(page, /availability=\{pack\.status\}/);
  assert.match(verification, /availability === 'active' \|\| resumingFullLink/);
  assert.match(verification, /I already started this interview/);
  assert.match(verification, /Change email/);
  assert.match(callback, /verification=expired/);
  assert.match(flow, /Use another email/);
  assert.match(flow, /maskEmail\(candidateEmail\)/);
});
