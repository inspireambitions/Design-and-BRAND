import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('employer volume flags default off and gate WhatsApp behind the volume flag', async () => {
  const flags = read('lib/employer-volume.ts');
  assert.match(flags, /EMPLOYER_VOLUME/);
  assert.match(flags, /WHATSAPP_ENABLED/);
  assert.match(flags, /employerVolumeEnabled\(\) && flag\(process\.env\.WHATSAPP_ENABLED\)/);

  const { employerVolumeEnabled, whatsAppEnabled } = await import('../lib/employer-volume.ts');
  delete process.env.EMPLOYER_VOLUME;
  delete process.env.WHATSAPP_ENABLED;
  assert.equal(employerVolumeEnabled(), false);
  assert.equal(whatsAppEnabled(), false);
  process.env.WHATSAPP_ENABLED = 'true';
  assert.equal(whatsAppEnabled(), false, 'WhatsApp never enables without the volume flag');
  process.env.EMPLOYER_VOLUME = 'true';
  assert.equal(employerVolumeEnabled(), true);
  assert.equal(whatsAppEnabled(), true);
  delete process.env.EMPLOYER_VOLUME;
  delete process.env.WHATSAPP_ENABLED;
});

test('section 1: employer page hero and sample block change only behind the flag', () => {
  const page = read('app/for-employers/page.tsx');
  const component = read('components/EmployerProofCreate.tsx');
  const copy = read('lib/marketing-content.ts');

  assert.match(page, /volume=\{employerVolumeEnabled\(\)\}/);
  assert.match(page, /production=\{process\.env\.NODE_ENV === 'production'\}/);
  assert.match(page, /samples\/employer-report\.png/);

  assert.match(component, /\{volume \? c\.volumeTitle : c\.title\}/);
  assert.match(component, /\{volume \? c\.volumePrimary : c\.primaryCta\}/);
  assert.match(component, /encodeURIComponent\('\/for-employers#create'\)/);
  assert.match(component, /volume && !production \?/);
  assert.match(component, /hidden in production/);

  assert.match(copy, /volumeTitle: '223 applications\. Seven worth your time\. 48 hours\.'/);
  assert.match(copy, /volumePrimary: 'Start a shortlist, free'/);
  assert.match(copy, /volumeSecondary: 'See a real report'/);
  assert.match(copy, /volumeTrust: 'No automatic rejection\. No accent, face or personality scoring\. You decide\.'/);
  assert.match(copy, /volumeSampleTitle: 'What you get after a candidate answers'/);

  const signIn = read('components/EmailSignIn.tsx');
  assert.doesNotMatch(signIn, /Promotions or Spam|emailDeliveryHelp/);
});

test('no em dashes in employer volume copy or docs', () => {
  for (const path of ['lib/employer-volume.ts', 'docs/employer-volume-changes.md', 'scripts/employer-volume.test.mjs']) {
    assert.doesNotMatch(read(path), /\u2014/, `${path} contains an em dash`);
  }
  const copy = read('lib/marketing-content.ts');
  assert.doesNotMatch(copy, /\u2014/);
});
