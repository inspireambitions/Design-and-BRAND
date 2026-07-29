import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Same shape of guard as /api/coach — this endpoint is unauthenticated.
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

export async function POST(req: Request) {
  if (rateLimited(req)) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: { email?: string; from?: string; to?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const record = {
    email,
    from: (body.from ?? "").slice(0, 120),
    to: (body.to ?? "").slice(0, 120),
    at: new Date().toISOString(),
  };

  // Forward to whatever list you use. Set SUBSCRIBE_WEBHOOK_URL to a Zapier
  // catch-hook, a ConvertKit/Loops/Resend endpoint, or your own handler. With
  // nothing configured the address is logged and dropped — wire this before
  // promising anyone a follow-up email.
  const hook = process.env.SUBSCRIBE_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } catch (err) {
      console.error("[subscribe] webhook failed", err);
      // Still a success for the caller — the roadmap is theirs either way.
    }
  } else {
    console.log("[subscribe] captured (no SUBSCRIBE_WEBHOOK_URL set)", record);
  }

  return NextResponse.json({ ok: true });
}
