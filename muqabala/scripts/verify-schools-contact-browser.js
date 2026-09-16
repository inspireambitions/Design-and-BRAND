async (page) => {
  await page.route('**/api/schools/pilot-contact', route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Please try again later.'})}));
  await page.goto('http://localhost:3110/schools');
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Send pilot enquiry')?.disabled);
  const institution = page.getByRole('textbox', { name: 'Institution', exact: true });
  await institution.focus();
  await page.keyboard.type('Synthetic College');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Synthetic Adviser');
  await page.keyboard.press('Tab');
  await page.keyboard.type('fixture@example.test');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Local keyboard recovery check.');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.getByRole('alert').filter({ hasText: /Service unavailable|Please try again later/ }).waitFor();
  if (await institution.inputValue() !== 'Synthetic College') throw new Error('Enquiry lost after failure');
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('Horizontal overflow');
  console.log('PASS: mobile keyboard form, failed-request recovery, no horizontal overflow');
}
