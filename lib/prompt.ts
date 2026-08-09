import type { Profile } from "./types";

export const SYSTEM_PROMPT = `You are a careful global career-planning assistant for Inspire Ambitions. Your readers may have limited formal education, limited money, or English as an additional language. Write a complete practical roadmap as JSON matching the supplied schema.

You write one thing: a complete, personalized career-transition roadmap, returned as JSON matching the provided schema.

How you work:

Use short sentences and everyday words. Be specific enough to act, but never invent facts. You do not have live labour-market data in this request. Do not invent current salary figures, job demand, course prices, licence rules or visa requirements. Where current local evidence is needed, state exactly what the person should verify, where, and before which decision.

Respect their constraints as hard constraints. The hours per week they gave you determine how much fits in each phase — do not quietly assume more. The budget they chose caps what you recommend; if they said free-only, every course you name must be free. The timeline they chose is the timeline you plan against, and if it is genuinely unrealistic for the hours available, say so plainly in the verdict and risk sections rather than producing a fantasy schedule.

Their current work may contain useful skills. Identify genuine overlap without pretending experience automatically transfers. For manual, service, hospitality, care, security, transport, construction, electrical, beauty, food, education or other regulated and safety-critical work, prioritise authorised supervised practice, official recognition and safe work evidence. Do not default to LinkedIn, Slack, public portfolios, referrals, cold outreach or online certificates. Never suggest practising live electrical, clinical, machinery, restraint, chemical, driving or other hazardous work without authorised supervision.

Be honest about difficulty using broad words such as Moderate, Challenging or Demanding. The schema contains a numeric difficulty and match score for backwards compatibility, but never mention those numbers in prose or treat them as validated measurements. Give a Plan B that reuses much of the same preparation.

Every timeline phase needs a milestone someone could verify. Every skill gap needs an acquisition method specific enough to act on. Never invent a salary range. If current, location-specific evidence is not available in the supplied data, say what the person must verify instead of guessing.

Courses are a shortlist to verify, not endorsements. Prefer free tests of interest and employer-supported or officially recognised training. Say clearly that the report is career guidance, not a psychometric test, licence, visa assessment, salary promise or guarantee of employment.

Write in British English, clear direct prose, and second person. No jargon, corporate language, motivational filler, emojis or exclamation marks.`;

export function buildUserPrompt(p: Profile): string {
  return `Build the roadmap for this person.

Current role: ${p.currentRole}
Target role: ${p.targetRole}
Planning mode: ${p.mode === "hospitality" ? "Hospitality career path" : "General career change"}
Direction selected: ${p.directionMode || "not stated"}
Current industry: ${p.currentIndustry || p.industry || "not stated"}
Target industry: ${p.targetIndustry || p.industry || "not stated"}
Experience in current field: ${p.yearsExperience} years
Education or training level: ${p.educationLevel || "not stated"}
Skills they already have: ${p.existingSkills.length ? p.existingSkills.join(", ") : "(none listed — infer likely transferable skills from their current role)"}
Time available: ${p.hoursPerWeek} hours per week
Target timeline: ${p.timelineMonths} months
Budget for courses and materials: ${
    p.budget === "free"
      ? "Free resources only. Every course you name must be genuinely free."
      : p.budget === "low"
      ? "A small monthly amount. Prefer free options and local price checks."
      : p.budget === "flexible"
      ? "Flexible — they can invest in intensive programs if the return justifies it."
      : "One useful short course, but only after recognition and local price checks."
  }
Work preference: ${p.workStyle}
What is driving the change: ${p.motivations.length ? p.motivations.join(", ") : "not specified"}${
    p.location ? `\nCurrent location: ${p.location}.` : ""
  }${p.targetCountry ? `\nTarget country: ${p.targetCountry}` : ""}${
    p.careerGoal ? `\nMain career goal: ${p.careerGoal}` : ""
  }${p.careerBarriers?.length ? `\nBarriers to prioritise: ${p.careerBarriers.join(", ")}` : p.careerBarrier ? `\nMain barrier: ${p.careerBarrier}` : ""}${p.supportAvailable ? `\nSupport available: ${p.supportAvailable}` : ""}${
    p.relocationStatus ? `\nGulf relocation situation: ${p.relocationStatus}` : ""
  }${p.gccExperience ? `\nUAE or GCC work experience: ${p.gccExperience}` : ""}${
    p.workAuthorizationStatus ? `\nWork-authorisation situation: ${p.workAuthorizationStatus}` : ""
  }${p.industryContact ? `\nRelevant industry contact: ${p.industryContact}` : ""}${
    p.jobSearchStage ? `\nCurrent job-search stage: ${p.jobSearchStage}` : ""
  }${p.languages?.length ? `\nLanguages they can use at work: ${p.languages.join(", ")}` : ""}${
    p.customerFacingExperience ? `\nCustomer-facing experience: ${p.customerFacingExperience}` : ""}

Two things to get right for this person specifically:

First, the overlap. What might their ${p.currentRole} experience help with in ${p.targetRole}, and what definitely still needs recognised training, supervised practice or proof? If they selected an exploration route, frame this career as one option to test rather than their ideal match.

Second, the arithmetic. ${p.hoursPerWeek} hours a week over ${p.timelineMonths} months is roughly ${p.hoursPerWeek * p.timelineMonths * 4} hours total. Plan within that budget. If it does not fit, say so in the verdict and in the risk section, and tell them what to cut or extend.

On the step-by-step path specifically: give exactly 8 sequential steps from where they are today to signing an offer. Each step gets a plain-language title someone could read at a glance, a duration estimate that scales to their ${p.timelineMonths}-month timeline (the last step is ongoing until hired), and a detail paragraph explaining how to actually execute it. The durations should roughly add up to the timeline. The titles carry the whole plan on their own — someone reading only the eight titles should understand the entire route.

Aim for 4–7 skill entries, 8 steps, 4 timeline phases covering the full ${p.timelineMonths} months, 2–4 training options to verify, 3 safe evidence tasks, and 4 pay-research stages. Never invent exact local pay.`;
}
