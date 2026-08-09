import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { generateReport } from "@/lib/engine";
import { buildCoreUserPrompt, SYSTEM_PROMPT } from "@/lib/prompt";
import { CORE_REPORT_SCHEMA } from "@/lib/schema";
import { parseAiRoadmap } from "@/lib/ai-response";
import { applyCareerSafetyGuards, needsClinicalPrerequisiteGuard, rolesAreIdentical } from "@/lib/career-safety";
import { applyCareerLadder } from "@/lib/career-ladders";
import { applyPlanningConstraints, targetRoleError } from "@/lib/planning-constraints";
import type { Profile, RoadmapReport } from "@/lib/types";
import { INDUSTRY_OPTIONS } from "@/lib/industry-data";

export const runtime = "nodejs";
export const maxDuration = 300;

const WINDOW_MS = 60_000;
// Allow a user to revise several answers or compare a few paths without being
// mistaken for abuse. Ten full reports per minute is still well beyond normal
// use, while keeping a useful guard on the unauthenticated endpoint.
const MAX_PER_WINDOW = 10;
const hits = new Map<string, number[]>();

function rateLimited(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, values] of hits) if (values.every((time) => now - time >= WINDOW_MS)) hits.delete(key);
  }
  return recent.length > MAX_PER_WINDOW;
}

function validProfile(body: unknown): body is Profile {
  const p = body as Partial<Profile> | null;
  return !!p && typeof p.currentRole === "string" && typeof p.targetRole === "string" && p.currentRole.trim().length > 0 && p.targetRole.trim().length > 0;
}

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ error: "Please wait a minute before building another roadmap." }, { status: 429 });
  }

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

  const clean = (value: unknown, max = 160) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const cleanList = (value: unknown, maxItems = 30) =>
    (Array.isArray(value) ? value : []).slice(0, maxItems).map((item) => clean(item, 100)).filter(Boolean);
  const allowedIndustries = new Set(INDUSTRY_OPTIONS.map((item) => item.value));
  const normalIndustry = (value: unknown) => {
    const requested = clean(value, 40).toLowerCase();
    return allowedIndustries.has(requested as (typeof INDUSTRY_OPTIONS)[number]["value"])
      ? requested
      : "other";
  };
  const requestedIndustry = normalIndustry(body.targetIndustry || body.industry);
  const requestedCurrentIndustry = normalIndustry(body.currentIndustry || body.industry);
  const profile: Profile = {
    ...body,
    currentRole: clean(body.currentRole),
    targetRole: clean(body.targetRole),
    existingSkills: cleanList(body.existingSkills),
    motivations: cleanList(body.motivations, 12),
    languages: cleanList(body.languages, 20),
    certificationsHeld: cleanList(body.certificationsHeld, 20),
    hoursPerWeek: Math.max(2, Math.min(40, Number(body.hoursPerWeek) || 10)),
    timelineMonths: [6, 12, 18, 24].includes(Number(body.timelineMonths)) ? Number(body.timelineMonths) : 12,
    budget: clean(body.budget, 20) || "free",
    workStyle: clean(body.workStyle, 20) || "any",
    yearsExperience: clean(body.yearsExperience, 20) || "0-2",
    mode: body.mode === "hospitality" ? "hospitality" : "general",
    industry: body.mode === "hospitality" || requestedIndustry === "hospitality"
      ? "hospitality"
      : requestedIndustry,
    currentIndustry: requestedCurrentIndustry,
    targetIndustry: requestedIndustry,
    otherIndustry: clean(body.otherIndustry, 100),
    directionMode: body.directionMode === "known" || body.directionMode === "grow" ? body.directionMode : "explore",
    location: clean(body.location),
    targetCountry: clean(body.targetCountry, 80),
    careerGoal: clean(body.careerGoal, 80),
    careerBarrier: clean(body.careerBarrier, 80),
    careerBarriers: cleanList(body.careerBarriers, 3),
    otherBarrier: clean(body.otherBarrier, 220),
    educationLevel: clean(body.educationLevel, 40),
    supportAvailable: clean(body.supportAvailable, 40),
    relocationStatus: clean(body.relocationStatus, 40),
    gccExperience: clean(body.gccExperience, 40),
    workAuthorizationStatus: clean(body.workAuthorizationStatus, 60),
    industryContact: clean(body.industryContact, 40),
    jobSearchStage: clean(body.jobSearchStage, 40),
    customerFacingExperience: clean(body.customerFacingExperience, 40),
  };

  if (rolesAreIdentical(profile.currentRole, profile.targetRole)) {
    return NextResponse.json(
      { error: "Your current and target roles are the same. Choose the next role you want, such as supervisor, manager or specialist." },
      { status: 422 }
    );
  }

  const invalidTarget = targetRoleError(profile.targetRole);
  if (invalidTarget) {
    return NextResponse.json({ error: invalidTarget }, { status: 422 });
  }

  // The deterministic engine is both the no-API-key path and the safety net.
  const fallback = applyPlanningConstraints(
    applyCareerLadder(applyCareerSafetyGuards(generateReport(profile), profile), profile),
    profile
  );

  if (needsClinicalPrerequisiteGuard(profile)) {
    console.info("[roadmap] regulated clinical prerequisites missing; serving guarded report", {
      from: profile.currentRole,
      to: profile.targetRole,
    });
    return NextResponse.json(fallback);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(fallback);
  }

  try {
    const client = new Anthropic({
      maxRetries: 0,
      timeout: 105_000,
    });

    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 90_000);
    let message;
    try {
      const stream = client.beta.messages.stream({
        model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
        max_tokens: 7000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort: "low",
        },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [{
          role: "user",
          content: `${buildCoreUserPrompt(profile)}\n\nReturn one JSON object matching this schema exactly:\n${JSON.stringify(CORE_REPORT_SCHEMA)}`,
        }],
      } as never, { signal: controller.signal });

      message = await stream.finalMessage();
    } finally {
      clearTimeout(deadline);
    }

    if (message.stop_reason === "refusal") {
      console.warn("[roadmap] Claude refused; serving engine report");
      return NextResponse.json(fallback);
    }

    const text = message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return NextResponse.json(fallback);

    const parsed = parseAiRoadmap(text.text);
    if (!parsed) {
      console.error("[roadmap] Claude returned invalid report JSON; serving engine report", {
        stopReason: message.stop_reason,
        responseId: message.id,
      });
      return NextResponse.json(fallback);
    }

    // Merge over the engine output so a partially-shaped response still renders.
    const report: RoadmapReport = applyPlanningConstraints(
      applyCareerLadder(applyCareerSafetyGuards({
        ...fallback,
        ...parsed,
        snapshot: { ...fallback.snapshot, ...(parsed.snapshot ?? {}) },
        generatedBy: "ai",
      }, profile), profile),
      profile
    );

    console.info("[roadmap] Claude report generated", {
      responseId: message.id,
      from: profile.currentRole,
      to: profile.targetRole,
    });

    return NextResponse.json(report);
  } catch (err) {
    console.error("[roadmap] generation failed, serving engine report:", err);
    return NextResponse.json(fallback);
  }
}
