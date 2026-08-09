import { chromium } from "@playwright/test";

const base = process.env.BASE_URL || "http://127.0.0.1:4326/career-change-roadmap";
const output = "audit-2026-08-04";
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await desktop.goto(base, { waitUntil: "networkidle" });
await desktop.screenshot({ path: `${output}/repaired-landing-desktop.png`, fullPage: true });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobile.goto(`${base}/start`, { waitUntil: "networkidle" });
await mobile.getByLabel("Country").selectOption("United Arab Emirates");
await mobile.screenshot({ path: `${output}/repaired-question-mobile.png`, fullPage: true });

await mobile.evaluate(async () => {
  const response = await fetch("/career-change-roadmap/api/roadmap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "general", directionMode: "explore", currentIndustry: "logistics", targetIndustry: "logistics", industry: "logistics",
      currentRole: "Warehouse Assistant", targetRole: "Logistics Coordinator", yearsExperience: "3-5", educationLevel: "certificate",
      existingSkills: ["Stock control", "Checking details", "Using handheld scanners"], hoursPerWeek: 5, timelineMonths: 12,
      budget: "free", supportAvailable: "none", workStyle: "onsite", motivations: ["money", "business"],
      careerBarrier: "Money for training", targetCountry: "United Arab Emirates",
    }),
  });
  const report = await response.json();
  localStorage.setItem("icr.report.v1", JSON.stringify(report));
  localStorage.setItem("icr.unlocked.v1", "false");
});
await mobile.goto(`${base}/report`, { waitUntil: "networkidle" });
await mobile.screenshot({ path: `${output}/repaired-report-mobile.png`, fullPage: true });

await desktop.evaluate(async () => {
  const response = await fetch("/career-change-roadmap/api/roadmap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mode: "general", directionMode: "known", currentIndustry: "trades", targetIndustry: "trades", industry: "trades",
      currentRole: "Construction Helper", targetRole: "Electrician", yearsExperience: "3-5", educationLevel: "certificate",
      existingSkills: ["Using tools", "Following safety rules"], hoursPerWeek: 8, timelineMonths: 18, budget: "low",
      supportAvailable: "mentor", workStyle: "onsite", motivations: ["money", "business"], careerBarrier: "Money for training",
      targetCountry: "United Arab Emirates",
    }),
  });
  const report = await response.json();
  localStorage.setItem("icr.report.v1", JSON.stringify(report));
  localStorage.setItem("icr.unlocked.v1", "false");
});
await desktop.goto(`${base}/report`, { waitUntil: "networkidle" });
await desktop.screenshot({ path: `${output}/repaired-report-desktop.png`, fullPage: true });

await browser.close();
console.log("Captured repaired desktop, mobile question and report screens.");
