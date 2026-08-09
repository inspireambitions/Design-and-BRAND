const base = process.env.BASE_URL || "http://127.0.0.1:4326/career-change-roadmap";

const routes = [
  ["logistics", "Warehouse Assistant", "Logistics Coordinator"],
  ["trades", "Construction Helper", "Electrician", true],
  ["care", "Care Assistant", "Care Supervisor", true],
  ["education", "School Assistant", "Teaching Assistant", true],
  ["retail", "Shop Assistant", "Customer Service Supervisor"],
  ["administration", "Office Assistant", "Administrative Coordinator"],
  ["finance", "Cashier", "Bookkeeping and Accounts Assistant"],
  ["sales", "Sales Assistant", "Sales Representative"],
  ["technology", "Help Desk Agent", "IT Support Technician"],
  ["manufacturing", "Production Worker", "Production Team Leader", true],
  ["transport", "Driver's Assistant", "Transport Coordinator", true],
  ["security", "Security Guard", "Security Supervisor", true],
  ["facilities", "Cleaner", "Facilities Supervisor", true],
  ["beauty", "Salon Assistant", "Beauty Therapist", true],
  ["hospitality", "Waiter", "Front Office Manager"],
  ["business", "Market Seller", "Small Business Owner"],
  ["agriculture", "Farm Worker", "Food Production Quality Assistant", true],
  ["other", "Community Volunteer", "Museum Guide"],
];

for (const [index, [industry, currentRole, targetRole, regulated]] of routes.entries()) {
  const response = await fetch(`${base}/api/roadmap`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${index + 20}` },
    body: JSON.stringify({
      mode: industry === "hospitality" ? "hospitality" : "general",
      directionMode: index % 3 === 0 ? "explore" : "known",
      currentIndustry: industry,
      targetIndustry: industry,
      industry,
      currentRole,
      targetRole,
      yearsExperience: index % 2 ? "0-2" : "6-10",
      educationLevel: index % 2 ? "primary" : "certificate",
      existingSkills: ["Working safely", "Checking details", "Working with a team"],
      hoursPerWeek: index % 2 ? 2 : 12,
      timelineMonths: index % 2 ? 6 : 24,
      budget: index % 4 === 0 ? "free" : index % 4 === 1 ? "low" : "500",
      supportAvailable: index % 2 ? "none" : "employer",
      workStyle: "onsite",
      motivations: ["growth", "business"],
      careerBarrier: index % 2 ? "My education level" : "Money for training",
      targetCountry: index % 4 === 0 ? "United Arab Emirates" : index % 4 === 1 ? "Uganda" : index % 4 === 2 ? "United Kingdom" : "Canada",
    }),
  });
  if (!response.ok) throw new Error(`${industry}: HTTP ${response.status}`);
  const report = await response.json();
  if (report.steps?.length !== 8) throw new Error(`${industry}: expected 8 steps`);
  if (report.timeline?.length !== 4) throw new Error(`${industry}: expected 4 timeline phases`);
  if (!report.guidanceNote?.includes("not a psychometric test")) throw new Error(`${industry}: missing assessment limit`);
  if (/\$\s?\d{2,}|\d{2,},\d{3}/.test(JSON.stringify(report.salary))) throw new Error(`${industry}: exact salary leaked`);
  if (report.courses.some((course) => !/free/i.test(course.cost) && !/check/i.test(course.cost))) throw new Error(`${industry}: unverified course price leaked`);
  if (regulated && !/licen[cs]e|supervis|safety|safeguard|authori[sz]|approved|scope/i.test(report.guidanceNote)) throw new Error(`${industry}: regulated warning missing`);
  if (["trades", "care", "manufacturing", "transport", "security", "facilities", "beauty", "agriculture"].includes(industry)) {
    const advice = JSON.stringify({ steps: report.steps, projects: report.projects, networking: report.networking });
    if (/slack community|linkedin groups|public portfolio/i.test(advice)) throw new Error(`${industry}: unsuitable digital-first advice`);
  }
  console.log(`PASS ${industry.padEnd(15)} ${report.risk.difficultyLabel}`);
}

const invalid = await fetch(`${base}/api/roadmap`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.240" },
  body: JSON.stringify({ currentRole: "", targetRole: "" }),
});
if (invalid.status !== 400) throw new Error(`invalid profile: expected 400, got ${invalid.status}`);
console.log("PASS invalid profile rejected");

const invalidEmail = await fetch(`${base}/api/subscribe`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.241" },
  body: JSON.stringify({ email: "not-an-email" }),
});
if (invalidEmail.status !== 400) throw new Error(`invalid email: expected 400, got ${invalidEmail.status}`);
console.log("PASS invalid email rejected");

const longInput = "x".repeat(600);
const cleaned = await fetch(`${base}/api/roadmap`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.242" },
  body: JSON.stringify({
    industry: "other", currentRole: `<script>${longInput}</script>`, targetRole: `Guide ${longInput}`,
    existingSkills: Array.from({ length: 100 }, (_, i) => `skill-${i}-${longInput}`),
    hoursPerWeek: 999, timelineMonths: 999, budget: "free", motivations: [],
  }),
});
if (!cleaned.ok) throw new Error(`long input: HTTP ${cleaned.status}`);
const cleanedReport = await cleaned.json();
if (cleanedReport.snapshot.from.length > 160 || cleanedReport.snapshot.to.length > 160) throw new Error("long input was not capped");
if (cleanedReport.snapshot.hoursPerWeek !== 40 || cleanedReport.snapshot.months !== 12) throw new Error("numeric limits failed");
console.log("PASS long and extreme input bounded");

console.log(`PASS ${routes.length + 3} stress cases`);
