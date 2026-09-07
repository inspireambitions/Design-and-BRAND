async (page) => {
  await page.reload();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('heading', { name: 'Interviewer name', exact: true }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error('Horizontal overflow at ' + width);
    await page.screenshot({ path: 'out/evaluation-controls-fixture/width-' + width + '.png', fullPage: true });
  }
  console.log('PASS: controls fit 390px and 1280px viewports');
}
