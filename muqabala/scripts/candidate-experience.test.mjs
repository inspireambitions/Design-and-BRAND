import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { rubricForQuestion } from '../lib/question-rubric.ts';
import { compareRetries } from '../lib/retry-comparison.ts';
import { resolveUnscoredReason } from '../lib/report-feedback.ts';
import { focusedQuestionFromRole } from '../lib/focused-question.ts';
import { containsArabicScript, overallFromAnswers } from '../lib/scoring.ts';
import { screeningPreviewCopy } from '../lib/screening-preview.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const competency = (id, evidence = null) => ({ id, label: id, score: evidence ? 8 : 2, evidence });
const feedback = (overrides = {}) => ({
  questionId: 'q1', score: 70, status: 'scored', headline: 'Result',
  competencies: [competency('ownership')], strengths: [], improvements: ['Add the outcome.'],
  coachTip: 'Say what changed.', source: 'ai', scoringVersion: 'model-v1', rubricVersion: 'rubric-v1',
  ...overrides,
});

test('question rubric returns exact stored criteria in question order and fails closed', () => {
  const role = {
    competencies: [
      { id: 'a', label: 'A', labelAr: 'أ', anchor: 'Exact A' },
      { id: 'b', label: 'B', labelAr: 'ب', anchor: 'Exact B' },
    ],
  };
  assert.deepEqual(rubricForQuestion(role, { competencies: ['b', 'a'] }).map((item) => item.anchor), ['Exact B', 'Exact A']);
  assert.deepEqual(rubricForQuestion(role, { competencies: ['a', 'missing'] }), []);
  assert.deepEqual(rubricForQuestion(role, { competencies: ['a', 'a'] }), []);
});

test('retry comparison blocks missing or changed versions and mismatched questions', () => {
  assert.equal(compareRetries(feedback({ scoringVersion: undefined }), feedback({ scoringVersion: undefined })).compatible, false);
  assert.equal(compareRetries(feedback(), feedback({ rubricVersion: 'rubric-v2' })).compatible, false);
  assert.equal(compareRetries(feedback(), feedback({ questionId: 'q2' })).compatible, false);
});

test('retry comparison separates added, changed and still-missing evidence', () => {
  const before = feedback({ competencies: [competency('a'), competency('b', 'Old proof'), competency('c')] });
  const after = feedback({ competencies: [competency('a', 'New proof'), competency('b', 'Different proof'), competency('c')] });
  const result = compareRetries(before, after);
  assert.equal(result.compatible, true);
  assert.deepEqual(result.evidenceAdded.map((item) => item.id), ['a']);
  assert.deepEqual(result.evidenceChanged.map((item) => item.id), ['b']);
  assert.deepEqual(result.stillMissing.map((item) => item.id), ['c']);
});

test('mixed-script answers require multilingual understanding even when Latin text dominates', () => {
  assert.equal(containsArabicScript('I called the guest ثم شرحت الحل and fixed the booking'), true);
  assert.equal(containsArabicScript('I called the guest and fixed the booking'), false);
});

test('reports use stored unscored reasons and never turn them into zero scores', () => {
  const unscored = feedback({
    score: 0,
    status: 'unscored',
    unscoredReason: 'feedback_could_not_be_verified',
    source: 'ai',
  });
  assert.equal(resolveUnscoredReason(unscored, 'A complete saved answer.', 'failed'), 'feedback_could_not_be_verified');
  assert.equal(resolveUnscoredReason(null, '', 'unscored'), 'question_not_answered');
  assert.equal(resolveUnscoredReason(null, 'A saved answer.', 'failed'), 'scoring_service_unavailable');
});

test('older reports get a cautious reason without inventing a failure cause', () => {
  const oldFeedback = feedback({ score: 0, status: 'unscored', source: 'ai' });
  assert.equal(resolveUnscoredReason(oldFeedback, 'A complete answer.', 'unscored'), 'reason_not_recorded');
});

test('pending feedback is not reported as a scoring failure', () => {
  assert.equal(resolveUnscoredReason(null, 'A saved answer.', 'pending'), null);
});

test('overall score is withheld when scoring sources measure different things', () => {
  assert.equal(overallFromAnswers([
    { feedback: feedback({ source: 'ai', score: 80 }) },
    { feedback: feedback({ source: 'structure', score: 60 }) },
  ]), null);
  assert.equal(overallFromAnswers([
    { feedback: feedback({ source: 'ai', score: 80 }) },
    { feedback: feedback({ source: 'ai', score: 60 }) },
  ]), 70);
});

test('report retry resolves the original question before rotation or subsetting', () => {
  const question = (id) => ({ id });
  const catalogue = { questions: [question('new-opener')], bank: [question('old-core')] };
  assert.equal(focusedQuestionFromRole(catalogue, 'old-core')?.id, 'old-core');
  const custom = { questions: Array.from({ length: 8 }, (_, index) => question(`custom-${index + 1}`)) };
  assert.equal(focusedQuestionFromRole(custom, 'custom-7')?.id, 'custom-7');
});

test('employer work-sample previews use the sending company and disclose human review', () => {
  const preview = screeningPreviewCopy({
    companyName: 'Nour Clinic',
    jobTitle: 'Receptionist',
    questionCount: 3,
  });
  assert.equal(preview.invitationTitle, 'Nour Clinic invites you to show how you would handle the job.');
  assert.equal(preview.roleLine, 'Receptionist work sample from Nour Clinic.');
  assert.match(preview.description, /Three questions\. About 12 minutes\./);
  assert.match(preview.description, /reviewed by the hiring team/);
  assert.match(preview.description, /No face scoring\. No automatic rejection\./);
});

test('work-sample previews normalise unsafe layout characters and never include recruiter details', () => {
  const preview = screeningPreviewCopy({
    companyName: '  Nour\nClinic\u0000  ',
    jobTitle: '  Front\tDesk Agent  ',
  });
  assert.equal(preview.companyName, 'Nour Clinic');
  assert.equal(preview.jobTitle, 'Front Desk Agent');
  assert.doesNotMatch(JSON.stringify(preview), /recruiter/i);
});

test('marketing pages expose a keyboard skip link and rating choices have a labelled group', () => {
  const marketing = read('components/MarketingSite.tsx');
  const rating = read('components/RatingCard.tsx');
  assert.match(marketing, /href="#main-content"/);
  assert.match(marketing, /id="main-content"/);
  assert.match(rating, /role="group" aria-label=\{t\('rateConfidence'\)\}/);
});

test('failed scoring is not announced as ready feedback and verification copy matches the enabled journey', () => {
  const flow = read('components/InterviewFlow.tsx');
  const copy = read('lib/i18n.ts');
  assert.match(flow, /feedback\.source === 'none' \? t\('firstFeedbackUnavailable'\)/);
  assert.doesNotMatch(copy, /Verify your email to unlock the remaining questions/);
  assert.match(copy, /firstFeedbackUnavailable: 'Question 1 feedback is not available yet'/);
});
