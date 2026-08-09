import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(req: Request): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, values] of hits) {
      if (values.every((time) => now - time >= WINDOW_MS)) hits.delete(key);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

interface FeedbackBody {
  vote?: "up" | "down";
  note?: string;
  email?: string | null;
  mode?: string;
  from?: string;
  to?: string;
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max) : "";

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ delivered: false, error: "rate_limited" }, { status: 429 });
  }

  let body: FeedbackBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ delivered: false, error: "bad_json" }, { status: 400 });
  }

  if (body.vote !== "up" && body.vote !== "down") {
    return NextResponse.json({ delivered: false, error: "invalid_vote" }, { status: 400 });
  }

  const key = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL?.trim();
  if (!key || !ownerEmail || !EMAIL_RE.test(ownerEmail)) {
    return NextResponse.json({ delivered: false, error: "email_not_configured" }, { status: 503 });
  }

  const email = clean(body.email, 254);
  const from = clean(body.from, 120) || "Not provided";
  const to = clean(body.to, 120) || "Not provided";
  const note = clean(body.note, 1200) || "No written comment";
  const route = clean(body.mode, 40) === "hospitality" ? "Hospitality career path" : "Career change roadmap";
  const userEmail = EMAIL_RE.test(email) ? email : "Not provided";
  const helpful = body.vote === "up" ? "Yes" : "No";

  const text = [
    "A user sent feedback on the Inspire Ambitions AI Career Coach.",
    `Useful: ${helpful}`,
    `Comment: ${note}`,
    `Email: ${userEmail}`,
    `Route: ${route}`,
    `From: ${from}`,
    `To: ${to}`,
    `Sent: ${new Date().toISOString()}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || BRAND.emailFrom,
        to: [ownerEmail],
        subject: `Career Coach feedback: ${helpful} — ${from} to ${to}`.slice(0, 180),
        text,
      }),
    });

    if (!response.ok) {
      console.error("[feedback] Resend rejected feedback", response.status);
      return NextResponse.json({ delivered: false, error: "resend_rejected" }, { status: 502 });
    }
    return NextResponse.json({ delivered: true });
  } catch (error) {
    console.error("[feedback] Resend request failed", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ delivered: false, error: "send_failed" }, { status: 502 });
  }
}
