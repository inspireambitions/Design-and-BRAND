import { describe, expect, it } from "vitest";
import { applyCareerLadder } from "./career-ladders";
import { generateReport } from "./engine";
import type { Profile } from "./types";

function profile(currentRole: string, targetRole: string, budget = "free"): Profile {
  return {
    mode: "hospitality",
    currentRole,
    targetRole,
    yearsExperience: "0-2",
    existingSkills: [],
    hoursPerWeek: 8,
    timelineMonths: 24,
    budget,
    workStyle: "onsite",
    motivations: ["growth"],
    educationLevel: "secondary",
    location: "Dubai, UAE",
    targetCountry: "United Arab Emirates",
  };
}

describe("career progression ladders", () => {
  it("maps Room Attendant towards Director without promising the final title in 24 months", () => {
    const input = profile("Room Attendant", "Director of Housekeeping");
    const report = applyCareerLadder(generateReport(input), input);
    expect(report.verdict).toContain("Housekeeping Supervisor");
    expect(report.verdict).toContain("not promise Director of Housekeeping");
    expect(report.steps).toHaveLength(8);
    expect(report.courses.every((course) => /employer-funded/i.test(course.cost))).toBe(true);
    expect(report.resume.summary).toContain("Housekeeping Coordinator or Senior Room Attendant");
    expect(report.resume.summary).not.toContain("Director of Housekeeping candidate");
    expect(report.interview.narrative).toContain("next gate");
  });

  it("maps HR Intern towards Director and protects private employee data", () => {
    const input = profile("HR Intern", "Director of HR", "500");
    const report = applyCareerLadder(generateReport(input), input);
    expect(report.verdict).toContain("HR Officer or HR Generalist");
    expect(report.snapshot.to).toBe("Director of HR");
    expect(report.projects.map((project) => project.description).join(" ")).toContain("Never copy real identity");
    expect(report.courses.some((course) => course.name.includes("CIPD Level 3"))).toBe(true);
    expect(report.networking.outreachTemplate).toContain("HR Coordinator");
  });

  it("does not change an unrelated report", () => {
    const input = profile("Barista", "Front Office Manager");
    const report = generateReport(input);
    expect(applyCareerLadder(report, input)).toBe(report);
  });
});
