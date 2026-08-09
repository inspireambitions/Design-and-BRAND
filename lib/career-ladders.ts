import type { CourseRec, Profile, RoadmapReport, SkillGapItem } from "./types";

type Ladder = {
  id: "housekeeping" | "hr";
  roles: string[];
  aliases: Record<string, string[]>;
  targetPattern: RegExp;
  skills: SkillGapItem[];
};

const HOUSEKEEPING: Ladder = {
  id: "housekeeping",
  roles: [
    "Room Attendant",
    "Housekeeping Coordinator or Senior Room Attendant",
    "Housekeeping Supervisor",
    "Assistant Executive Housekeeper",
    "Executive Housekeeper",
    "Director of Housekeeping",
  ],
  aliases: {
    "Room Attendant": ["room attendant", "housekeeping attendant", "hotel housekeeper", "housekeeper"],
    "Housekeeping Coordinator or Senior Room Attendant": ["housekeeping coordinator", "senior room attendant", "housekeeping team leader"],
    "Housekeeping Supervisor": ["housekeeping supervisor", "floor supervisor", "public area supervisor"],
    "Assistant Executive Housekeeper": ["assistant executive housekeeper", "assistant housekeeping manager"],
    "Executive Housekeeper": ["executive housekeeper", "housekeeping manager", "head housekeeper"],
    "Director of Housekeeping": ["director of housekeeping", "housekeeping director"],
  },
  targetPattern: /\b(executive housekeeper|director of housekeeping|housekeeping director)\b/i,
  skills: [
    { skill: "Room inspection and quality control", status: "need", priority: "high", howToAcquire: "Shadow authorised inspections. Record defects, corrective action and the recheck result without guest details." },
    { skill: "Briefing, coaching and shift leadership", status: "need", priority: "high", howToAcquire: "Lead a briefing, train one colleague and ask your supervisor to record the result." },
    { skill: "Rostering, productivity and room allocation", status: "need", priority: "high", howToAcquire: "Learn how your property plans rooms, labour and public-area coverage. Complete one supervised planning exercise." },
    { skill: "Linen, laundry, stock and chemical control", status: "need", priority: "medium", howToAcquire: "Join one stock count or laundry review. Follow safety data and never change a chemical process without approval." },
    { skill: "Guest recovery and cross-department coordination", status: "need", priority: "medium", howToAcquire: "Track one anonymised service issue from report to resolution with Front Office or Engineering." },
    { skill: "Budget, suppliers and department performance", status: "need", priority: "high", howToAcquire: "At management level, own a supervised cost, quality or productivity review and explain the business result." },
  ],
};

const HR: Ladder = {
  id: "hr",
  roles: [
    "HR Intern",
    "HR Coordinator",
    "HR Officer or HR Generalist",
    "Assistant HR Manager",
    "HR Manager",
    "Director of HR",
  ],
  aliases: {
    "HR Intern": ["hr intern", "human resources intern", "people intern"],
    "HR Coordinator": ["hr coordinator", "human resources coordinator", "hr administrator", "hr assistant"],
    "HR Officer or HR Generalist": ["hr officer", "hr generalist", "human resources officer", "human resources generalist"],
    "Assistant HR Manager": ["assistant hr manager", "assistant human resources manager"],
    "HR Manager": ["hr manager", "human resources manager", "people and culture manager"],
    "Director of HR": ["director of hr", "hr director", "director of human resources", "people and culture director"],
  },
  targetPattern: /\b(director of hr|hr director|director of human resources|people and culture director)\b/i,
  skills: [
    { skill: "Accurate HR administration and employee records", status: "need", priority: "high", howToAcquire: "Own a supervised onboarding, document or employee-data workflow. Use invented examples outside work and keep employee data private." },
    { skill: "Recruitment and onboarding", status: "need", priority: "high", howToAcquire: "Support a vacancy from approved job description to onboarding. Record cycle time and completion without candidate names." },
    { skill: "Employment law and fair process", status: "need", priority: "high", howToAcquire: "Study the current law for your location. Shadow cases only with permission and use fictional scenarios for practice." },
    { skill: "HR systems, payroll inputs and reporting", status: "need", priority: "medium", howToAcquire: "Learn the authorised HRIS workflow and build an anonymised monthly people report." },
    { skill: "Employee relations and manager support", status: "need", priority: "high", howToAcquire: "Observe authorised meetings, practise neutral notes with fictional cases and learn when to escalate." },
    { skill: "Workforce planning, budget and HR strategy", status: "need", priority: "high", howToAcquire: "At manager level, lead one approved workforce, retention or capability plan tied to an operating result." },
  ],
};

