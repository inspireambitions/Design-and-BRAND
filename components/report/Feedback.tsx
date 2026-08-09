"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/api";
import type { RoadmapReport } from "@/lib/types";

export function Feedback({ report, email }: { report: RoadmapReport; email: string | null }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!vote || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vote,
          note,
          email,
          mode: report.mode,
          from: report.snapshot.from,
          to: report.snapshot.to,
        }),
      });
      const data = (await res.json().catch(() => null)) as { delivered?: boolean } | null;
      if (!res.ok || !data?.delivered) throw new Error("feedback_not_delivered");
      setSent(true);
    } catch {
      setError("We could not send your feedback. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="no-print rounded-2xl border border-ink/[0.07] bg-paper-soft px-6 pb-20 pt-5 text-center sm:py-5">
        <p className="text-[15px] text-ink-soft">
          Thank you. Your feedback was sent to Inspire Ambitions.
        </p>
      </div>
    );
  }

  return (
    <div className="no-print rounded-2xl border border-ink/[0.07] bg-paper-soft px-6 pb-20 pt-5 sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-medium text-ink">Was this roadmap useful?</p>
        <div className="flex gap-2">
          <button
            onClick={() => setVote("up")}
            aria-pressed={vote === "up"}
            className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              vote === "up"
                ? "border-ever-deep bg-ever-night text-paper-soft"
                : "border-ink/15 text-ink-soft hover:border-ever hover:text-ever-deep"
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => setVote("down")}
            aria-pressed={vote === "down"}
            className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              vote === "down"
                ? "border-clay bg-clay text-white"
                : "border-ink/15 text-ink-soft hover:border-clay hover:text-clay"
            }`}
          >
            No
          </button>
        </div>
      </div>

      {vote && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="mt-4 animate-fadeIn"
        >
          <label htmlFor="fb" className="block text-sm text-ink-soft">
            {vote === "up"
              ? "What was the most useful part?"
              : "What was missing or wrong? This is the fastest way to get it fixed."}
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="fb"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              maxLength={1200}
              className="min-h-11 flex-1 rounded-xl border border-ink/12 bg-paper px-4 py-2.5 text-ink placeholder:text-ink-faint focus:border-ever-bright focus:outline-none"
            />
            <button type="submit" disabled={busy} className="btn-ghost px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            This sends your rating, comment and career route to Inspire Ambitions. Your email is included only if you used it to unlock the report.
          </p>
          {error && <p className="mt-2 text-sm text-clay" role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}
