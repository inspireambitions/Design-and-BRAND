import { expect, test, type Page } from "@playwright/test";

const base = process.env.BASE_URL || "http://localhost:4326/career-change-roadmap";
const chromeLaunch = process.platform === "darwin"
  ? { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }
  : { channel: "chrome" as const };

test.use({
  viewport: { width: 390, height: 844 },
  launchOptions: chromeLaunch,
});

async function completeRoadmap(page: Page, currentRole: string, targetRole: string) {
  const next = () => page.getByRole("button", { name: /^Continue/ });

  await page.getByLabel("Country").selectOption("United Kingdom");
  await next().click();

  await page.getByLabel("Area of work").selectOption("logistics");
  await page.getByLabel("Your job or main activity").fill(currentRole);
  await next().click();

  await page.getByRole("button", { name: /Show me ideas/i }).click();
  await page.getByLabel("Area you may want to enter").selectOption("logistics");
  await page.getByLabel("Choose one job to explore first").selectOption(targetRole);
  await next().click();

  await page.getByRole("button", { name: /3 to 5 years/i }).click();
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
  await page.getByRole("button", { name: /^Money for training/i }).click();
  await page.getByLabel(/Where are you in your job search/i).selectOption("no-replies");
  await page.getByLabel("Work setting").selectOption("onsite");
  await page.getByRole("button", { name: /Build my plan/i }).click();

  await expect(page.getByText("Planning outlook", { exact: true })).toBeVisible({ timeout: 120_000 });
}

test("completed guidance persists until the user deliberately starts again", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));

  await page.goto(base);
  await page.goto(`${base}/start?fresh=1`);
  await expect(page.getByLabel("Country")).toBeVisible();
  await expect(page).toHaveURL(`${base}/start`);

  await completeRoadmap(page, "Warehouse Assistant", "Logistics Coordinator");
  await expect(page).toHaveURL(`${base}/report`);
  await expect(page.getByRole("heading", { level: 1, name: /Warehouse Assistant.*Logistics Coordinator/i })).toBeVisible();

  await page.waitForTimeout(30_000);
  await expect(page).toHaveURL(`${base}/report`);
  await expect(page.getByText("Planning outlook", { exact: true })).toBeVisible();
  await expect(page.getByText(/Question 1 of 8/i)).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("Planning outlook", { exact: true })).toBeVisible();
  await expect(page.getByText(/Question 1 of 8/i)).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(base);
  await expect(page.getByText(/Question 1 of 8/i)).toHaveCount(0);

  await page.goto(`${base}/start`);
  await expect(page.getByRole("heading", { name: /How would you like to begin/i })).toBeVisible();

  await page.goto(`${base}/start?fresh=1`);
  await expect(page.getByLabel("Country")).toBeVisible();
  await expect(page).toHaveURL(`${base}/start`);
  await expect(page.getByText(/Question 1 of 8/i)).toBeVisible();
  await completeRoadmap(page, "Warehouse Operative", "Logistics Coordinator");
  await expect(page).toHaveURL(`${base}/report`);

  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
