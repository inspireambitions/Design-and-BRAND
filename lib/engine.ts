import { BUDGET_CAPS, findRole, type RoleKnowledge } from "./careers-data";
import type {
  Profile,
  RoadmapReport,
  RoadmapStep,
  SkillGapItem,
  TimelinePhase,
} from "./types";

// Deterministic roadmap generator. Used as the zero-dependency fallback when
// no Claude API key is configured (and as the safety net if the API call
// fails), so the product always produces a complete report.

const GENERIC_ROLE: RoleKnowledge = {
  role: "Your Target Role",
  aliases: [],
  coreSkills: [
    { skill: "Core Domain Knowledge", priority: "high", how: "Follow the top 3 practitioners in the field; read the standard intro texts; write weekly notes" },
    { skill: "Field-Standard Tooling", priority: "high", how: "Identify the 2–3 tools every job posting mentions and reach working fluency through projects" },
    { skill: "Portfolio Evidence", priority: "high", how: "Build 2–3 public artifacts (projects, case studies, write-ups) that prove capability" },
    { skill: "Industry Vocabulary & Trends", priority: "medium", how: "One newsletter + one podcast in the field, consumed weekly" },
    { skill: "Professional Network in the Field", priority: "medium", how: "Two informational interviews per month via LinkedIn and community Slack groups" },
    { skill: "Communication & Collaboration", priority: "low", how: "Usually transferable from your current role — collect concrete stories" },
  ],
  courses: [
    { name: "Top-rated introductory certificate in the field", provider: "Coursera / edX", cost: "$0–$300", duration: "3–6 months part-time", rating: "—", why: "Search the field name + 'professional certificate'; pick the one with the most enrollments and recent reviews.", minBudget: 0 },
    { name: "Free foundational curriculum", provider: "YouTube / open courseware", cost: "Free", duration: "Self-paced", rating: "—", why: "Nearly every field has a canonical free path — find it via the field's subreddit wiki.", minBudget: 0 },
    { name: "Cohort-based intensive", provider: "Maven / industry bootcamps", cost: "$500–$3,000", duration: "6–12 weeks", rating: "—", why: "Worth it for accountability and network once fundamentals are in place.", minBudget: 500 },
  ],
  salary: [
    { stage: "First role in the new field", range: "Entry-level band for the field", note: "Expect a possible temporary step down from your current pay", pct: 40 },
    { stage: "2 years in", range: "Mid-level band", note: "Your prior-career maturity usually accelerates this stage", pct: 60 },
    { stage: "4–5 years in", range: "Senior band", note: "Specialization drives the premium", pct: 80 },
    { stage: "Leadership track", range: "Top band", note: "Management or deep expertise", pct: 100 },
  ],
  communities: ["The field's main subreddit and its wiki", "1–2 active Slack/Discord communities", "Local meetups via Meetup.com", "LinkedIn groups with recent activity"],
  people: ["The 3 most-cited practitioners on LinkedIn", "Authors of the field's standard books", "Active community moderators"],
  events: ["Local meetups (monthly)", "The field's main annual conference (virtual pass)", "Community-run workshops"],
  dayInLife: [
    { time: "9:00", activity: "Plan the day around the field's core production work" },
    { time: "10:00", activity: "Deep work block on the main deliverable" },
    { time: "12:30", activity: "Collaboration: reviews, syncs, or client/stakeholder time" },
    { time: "14:30", activity: "Second focus block; learning woven into real tasks" },
    { time: "16:30", activity: "Wrap-up: document progress, prep tomorrow" },
  ],
  demand: "Research current demand via LinkedIn job counts and Google Trends for the role title",
  difficultyBase: 5,
  planB: "An adjacent role that shares 60%+ of the same skills — identify it early so pivoting isn't starting over.",
  frameworks: ["STAR stories that bridge your old career to the new one", "A 90-second 'why this switch' narrative", "Portfolio walk-through practice"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();

function skillIsCovered(skill: string, existing: string[], currentRole: string): "have" | "partial" | "need" {
  const s = norm(skill);
  const tokens = s.split(/\s+/).filter((t) => t.length > 3);
  for (const e of existing) {
    const en = norm(e);
    if (en === s || s.includes(en) || en.includes(s)) return "have";
    if (tokens.some((t) => en.includes(t))) return "partial";
  }
  // Soft-skill heuristics: communication/stakeholder/planning tend to transfer
  const transferable = ["communication", "stakeholder", "planning", "storytelling", "management", "empathy", "scheduling"];
  if (transferable.some((t) => s.includes(t)) && currentRole.length > 0) return "partial";
  return "need";
}

function buildTimeline(profile: Profile, role: RoleKnowledge, gaps: SkillGapItem[]): TimelinePhase[] {
  const m = profile.timelineMonths;
  const needs = gaps.filter((g) => g.status !== "have");
  const topNeeds = needs.slice(0, 3).map((g) => g.skill);
  const pace = profile.hoursPerWeek >= 15 ? "an aggressive" : profile.hoursPerWeek >= 8 ? "a steady" : "a sustainable";

  const seg = (a: number, b: number) => (a === b ? `Month ${a}` : `Months ${a}–${b}`);
  const q = Math.max(1, Math.round(m / 4));

  return [
    {
      label: seg(1, q),
      title: "Foundations",
      focus: `Close the highest-priority gap first: ${topNeeds[0] ?? "core fundamentals"}. Set ${pace} rhythm of ${profile.hoursPerWeek} hrs/week.`,
      actions: [
        `Start the primary course (see Courses section) and block ${profile.hoursPerWeek} weekly hours in your calendar now`,
        `Reach working fluency in ${topNeeds[0] ?? "the field's core tool"}`,
        `Join 2 communities from the Networking section and introduce yourself`,
      ],
      milestone: `You can explain the ${role.role} craft credibly and produce basic work in the core tool`,
    },
    {
      label: seg(q + 1, q * 2),
      title: "Skill Building & First Portfolio Piece",
      focus: `Layer in ${topNeeds[1] ?? "secondary skills"} while shipping your first real artifact.`,
      actions: [
        `Complete portfolio project #1 (see Projects section) — deliberately leverage your ${profile.currentRole} background`,
        `Continue coursework; finish the main certificate's midpoint`,
        `Start 2 informational interviews per month with working ${role.role}s`,
      ],
      milestone: "One complete, public portfolio piece with a written case study",
    },
    {
      label: seg(q * 2 + 1, q * 3),
      title: "Proof & Positioning",
      focus: `Second portfolio piece, ${topNeeds[2] ?? "advanced topics"}, and rewriting your professional story.`,
      actions: [
        "Ship portfolio project #2 with a measurable outcome",
        "Rewrite resume and LinkedIn using the Resume section's before/after patterns",
        "Ask for feedback on your portfolio in your communities — then act on it",
      ],
      milestone: `Your materials read like a ${role.role} who used to be a ${profile.currentRole} — not the reverse`,
    },
    {
      label: seg(q * 3 + 1, m),
      title: "The Job Hunt",
      focus: "Applications, interviews, and converting your network into referrals.",
      actions: [
        "Apply to 8–10 well-fitted roles per week; tailor the top 3",
        "Convert informational interviews into referrals — the highest-yield channel for switchers",
        "Run weekly mock interviews using the Interview Prep section",
      ],
      milestone: `Offers in hand — targeting your start as a ${role.role} by month ${m}`,
    },
  ];
}

// Eight sequential steps from where they are to hired. Durations are scaled to
// the chosen timeline so the ladder always adds up to roughly the right total.
function buildSteps(profile: Profile, role: RoleKnowledge, gaps: SkillGapItem[]): RoadmapStep[] {
  const m = profile.timelineMonths;
  const needs = gaps.filter((g) => g.status === "need");
  const top = needs.map((g) => g.skill);
  const unit = m / 12; // scale factor against the canonical 12-month plan
  const d = (lo: number, hi: number) => {
    const a = Math.max(1, Math.round(lo * unit));
    const b = Math.max(a, Math.round(hi * unit));
    return a === b ? `~${a} month${a > 1 ? "s" : ""}` : `~${a}–${b} months`;
  };
  const paid = profile.budget !== "free";

  return [
    {
      title: `Commit to the switch and set up your ${profile.hoursPerWeek} hrs/week`,
      duration: d(1, 1),
      detail: `Block the hours in your calendar as recurring appointments before anything else — this is the step people skip, and it is the one that decides whether the other seven happen. Tell one person you are doing this. Set up a single folder or repo where every artifact from this plan will live.`,
    },
    {
      title: `Reach working fluency in ${top[0] ?? "the field's core tool"}`,
      duration: d(1, 2),
      detail: `${gaps.find((g) => g.skill === top[0])?.howToAcquire ?? "Follow the primary course in the Courses section."} Stop when you can produce something usable without a tutorial open — not when you feel confident, which comes later.`,
    },
    {
      title: paid
        ? `Enroll in and start the primary certificate`
        : `Start the free foundational curriculum`,
      duration: d(1, 1),
      detail: `See the Courses section for the specific program filtered to your budget. Enroll the same week you finish step 2 — momentum between steps matters more than the gap between your current skill and the syllabus.`,
    },
    {
      title: `Build portfolio project #1 on your ${profile.currentRole.toLowerCase()} domain`,
      duration: d(2, 3),
      detail: `This is your differentiator and it belongs early, not at the end. Apply the new craft to a problem you already understand from your current career. Write the case study as you go — process, decisions, what failed — not afterwards from memory.`,
    },
    {
      title: `Close the remaining high-priority gaps (${top.slice(1, 3).join(", ") || "secondary skills"})`,
      duration: d(2, 3),
      detail: `Work through the remaining "Need" rows in the Skill Gap table in priority order. Fold each one into project work rather than studying it in isolation — skills learned in a project stick and become interview stories; skills learned from a course alone do neither.`,
    },
    {
      title: "Ship portfolio project #2 and rewrite your professional story",
      duration: d(2, 3),
      detail: `Second project should be end-to-end with a measurable outcome. In parallel, rewrite your resume and LinkedIn using the before/after patterns in the Resume section, so your materials read like a ${role.role} who used to be a ${profile.currentRole} rather than the reverse.`,
    },
    {
      title: "Convert your network into referrals",
      duration: d(2, 3),
      detail: `Start this from month one, but it becomes the main activity here. Switchers are hired through people far more often than through cold applications. Use the outreach template in the Networking section; aim for one informational interview a week and follow up three weeks later.`,
    },
    {
      title: `Apply, interview, and negotiate your first ${role.role} offer`,
      duration: "~Ongoing until hired",
      detail: `8–10 well-fitted applications a week, with the top three tailored. Run weekly mock interviews against the questions in the Interview Prep section. Expect the search itself to take 2–4 months — that is normal, and it is the part switchers most consistently underestimate.`,
    },
  ];
}

export function generateReport(profile: Profile): RoadmapReport {
  const role = findRole(profile.targetRole) ?? { ...GENERIC_ROLE, role: profile.targetRole || GENERIC_ROLE.role };

  const skillGap: SkillGapItem[] = role.coreSkills.map((cs) => ({
    skill: cs.skill,
    status: skillIsCovered(cs.skill, profile.existingSkills, profile.currentRole),
    priority: cs.priority,
    howToAcquire: cs.how,
  }));

  const transferableCount = skillGap.filter((g) => g.status !== "need").length;
  const needCount = skillGap.filter((g) => g.status === "need").length;

  // Match score: base by role difficulty, adjusted by transferable skills,
  // committed hours, and timeline realism.
  const hoursFactor = Math.min(profile.hoursPerWeek / 12, 1.4);
  const timeFactor = Math.min(profile.timelineMonths / 12, 1.5);
  let score =
    62 +
    transferableCount * 5 -
    role.difficultyBase * 2 +
    hoursFactor * 12 +
    timeFactor * 8;
  score = Math.round(Math.max(35, Math.min(96, score)));

  const budgetCap = BUDGET_CAPS[profile.budget] ?? 500;
  const courses = role.courses
    .filter((c) => c.minBudget <= budgetCap)
    .map(({ minBudget: _min, ...rest }) => rest);
  if (courses.length === 0) {
    courses.push(...role.courses.filter((c) => c.minBudget === 0).map(({ minBudget: _min, ...rest }) => rest));
  }

  const difficulty = Math.max(
    1,
    Math.min(10, role.difficultyBase + (profile.hoursPerWeek < 6 ? 1 : 0) + (profile.timelineMonths <= 6 ? 1 : -1))
  );

  const tight = profile.timelineMonths <= 6 || (profile.timelineMonths <= 12 && profile.hoursPerWeek < 8);

  return {
    generatedBy: "engine",
    matchScore: score,
    verdict:
      score >= 80
        ? `Strong fit. Your ${profile.currentRole} background carries real transferable weight into ${role.role}, and your time commitment makes this timeline credible.`
        : score >= 62
        ? `Achievable with focus. The path from ${profile.currentRole} to ${role.role} is well-trodden — your plan below closes the ${needCount} key gaps deliberately.`
        : `Ambitious but possible. This is a demanding switch on your current timeline — the plan below front-loads the hardest gaps and includes a Plan B so no month is wasted.`,
    snapshot: {
      from: profile.currentRole,
      to: role.role,
      months: profile.timelineMonths,
      hoursPerWeek: profile.hoursPerWeek,
      transferableCount,
      estimatedCost:
        budgetCap === 0 ? "$0 (free-only path)" : budgetCap >= 100000 ? "$300–$3,000 depending on chosen intensives" : `Under $${budgetCap}`,
    },
    skillGap,
    steps: buildSteps(profile, role, skillGap),
    timeline: buildTimeline(profile, role, skillGap),
    courses,
    projects: [
      {
        title: `Redesign / rebuild something from your ${profile.currentRole} world`,
        description: `Apply ${role.role} craft to a domain you already know deeply — this is the single highest-leverage move for switchers, because your domain insight is something juniors can't fake.`,
        skills: skillGap.filter((g) => g.priority === "high").map((g) => g.skill).slice(0, 3),
        effort: "3–4 weeks part-time",
      },
      {
        title: "A public, end-to-end piece with a written case study",
        description: "Pick a real problem (a local business, a nonprofit, an open dataset), take it from problem to outcome, and write up your process honestly — including what didn't work.",
        skills: skillGap.filter((g) => g.status === "need").map((g) => g.skill).slice(0, 3),
        effort: "4–6 weeks part-time",
      },
      {
        title: "A community contribution",
        description: "Answer questions, contribute to an open project, or publish a teardown in your target community. Visible generosity compounds into referrals.",
        skills: ["Communication", "Craft credibility"],
        effort: "Ongoing, 1–2 hrs/week",
      },
    ],
    resume: {
      summary: `Position yourself as a ${role.role} with rare ${profile.currentRole} domain depth — not as a ${profile.currentRole} trying to escape.`,
      headline: `${role.role} · ex-${profile.currentRole} · ${skillGap.filter((g) => g.status !== "need").slice(0, 2).map((g) => g.skill).join(" · ") || "transferable strengths"}`,
      bullets: [
        {
          before: `Responsible for day-to-day ${profile.currentRole.toLowerCase()} duties and tasks`,
          after: `Reframed: lead with the outcome and the ${role.role}-relevant muscle — e.g. "Drove [measurable result] by [action], working across [stakeholders/tools]"`,
        },
        {
          before: "Completed online course in " + role.role.toLowerCase(),
          after: `“Built [portfolio project] — [one-line outcome]” — projects with results outrank certificates on every screen`,
        },
        {
          before: "Career break / career change in progress",
          after: `“Transitioning ${profile.currentRole} → ${role.role}: [X] shipped projects, [Y] certification, available [date]” — own the narrative before recruiters guess`,
        },
      ],
      linkedinTips: [
        `Headline: state the target role first (recruiters search by title, not by history)`,
        "About section: 3 short paragraphs — the switch story, the proof (projects/certs), the ask",
        "Feature your 2 portfolio pieces in the Featured section with outcome-first titles",
        "Post once a week about what you're learning — switchers who narrate the journey get inbound interest",
        "Set 'Open to Work' for the target title only (recruiter-visible mode if you're currently employed)",
      ],
    },
    salary: role.salary,
    networking: {
      communities: role.communities,
      peopleToFollow: role.people,
      events: role.events,
      outreachTemplate: `Hi [Name] — I'm a ${profile.currentRole} transitioning into ${role.role}, and your [post/talk/project about X] genuinely changed how I think about [specific thing]. I'm not asking for a job — I'd love 15 minutes to hear how you'd approach [one specific, researched question] if you were starting today. Happy to work around your schedule.`,
      weeklyRoutine: [
        "2 thoughtful comments per day in your main community (visibility compounds)",
        "1 informational interview per week from month 2",
        "1 piece of public learning (post, write-up, or answer) per week",
        "Track every conversation in a simple CRM sheet — follow up in 3 weeks",
      ],
    },
    interview: {
      narrative: `“I spent [N] years as a ${profile.currentRole}, where I got genuinely good at [transferable strengths]. I kept gravitating toward [the target-role part of the job] — so ${profile.timelineMonths} months ago I committed: [course], [project 1], [project 2]. I'm not leaving ${profile.currentRole} work behind; I'm bringing its ${profile.motivations.includes("meaning") ? "purpose and " : ""}judgment into ${role.role}, where I can [what you'll do for them].”`,
      commonQuestions: [
        { question: "Why are you changing careers?", approach: "Run toward, never away. One sentence on what pulled you in, then immediately pivot to the evidence: what you've built and learned." },
        { question: `Why should we hire you over an experienced ${role.role}?`, approach: `Your domain depth is the answer: you bring ${profile.currentRole} insight nobody else on the team has, plus demonstrated learning velocity — then point at your portfolio.` },
        { question: "Walk me through one of your projects.", approach: "Problem → constraint → decisions → outcome → what you'd do differently. Practice it aloud until the 3-minute version is effortless." },
        { question: "What's your biggest gap?", approach: "Name a real one (not a humble-brag), show the plan already in motion to close it, and cite a time you closed a similar gap fast." },
      ],
      frameworks: role.frameworks,
      redFlags: [
        "Talking about your old career in the past tense with resentment",
        "Apologizing for being a switcher — frame it as an asset or nobody else will",
        "Portfolio you can't defend decision-by-decision",
        "No questions for them — always have 3 that prove you researched the team",
      ],
    },
    dayInLife: role.dayInLife,
    risk: {
      difficulty,
      difficultyLabel: difficulty <= 3 ? "Moderate" : difficulty <= 6 ? "Challenging" : "Demanding",
      successFactors: [
        `Consistency beats intensity: ${profile.hoursPerWeek} hrs/week, protected in your calendar, compounds fast`,
        "Portfolio-first: two strong public pieces outrank any certificate",
        `Leverage asymmetry: your ${profile.currentRole} background is a moat, not baggage`,
        "Referrals: switchers get hired through people ~3× more often than through cold applications",
      ],
      setbacks: [
        { risk: tight ? "Your timeline is tight for the hours available" : "Motivation dip around month 3–4 (universal)", mitigation: tight ? "Protect the plan's sequence — if you slip, extend the timeline rather than skipping portfolio work" : "Pre-commit to a community and a weekly public update; external accountability survives motivation" },
        { risk: "Job-hunt phase takes longer than planned", mitigation: "Start networking in month 1, not month " + Math.max(1, profile.timelineMonths - 2) + " — pipeline building is the part switchers most underestimate" },
        { risk: "Imposter feeling in the first role", mitigation: "Normal and temporary. The 90-day plan below is designed to convert it into early wins" },
      ],
      planB: role.planB,
    },
    firstNinetyDays: {
      phases: [
        { window: "Days 1–30 · Learn", goals: ["Map who does what and how decisions actually get made", "Ship one small, safe win in week 2–3", "Set explicit expectations with your manager — ask 'what does great look like at 90 days?'"] },
        { window: "Days 31–60 · Contribute", goals: ["Own one workstream end-to-end", `Deploy your ${profile.currentRole} superpower once, visibly`, "Build relationships beyond your immediate team — 1 coffee chat per week"] },
        { window: "Days 61–90 · Compound", goals: ["Deliver a project with a measurable outcome you can cite forever", "Ask for structured feedback and act on it publicly", "Write your own next-6-months development plan and share it with your manager"] },
      ],
    },
  };
}
