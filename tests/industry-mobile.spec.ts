import { expect, test } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:4326/career-change-roadmap";

test.use({
  viewport: { width: 390, height: 844 },
  launchOptions: { executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
});

async function continueButton(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /^Continue/ }).click();
}

test("a Gulf warehouse worker can complete the plain-language exploration route on mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${base}/start`);
  await expect(page.getByRole("button", { name: /Listen to this question/i })).toBeVisible();
  await page.getByLabel("Country").selectOption("United Arab Emirates");
  await expect(page.getByLabel(/Where are you in this move/i)).toBeVisible();
  await page.getByLabel(/Where are you in this move/i).selectOption("already-there");
  await continueButton(page);

  await page.getByLabel("Area of work").selectOption("logistics");
  await page.getByLabel("Your job or main activity").fill("Warehouse Assistant");
  await continueButton(page);

  await page.getByRole("button", { name: /Show me ideas/i }).click();
  await page.getByLabel("Area you may want to enter").selectOption("logistics");
  await page.getByLabel("Choose one job to explore first").selectOption("Logistics Coordinator");
  await continueButton(page);

  await page.getByRole("button", { name: /3 to 5 years/i }).click();
  await page.getByLabel("Highest level completed").selectOption("certificate");
  await continueButton(page);

  await page.getByRole("button", { name: /Stock control/i }).click();
  await page.getByRole("button", { name: /Checking details/i }).click();
  await page.getByRole("button", { name: /Checking AI answers for mistakes/i }).click();
  await page.getByPlaceholder("Type another skill").fill("Using handheld scanners");
  await page.getByRole("button", { name: "Add skill" }).click();
  await continueButton(page);

  await page.getByRole("button", { name: /^5 hours/ }).click();
  await page.getByRole("button", { name: /^12 months/ }).click();
  await continueButton(page);

  await page.getByRole("button", { name: /Free only/i }).click();
  await page.getByLabel("Support you may have").selectOption("none");
  await continueButton(page);

  await page.getByRole("button", { name: /Earn more money/i }).click();
  await page.getByRole("button", { name: /Build skills for my own business later/i }).click();
  await page.getByRole("button", { name: /^Money for training/i }).click();
  await page.getByRole("button", { name: /^Transport or driving licence/i }).click();
  await page.getByRole("button", { name: /^Language or confidence/i }).click();
  await expect(page.getByRole("button", { name: /^Family responsibilities/i })).toBeDisabled();
  await page.getByLabel(/Where are you in your job search/i).selectOption("no-replies");
  await page.getByLabel("Work setting").selectOption("onsite");
  await page.getByLabel("UAE or GCC work experience").selectOption("1-3");
  await page.getByLabel("Work-authorisation situation").selectOption("employer-needed");
  await page.getByLabel(/Do you know anyone/i).selectOption("no");
  await page.getByRole("button", { name: /Build my plan/i }).click();

  await expect(page.getByText("Planning outlook", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Logistics Coordinator/i).first()).toBeVisible();
  await expect(page.getByText(/not a test score/i)).toBeVisible();
  await expect(page.getByText(/Important limits:/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Before you trust a UAE job offer/i })).toBeVisible();
  await expect(page.getByText(/\/100 planning fit/i)).toHaveCount(0);
  await expect(page.getByText(/\$[0-9]{2,}/i)).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const smallTargets = await page.locator("button:visible, a:visible").evaluateAll((elements) =>
    elements
      .filter((element) => !element.closest("nextjs-portal") && !element.hasAttribute("data-nextjs-dev-tools-button"))
      .map((element) => ({ text: element.textContent?.trim(), height: element.getBoundingClientRect().height }))
      .filter((item) => item.height > 0 && item.height < 40)
  );
  expect(smallTargets).toEqual([]);
  expect(errors).toEqual([]);
});

