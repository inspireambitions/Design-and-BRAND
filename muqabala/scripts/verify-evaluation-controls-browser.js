async (page) => {
  await page.getByRole('button', { name: 'Edit name', exact: true }).click();
  await page.getByRole('textbox', { name: 'Interviewer', exact: true }).fill('Corrected synthetic reviewer');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Edit name', exact: true }).waitFor();
  if (await page.getByRole('textbox', { name: 'Interviewer', exact: true }).inputValue() !== 'Corrected synthetic reviewer') throw new Error('Name save failed');
  await page.getByRole('combobox', { name: 'Correct a previous note' }).selectOption('0');
  const note = page.getByRole('textbox', { name: 'Employer note or correction' });
  if (!await page.getByRole('button', { name: 'Add correction', exact: true }).isDisabled()) throw new Error('Empty correction allowed');
  await note.fill((await note.inputValue()) + 'Three years, not two.');
  await page.getByRole('button', { name: 'Add correction', exact: true }).click();
  if (await page.getByRole('region', { name: 'Synthetic saved notes' }).getByRole('listitem').count() !== 2) throw new Error('Correction lost original');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByText('Version 1 · Closed', { exact: true }).waitFor();
  await page.getByRole('checkbox', { name: 'Reject actions to test recovery' }).check();
  await note.fill('Retain this draft after network failure.');
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByText('We could not confirm the note was added. Your text is still here. Refresh to check before trying again.', { exact: true }).waitFor();
  if (await note.inputValue() !== 'Retain this draft after network failure.') throw new Error('Draft lost');
  if (!await page.getByRole('button', { name: 'Add note', exact: true }).isEnabled()) throw new Error('Busy stuck');
  console.log('PASS: name edit, first-note correction, original retained, archived link close, failed-request draft recovery');
}
