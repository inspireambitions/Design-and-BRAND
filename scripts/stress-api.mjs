const base = process.env.BASE_URL || "http://127.0.0.1:4326/career-change-roadmap";

const request = (path, body, ip, raw = false) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: raw ? body : JSON.stringify(body),
  });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const normalProfile = {
  mode: "general",
  industry: "logistics",
  currentRole: "Warehouse Assistant",
  targetRole: "Logistics Coordinator",
  existingSkills: ["Checking details"],
  motivations: ["growth"],
  yearsExperience: "3-5",
  hoursPerWeek: 5,
  timelineMonths: 12,
  budget: "free",
  workStyle: "onsite",
};

// Suite 3: malformed, missing and oversized input must be rejected or bounded.
{
  const malformed = await request("/api/roadmap", "{bad", "203.0.113.31", true);
  assert(malformed.status === 400, `malformed JSON returned ${malformed.status}`);

  const missing = await request("/api/roadmap", { currentRole: "Cleaner" }, "203.0.113.32");
  assert(missing.status === 400, `missing target role returned ${missing.status}`);

  const oversized = await request("/api/roadmap", {
    ...normalProfile,
    currentRole: "W".repeat(2000),
    existingSkills: Array.from({ length: 100 }, (_, index) => `Skill ${index}`),
    motivations: Array.from({ length: 100 }, (_, index) => `Reason ${index}`),
    careerBarriers: Array.from({ length: 100 }, (_, index) => `Barrier ${index}`),
    languages: Array.from({ length: 100 }, (_, index) => `Language ${index}`),
    hoursPerWeek: 999,
    timelineMonths: 999,
  }, "203.0.113.33");
  assert(oversized.ok, `oversized bounded request returned ${oversized.status}`);
  const report = await oversized.json();
  assert(report.snapshot.from.length <= 160, "current role was not bounded");
  assert(report.snapshot.hoursPerWeek === 40, "weekly hours were not capped at 40");
  assert(report.snapshot.months === 12, "invalid timeline did not fall back to 12 months");
  assert(report.snapshot.careerBarriers.length === 3, "career barriers were not capped at three");

  const invalidEmail = await request("/api/subscribe", { email: "not-an-email" }, "203.0.113.34");
  assert(invalidEmail.status === 400, `invalid email returned ${invalidEmail.status}`);
  console.log("PASS 3/5 malformed and boundary input");
}

// Suite 4: paid/expensive endpoints must throttle bursts.
{
  const roadmapStatuses = [];
  for (let index = 0; index < 11; index += 1) {
    roadmapStatuses.push((await request("/api/roadmap", normalProfile, "203.0.113.41")).status);
  }
  assert(roadmapStatuses.slice(0, 10).every((status) => status === 200), `roadmap pre-limit statuses: ${roadmapStatuses}`);
  assert(roadmapStatuses[10] === 429, `roadmap limit returned ${roadmapStatuses[10]}`);

  const coachStatuses = [];
  for (let index = 0; index < 9; index += 1) {
    coachStatuses.push((await request("/api/coach", { messages: [{ role: "user", content: "What next?" }] }, "203.0.113.42")).status);
  }
  assert(coachStatuses.slice(0, 8).every((status) => status === 200), `coach pre-limit statuses: ${coachStatuses}`);
  assert(coachStatuses[8] === 429, `coach limit returned ${coachStatuses[8]}`);

  const subscribeStatuses = [];
  for (let index = 0; index < 6; index += 1) {
    subscribeStatuses.push((await request("/api/subscribe", { email: `test-${index}@example.com` }, "203.0.113.43")).status);
  }
  assert(subscribeStatuses.slice(0, 5).every((status) => status === 200), `email pre-limit statuses: ${subscribeStatuses}`);
  assert(subscribeStatuses[5] === 429, `email limit returned ${subscribeStatuses[5]}`);
  console.log("PASS 4/5 burst rate limits");
}

// Suite 5: absent providers must degrade honestly and keep the free roadmap usable.
{
  const roadmap = await request("/api/roadmap", normalProfile, "203.0.113.51");
  const report = await roadmap.json();
  assert(roadmap.ok && report.generatedBy === "engine", "roadmap did not use the safe local engine");

  const coach = await request("/api/coach", { messages: [{ role: "user", content: "What next?" }] }, "203.0.113.52");
  const coachBody = await coach.json();
  assert(coach.ok && /needs an ANTHROPIC_API_KEY/i.test(coachBody.reply), "coach did not disclose missing provider");

  const subscribe = await request("/api/subscribe", { email: "provider-test@example.com" }, "203.0.113.53");
  const subscribeBody = await subscribe.json();
  assert(subscribe.ok && subscribeBody.delivered === false, "email endpoint falsely claimed delivery");

  const feedback = await request("/api/feedback", { vote: "up", note: "Provider failure check" }, "203.0.113.54");
  const feedbackBody = await feedback.json();
  assert(feedback.status === 503 && feedbackBody.error === "email_not_configured", "feedback endpoint falsely claimed delivery");
  console.log("PASS 5/5 provider failure and local fallback");
}
