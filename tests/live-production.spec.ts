import { expect, test } from "@playwright/test";

const base = process.env.LIVE_BASE_URL || "https://inspireambitions.com/career-change-roadmap";
const chromeLaunch = process.platform === "darwin"
  ? { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }
  : { channel: "chrome" as const };

test.use({
  viewport: { width: 390, height: 844 },
  launchOptions: chromeLaunch,
});

for (const viewport of [
  { name: "small phone", width: 320, height: 568 },
  { name: "large phone", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
]) {
  test(`current production assessment fits a ${viewport.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto(`${base}/start`);
    await expect(page.getByRole("heading", { name: "Where do you want to work?" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test("current production wizard completes on mobile", async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));
  const next = () => page.getByRole("button", { name: /^Continue/ });

  await page.goto(`${base}/start`);
  await page.getByLabel("Country").selectOption("United Arab Emirates");
  await page.getByLabel(/Where are you in this move/i).selectOption("already-there");
  await next().click();

  await page.getByLabel("Area of work").selectOption("logistics");
  await page.getByLabel("Your job or main activity").fill("Warehouse Assistant");
  await next().click();

  await page.getByRole("button", { name: /Show me ideas/i }).click();
  await page.getByLabel("Area you may want to enter").selectOption("logistics");
  await page.getByLabel("Choose one job to explore first").selectOption("Logistics Coordinator");
  await next().click();

  await page.getByRole("button", { name: /3.*5 years/i }).click();
  await page.getByLabel("Highest level completed").selectOption("certificate");
  await next().click();

  await page.getByRole("button", { name: /Stock control/i }).click();
  await page.getByRole("button", { name: /Checking details/i }).click();
  await next().click();

  await page.getByRole("button", { name: /^5 hours/ }).click();
  await page.getByRole("button", { name: /^12 months/i }).click();
  await next().click();

  await page.getByRole("button", { name: /Free only/i }).click();
  await page.getByLabel("Support you may have").selectOption("none");
  await next().click();

  await page.getByRole("button", { name: /Earn more money/i }).click();
  await page.getByRole("button", { name: /Build skills for my own business later/i }).click();
  await page.getByRole("button", { name: /^Money for training/i }).click();
  await page.getByLabel(/Where are you in your job search/i).selectOption("no-replies");
  await page.getByLabel("Work setting").selectOption("onsite");
  await page.getByLabel("UAE or GCC work experience").selectOption("1-3");
  await page.getByLabel("Work-authorisation situation").selectOption("employer-needed");
  await page.getByLabel(/Do you know anyone/i).selectOption("no");
  await page.getByRole("button", { name: /Build my plan/i }).click();

  await expect(page.getByText("Planning outlook", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Logistics Coordinator/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Before you trust a UAE job offer/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