const LADDERS = [HOUSEKEEPING, HR];

function roleIndex(ladder: Ladder, value: string): number {
  const normal = value.toLowerCase().trim();
  return ladder.roles.findIndex((role) =>
    role.toLowerCase() === normal || (ladder.aliases[role] || []).some((alias) => alias === normal)
  );
}

function findLadder(profile: Profile): { ladder: Ladder; currentIndex: number; targetIndex: number } | null {
  for (const ladder of LADDERS) {
    if (!ladder.targetPattern.test(profile.targetRole)) continue;
    const currentIndex = roleIndex(ladder, profile.currentRole);
    const targetIndex = roleIndex(ladder, profile.targetRole);
    if (currentIndex >= 0 && targetIndex > currentIndex) return { ladder, currentIndex, targetIndex };
  }
  return null;
}

function phases(months: number, focus: string[]) {
  const firstEnd = Math.max(1, Math.floor(months / 4));
  const secondEnd = Math.max(firstEnd + 1, Math.floor(months / 2));
  const thirdEnd = Math.max(secondEnd + 1, Math.floor((months * 3) / 4));
  const label = (start: number, end: number) => start === end ? `Month ${start}` : `Months ${start}–${end}`;
  const ranges = [[1, firstEnd], [firstEnd + 1, secondEnd], [secondEnd + 1, thirdEnd], [thirdEnd + 1, months]];
  return ranges.map(([start, end], index) => ({
    label: label(start, end),
    title: ["Confirm the gate", "Build supervised evidence", "Compete for the next level", "Consolidate and reassess"][index],
    focus: focus[index],
    actions: [
      index === 0 ? "Compare your evidence with the next role's real job description" : "Complete one approved task at the next level",
      "Ask your manager for written feedback on one result",
      index === 3 ? "Update the promotion plan using the evidence you now have" : "Keep a private evidence log with no guest, employee or employer data",
    ],
    milestone: ["Your manager confirms the next role's main gaps", "You have two verified examples at the next level", "You are ready to apply or request an acting assignment", "You can name the next gate and the evidence still missing"][index],
  }));
}

function housekeepingCourses(profile: Profile): CourseRec[] {
  const free: CourseRec[] = [{
    name: "Employer-led housekeeping cross-training",
    provider: "Your hotel, brand academy or approved property trainer",
    cost: "Ask for employer-funded access",
    duration: "Agree one supervised task at a time",
    rating: "Verify with your employer",
    why: "Request inspection, rostering, inventory, laundry and briefing exposure in the order required for your next role.",
    badge: "Start here",
  }];
  if (profile.budget === "free") return free;
  return [...free,
    {
      name: "Certified Hospitality Supervisor (CHS)",
      provider: "AHLEI",
      cost: "Check the current official price before paying",
      duration: "Use after you hold qualifying supervisory duties",
      rating: "Eligibility checked 10 August 2026",
      why: "Consider this after you supervise staff and meet AHLEI's current eligibility rules. It does not replace promotion evidence.",
      badge: "Supervisor stage",
      url: "https://www.ahla.com/certifications",
    },
    {
      name: "Certified Hospitality Housekeeping Executive (CHHE)",
      provider: "AHLEI",
      cost: "Check the current official regional price before paying",
      duration: "Only when you reach a qualifying management role",
      rating: "Prerequisites checked 10 August 2026",
      why: "AHLEI lists executive or management-level housekeeping work as a prerequisite. Do not buy this as a Room Attendant.",
      badge: "Later-stage option",
      url: "https://ahleisa.org/products/certified-hospitality-housekeeping-executive-chhe",
    },
  ];
}

function hrCourses(profile: Profile): CourseRec[] {
  const free: CourseRec[] = [{
    name: "UAE private-sector employment law",
    provider: "The Official Platform of the UAE Government",
    cost: "Free",
    duration: "Use as a current reference",
    rating: "Page checked 10 August 2026",
    why: "Read the current law and amendments. Use fictional cases for practice and seek authorised advice for live employee matters.",
    badge: "Official source",
    url: "https://u.ae/en/information-and-services/jobs/employment-in-the-private-sector/employment-laws-and-regulations-in-the-private-sector",
  }];
  if (profile.budget === "free") return free;
  return [...free,
    {
      name: "CIPD Level 3 Foundation Certificate in People Practice",
      provider: "CIPD approved study centre",
      cost: "Compare current approved-centre prices",
      duration: "CIPD states a typical 8 to 12 months",
      rating: "Official page checked 10 August 2026",
      why: "This is designed for people new to HR or working in HR support. Confirm that local employers value it before enrolling.",
      badge: "Early-career option",
      url: "https://www.cipd.org/en/learning/qualifications/foundation/foundation-certificate-in-people-practice/",
    },
    {
      name: "SHRM Certified Professional (SHRM-CP)",
      provider: "SHRM",
      cost: "Check the current application and exam fees",
      duration: "Prepare only after checking the current exam window",
      rating: "Eligibility checked 10 August 2026",
      why: "SHRM positions this for operational HR work and people pursuing HR. Compare it with CIPD and local vacancy requirements before choosing.",
      badge: "Optional credential",
      url: "https://www.shrm.org/credentials/certification/shrm-cp",
    },
  ];
}

