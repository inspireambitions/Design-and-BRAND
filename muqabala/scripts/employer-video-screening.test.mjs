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
});

test('candidate APIs do not expose employer analysis or reports', () => {
  const scoreRoute = read('app/api/score/route.ts');
  const reportRoute = read('app/api/interviews/[id]/report/route.ts');
  assert.match(scoreRoute, /mode === 'screening'[\s\S]*saved: true/);
  assert.match(reportRoute, /mode === 'screening'[\s\S]*status: 404/);
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
  assert.match(report, /Candidate’s recorded evidence/);
  assert.match(report, /AI-generated analysis/);
  assert.match(report, /not a verified fact or an automatic decision/);
  assert.match(report, /createSignedUrl/);
});

test('employer creation form generates the description before unlocking the link action', () => {
  const form = read('components/EmployerProofCreate.tsx');
  const styles = read('components/EmployerProofCreate.module.css');
  const generatePosition = form.indexOf("t('proofGenerateAdvert')");
  const createPosition = form.indexOf("t('proofCreateAction')");

  assert.match(form, /fetch\('\/api\/screening\/job-description'/);
  assert.match(form, /const canCreate = companyReady && titleReady && jobReady/);
  assert.match(form, /type="submit" className=\{styles\.submit\} disabled=\{!canCreate\}/);
  assert.ok(generatePosition >= 0 && createPosition > generatePosition);
  assert.match(styles, /\.actions\s*\{[\s\S]*grid-template-columns:/);
  assert.match(styles, /@media \(max-width: 28rem\)[\s\S]*\.actions\s*\{\s*grid-template-columns: 1fr;/);
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
