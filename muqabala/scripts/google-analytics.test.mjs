import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { analyticsPagePath, GOOGLE_ANALYTICS_ID } from '../lib/google-analytics.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Google Analytics uses the approved GA4 property with advertising signals disabled', () => {
  const component = read('components/GoogleAnalytics.tsx');
  assert.equal(GOOGLE_ANALYTICS_ID, 'G-P0ZRD76L3J');
  assert.match(component, /googletagmanager\.com\/gtag\/js/);
  assert.match(component, /send_page_view: false/);
  assert.match(component, /allow_google_signals: false/);
  assert.match(component, /allow_ad_personalization_signals: false/);
});

test('private route identifiers never become analytics page paths', () => {
  assert.equal(analyticsPagePath('/s/private-company-code'), '/s/[code]');
  assert.equal(analyticsPagePath('/share/private-report-token'), '/share/[token]');
  assert.equal(analyticsPagePath('/account/reports/private-report-id'), '/account/reports/[id]');
  assert.equal(analyticsPagePath('/employer/interviews/private-interview-id'), '/employer/interviews/[id]');
  assert.equal(analyticsPagePath('/for-employers'), '/for-employers');
  assert.equal(analyticsPagePath('/practice/front-office-agent'), '/practice/front-office-agent');
});

test('privacy copy names Google Analytics and explains the private-link boundary', () => {
  const privacy = read('lib/marketing-content.ts');
  assert.match(privacy, /We use Google Analytics/);
  assert.match(privacy, /Private link identifiers are replaced with generic route labels/);
});
