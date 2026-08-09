const base = process.env.BASE_URL || "http://127.0.0.1:4326/career-change-roadmap";

const cases = [
  {
    name: "warehouse to logistics",
    profile: { industry: "logistics", currentRole: "Warehouse Assistant", targetRole: "Logistics Coordinator", existingSkills: ["Stock control", "Checking details"] },
    expectProject: /stock|dispatch/i,
    reject: /figma|portfolio project/i,
  },
  {
    name: "retail to office administration",
    profile: { industry: "administration", currentRole: "Shop Assistant", targetRole: "Administrative Coordinator", existingSkills: ["Customer service", "Cash handling"] },
    expectProject: /office process|evidence pack/i,
    reject: /coding bootcamp/i,
  },
  {
    name: "cleaner to facilities supervisor",
    profile: { industry: "facilities", currentRole: "Cleaner", targetRole: "Facilities Supervisor", existingSkills: ["Cleaning standards", "Stock control"] },
    expectProject: /cleaning|facilities/i,
    expectGuidance: /chemical|equipment|safety/i,
  },
  {
    name: "construction helper to electrician",
    profile: { industry: "trades", currentRole: "Construction Helper", targetRole: "Electrician", existingSkills: ["Using tools", "Following safety rules"] },
    expectProject: /maintenance|safety/i,
    expectGuidance: /licen[cs]e|supervis|live systems/i,
  },
  {
    name: "care assistant to care supervisor",
    profile: { industry: "care", currentRole: "Care Assistant", targetRole: "Care Supervisor", existingSkills: ["Helping people", "Keeping records"] },
    expectProject: /care quality|evidence pack/i,
    expectGuidance: /safeguard|registration|supervis/i,
  },
  {
    name: "custom role remains available",
    profile: { industry: "other", currentRole: "Market Seller", targetRole: "Museum Guide", existingSkills: ["Customer service", "Public speaking"] },
    expectProject: /market seller|public/i,
  },
];

for (const [index, testCase] of cases.entries()) {
  const body = {
    mode: "general",
    yearsExperience: "3-5",
    hoursPerWeek: 8,
    timelineMonths: 12,
    budget: "free",
    workStyle: "any",
    motivations: ["growth"],
    ...testCase.profile,
  };
  const response = await fetch(`${base}/api/roadmap`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${index + 10}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${testCase.name}: HTTP ${response.status}`);
  const report = await response.json();
  const projectText = JSON.stringify(report.projects);
  const allText = JSON.stringify(report);
  if (!testCase.expectProject.test(projectText)) throw new Error(`${testCase.name}: wrong evidence projects`);
  if (testCase.expectGuidance && !testCase.expectGuidance.test(report.guidanceNote)) throw new Error(`${testCase.name}: safety guidance missing`);
  if (testCase.reject && testCase.reject.test(allText)) throw new Error(`${testCase.name}: inappropriate advice present`);
  if (/\$\d+k|\$\d{2,3},\d{3}/i.test(JSON.stringify(report.salary))) throw new Error(`${testCase.name}: unverified exact salary present`);
  console.log(`PASS ${testCase.name} (${report.risk.difficultyLabel} route)`);
}

console.log(`PASS ${cases.length} industry roadmap cases`);
