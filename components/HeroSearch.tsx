"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SUGGESTIONS = [
  ["Teacher", "UX Designer"],
  ["Nurse", "Product Manager"],
  ["Accountant", "Data Analyst"],
  ["Retail Manager", "Software Engineer"],
  ["Journalist", "Digital Marketer"],
  ["Military", "Cybersecurity Analyst"],
];

export function HeroSearch() {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function go(e?: React.FormEvent) {
    e?.preventDefault();
    const params = new URLSearchParams();
    if (from.trim()) params.set("from", from.trim());
    if (to.trim()) params.set("to", to.trim());
    router.push(`/start${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="w-full">
      <form
        onSubmit={go}
        className="flex flex-col gap-3 rounded-[28px] border border-ink/[0.08] bg-paper-soft p-3 shadow-float sm:flex-row sm:items-center sm:gap-2"
      >
        <div className="flex flex-1 items-center gap-3 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">From</span>
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="Teacher"
            aria-label="Your current role"
            className="w-full bg-transparent text-lg text-ink placeholder:text-ink-faint/60 focus:outline-none"
          />
        </div>
        <div className="hidden h-8 w-px bg-ink/10 sm:block" aria-hidden />
        <div className="flex flex-1 items-center gap-3 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-faint">To</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="UX Designer"
            aria-label="Your target role"
            className="w-full bg-transparent text-lg text-ink placeholder:text-ink-faint/60 focus:outline-none"
          />
        </div>
        <button type="submit" className="btn-signal shrink-0 text-base">
          Build my roadmap
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-ink-faint">Popular:</span>
        {SUGGESTIONS.map(([a, b]) => (
          <button
            key={a + b}
            type="button"
            onClick={() => {
              setFrom(a);
              setTo(b);
            }}
            className="rounded-full border border-ink/10 bg-paper-soft/60 px-3 py-1.5 text-sm text-ink-soft transition-all hover:border-ever hover:bg-paper-soft hover:text-ever-deep"
          >
            {a} → {b}
          </button>
        ))}
      </div>
    </div>
  );
}
