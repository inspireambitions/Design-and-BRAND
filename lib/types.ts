export interface Profile {
  mode?: "general" | "hospitality";
  directionMode?: "known" | "explore" | "grow";
  industry?: string;
  currentIndustry?: string;
  targetIndustry?: string;
  otherIndustry?: string;
  currentRole: string;
  targetRole: string;
  yearsExperience: string; // "0-2" | "3-5" | "6-10" | "10+"
  existingSkills: string[];
  hoursPerWeek: number;
  timelineMonths: number; // 6 | 12 | 18 | 24
  budget: string; // "free" | "500" | "2000" | "flexible"
  workStyle: string; // "remote" | "hybrid" | "onsite" | "any"
  motivations: string[];
  location?: string;
  targetCountry?: string;
  careerGoal?: string;
  careerBarrier?: string;
  careerBarriers?: string[];
  otherBarrier?: string;
  marketSegment?: string;
  currentSalary?: number;
  educationLevel?: string;
  languages?: string[];
  certificationsHeld?: string[];
  supportAvailable?: string;
  relocationStatus?: string;
  gccExperience?: string;
  workAuthorizationStatus?: string;
  industryContact?: string;
  jobSearchStage?: string;
  customerFacingExperience?: string;
}

export interface SkillGapItem {
  skill: string;
  status: "have" | "partial" | "need";
  priority: "high" | "medium" | "low";
  howToAcquire: string;
}

export interface RoadmapStep {
  title: string;
  duration: string; // "~2–3 months" | "~Ongoing"
  detail: string; // gated behind the paywall
}

export interface TimelinePhase {
  label: string; // e.g. "Months 1–2"
  title: string;
  focus: string;
  actions: string[];
  milestone: string;
}

export interface CourseRec {
  name: string;
  provider: string;
  cost: string;
  duration: string;
  rating: string;
  why: string;
  badge?: string;
  url?: string;
}

export interface ProjectRec {
  title: string;
  description: string;
  skills: string[];
  effort: string;
}

export interface ResumeGuidance {
  summary: string;
  headline: string;
  bullets: { before: string; after: string }[];
  linkedinTips: string[];
}

export interface SalaryStage {
  stage: string;
  range: string;
  note: string;
  pct: number; // 0-100 for chart bar
}

export interface NetworkingPlan {
  communities: string[];
  peopleToFollow: string[];
  events: string[];
  outreachTemplate: string;
  weeklyRoutine: string[];
}

export interface InterviewPrep {
  narrative: string;
  commonQuestions: { question: string; approach: string }[];
  frameworks: string[];
  redFlags: string[];
}

export interface RiskAssessment {
  difficulty: number; // 1-10
  difficultyLabel: string;
  successFactors: string[];
  setbacks: { risk: string; mitigation: string }[];
  planB: string;
}

export interface FirstNinetyDays {
  phases: { window: string; goals: string[] }[];
}

export interface RoadmapReport {
  generatedBy: "ai" | "engine";
  mode?: "general" | "hospitality";
  guidanceNote?: string;
  matchScore: number; // 0-100
  verdict: string;
  snapshot: {
    from: string;
    to: string;
    months: number;
    hoursPerWeek: number;
    transferableCount: number;
    estimatedCost: string;
    location?: string;
    targetIndustry?: string;
    careerBarriers?: string[];
    relocationStatus?: string;
    gccExperience?: string;
    workAuthorizationStatus?: string;
    industryContact?: string;
    jobSearchStage?: string;
    languages?: string[];
    customerFacingExperience?: string;
  };
  skillGap: SkillGapItem[];
  steps: RoadmapStep[];
  timeline: TimelinePhase[];
  courses: CourseRec[];
  projects: ProjectRec[];
  resume: ResumeGuidance;
  salary: SalaryStage[];
  networking: NetworkingPlan;
  interview: InterviewPrep;
  dayInLife: { time: string; activity: string }[];
  risk: RiskAssessment;
  firstNinetyDays: FirstNinetyDays;
}

export const SECTION_META = [
  { id: "snapshot", n: 0, icon: "00", title: "Your starting point", blurb: "The route, conditions and important limits", free: true },
  { id: "skill-gap", n: 1, icon: "01", title: "Skills check", blurb: "What you can already use and what to learn next", free: true },
  { id: "steps", n: 2, icon: "02", title: "Your next steps", blurb: "A practical order of work from today onwards", free: true },
  { id: "timeline", n: 3, icon: "03", title: "Month-by-month plan", blurb: "A schedule shaped around the time you actually have", free: true },
  { id: "courses", n: 4, icon: "04", title: "Training to check", blurb: "Options within your budget, with recognition checks", free: false },
  { id: "projects", n: 5, icon: "05", title: "Proof of your skills", blurb: "Safe work samples, supervised practice or evidence tasks", free: false },
  { id: "resume", n: 6, icon: "06", title: "CV and profile", blurb: "Clear ways to explain the experience you already have", free: false },
  { id: "salary", n: 7, icon: "07", title: "Pay research", blurb: "How to compare real local adverts without false promises", free: false },
  { id: "networking", n: 8, icon: "08", title: "People who can help", blurb: "Who to ask, where to learn and what to say", free: false },
  { id: "interview", n: 9, icon: "09", title: "Interview practice", blurb: "Your career-change story and likely questions", free: false },
  { id: "day-in-life", n: 10, icon: "10", title: "What the work may involve", blurb: "A realistic example day to verify with a worker", free: false },
  { id: "risk", n: 11, icon: "11", title: "Risks and Plan B", blurb: "What may slow the move and a safer backup route", free: false },
  { id: "ninety", n: 12, icon: "12", title: "First 90 days", blurb: "How to settle in and build trust after you are hired", free: false },
] as const;
