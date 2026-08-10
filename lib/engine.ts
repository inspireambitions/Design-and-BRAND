import { BUDGET_CAPS, findRole, type RoleKnowledge } from "./careers-data";
import { INDUSTRY_SKILLS, TYPICAL_TARGETS, inferSeniorityBand } from "./industry-data";
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
    { skill: "Core job knowledge", priority: "high", how: "Read 10 recent local job adverts and ask a working person which tasks matter most." },
    { skill: "Tools used in the job", priority: "high", how: "List the tools repeated in local adverts, then practise only through a safe course, training setup or supervised work." },
    { skill: "Proof you can do the work", priority: "high", how: "Collect a safe checklist, sample, work record, supervisor comment or small result. Remove private information." },
    { skill: "Local requirements", priority: "medium", how: "Check the official regulator, licensing body, employer or recognised training provider before paying." },
    { skill: "People who understand the route", priority: "medium", how: "Speak to two current workers, a supervisor, approved trainer or recruiter in your target location." },
    { skill: "Communication and teamwork", priority: "low", how: "Use a real example from work, home or volunteering to show how you helped achieve a result." },
  ],
  courses: [
    { name: "Recognised local foundation", provider: "Official body, vocational college or employer-approved provider", cost: "Check locally before paying", duration: "Varies", rating: "Verify", why: "Ask employers whether they accept it and confirm any licence or supervised-hours requirement first.", minBudget: 0 },
    { name: "Free introduction to the work", provider: "Public library, open courseware or an employer's free learning", cost: "Free", duration: "Self-paced", rating: "Verify", why: "Use this to test your interest before committing money.", minBudget: 0 },
    { name: "Supervised practice or short local course", provider: "Employer, apprenticeship or approved training centre", cost: "Compare local providers", duration: "Varies", rating: "Verify", why: "Choose it only if it creates recognised, safe evidence for the job you want.", minBudget: 500 },
  ],
  salary: [
    { stage: "First role in the new field", range: "Entry-level band for the field", note: "Expect a possible temporary step down from your current pay", pct: 40 },
    { stage: "2 years in", range: "Mid-level band", note: "Your prior-career maturity usually accelerates this stage", pct: 60 },
    { stage: "4–5 years in", range: "Senior band", note: "Specialization drives the premium", pct: 80 },
    { stage: "Leadership track", range: "Top band", note: "Management or deep expertise", pct: 100 },
  ],
  communities: ["A recognised local trade or professional association", "A current worker group", "An approved training centre or employer open day"],
  people: ["A working supervisor", "An approved trainer", "A recruiter who hires this role locally"],
  events: ["Employer recruitment day", "Vocational college information session", "Local industry event"],
  dayInLife: [
    { time: "9:00", activity: "Plan the day around the field's core production work" },
    { time: "10:00", activity: "Deep work block on the main deliverable" },
    { time: "12:30", activity: "Collaboration: reviews, syncs, or client/stakeholder time" },
    { time: "14:30", activity: "Second focus block; learning woven into real tasks" },
    { time: "16:30", activity: "Wrap-up: document progress, prep tomorrow" },
  ],
  demand: "Check at least 10 recent adverts in the place you want to work and compare the repeated requirements.",
  difficultyBase: 5,
  planB: "An adjacent role that shares 60%+ of the same skills — identify it early so pivoting isn't starting over.",
  frameworks: ["Situation → action → result", "Safety and quality first", "Show evidence from real or supervised work"],
};

