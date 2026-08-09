import { describe, expect, it } from "vitest";
import { applyCareerSafetyGuards, rolesAreIdentical } from "./career-safety";
import { generateReport } from "./engine";
import type { Profile } from "./types";

const profile: Profile = {
  currentRole: "Room Attendant",
  targetRole: "Registered Nurse",
  yearsExperience: "3-5",
  existingSkills: ["Customer service"],
  hoursPerWeek: 8,
  timelineMonths: 24,
  budget: "free",
  workStyle: "onsite",
  motivations: ["growth"],
  educationLevel: "secondary",
  location: "Dubai, UAE",
  targetCountry: "United Arab Emirates",
};

describe("career safety guards", () => {
  it("normalises identical role titles", () => {
    expect(rolesAreIdentical("Director of HR", " director-of-hr ")).toBe(true);
  });

  it("does not create a direct clinical application plan without prerequisites", () => {
    const guarded = applyCareerSafetyGuards(generateReport(profile), profile);
    expect(guarded.verdict).toContain("cannot move straight");
    expect(guarded.steps[0].title).toContain("licensed title");
    expect(guarded.steps[7].detail).toContain("Never claim");
    expect(guarded.courses.map((course) => course.provider)).toContain("Dubai Health Authority, Sheryan");
  });

  it("does not alter an unrelated career report", () => {
    const hr = { ...profile, targetRole: "Director of HR" };
    const report = generateReport(hr);
    expect(applyCareerSafetyGuards(report, hr)).toBe(report);
  });

  it("keeps every six-month phase range in chronological order", () => {
    const report = generateReport({ ...profile, targetRole: "HR Coordinator", timelineMonths: 6 });
    for (const phase of report.timeline) {
      const months = phase.label.match(/\d+/g)?.map(Number) || [];
      if (months.length === 2) expect(months[0]).toBeLessThanOrEqual(months[1]);
    }
    expect(report.timeline.at(-1)?.label).toContain("6");
  });
});
