import type { RoadmapReport } from "./types";

export type AiRoadmapPatch = Omit<RoadmapReport, "generatedBy">;

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
    if (!isObject(value.snapshot)) return null;
    if (!Array.isArray(value.skillGap) || value.skillGap.length === 0) return null;
    if (!Array.isArray(value.steps) || value.steps.length !== 8) return null;
    if (!Array.isArray(value.timeline) || value.timeline.length === 0) return null;
    return value as AiRoadmapPatch;
  } catch {
    return null;
  }
}