function genericRoleForProfile(profile: Profile): RoleKnowledge {
  const industry = profile.targetIndustry || profile.industry || "other";
  const skills = INDUSTRY_SKILLS[industry];
  const nearby = TYPICAL_TARGETS.find((item) => item.industry === industry);
  const adjacentPlan = industry === "hospitality"
    ? "Use a related guest-service, operations, coordination or team-leader role that builds the same evidence."
    : nearby?.planB;
  if (!skills?.length) return { ...GENERIC_ROLE, role: profile.targetRole || GENERIC_ROLE.role };

  return {
    ...GENERIC_ROLE,
    role: profile.targetRole || GENERIC_ROLE.role,
    industry,
    seniorityBand: inferSeniorityBand(profile.targetRole),
    prerequisites: [
      "Check repeated requirements in current local adverts",
      "Build safe evidence through real or supervised work",
    ],
    coreSkills: skills.map((skill, index) => ({
      skill,
      priority: index < 2 ? "high" as const : index < 5 ? "medium" as const : "low" as const,
      how: `Compare this with current ${profile.targetRole} adverts, then build evidence through authorised work, supervised practice or a recognised local course.`,
    })),
    planB: adjacentPlan
      ? `If ${profile.targetRole} is not yet realistic, use this industry's adjacent route: ${adjacentPlan}`
      : GENERIC_ROLE.planB,
  };
}

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
  const firstEnd = Math.max(1, Math.floor(m / 4));
  const secondEnd = Math.max(firstEnd + 1, Math.floor(m / 2));
  const thirdEnd = Math.max(secondEnd + 1, Math.floor((m * 3) / 4));
  const practical = Boolean(role.industry);
  const evidenceLabel = practical ? "work-evidence task" : "portfolio piece";

  return [
    {
      label: seg(1, firstEnd),
      title: "Foundations",
      focus: `Close the highest-priority gap first: ${topNeeds[0] ?? "core fundamentals"}. Set ${pace} rhythm of ${profile.hoursPerWeek} hrs/week.`,
      actions: practical ? [
        `Protect ${profile.hoursPerWeek} hours each week for learning and evidence`,
        `Check the official or employer requirement for ${topNeeds[0] ?? "the first core skill"}`,
        `Ask one working person or approved trainer what a beginner should do first`,
      ] : [
        `Start the primary course and protect ${profile.hoursPerWeek} weekly hours`,
        `Practise ${topNeeds[0] ?? `the main work required for ${role.role}`}`,
        `Join one relevant community and ask a specific beginner question`,
      ],
      milestone: `You can explain the main duties of ${role.role} and show basic, relevant evidence`,
    },
    {
      label: seg(firstEnd + 1, secondEnd),
      title: `Skill Building & First ${practical ? "Work Evidence" : "Portfolio Piece"}`,
      focus: `Layer in ${topNeeds[1] ?? "secondary skills"} while completing your first real ${evidenceLabel}.`,
      actions: practical ? [
        `Complete evidence task #1 safely, using your ${profile.currentRole} experience`,
        "Continue approved learning or supervised practice",
        `Speak to two people currently doing ${role.role} work about the real day-to-day duties`,
      ] : [
        `Complete evidence task #1 (see Evidence Projects section) — deliberately use your ${profile.currentRole} background`,
        `Continue coursework; finish the main certificate's midpoint`,
        `Arrange two informed conversations per month with people doing ${role.role} work`,
      ],
      milestone: practical ? "One safe, relevant piece of work evidence that a supervisor or employer can review" : "One complete, public portfolio piece with a written case study",
    },
    {
      label: seg(secondEnd + 1, thirdEnd),
      title: "Proof & Positioning",
      focus: `Second evidence task, ${topNeeds[2] ?? "advanced topics"}, and rewriting your professional story.`,
      actions: practical ? [
        "Complete a second safe evidence task with a result or supervisor comment",
        "Update your CV using simple action and result examples",
        "Ask a supervisor, trainer or recruiter to check your readiness",
      ] : [
        "Complete evidence task #2 with a measurable outcome or supervisor feedback",
        "Rewrite resume and LinkedIn using the Resume section's before/after patterns",
        "Ask a working professional for feedback on your evidence — then act on it",
      ],
      milestone: `Your materials show relevant evidence for ${role.role} while using the strengths from your ${profile.currentRole} work`,
    },
    {
      label: seg(thirdEnd + 1, m),
      title: "The Job Hunt",
      focus: practical ? "Verify requirements, apply to realistic roles and practise the interview." : "Applications, interviews and informed introductions.",
      actions: practical ? [
        "Apply only where you meet the safety, licence and work-authorisation requirements",
        "Use employer sites, trusted job boards, approved recruiters and people you know",
        "Practise one interview answer aloud each week",
      ] : [
        "Apply to a small number of well-fitted roles and tailor the strongest applications",
        "Ask informed contacts which teams or roles are realistic",
        "Run weekly mock interviews using the Interview Practice section",
      ],
      milestone: `A realistic application routine, verified requirements and stronger evidence for ${role.role} work by month ${m}`,
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
  const practical = Boolean(role.industry);

  return [
    {
      title: `Commit to the switch and set up your ${profile.hoursPerWeek} hrs/week`,
      duration: d(1, 1),
      detail: `Choose two or three repeatable time slots that total ${profile.hoursPerWeek} hours. Tell one supportive person. Keep your notes, course checks and evidence in one paper or digital folder.`,
    },
    {
      title: `Learn the first required skill: ${top[0] ?? "the role's core work"}`,
      duration: d(1, 2),
      detail: `${gaps.find((g) => g.skill === top[0])?.howToAcquire ?? "Use the first verified learning option in the Training section."} Do not pay until you confirm the training is recognised where you want to work.`,
    },
    {
      title: paid
        ? `Check recognition, then start the best suitable training`
        : `Start with the free foundation`,
      duration: d(1, 1),
      detail: `Use the Training section as a shortlist, not an instruction to buy. Compare current adverts, ask an employer or official body, then choose the least expensive recognised route.`,
    },
    {
      title: `${practical ? "Complete work-evidence task" : "Build portfolio project"} #1 using your ${profile.currentRole.toLowerCase()} experience`,
      duration: d(2, 3),
      detail: practical
        ? `Use the first task in the Evidence Projects section. Keep it safe, within your authority and free of private data. Record the starting point, your action, the result and any supervisor feedback.`
        : `This is your differentiator and it belongs early, not at the end. Apply the new craft to a problem you already understand from your current career. Write the case study as you go — process, decisions, what failed — not afterwards from memory.`,
    },
    {
      title: `Close the remaining high-priority gaps (${top.slice(1, 3).join(", ") || "secondary skills"})`,
      duration: d(2, 3),
      detail: `Work through the remaining "Need" rows in the Skill Gap table in priority order. Practise through safe, supervised or authorised work where possible, so the learning becomes evidence rather than only a certificate.`,
    },
    {
      title: `Complete ${practical ? "evidence task" : "portfolio project"} #2 and update your CV story`,
      duration: d(2, 3),
      detail: `The second piece should show a result, quality check or credible feedback. Rewrite your CV using the before-and-after patterns so it shows relevant evidence for ${role.role}. An online profile is optional, not a requirement.`,
    },
    {
      title: practical ? "Ask the right people to check your readiness" : "Turn informed conversations into introductions",
      duration: d(2, 3),
      detail: practical
        ? `Ask a supervisor, working ${role.role}, approved trainer or local recruiter to compare your evidence with a real job advert. Record the missing requirement and the safest next action.`
        : `Use the message in the People section to ask focused questions. When someone knows your work, it is reasonable to ask whether they know a suitable opening or team.`,
    },
    {
      title: `Apply, interview, and negotiate your first ${role.role} offer`,
      duration: "~Ongoing until hired",
      detail: practical
        ? `Use employer career pages, trusted job boards and approved recruiters. Apply only where you meet essential safety, licence and work-authorisation requirements. Keep a simple list of applications and practise the questions in this report.`
        : `Choose well-fitted openings, tailor the strongest applications and practise the questions in this report. Track what receives replies and adjust the evidence or role level if needed.`,
    },
  ];
}

export function generateReport(profile: Profile): RoadmapReport {
  const role = findRole(profile.targetRole) ?? genericRoleForProfile(profile);
  const hospitality =
    profile.mode === "hospitality" ||
    profile.industry === "hospitality";
  const regulated = Boolean(role.safetyCritical || role.regulatedNotice);
  const practical = Boolean(role.industry) || hospitality || regulated;

  const skillGap: SkillGapItem[] = role.coreSkills.map((cs) => ({
    skill: cs.skill,
    status: skillIsCovered(cs.skill, profile.existingSkills, profile.currentRole),
    priority: cs.priority,
    howToAcquire: cs.how,
  }));

  const transferableCount = skillGap.filter((g) => g.status !== "need").length;
  const needCount = skillGap.filter((g) => g.status === "need").length;

  // Internal planning signal used to choose a broad written outlook. It is not
  // shown as an assessment score because the inputs do not justify that level
  // of psychometric precision.
  const hoursFactor = Math.min(profile.hoursPerWeek / 12, 1.4);
  const timeFactor = Math.min(profile.timelineMonths / 12, 1.5);
  let score =
    48 +
    transferableCount * 4 -
    role.difficultyBase * 3 +
    hoursFactor * 14 +
    timeFactor * 8;
  score = Math.round(Math.max(22, Math.min(94, score)));

  const budgetCap = BUDGET_CAPS[profile.budget] ?? 500;
  const courses = role.courses
    .filter((c) => c.minBudget <= budgetCap)
    .map(({ minBudget: _min, ...rest }) => ({
      ...rest,
      cost: /free/i.test(rest.cost) ? rest.cost : "Check the current local price before paying",
    }));
  if (courses.length === 0) {
    courses.push(...role.courses.filter((c) => c.minBudget === 0).map(({ minBudget: _min, ...rest }) => ({
      ...rest,
      cost: /free/i.test(rest.cost) ? rest.cost : "Check the current local price before paying",
    })));
  }

  const difficulty = Math.max(
    1,
    Math.min(10, role.difficultyBase + (profile.hoursPerWeek < 6 ? 1 : 0) + (profile.timelineMonths <= 6 ? 1 : -1))
  );

  const tight = profile.timelineMonths <= 6 || (profile.timelineMonths <= 12 && profile.hoursPerWeek < 8);

  return {
    generatedBy: "engine",
    mode: hospitality ? "hospitality" : "general",
    guidanceNote: role.regulatedNotice
      ? `Important: ${role.regulatedNotice} This roadmap is career guidance, not a psychometric test, licence, qualification, visa assessment or salary promise.`
      : hospitality
      ? "This is a career-planning guide, not a psychometric test, qualification check, visa assessment or salary promise. Verify role, licence and pay requirements in the country and property where you want to work."
      : `This is a career-planning guide, not a psychometric test, qualification check, visa assessment or salary promise. Verify current role requirements in ${profile.targetCountry || "the place you want to work"} before spending money or leaving a job.`,
    matchScore: score,
    verdict:
      profile.directionMode === "explore"
        ? `This is a route to test, not a verdict about your best career. Your first actions help you compare the real work, local requirements and low-cost evidence before you make a big decision.`
        : hospitality && profile.careerBarrier
        ? `Your route from ${profile.currentRole} to ${role.role} is possible, but the plan must address your main barrier first. The first actions below create evidence you can show a manager or recruiter instead of relying on qualifications alone.`
        : score >= 78
        ? `Your ${profile.currentRole} background carries real transferable weight into ${role.role}, and the hours you can commit make this timeline credible rather than aspirational.`
        : score >= 55
        ? `The path from ${profile.currentRole} to ${role.role} is well-trodden, and the plan below closes your ${needCount} real gaps in priority order. The work is in the consistency, not the difficulty.`
        : `This is a demanding switch on your current timeline. The plan front-loads the hardest gaps and includes a Plan B, so even a slower run leaves you further ahead than when you started.`,
    snapshot: {
      from: profile.currentRole,
      to: role.role,
      months: profile.timelineMonths,
      hoursPerWeek: profile.hoursPerWeek,
      transferableCount,
      estimatedCost:
        profile.budget === "free" ? "Free-only starting route"
          : profile.budget === "low" ? "Small monthly budget; check local prices"
          : profile.budget === "500" ? "One short course, only if recognised"
          : "Flexible; compare value before paying",
      location: profile.targetCountry || profile.location,
      targetIndustry: profile.targetIndustry || profile.industry,
      careerBarriers: profile.careerBarriers?.length
        ? profile.careerBarriers
        : profile.careerBarrier ? [profile.careerBarrier] : [],
      relocationStatus: profile.relocationStatus,
      gccExperience: profile.gccExperience,
      workAuthorizationStatus: profile.workAuthorizationStatus,
      industryContact: profile.industryContact,
      jobSearchStage: profile.jobSearchStage,
      languages: profile.languages,
      customerFacingExperience: profile.customerFacingExperience,
    },
    skillGap,
    steps: buildSteps(profile, role, skillGap),
    timeline: buildTimeline(profile, role, skillGap),
    courses,
    projects: role.evidenceProjects?.length
      ? role.evidenceProjects
      : hospitality
      ? [
          {
            title: `Improve one real result in your current ${profile.currentRole} work`,
            description: "Choose one result you can measure: guest feedback, upselling, service time, waste, cost, safety, room readiness, training or team performance. Record the starting point, your action and the result.",
            skills: skillGap.filter((g) => g.priority === "high").map((g) => g.skill).slice(0, 3),
            effort: "2–4 weeks alongside work",
          },
          {
            title: `Shadow or support the ${role.role} team`,
            description: "Ask for two short shadowing sessions or one cross-department task. Write down the decisions, systems and standards the target role uses, then turn that exposure into a clear development request.",
            skills: skillGap.filter((g) => g.status === "need").map((g) => g.skill).slice(0, 3),
            effort: "Two sessions plus a one-page reflection",
          },
          {
            title: "Build a one-page promotion or transfer case",
            description: "Show your evidence, the role you want, the gaps you are closing and what responsibility you can take in the next 90 days. Use it in a manager conversation and refine it from the feedback.",
            skills: ["Communication", "Career evidence"],
            effort: "2–3 hours, then revise after feedback",
          },
        ]
      : practical
      ? [
          {
            title: `Improve one real ${profile.currentRole} result`,
            description: "Choose a small, safe problem at work or in a supervised setting. Record the starting point, what you did and the result. Ask permission and remove names or private information.",
            skills: skillGap.filter((g) => g.priority === "high").map((g) => g.skill).slice(0, 3),
            effort: "1–3 weeks alongside work",
          },
          {
            title: `Create a simple ${role.role} evidence pack`,
            description: "Collect safe examples such as a checklist, anonymised work record, process map, training exercise or supervisor comment. Do not perform work outside your authority.",
            skills: skillGap.filter((g) => g.status === "need").map((g) => g.skill).slice(0, 3),
            effort: "3–5 hours plus feedback",
          },
          {
            title: "Ask a working person to review your readiness",
            description: "Compare your evidence with a current local advert. Ask what you can already do, what needs supervised practice and which requirement must be officially verified.",
            skills: ["Career research", "Feedback"],
            effort: "Two short conversations",
          },
        ]
      : [
          {
            title: `Redesign / rebuild something from your ${profile.currentRole} world`,
            description: `Apply the skills required for ${role.role} to a field you already know. Show the decisions you made, the result and what you learned.`,
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
      summary: hospitality
        ? `Position yourself as a ${role.role} candidate who already understands live hotel operations and can prove results from ${profile.currentRole} work.`
        : regulated
          ? `Position yourself as a careful ${role.role} candidate who understands the limits of their current authority, is completing recognised requirements and can show safe, supervised evidence.`
          : `Position yourself as a ${role.role} with useful ${profile.currentRole} experience and clear evidence of the skills that carry across.`,
      headline: `${role.role} | ${skillGap.filter((g) => g.status !== "need").slice(0, 2).map((g) => g.skill).join(" | ") || `Experience from ${profile.currentRole}`}`,
      bullets: [
        {
          before: `Responsible for day-to-day ${profile.currentRole.toLowerCase()} duties and tasks`,
          after: `Reframed: lead with the outcome and the ${role.role}-relevant muscle — e.g. "Drove [measurable result] by [action], working across [stakeholders/tools]"`,
        },
        {
          before: "Completed online course in " + role.role.toLowerCase(),
          after: `“Completed [evidence task] — [one-line outcome or supervisor feedback]” — show proof alongside any certificate`,
        },
        {
          before: "Career break / career change in progress",
          after: `“Moving from ${profile.currentRole} towards ${role.role}: [X] evidence tasks, [Y] recognised training, available [date]” — say what you can prove without overstating your authority`,
        },
      ],
      linkedinTips: practical ? [
        "Put the target role and location near the top of your CV",
        "Use short action-and-result examples from real work, home, volunteering or supervised training",
        "List only certificates you completed and state the awarding body correctly",
        "Keep private customer, patient, pupil and employer information out of samples",
        "An online profile can help, but employer sites, trusted job boards and approved recruiters also matter",
      ] : [
        "State the target role first in your profile headline",
        "Use three short paragraphs: the change, your proof and the kind of opportunity you seek",
        "Feature two safe, non-confidential evidence pieces with outcome-first titles",
        "Share useful learning only when it helps your field; posting every week is not required",
        "Use the target title consistently across your CV, profile and applications",
      ],
    },
    salary: [
      { stage: "Starting or trainee route", range: "Check recent local adverts", note: `Compare at least 10 suitable ${role.role} adverts in ${profile.targetCountry || "your intended location"}.`, pct: 40 },
      { stage: "With recognised training", range: "Verify locally", note: "Check whether the qualification, licence or provider changes the offered pay.", pct: 60 },
      { stage: "With proven experience", range: "Verify locally", note: "Compare similar responsibility, shift pattern, sector and employer size.", pct: 80 },
      { stage: "Supervisor, specialist or business route", range: "Varies widely", note: "Higher responsibility does not guarantee higher take-home pay. Compare the complete offer.", pct: 100 },
    ],
    networking: {
      communities: role.communities,
      peopleToFollow: role.people,
      events: role.events,
      outreachTemplate: practical
        ? `Hello [Name]. My current role is ${profile.currentRole}, and I am exploring ${role.role} work in ${profile.targetCountry || "this area"}. Could I ask you two short questions: what requirement should I verify first, and what beginner evidence do employers trust? I am not asking you to promise me a job.`
        : `Hello [Name]. My current role is ${profile.currentRole}, and I am preparing for ${role.role} work. Your experience with [specific topic] is relevant to one question I have: [focused question]. Would you be open to a short conversation or written reply?`,
      weeklyRoutine: practical ? [
        "Read two current local adverts and note repeated requirements",
        "Ask one working person, supervisor, trainer or recruiter a focused question",
        "Improve one safe piece of evidence",
        "Keep names, dates and next actions in a simple notebook or phone note",
      ] : [
        "Read current adverts and note repeated requirements",
        "Have one informed career conversation",
        "Improve one evidence piece or application",
        "Track names, dates and next actions in a simple note",
      ],
    },
    interview: {
      narrative: `“I spent [N] years in ${profile.currentRole} work, where I became good at [transferable strengths]. I kept moving towards [the target-role part of the job]. ${profile.timelineMonths} months ago, I committed to [course], [project 1] and [project 2]. I now bring that ${profile.motivations.includes("meaning") ? "purpose and " : ""}judgement into ${role.role}, where I can [what you will do for them].”`,
      commonQuestions: [
        { question: "Why are you changing careers?", approach: "Run toward, never away. One sentence on what pulled you in, then immediately pivot to the evidence: what you've built and learned." },
        { question: `Why should we consider you for ${role.role}?`, approach: `Use one strength from ${profile.currentRole}, one piece of relevant evidence and one honest sentence about the training or supervision you still need.` },
        { question: "Show me evidence that you can do part of this work.", approach: "Explain the situation, what you were allowed to do, the action, the result and what you learned. Never claim unsupervised work you did not perform." },
        { question: "What's your biggest gap?", approach: "Name a real one (not a humble-brag), show the plan already in motion to close it, and cite a time you closed a similar gap fast." },
      ],
      frameworks: role.frameworks,
      redFlags: [
        "Talking about your old career in the past tense with resentment",
        "Apologizing for being a switcher — frame it as an asset or nobody else will",
        "Evidence or certificates you cannot explain honestly",
        "No questions for them — always have 3 that prove you researched the team",
      ],
    },
    dayInLife: role.dayInLife,
    risk: {
      difficulty,
      difficultyLabel: difficulty <= 3 ? "Moderate" : difficulty <= 6 ? "Challenging" : "Demanding",
      successFactors: practical ? [
        `Protect ${profile.hoursPerWeek} hours each week for small, steady progress`,
        "Check licences, recognition and safety rules before paying or practising",
        `Use real evidence from your ${profile.currentRole} experience without sharing private information`,
        "Ask working people and trusted recruiters what local employers actually accept",
      ] : [
        `Protect ${profile.hoursPerWeek} hours each week for consistent progress`,
        "Two strong evidence pieces usually matter more than many certificates",
        `Use your ${profile.currentRole} background as useful context, not baggage`,
        "Use informed conversations to learn requirements and find suitable openings",
      ],
      setbacks: [
        { risk: tight ? "Your timeline is tight for the hours available" : "Progress may slow after the first few months", mitigation: tight ? "Keep the sequence and extend the timeline rather than skipping required practice or evidence" : "Use a weekly check-in with a trusted person and record one completed action at a time" },
        { risk: "Job-hunt phase takes longer than planned", mitigation: "Start networking in month 1, not month " + Math.max(1, profile.timelineMonths - 2) + " — pipeline building is the part switchers most underestimate" },
        { risk: "Imposter feeling in the first role", mitigation: "Normal and temporary. The 90-day plan below is designed to convert it into early wins" },
      ],
      planB: role.planB,
    },
    firstNinetyDays: {
      phases: [
        { window: "Days 1–30 · Learn", goals: ["Map who does what and how decisions actually get made", "Ship one small, safe win in week 2–3", "Set explicit expectations with your manager — ask 'what does great look like at 90 days?'"] },
        { window: "Days 31–60 · Contribute", goals: ["Take responsibility for one suitable piece of work", `Use one strength from your ${profile.currentRole} experience`, "Build trust with people beyond your immediate team"] },
        { window: "Days 61–90 · Compound", goals: ["Deliver a project with a measurable outcome you can cite forever", "Ask for structured feedback and act on it publicly", "Write your own next-6-months development plan and share it with your manager"] },
      ],
    },
  };
}
