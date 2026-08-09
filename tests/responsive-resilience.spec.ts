import { expect, test } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:4326/career-change-roadmap";

test.use({
  launchOptions: { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
});

for (const viewport of [
  { name: "small phone", width: 320, height: 568 },
  { name: "large phone", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
]) {
  test(`landing and assessment fit a ${viewport.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);

    await page.goto(base);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

    await page.goto(`${base}/start`);
    await expect(page.getByLabel("Country")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test("corrupt saved data recovers without an error screen", async ({ page }) => {
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem("icr.report.v1", "{broken-json"));
  await page.goto(`${base}/report`);
  await page.waitForURL(/\/start$/);
  await expect(page.getByLabel("Country")).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
});

