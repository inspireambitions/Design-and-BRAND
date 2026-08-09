import { describe, expect, it } from "vitest";
import { parseAiRoadmap } from "./ai-response";

const valid = {
  matchScore: 50,
  verdict: "Test",
  snapshot: { from: "A", to: "B", months: 12, hoursPerWeek: 5, transferableCount: 1, estimatedCost: "Free" },
  skillGap: [{ skill: "Test", status: "need", priority: "high", howToAcquire: "Test" }],
  steps: Array.from({ length: 8 }, (_, index) => ({ title: `Step ${index + 1}`, duration: "One month", detail: "Test" })),
  timeline: [{ label: "Months 1–3", title: "Start", focus: "Test", actions: ["Test"], milestone: "Test" }],
  courses: [{ name: "Test", provider: "Test", cost: "Free", duration: "One month", rating: "Check", why: "Test", badge: "Verify" }],
  projects: [{ title: "Test", description: "Test", skills: ["Test"], effort: "One hour" }],
  risk: { difficulty: 5, difficultyLabel: "Test", successFactors: ["Test"], setbacks: [], planB: "Test" },
};

describe("parseAiRoadmap", () => {
  it("accepts a valid report object", () => {
    expect(parseAiRoadmap(JSON.stringify(valid))?.verdict).toBe("Test");
  });

  it("extracts JSON from a fenced response", () => {
    expect(parseAiRoadmap(`Here is the report:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``)?.steps).toHaveLength(8);
  });

  it("rejects malformed JSON", () => {
    expect(parseAiRoadmap('{"snapshot":')).toBeNull();
  });

  it("rejects a partial report that would break the UI", () => {
    expect(parseAiRoadmap(JSON.stringify({ snapshot: {}, steps: [] }))).toBeNull();
  });

  it("keeps usable AI fields when one core array is incomplete", () => {
    const patch = parseAiRoadmap(JSON.stringify({ verdict: "Useful analysis", steps: valid.steps.slice(0, 7) }));
    expect(patch?.verdict).toBe("Useful analysis");
    expect(patch?.steps).toHaveLength(7);
  });
});
