import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";
import { roadmapEmailHtml, roadmapEmailText, type RoadmapEmailData } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Same guard as /api/coach — this endpoint is unauthenticated and now spends
// real Resend quota, so it is rate limited per IP.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
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

interface Body {
  email?: string;
  from?: string;
  to?: string;
  months?: number;
  hoursPerWeek?: number;
  matchBand?: string;
  difficulty?: number;
  difficultyLabel?: string;
  steps?: { title?: string; duration?: string }[];
}

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const str = (v: unknown, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
  const data: RoadmapEmailData = {
    from: str(body.from) || "your current role",
    to: str(body.to) || "your target role",
    months: Number.isFinite(body.months) ? Number(body.months) : 12,
    hoursPerWeek: Number.isFinite(body.hoursPerWeek) ? Number(body.hoursPerWeek) : 10,
    matchBand: str(body.matchBand, 60) || "Achievable with focus",
    difficulty: Number.isFinite(body.difficulty) ? Number(body.difficulty) : 5,
    difficultyLabel: str(body.difficultyLabel, 40) || "Moderate",
    steps: (Array.isArray(body.steps) ? body.steps : [])
      .slice(0, 12)
      .map((s) => ({ title: str(s?.title, 200), duration: str(s?.duration, 40) }))
      .filter((s) => s.title),
    siteUrl: `https://${BRAND.domain}${BRAND.basePath}`,
  };

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // No key configured: the address is logged and dropped. The gate copy
    // promises an email, so this path must not survive into production.
    console.warn("[subscribe] RESEND_API_KEY not set — logging only", {
      email,
      from: data.from,
      to: data.to,
      at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, delivered: false });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || BRAND.emailFrom,
        to: [email],
        subject: `Your career change roadmap: ${data.from} → ${data.to}`,
        html: roadmapEmailHtml(data),
        text: roadmapEmailText(data),
        headers: { "X-Entity-Ref-ID": `roadmap-${Date.now()}` },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[subscribe] resend rejected", res.status, detail.slice(0, 400));
      // The roadmap is already in the user's browser. A mail failure is our
      // problem, not theirs — report success and unlock.
      return NextResponse.json({ ok: true, delivered: false });
    }

    return NextResponse.json({ ok: true, delivered: true });
  } catch (err) {
    console.error("[subscribe] resend threw", err);
    return NextResponse.json({ ok: true, delivered: false });
  }
}

export const runtime = "nodejs";
