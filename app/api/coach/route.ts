import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { RoadmapReport } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const COACH_SYSTEM = `You are the career coach attached to a personalized transition roadmap the person has already received. They are mid-journey and asking follow-up questions.

Answer as their coach, not as a search engine. You have their roadmap in context — refer to it specifically ("your month 3–4 phase", "the portfolio project we planned around your teaching background") rather than giving advice that could apply to anyone.

Be direct and brief. Two or three short paragraphs is usually right; a list only when the answer genuinely is a list. If they ask something the roadmap already answers, point them to that section and add the one thing the roadmap could not say.

If they are anxious, take the worry seriously and then give them the next concrete action. Do not reassure without a next step.

Never invent facts about salaries, companies, or programs you are not confident about — say what you would check and where.`;

function reportDigest(report: RoadmapReport | null): string {
  if (!report) return "No roadmap available yet.";
  return JSON.stringify(
    {
      from: report.snapshot?.from,
      to: report.snapshot?.to,
      months: report.snapshot?.months,
      hoursPerWeek: report.snapshot?.hoursPerWeek,
      matchScore: report.matchScore,
      verdict: report.verdict,
      skillGap: report.skillGap,
      timeline: report.timeline,
      courses: report.courses?.map((c) => ({ name: c.name, provider: c.provider, cost: c.cost })),
      projects: report.projects,
      salary: report.salary,
      risk: report.risk,
    },
    null,
    1
  );
}

// Minimal in-process rate limit so an unauthenticated endpoint backed by a
// paid model can't be scripted against. Replace with a shared store (Redis,
// Upstash) the moment this runs on more than one instance.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;
const hits = new Map<string, number[]>();

function rateLimited(req: Request): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json(
      { reply: "You're asking faster than I can think. Give me a minute and try again." },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        reply:
          "The coach needs an ANTHROPIC_API_KEY set on the server to answer. Your roadmap above is complete and usable without it — everything in it was generated locally.",
      },
      { status: 200 }
    );
  }

  let body: { messages?: ChatTurn[]; report?: RoadmapReport } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = (body?.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()
  );
  if (messages.length === 0) {
    return NextResponse.json({ error: "No message provided." }, { status: 400 });
  }

  try {
    const client = new Anthropic();
    const stream = client.beta.messages.stream({
      model: "claude-opus-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Their roadmap:\n${reportDigest(body?.report ?? null)}` },
      ],
      messages: messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
    } as never);

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return NextResponse.json({
        reply: "I can't answer that one. Ask me anything about your roadmap, the timeline, or the job hunt itself.",
      });
    }

    const reply = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    return NextResponse.json({ reply: reply || "I didn't catch that — could you rephrase?" });
  } catch (err) {
    console.error("[coach] request failed:", err);
    return NextResponse.json(
      { reply: "The coach is temporarily unavailable. Your roadmap above is unaffected — try again in a moment." },
      { status: 200 }
    );
  }
}
