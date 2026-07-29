"use client";

import { useState } from "react";

export function Feedback() {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="no-print rounded-2xl border border-ink/[0.07] bg-paper-soft px-6 py-5 text-center">
        <p className="text-[15px] text-ink-soft">
          Thanks — noted. That&rsquo;s how the roadmaps get better.
        </p>
      </div>
    );
  }

  return (
    <div className="no-print rounded-2xl border border-ink/[0.07] bg-paper-soft px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-medium text-ink">Was this roadmap useful?</p>
        <div className="flex gap-2">
          <button
            onClick={() => setVote("up")}
            aria-pressed={vote === "up"}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              vote === "up"
                ? "border-ever-deep bg-ever-night text-paper-soft"
                : "border-ink/15 text-ink-soft hover:border-ever hover:text-ever-deep"
            }`}
          >
            👍 Yes
          </button>
          <button
            onClick={() => setVote("down")}
            aria-pressed={vote === "down"}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              vote === "down"
                ? "border-clay bg-clay text-white"
                : "border-ink/15 text-ink-soft hover:border-clay hover:text-clay"
            }`}
          >
            👎 No
          </button>
        </div>
      </div>

      {vote && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Wire this to your analytics or a /api/feedback route.
            setSent(true);
          }}
          className="mt-4 animate-fadeIn"
        >
          <label htmlFor="fb" className="block text-sm text-ink-soft">
            {vote === "up"
              ? "What was the most useful part?"
              : "What was missing or wrong? This is the fastest way to get it fixed."}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="fb"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
              className="flex-1 rounded-xl border border-ink/12 bg-paper px-4 py-2.5 text-ink placeholder:text-ink-faint focus:border-ever-bright focus:outline-none"
            />
            <button type="submit" className="btn-ghost px-5 py-2.5 text-sm">
              Send
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
