import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { generateReport } from "@/lib/engine";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/prompt";
import { REPORT_SCHEMA } from "@/lib/schema";
import type { Profile, RoadmapReport } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function validProfile(body: unknown): body is Profile {
  const p = body as Partial<Profile> | null;
  return !!p && typeof p.currentRole === "string" && typeof p.targetRole === "string" && p.currentRole.trim().length > 0 && p.targetRole.trim().length > 0;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!validProfile(body)) {
    return NextResponse.json(
      { error: "A current role and a target role are required." },
      { status: 400 }
    );
  }

  const profile: Profile = {
    ...body,
    existingSkills: Array.isArray(body.existingSkills) ? body.existingSkills : [],
    motivations: Array.isArray(body.motivations) ? body.motivations : [],
    hoursPerWeek: Number(body.hoursPerWeek) || 10,
    timelineMonths: Number(body.timelineMonths) || 12,
    budget: body.budget || "500",
    workStyle: body.workStyle || "any",
    yearsExperience: body.yearsExperience || "3-5",
  };

  // The deterministic engine is both the no-API-key path and the safety net.
  const fallback = generateReport(profile);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(fallback);
  }

  try {
    const client = new Anthropic();

    const stream = client.beta.messages.stream({
      model: "claude-opus-5",
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: REPORT_SCHEMA },
      },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: buildUserPrompt(profile) }],
    } as never);

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return NextResponse.json(fallback);
    }

    const text = message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return NextResponse.json(fallback);

    const parsed = JSON.parse(text.text) as Omit<RoadmapReport, "generatedBy">;

    // Merge over the engine output so a partially-shaped response still renders.
    const report: RoadmapReport = {
      ...fallback,
      ...parsed,
      snapshot: { ...fallback.snapshot, ...(parsed.snapshot ?? {}) },
      generatedBy: "ai",
    };

    return NextResponse.json(report);
  } catch (err) {
    console.error("[roadmap] generation failed, serving engine report:", err);
    return NextResponse.json(fallback);
  }
}
