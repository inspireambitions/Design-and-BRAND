import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  hideEmployerInterviewFooter,
  hidePracticeFooter,
  hideUniversalInterviewFooter,
} from '../lib/footer-visibility.ts';
import { STRINGS } from '../lib/i18n.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('practice footer is hidden only for device, active answer and processing states', () => {
  assert.equal(hidePracticeFooter('check', false), false);
  assert.equal(hidePracticeFooter('check', false, true), true);
  assert.equal(hidePracticeFooter('prep', false), false);
  assert.equal(hidePracticeFooter('record', false), true);
  assert.equal(hidePracticeFooter('review', false), true);
  assert.equal(hidePracticeFooter('feedback', false), true);
  assert.equal(hidePracticeFooter('feedback', true), false);
  assert.equal(hidePracticeFooter('done', true), false);
});

test('employer footer stays out of device, recording, upload, consent and submission states', () => {
  for (const stage of ['resuming', 'device', 'recording', 'saving', 'consent', 'submitting']) {
    assert.equal(hideEmployerInterviewFooter(stage), true, stage);
  }
  for (const stage of ['unavailable', 'intro', 'ready', 'complete']) {
    assert.equal(hideEmployerInterviewFooter(stage), false, stage);
  }
});

test('universal interview footer stays visible during setup and competency preparation', () => {
  assert.equal(hideUniversalInterviewFooter('SETUP'), false);
  assert.equal(hideUniversalInterviewFooter('CONFIRM'), false);
  assert.equal(hideUniversalInterviewFooter('INTERVIEW'), true);
  assert.equal(hideUniversalInterviewFooter('FEEDBACK_LOADING'), true);
  assert.equal(hideUniversalInterviewFooter('FEEDBACK'), false);
  assert.equal(hideUniversalInterviewFooter('DELETED'), false);
});

test('global footer uses established internal links and safe external links', () => {
  const footer = read('components/SiteFooter.tsx');
  const layout = read('app/layout.tsx');
  assert.match(layout, /<SiteFooter\s*\/>/);
  assert.match(footer, /import Link from 'next\/link'/);
  assert.match(footer, /target="_blank" rel="noopener noreferrer"/);
  assert.match(footer, /footer_link_clicked/);
  assert.match(footer, /href: '\/practice'/);
  assert.match(footer, /href: '\/accessibility'/);
  assert.doesNotMatch(footer, /Cookie Settings|Delete My Data|All tools|All assessments|Promotion Readiness|Manager Skills|JD Generator|Critical Thinking/i);
});

test('footer copy is complete in English and Arabic', () => {
  const keys = [
    'footerPrepare', 'footerUaeCareers', 'footerMuqabala', 'footerLegal',
    'footerStartPractice', 'footerInterviewReadiness', 'footerGccCvBuilder',
    'footerAiCareerCoach', 'footerSalaryGuides', 'footerLabourLaw',
    'footerGratuityCalculator', 'footerMovingToUae', 'footerForEmployers',
    'footerAbout', 'footerContact', 'footerHelpFaq', 'footerPrivacy',
    'footerTerms', 'footerAccessibility', 'footerBookCall', 'footerMoreResources',
  ];
  for (const key of keys) {
    assert.ok(STRINGS.en[key]?.trim(), `missing English ${key}`);
    assert.ok(STRINGS.ar[key]?.trim(), `missing Arabic ${key}`);
  }
});

test('focused interview components use state-based footer guards', () => {
  assert.match(read('components/InterviewFlow.tsx'), /hidePracticeFooter\(stage, Boolean\(feedback\), requestingCamera\)/);
  assert.match(read('components/EmployerVideoInterview.tsx'), /hideEmployerInterviewFooter\(stage\)/);
  assert.match(read('components/UniversalInterview.tsx'), /hideUniversalInterviewFooter\(stage\)/);
  assert.match(read('app/globals.css'), /body:has\(\[data-footer-visibility='focused'\]\) \.site-footer/);
});