function evidencedSkills(ladder: Ladder, profile: Profile): SkillGapItem[] {
  const selected = profile.existingSkills;
  const evidenceByIndex = ladder.id === "housekeeping"
    ? [
        ["Checking details", "Cleaning standards", "Quality checks"],
        ["Working with a team", "Training another person", "Leading or guiding others"],
        ["Planning work", "Keeping records"],
        ["Stock control", "Chemical safety", "Working safely"],
        ["Helping customers", "Solving problems", "Explaining information"],
        ["Working with data or spreadsheets", "Planning work"],
      ]
    : [
        ["Keeping records", "Checking details", "Data entry"],
        ["Explaining information", "Scheduling", "Working with a team"],
        ["Keeping records", "Solving problems"],
        ["Using phones or computers", "Working with data or spreadsheets", "Data entry"],
        ["Helping customers", "Explaining information", "Solving problems"],
        ["Planning work", "Leading or guiding others", "Working with data or spreadsheets"],
      ];

  return ladder.skills.map((item, index) => {
    const evidence = selected.find((skill) => evidenceByIndex[index]?.includes(skill));
    if (!evidence) return item;
    return {
      ...item,
      status: "partial" as const,
      howToAcquire: `You selected “${evidence}” as evidence you already use. Test how well it transfers through the supervised task below. ${item.howToAcquire}`,
    };
  });
}

