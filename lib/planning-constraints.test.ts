import { describe, expect, it } from "vitest";
import { generateReport } from "./engine";
import { applyPlanningConstraints, targetRoleError } from "./planning-constraints";
import type { Profile } from "./types";

const profile: Profile = {
  currentRole: "Shop Assistant",
  targetRole: "Customer Service Supervisor",
  yearsExperience: "3-5",
  existingSkills: ["Customer service"],
  hoursPerWeek: 4,
  timelineMonths: 6,
  budget: "free",
  workStyle: "onsite",
  motivations: ["growth"],
};

describe("planning constraints", () => {
  it("asks for a real target role when the input is nonsense", () => {
    expect(targetRoleError("zzzzzz")).toContain("could not recognise");
    expect(targetRoleError("test")).toContain("could not recognise");
  });

  it("blocks instructions to bypass licensing", () => {
    expect(targetRoleError("unlicensed nurse")).toContain("cannot help");
  });

  it("accepts a normal target title", () => {
    expect(targetRoleError("Director of HR")).toBeNull();
  });

  it("treats a tight deadline as a planning window, not a promise", () => {
    const report = applyPlanningConstraints(generateReport(profile), profile);
    expect(report.verdict).toContain("does not guarantee");
    expect(report.risk.setbacks[0].mitigation).toContain("extend the date");
  });
});
