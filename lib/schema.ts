// JSON Schema for the roadmap report, used with Claude's structured outputs so
// the model's response is guaranteed to parse into RoadmapReport.

const str = { type: "string" } as const;
const strArr = { type: "array", items: { type: "string" } } as const;

function obj(props: Record<string, unknown>) {
  return {
    type: "object",
    properties: props,
    required: Object.keys(props),
    additionalProperties: false,
  };
}

function arrOf(props: Record<string, unknown>) {
  return { type: "array", items: obj(props) };
}

export const REPORT_SCHEMA = obj({
  matchScore: { type: "integer" },
  verdict: str,
  snapshot: obj({
    from: str,
    to: str,
    months: { type: "integer" },
    hoursPerWeek: { type: "integer" },
    transferableCount: { type: "integer" },
    estimatedCost: str,
  }),
  skillGap: arrOf({
    skill: str,
    status: { type: "string", enum: ["have", "partial", "need"] },
    priority: { type: "string", enum: ["high", "medium", "low"] },
    howToAcquire: str,
  }),
  steps: arrOf({
    title: str,
    duration: str,
    detail: str,
  }),
  timeline: arrOf({
    label: str,
    title: str,
    focus: str,
    actions: strArr,
    milestone: str,
  }),
  courses: arrOf({
    name: str,
    provider: str,
    cost: str,
    duration: str,
    rating: str,
    why: str,
    badge: str,
  }),
  projects: arrOf({
    title: str,
    description: str,
    skills: strArr,
    effort: str,
  }),
  resume: obj({
    summary: str,
    headline: str,
    bullets: arrOf({ before: str, after: str }),
    linkedinTips: strArr,
  }),
  salary: arrOf({
    stage: str,
    range: str,
    note: str,
    pct: { type: "integer" },
  }),
  networking: obj({
    communities: strArr,
    peopleToFollow: strArr,
    events: strArr,
    outreachTemplate: str,
    weeklyRoutine: strArr,
  }),
  interview: obj({
    narrative: str,
    commonQuestions: arrOf({ question: str, approach: str }),
    frameworks: strArr,
    redFlags: strArr,
  }),
  dayInLife: arrOf({ time: str, activity: str }),
  risk: obj({
    difficulty: { type: "integer" },
    difficultyLabel: str,
    successFactors: strArr,
    setbacks: arrOf({ risk: str, mitigation: str }),
    planB: str,
  }),
  firstNinetyDays: obj({
    phases: arrOf({ window: str, goals: strArr }),
  }),
});

// The public WordPress bridge closes requests after 120 seconds. Keep Claude's
// task to the sections where role-specific judgement changes the answer. The
// deterministic engine supplies scheduling, evidence tasks and standard safety
// sections so the visitor receives a complete report within the bridge limit.
export const CORE_REPORT_SCHEMA = obj({
  verdict: REPORT_SCHEMA.properties["verdict"],
  snapshot: REPORT_SCHEMA.properties["snapshot"],
  skillGap: REPORT_SCHEMA.properties["skillGap"],
  steps: REPORT_SCHEMA.properties["steps"],
  courses: REPORT_SCHEMA.properties["courses"],
});
