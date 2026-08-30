import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const interviewId = '11111111-1111-4111-8111-111111111111';

const feedback = {
  questionId: 'angry_guest',
  score: 78,
  status: 'scored',
  headline: 'Clear ownership with a useful result',
  competencies: [
    { id: 'customer_focus', label: 'Customer focus', score: 8, evidence: 'I listened, apologised and kept the guest updated.' },
    { id: 'ownership', label: 'Ownership', score: 8, evidence: 'I called housekeeping and arranged another room.' },
    { id: 'problem_solving', label: 'Problem solving', score: 7, evidence: 'I offered a temporary lounge while we prepared the room.' },
    { id: 'evidence', label: 'Specific evidence', score: 7, evidence: 'The room was ready within twenty minutes.' },
  ],
  strengths: ['You explained what you personally did.'],
  improvements: ['Name the exact service recovery you offered.'],
  coachTip: 'Finish with what the guest said or did next.',
  source: 'ai',
  scoringVersion: 'e2e-v1',
  rubricVersion: 'e2e-v1',
};

async function mockPracticeApis(page: Page) {
  await page.route('**/api/interviews', async (route) => {
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: interviewId, unlocked: true }) });
  });
  await page.route(`**/api/interviews/${interviewId}`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ saved: true, completionProof: 'completion-proof-for-browser-tests-1234567890' }) });
  });
  await page.route('**/api/score', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ feedback }) });
  });
  await page.route('**/api/practice-plans', async (route) => {
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'queued', maskedEmail: 'p•••••@example.com' }) });
  });
}

async function completeTypedPractice(page: Page, locale: 'en' | 'ar') {
  await mockPracticeApis(page);
  await page.goto(`/practice/front-office-agent?focus=angry_guest&lang=${locale}`);

  if (locale === 'en') {
    await page.getByRole('button', { name: 'Quick guided practice' }).click();
    await page.getByRole('button', { name: 'Type my answers' }).click();
    await page.getByRole('button', { name: 'Continue with typing' }).click();
    await page.getByRole('button', { name: 'Start answering' }).click();
    await page.getByLabel('Your answer').fill('A guest was upset because the room was delayed. I listened, apologised, called housekeeping, offered the lounge and kept the guest updated. The room was ready within twenty minutes.');
    await page.getByRole('button', { name: 'Review answer' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Get my feedback' }).click();
    await expect(page.getByText('What your answer proves')).toBeVisible();
    await page.getByRole('button', { name: 'See my results' }).click();
  } else {
    await page.getByRole('button', { name: 'تدريب موجّه سريع' }).click();
    await page.getByRole('button', { name: 'اكتب إجاباتي' }).click();
    await page.getByRole('button', { name: 'المتابعة بالكتابة' }).click();
    await page.getByRole('button', { name: 'ابدأ الإجابة' }).click();
    await page.getByLabel('إجابتك').fill('كان النزيل منزعجاً بسبب تأخر الغرفة. استمعت إليه واعتذرت واتصلت بفريق التدبير وأبقيته على اطلاع حتى أصبحت الغرفة جاهزة.');
    await page.getByRole('button', { name: 'راجع الإجابة' }).click();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'احصل على ملاحظاتي' }).click();
    await page.getByRole('button', { name: 'اعرض نتائجي' }).click();
  }
}

test('English feedback stays available before the optional email capture and works by keyboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await completeTypedPractice(page, 'en');

  const capture = page.getByRole('heading', { name: 'Get your personalised 7-day practice plan' });
  await expect(capture).toBeVisible();
  await expect(page.getByText('What your answer proves')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Practise this interview again' })).toBeVisible();

  const email = page.getByLabel('Email address');
  await email.focus();
  await page.keyboard.type('person@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Your plan is queued for p•••••@example.com.')).toBeVisible();
  await expect(page.getByText('person@example.com')).toHaveCount(0);

  // @axe-core/playwright accepts older Playwright pages at runtime, but its
  // latest type bundle is compiled against a newer Page interface.
  const accessibility = await new AxeBuilder({ page: page as never }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Arabic mobile capture uses RTL while the email field remains LTR', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await completeTypedPractice(page, 'ar');

  const section = page.locator('.practice-plan-capture');
  await expect(section).toHaveAttribute('lang', 'ar');
  await expect(section).toHaveAttribute('dir', 'rtl');
  await expect(page.getByLabel('البريد الإلكتروني')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('link', { name: 'تدرّب على هذه المقابلة مرة أخرى' })).toBeVisible();

  const accessibility = await new AxeBuilder({ page: page as never }).analyze();
  expect(accessibility.violations).toEqual([]);
});
