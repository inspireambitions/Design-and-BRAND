import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { renderLifecycleEmail } from '../lib/email/lifecycle.ts';

test('the two-hour onboarding email is a service email with one clear return action', () => {
  const email = renderLifecycleEmail({ type: 'onboarding_2h', locale: 'en' });
  assert.match(email.subject, /Muqabala practice/);
  assert.match(email.html, /Return to my account/);
  assert.match(email.html, /unless you choose to share a report/);
  assert.match(email.html, /does not subscribe you to marketing emails/);
  assert.doesNotMatch(`${email.subject}${email.html}${email.text}`, /[—–]/);
});

test('marketing consent is captured only after authentication', () => {
  const requestRoute = readFileSync(new URL('../app/api/auth/request/route.ts', import.meta.url), 'utf8');
  const preferenceRoute = readFileSync(new URL('../app/api/account/email-preferences/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(requestRoute, /marketingOptIn|lifecycle_email_intents|muqabala_marketing/);
  assert.match(preferenceRoute, /currentUser\(\)/);
  assert.match(preferenceRoute, /consent_copy/);
  assert.match(preferenceRoute, /CAREER_EMAIL_CONSENT\[parsed\.data\.lang\]/);
});

test('database queue recovers leases, caps poison jobs and reconciles early webhooks', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260829090000_lifecycle_emails.sql', import.meta.url), 'utf8');
  assert.match(migration, /status='processing' and lease_until<=now\(\) and attempt_count>=5/);
  assert.match(migration, /jobs\.attempt_count<5/);
  assert.match(migration, /'cancelled','failed'/);
  assert.match(migration, /reconcile_pending_lifecycle_email_events/);
  assert.doesNotMatch(migration, /muqabala_marketing_opt_in|lifecycle_email_intents/);
});

test('unsubscribe never erases an in-flight provider send', () => {
  const accountRoute = readFileSync(new URL('../app/api/account/email-preferences/route.ts', import.meta.url), 'utf8');
  const unsubscribeRoute = readFileSync(new URL('../app/api/email/unsubscribe/route.ts', import.meta.url), 'utf8');
  assert.match(accountRoute, /eq\('status', 'pending'\)/);
  assert.match(unsubscribeRoute, /eq\('status', 'pending'\)/);
  assert.doesNotMatch(accountRoute, /in\('status', \['pending', 'processing'\]\)/);
  assert.doesNotMatch(unsubscribeRoute, /in\('status', \['pending', 'processing'\]\)/);
});

test('the 24-hour career email requires an unsubscribe link', () => {
  assert.throws(
    () => renderLifecycleEmail({ type: 'career_tools_24h', locale: 'en' }),
    /requires unsubscribe, sender and business address details/,
  );
});

test('the opted-in career email names only verified tools and includes opt-out', () => {
  const unsubscribeUrl = 'https://trymuqabala.com/email/unsubscribe?token=test-token';
  const email = renderLifecycleEmail({ type: 'career_tools_24h', locale: 'en', unsubscribeUrl, senderAddress: 'hello@updates.trymuqabala.com', businessAddress: 'Verified business address' });
  assert.match(email.html, /Inspire Ambitions Gulf CV Builder/);
  assert.match(email.html, /AI Job Risk Calculator/);
  assert.match(email.html, /You chose to receive/);
  assert.match(email.text, /Unsubscribe:/);
  assert.match(email.text, /test-token/);
  assert.doesNotMatch(`${email.subject}${email.html}${email.text}`, /[—–]/);
});

test('both Arabic lifecycle emails render right to left', () => {
  const first = renderLifecycleEmail({ type: 'onboarding_2h', locale: 'ar' });
  const second = renderLifecycleEmail({
    type: 'career_tools_24h',
    locale: 'ar',
    unsubscribeUrl: 'https://trymuqabala.com/email/unsubscribe?token=test-token',
    senderAddress: 'hello@updates.trymuqabala.com',
    businessAddress: 'Verified business address',
  });
  assert.match(first.html, /lang="ar" dir="rtl"/);
  assert.match(second.html, /lang="ar" dir="rtl"/);
  assert.match(first.text, /فريق مقابلة/);
  assert.match(second.text, /إلغاء الاشتراك/);
});