export function applyCareerLadder(report: RoadmapReport, profile: Profile): RoadmapReport {
  const match = findLadder(profile);
  if (!match) return report;

  const { ladder, currentIndex, targetIndex } = match;
  const promotionsInWindow = profile.timelineMonths >= 18 ? 2 : 1;
  const credibleIndex = Math.min(targetIndex, currentIndex + promotionsInWindow);
  const credibleRole = ladder.roles[credibleIndex];
  const finalRole = ladder.roles[targetIndex];
  const route = ladder.roles.slice(currentIndex, targetIndex + 1).join(" → ");
  const housekeeping = ladder.id === "housekeeping";
  const courses = housekeeping ? housekeepingCourses(profile) : hrCourses(profile);
  const evidenceNoun = housekeeping ? "guest, staff or property" : "candidate, employee or employer";
  const skillGap = evidencedSkills(ladder, profile);
  const transferableCount = skillGap.filter((item) => item.status !== "need").length;
  const nextRole = ladder.roles[Math.min(currentIndex + 1, targetIndex)];

  return {
    ...report,
    verdict: `Your ${profile.timelineMonths}-month plan should target ${credibleRole}, not promise ${finalRole}. The full route is ${route}. Each promotion depends on real scope, results and a vacancy. Recheck the final target after you have proved the next level.`,
    snapshot: {
      ...report.snapshot,
      to: finalRole,
      transferableCount,
      estimatedCost: profile.budget === "free" ? "Start with employer-funded development" : "Check recognition and price before paying",
    },
    guidanceNote: `This is a staged promotion plan. It does not confirm a promotion, vacancy, salary, qualification or completion date. Treat ${credibleRole} as the current planning target and ${finalRole} as the longer-term direction.`,
    skillGap,
    steps: [
      { title: `Confirm the promotion route with your manager`, duration: "First 2 weeks", detail: `Compare ${route} with your property's or employer's real structure. Ask which role is the next available step and which results decide promotion.` },
      { title: `Prove the core work at your current level`, duration: "Months 1–3", detail: `Collect two verified quality, service, accuracy or productivity results. Remove all ${evidenceNoun} information.` },
      { title: `Take one authorised task from ${ladder.roles[Math.min(currentIndex + 1, targetIndex)]}`, duration: "Months 2–6", detail: "Ask for supervised exposure. Record the task, standard, result and manager feedback. An online course cannot replace this evidence." },
      { title: `Close the first leadership and systems gaps`, duration: "Months 4–9", detail: `Work through the high-priority skill rows. Learn only through approved systems, fictional practice or supervised work.` },
      { title: `Compete for ${ladder.roles[Math.min(currentIndex + 1, targetIndex)]}`, duration: "When the first gate is met", detail: "Use the job description and your evidence log. Apply internally or externally only when you can show the essential work." },
      { title: `Build results in ${credibleRole}`, duration: `Through month ${profile.timelineMonths}`, detail: "Own a repeated operating result, coach others and learn the reporting expected at that level. Do not rush past this stage to chase a title." },
      { title: `Prepare the next management gate`, duration: "After consistent results", detail: `Add wider team, systems, cost, risk and cross-department scope. Ask a department head which evidence is still missing.` },
      { title: `Pursue ${finalRole} after every prior gate`, duration: "Longer-term target", detail: `Compete for ${finalRole} only after you have led the required function at the previous level. Your original deadline does not override experience, scope or vacancy requirements.` },
    ],
    timeline: phases(profile.timelineMonths, [
      `Confirm the route and the evidence required for ${ladder.roles[Math.min(currentIndex + 1, targetIndex)]}.`,
      `Complete supervised work at the next level while keeping your current performance strong.`,
      `Seek an acting assignment, cross-training or a suitable vacancy for ${credibleRole}.`,
      `Consolidate results in or towards ${credibleRole}. Do not claim readiness for ${finalRole} yet.`,
    ]),
    courses,
    projects: housekeeping ? [
      { title: "Anonymised room-quality improvement", description: "Track one approved inspection problem, the correction and the recheck result. Remove room numbers, guest details and internal documents.", skills: ["Inspection", "Quality control", "Follow-up"], effort: "2 to 4 weeks" },
      { title: "Supervised shift or floor plan", description: "Prepare one draft allocation, briefing or handover with manager approval. Record the operating result, not staff names.", skills: ["Planning", "Communication", "Leadership"], effort: "One operating cycle" },
      { title: "Stock, linen or productivity review", description: "Join an authorised review and suggest one safe improvement. Do not copy confidential cost or supplier data.", skills: ["Cost awareness", "Analysis", "Housekeeping operations"], effort: "2 to 4 weeks" },
    ] : [
      { title: "Anonymised onboarding control check", description: "Use a fictional employee file to test an onboarding checklist. Never copy real identity, pay, medical or visa data.", skills: ["HR operations", "Accuracy", "Confidentiality"], effort: "One week" },
      { title: "Recruitment process measure", description: "With approval, measure one process such as completion time or interview attendance. Report totals only and remove candidate details.", skills: ["Recruitment", "Reporting", "Process improvement"], effort: "2 to 4 weeks" },
      { title: "Fictional manager guidance note", description: "Write a short response to a fictional attendance, performance or conduct case using current law and company procedure.", skills: ["Employee relations", "Writing", "Fair process"], effort: "One week" },
    ],
    resume: {
      summary: `Position your ${profile.currentRole} experience for ${nextRole}. Show evidence from the next level without claiming readiness for ${finalRole}.`,
      headline: `${profile.currentRole} preparing for ${nextRole} | ${skillGap.slice(0, 2).map((item) => item.skill).join(" | ")}`,
      bullets: housekeeping ? [
        { before: "Cleaned assigned rooms", after: "Completed [number] assigned rooms to the required standard, recorded defects and closed rechecks with the supervisor" },
        { before: "Helped the housekeeping team", after: "Supported [approved task] during [busy period], helping the team achieve [verified service or quality result]" },
        { before: "Want to become a Director of Housekeeping", after: `Preparing for ${nextRole} through supervised inspection, briefing and planning evidence` },
      ] : [
        { before: "Helped with HR administration", after: "Completed [approved onboarding or records task] accurately and on time, with employee information kept confidential" },
        { before: "Supported recruitment", after: "Tracked [approved process measure] across [number] vacancies and helped improve [verified result]" },
        { before: "Want to become a Director of HR", after: `Preparing for ${nextRole} through HR operations, reporting and supervised case-support evidence` },
      ],
      linkedinTips: [
        `Use ${nextRole} as the near-term target in your summary`,
        "Describe approved results, not confidential cases or internal documents",
        "Name completed qualifications accurately and link only to the awarding body",
        `Keep ${finalRole} in the career direction, not as a title you already claim`,
      ],
    },
    salary: ladder.roles.slice(currentIndex, Math.min(targetIndex + 1, currentIndex + 4)).map((role, index, roles) => ({
      stage: role,
      range: "Check current local adverts",
      note: index === 0
        ? "Record the full current package as the comparison point."
        : `Compare at least five recent ${role} adverts with similar property or employer scope.`,
      pct: Math.round(35 + (index * 65) / Math.max(1, roles.length - 1)),
    })),
    networking: {
      ...report.networking,
      peopleToFollow: housekeeping
        ? ["A Housekeeping Supervisor", "An Assistant Executive Housekeeper", "An Executive Housekeeper"]
        : ["An HR Coordinator or Officer", "An HR Manager", "A recruiter who hires HR operations roles"],
      outreachTemplate: `Hello [Name]. My current role is ${profile.currentRole}, and my next target is ${nextRole}. Could I ask which two results or duties you would need to see before considering someone ready for that step?`,
      weeklyRoutine: [
        `Compare one current ${nextRole} job description with your evidence`,
        "Complete or request one approved task from the next level",
        "Record one result and one piece of manager feedback",
        "Keep all guest, candidate, employee and employer information private",
      ],
    },
    interview: {
      narrative: `“My current role is ${profile.currentRole}. I am preparing for ${nextRole}, which is the next gate towards ${finalRole}. I have built evidence in [task 1] and [task 2], with [verified result]. My next development need is [honest gap].”`,
      commonQuestions: [
        { question: `Why are you ready for ${nextRole}?`, approach: "Give one current-level result, one supervised next-level task and one piece of manager feedback." },
        { question: "Which part of the next role still needs development?", approach: "Name the real gap and the approved work or training already arranged to close it." },
        { question: "How do you protect confidential information?", approach: `Explain how you keep ${evidenceNoun} information out of notes, samples and public profiles.` },
        { question: `Where do you want to progress after ${nextRole}?`, approach: `Name the next ladder stage. Keep ${finalRole} as the longer-term direction and show that you understand the gates between them.` },
      ],
      frameworks: ["Situation, authorised action, verified result", "Current scope, next-level evidence, remaining gap"],
      redFlags: [
        `Claiming readiness for ${finalRole} without prior management scope`,
        "Sharing confidential operating or people information as evidence",
        "Listing a course without showing how the learning changed your work",
      ],
    },
    dayInLife: housekeeping ? [
      { time: "Shift start", activity: `Review room status, staffing and quality priorities with the ${nextRole}` },
      { time: "Morning", activity: "Complete assigned work and join an authorised inspection or briefing task" },
      { time: "Mid-shift", activity: "Coordinate an approved guest, laundry, stock or maintenance follow-up" },
      { time: "Afternoon", activity: "Record results, rechecks and one learning point without private details" },
      { time: "Shift end", activity: "Complete the handover and ask for feedback on the next-level task" },
    ] : [
      { time: "Start", activity: `Review approved priorities with the ${nextRole} or manager` },
      { time: "Morning", activity: "Complete employee records, onboarding or recruitment support within your access level" },
      { time: "Midday", activity: "Update the authorised HR system and check data accuracy" },
      { time: "Afternoon", activity: "Support an approved report, training or employee-service task" },
      { time: "End", activity: "Secure confidential records, complete the handover and record one learning point" },
    ],
    risk: {
      ...report.risk,
      difficultyLabel: "Multi-stage promotion route",
      setbacks: [
        { risk: "The next title is not available in the current organisation", mitigation: "Build the evidence for the next level, then compare suitable roles in properties or employers with a clear ladder." },
        { risk: "Training is completed without wider job scope", mitigation: "Pair every course with an approved task, result and manager feedback." },
        { risk: "The final target takes longer than the selected deadline", mitigation: `Treat ${credibleRole} as the deadline target and keep ${finalRole} as the longer-term direction.` },
      ],
      planB: housekeeping
        ? "Use housekeeping coordination, quality, laundry or training as a bridge if a supervisor vacancy is not available."
        : "Use HR coordination, recruitment, learning, payroll support or employee-experience work to build broader operational evidence.",
    },
    firstNinetyDays: {
      phases: [
        { window: "Days 1–30", goals: [`Get the real ${nextRole} job description`, "Agree one supervised next-level task", "Start a private evidence log"] },
        { window: "Days 31–60", goals: ["Complete the approved task", "Record the standard and verified result", "Ask for direct manager feedback"] },
        { window: "Days 61–90", goals: [`Compare your evidence with the ${nextRole} requirements`, "Choose the next gap to close", "Agree whether an acting assignment, course or vacancy is the right next step"] },
      ],
    },
  };
}
