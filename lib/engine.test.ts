import { describe, expect, it } from "vitest";
import { generateReport } from "./engine";
import { INDUSTRY_SKILLS } from "./industry-data";
import type { Profile } from "./types";

function profile(industry: string): Profile {
  return {
    mode: industry === "hospitality" ? "hospitality" : "general",
    industry,
    currentIndustry: industry,
    targetIndustry: industry,
    currentRole: "Entry-level worker",
    targetRole: `Specialist role in ${industry}`,
    yearsExperience: "0-2",
    existingSkills: [],
    hoursPerWeek: 8,
    timelineMonths: 12,
    budget: "free",
    workStyle: "onsite",
    motivations: ["growth"],
    educationLevel: "secondary",
    location: "Dubai, UAE",
    targetCountry: "United Arab Emirates",
  };
}

describe("industry-aware generic reports", () => {
  it.each(Object.entries(INDUSTRY_SKILLS))("uses %s competencies and an adjacent Plan B", (industry, skills) => {
    const report = generateReport(profile(industry));
    expect(report.skillGap.map((item) => item.skill)).toContain(skills[0]);
    expect(report.risk.planB).toContain("adjacent route");
  });
});