test("hospitality users receive optional language and guest-experience questions", async ({ page }) => {
  await page.goto(`${base}/start`);
  await page.getByLabel("Country").selectOption("United Kingdom");
  await continueButton(page);

  await page.getByLabel("Area of work").selectOption("hospitality");
  await page.getByLabel("Your job or main activity").fill("Room Attendant");
  await continueButton(page);

  await page.getByRole("button", { name: /Help me move up/i }).click();
  await page.getByLabel("Job you want next").selectOption({ index: 1 });
  await continueButton(page);

  await page.getByRole("button", { name: /3 to 5 years/i }).click();
  await page.getByLabel("Highest level completed").selectOption("secondary");
  await continueButton(page);

  await expect(page.getByRole("heading", { name: "Hospitality experience that can help" })).toBeVisible();
  await page.getByRole("button", { name: "English" }).click();
  await page.getByPlaceholder("Type another language").fill("Swahili");
  await page.getByRole("button", { name: "Add language" }).click();
  await page.getByLabel(/Customer or guest-facing experience/i).selectOption("3-plus");
  await expect(page.getByText(/2 of 4 chosen/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("email gate unlocks export controls and tells the truth when delivery is unavailable", async ({ page }) => {
  await page.goto(`${base}/start`);
  await page.evaluate(() => {
    localStorage.setItem("icr.report.v1", JSON.stringify({
      generatedBy: "engine", mode: "general", matchScore: 62,
      verdict: "This is a route to test before making a big decision.",
      guidanceNote: "Verify local requirements before paying.",
      snapshot: { from: "Cleaner", to: "Facilities Supervisor", months: 12, hoursPerWeek: 5, transferableCount: 2, estimatedCost: "Free-only starting route", location: "United Arab Emirates", targetIndustry: "other", careerBarriers: ["Money for training", "Transport or driving licence"], jobSearchStage: "no-replies", relocationStatus: "already-there", gccExperience: "1-3", workAuthorizationStatus: "employer-needed", industryContact: "no" },
      skillGap: [{ skill: "Cleaning standards", status: "have", priority: "high", howToAcquire: "Use safe work evidence." }],
      steps: Array.from({ length: 8 }, (_, index) => ({ title: `Step ${index + 1}`, duration: "One month", detail: "Practical detail." })),
      timeline: [{ label: "Months 1–3", title: "Start", focus: "Build foundations", actions: ["Check local requirements"], milestone: "Requirements checked" }],
      courses: [{ name: "Recognised local foundation", provider: "Approved provider", cost: "Check locally", duration: "Varies", rating: "Verify", why: "Check recognition first" }],
      projects: [{ title: "Safe evidence task", description: "Record a safe result.", skills: ["Quality"], effort: "One week" }],
      resume: { summary: "Use honest evidence.", headline: "Facilities Supervisor", bullets: [{ before: "Did cleaning", after: "Improved an inspected cleaning result" }], linkedinTips: ["Use a clear CV"] },
      salary: [{ stage: "Starting route", range: "Check local adverts", note: "Compare 10 adverts", pct: 40 }],
      networking: { communities: ["Trade association"], peopleToFollow: ["Working supervisor"], events: ["Open day"], outreachTemplate: "May I ask two questions?", weeklyRoutine: ["Read two adverts"] },
      interview: { narrative: "I use safe evidence.", commonQuestions: [{ question: "Why this role?", approach: "Use one example" }], frameworks: ["Situation action result"], redFlags: ["Overclaiming"] },
      dayInLife: [{ time: "Start", activity: "Check priorities" }],
      risk: { difficulty: 5, difficultyLabel: "Challenging", successFactors: ["Check safety rules"], setbacks: [{ risk: "Wrong training", mitigation: "Verify first" }], planB: "Facilities Assistant" },
      firstNinetyDays: { phases: [{ window: "Days 1–30", goals: ["Learn safely"] }] }
    }));
    localStorage.setItem("icr.unlocked.v1", "false");
  });
  await page.goto(`${base}/report`);
  await page.getByPlaceholder("you@example.com").fill("reader@example.com");
  await page.getByRole("button", { name: /Unlock the full roadmap/i }).click();
  await expect(page.getByText(/could not confirm email delivery/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy full plan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute("href", /wa\.me/);
  await expect(page.getByRole("link", { name: "Send by email" })).toHaveAttribute("href", /^mailto:/);
  await expect(page.getByRole("button", { name: "Save as PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "UAE market reality" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "UAE offer scorecard" })).toBeVisible();
  await expect(page.getByText(/Applications but few replies/i)).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Save as PDF" })).toBeHidden();
});
