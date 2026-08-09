import type { RoadmapReport } from "./types";

export type AiRoadmapPatch = Partial<Omit<RoadmapReport, "generatedBy">>;

function extractJsonObject(text: string): string | null {
  const source = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = source.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAiRoadmap(text: string): AiRoadmapPatch | null {
  const json = extractJsonObject(text);
  if (!json) return null;

  try {
    const value: unknown = JSON.parse(json);
    if (!isObject(value)) return null;
    const patch: AiRoadmapPatch = {};
    if (typeof value.verdict === "string" && value.verdict.trim()) patch.verdict = value.verdict;
    if (isObject(value.snapshot) && Object.keys(value.snapshot).length) patch.snapshot = value.snapshot as RoadmapReport["snapshot"];
    if (Array.isArray(value.skillGap) && value.skillGap.length) patch.skillGap = value.skillGap as RoadmapReport["skillGap"];
    if (Array.isArray(value.steps) && value.steps.length) patch.steps = value.steps as RoadmapReport["steps"];
    if (Array.isArray(value.courses) && value.courses.length) patch.courses = value.courses as RoadmapReport["courses"];

    return Object.keys(patch).length ? patch : null;
  } catch {
    return null;
  }
}
