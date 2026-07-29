export interface Profile {
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
  email?: string;
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
  matchScore: number; // 0-100
  verdict: string;
  snapshot: {
    from: string;
    to: string;
    months: number;
    hoursPerWeek: number;
    transferableCount: number;
    estimatedCost: string;
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
  { id: "snapshot", n: 0, icon: "◎", title: "Transition Snapshot", blurb: "Your match score and the shape of the journey ahead", free: true },
  { id: "skill-gap", n: 1, icon: "📊", title: "Skill Gap Analysis", blurb: "Skills you have vs. skills you need, with acquisition plans", free: true },
  { id: "steps", n: 2, icon: "🪜", title: "The Step-by-Step Path", blurb: "Every step from here to hired, with a duration estimate each", free: true },
  { id: "timeline", n: 3, icon: "🗓️", title: "Month-by-Month Timeline", blurb: "A concrete schedule with milestones, tuned to your hours", free: true },
  { id: "courses", n: 4, icon: "🎓", title: "Courses & Certifications", blurb: "Specific programs filtered by your budget", free: false },
  { id: "projects", n: 5, icon: "🛠️", title: "Portfolio Projects", blurb: "Projects that leverage your existing domain expertise", free: false },
  { id: "resume", n: 6, icon: "📝", title: "Resume & LinkedIn Rewrite", blurb: "Before/after bullets that reframe your experience", free: false },
  { id: "salary", n: 7, icon: "💰", title: "Salary Progression", blurb: "Expected earnings at each stage of the transition", free: false },
  { id: "networking", n: 8, icon: "🤝", title: "Networking Strategy", blurb: "Communities, people, events, and an outreach script", free: false },
  { id: "interview", n: 9, icon: "⚡", title: "Interview Preparation", blurb: "Your career-switch narrative and common questions", free: false },
  { id: "day-in-life", n: 10, icon: "☀️", title: "A Day in Your New Life", blurb: "What a typical day actually looks like in the role", free: false },
  { id: "risk", n: 11, icon: "🎯", title: "Risk Assessment & Plan B", blurb: "Honest difficulty rating, setbacks, and your backup route", free: false },
  { id: "ninety", n: 12, icon: "🚀", title: "First 90 Days on the Job", blurb: "How to succeed once you've actually landed the role", free: false },
] as const;
