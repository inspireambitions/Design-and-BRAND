import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('desktop contact page keeps support inside Muqabala', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/contact');
  await expect(page.getByRole('heading', { level: 1, name: 'How can we help?' })).toBeVisible();
  const email = page.getByRole('link', { name: 'Email Muqabala at hello@trymuqabala.com' });
  await expect(email).toHaveAttribute('href', 'mailto:hello@trymuqabala.com');
  await expect(email).not.toHaveAttribute('target', '_blank');
  await expect(page.locator('a[href*="inspireambitions.com/contact"]')).toHaveCount(0);
  expect((await new AxeBuilder({ page: page as never }).analyze()).violations).toEqual([]);
});

test('mobile Arabic contact page is RTL and isolates the email address', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.addInitScript(() => localStorage.setItem('muqabala.lang.v1', 'ar'));
  await page.goto('/contact');
  const contact = page.locator('.contact-page');
  await expect(contact).toHaveAttribute('lang', 'ar');
  await expect(contact).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.contact-email-link bdi')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('.contact-email-link')).toBeInViewport();
  expect((await new AxeBuilder({ page: page as never }).analyze()).violations).toEqual([]);
});
