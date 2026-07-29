"use client";

import { useState } from "react";
import { SECTION_META, type RoadmapReport } from "@/lib/types";
import { CoursesSection } from "./Sections";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function EmailGate({
  report,
  onUnlock,
}: {
  report: RoadmapReport;
  onUnlock: (email: string) => void;
}) {
  const locked = SECTION_META.filter((m) => !m.free);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();

    if (!EMAIL_RE.test(value)) {
      setError("That doesn't look like an email address.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value,
          from: report.snapshot.from,
          to: report.snapshot.to,
        }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      onUnlock(value);
    } catch {
      // The roadmap is already computed and sitting in the browser — refusing
      // to show it because a mailing-list call failed would be user-hostile.
      onUnlock(value);
    }
  }

  return (
    <div className="no-print">
      {/* Teaser: the real next section, blurred out under a fade */}
      <div className="relative">
        <div className="locked-blur" aria-hidden>
          <CoursesSection report={report} />
        </div>
        <div className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-b from-transparent via-paper/80 to-paper" />
      </div>

      <div className="relative -mt-16">
        <div className="overflow-hidden rounded-[2rem] border border-ink/[0.08] bg-paper-soft shadow-float">
          <div className="border-b border-ink/[0.07] px-8 py-10 text-center sm:px-12 sm:py-14">
            <span className="eyebrow">Free while in beta</span>
            <h2 className="mx-auto mt-4 max-w-xl font-display text-3xl font-semibold leading-tight tracking-tight text-ink text-balance sm:text-[2.6rem]">
              You&rsquo;ve seen the diagnosis. The rest is the treatment.
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-ink-soft">
              {locked.length} more sections: courses filtered to your budget, portfolio projects
              built on your {report.snapshot.from.toLowerCase()} background, salary stages, the
              interview narrative, an honest risk read, and your first 90 days on the job.
            </p>

            {/* Two real numbers from behind the gate. A figure the reader
                recognizes as their own outperforms another feature list. */}
            <div className="mx-auto mt-9 grid max-w-xl gap-3 sm:grid-cols-2">
              <Stat
                label="Difficulty rating"
                value={`${report.risk.difficulty}/10`}
                accent={report.risk.difficultyLabel}
                note="Section 11 explains why, and what to do about it."
              />
              <Stat
                label="First-role salary"
                value={report.salary[0]?.range ?? "—"}
                note="Three more stages in section 7."
              />
            </div>

            {/* ── The gate ─────────────────────────────────── */}
            <form onSubmit={submit} className="mx-auto mt-9 max-w-xl text-left" noValidate>
              <label htmlFor="gate-email" className="sr-only">
                Email address
              </label>
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <input
                  id="gate-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error") {
                      setStatus("idle");
                      setError(null);
                    }
                  }}
                  aria-invalid={status === "error"}
                  aria-describedby={error ? "gate-error" : "gate-note"}
                  disabled={status === "sending"}
                  className={`w-full min-w-0 flex-1 rounded-full border bg-paper px-6 py-4 text-ink placeholder:text-ink-faint/70 transition-colors focus:outline-none focus:ring-2 focus:ring-signal/60 disabled:opacity-60 ${
                    status === "error"
                      ? "border-clay focus:border-clay"
                      : "border-ink/15 focus:border-ever-bright"
                  }`}
                />
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="btn-signal shrink-0 whitespace-nowrap px-8 text-base disabled:opacity-70"
                >
                  {status === "sending" ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ever-night/30 border-t-ever-night" aria-hidden />
                      Unlocking
                    </>
                  ) : (
                    <>
                      Unlock the full roadmap
                      <span aria-hidden>→</span>
                    </>
                  )}
                </button>
              </div>

              {error ? (
                <p id="gate-error" role="alert" className="mt-3 text-sm text-clay">
                  {error}
                </p>
              ) : (
                <p id="gate-note" className="mt-3 text-sm leading-relaxed text-ink-faint">
                  Free, no card. We send one email with a link back to this roadmap — so it
                  survives closing the tab — and nothing else unless you ask for it.
                </p>
              )}
            </form>
          </div>

          <ul className="grid gap-px bg-ink/[0.06] sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((m) => (
              <li key={m.id} className="bg-paper-soft p-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 font-mono text-xs font-semibold text-ever-bright">
                    {String(m.n).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display font-semibold leading-snug text-ink">{m.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-faint">{m.blurb}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2" aria-hidden>
                  {[100, 82, 91, 64].map((w, i) => (
                    <div key={i} className="h-2 rounded-full bg-ink/[0.07]" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: string;
  accent?: string;
  note: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl bg-paper-deep/60 px-5 py-4 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-semibold leading-tight text-ink">
        {value}
        {accent && <span className="ml-1.5 text-base font-medium text-clay">{accent}</span>}
      </p>
      <p className="mt-auto pt-2 text-sm leading-relaxed text-ink-faint">{note}</p>
    </div>
  );
}
