import type { Profile, RoadmapReport } from "./types";

const NON_ROLE_INPUTS = new Set([
  "asdf",
  "asdfgh",
  "qwerty",
  "test",
  "testing",
  "none",
  "nothing",
  "unknown",
  "not sure",
  "n a",
  "na",
]);

export function targetRoleError(targetRole: string): string | null {
  const normal = targetRole.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (normal.length < 3 || !/[a-z]/.test(normal)) {
    return "Enter a real target role, such as Housekeeping Supervisor, HR Coordinator or Electrician.";
  }
  if (NON_ROLE_INPUTS.has(normal) || /(.)\1{4,}/.test(normal) || !/[aeiouy]/.test(normal)) {
    return "We could not recognise that target role. Enter the job title you want or the next level you are aiming for.";
  }
  if (/\b(unlicensed|without a licence|fake|illegal)\b/.test(normal)) {
    return "Choose the recognised, lawful job title. The roadmap cannot help someone bypass licensing or misrepresent qualifications.";
  }
  if (normal.split(" ").length > 12) {
    return "Enter one target job title, not a full sentence. You can describe the wider goal in the career goal field.";
  }
  return null;
}

export function applyPlanningConstraints(report: RoadmapReport, profile: Profile): RoadmapReport {
  const tight = profile.timelineMonths <= 6 || (profile.timelineMonths <= 12 && profile.hoursPerWeek < 8);
  const alreadyGuarded = /cannot move straight|not promise/i.test(report.verdict);
  if (!tight || alreadyGuarded) return report;

  const planningLimit = profile.timelineMonths <= 6
    ? `Use the next ${profile.timelineMonths} months to test the role, close the first gaps and build evidence.`
    : `With ${profile.hoursPerWeek} hours a week, use this period to build evidence and test readiness.`;

  return {
    ...report,
    verdict: `${planningLimit} The selected deadline does not guarantee that training, required experience, licensing or hiring will finish by then. ${report.verdict}`,
    risk: {
      ...report.risk,
      setbacks: [
        { risk: "The selected deadline is shorter than the real preparation or hiring process", mitigation: "Keep the sequence, extend the date and pursue the next credible stage instead of skipping a requirement." },
        ...report.risk.setbacks,
      ].slice(0, 4),
    },
  };
}
