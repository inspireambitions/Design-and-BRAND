import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.BASE_URL || "http://127.0.0.1:4326/career-change-roadmap";
const output = "audit-2026-08-04-final";
await mkdir(output, { recursive: true });

const profile = {
  mode: "hospitality",
  directionMode: "known",
  industry: "hospitality",
  currentIndustry: "hospitality",
  targetIndustry: "hospitality",
  currentRole: "Room Attendant",
  targetRole: "Housekeeping Supervisor",
  yearsExperience: "3-5",
  existingSkills: ["Checking details", "Working safely", "Training another person", "Using AI tools for everyday work"],
  hoursPerWeek: 5,
  timelineMonths: 12,
  budget: "free",
  workStyle: "onsite",
  motivations: ["money", "growth", "stability"],
  targetCountry: "United Arab Emirates",
  careerBarrier: "Money for training",
  careerBarriers: ["Money for training", "Transport or driving licence", "Language or confidence"],
  educationLevel: "secondary",
  supportAvailable: "none",
  relocationStatus: "already-there",
  gccExperience: "1-3",
  workAuthorizationStatus: "employer-needed",
  industryContact: "no",
  jobSearchStage: "no-replies",
  languages: ["English", "Swahili"],
  customerFacingExperience: "3-plus",
};

const response = await fetch(`${base}/api/roadmap`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.200" },
  body: JSON.stringify(profile),
});
if (!response.ok) throw new Error(`Roadmap request failed: ${response.status}`);
const report = await response.json();

const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.goto(base);
  await page.evaluate(({ report, profile }) => {
    localStorage.setItem("icr.report.v1", JSON.stringify(report));
    localStorage.setItem("icr.profile.v1", JSON.stringify(profile));
    localStorage.setItem("icr.unlocked.v1", "true");
  }, { report, profile });
  await page.goto(`${base}/report`);
  await page.screenshot({ path: `${output}/${viewport.name}-report.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`${viewport.name} report overflows by ${overflow}px`);
  await page.close();
}
await browser.close();
console.log(`Captured final desktop and mobile reports in ${output}`);
