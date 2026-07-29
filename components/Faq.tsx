"use client";

import { useState } from "react";

const ITEMS = [
  {
    q: "How is this different from asking a chatbot?",
    a: "A chatbot gives you an answer. This gives you a plan with a structure behind it: twelve sections that cover the whole transition, sequenced against the hours you actually have, with a portfolio strategy built around your specific background. It also holds itself to your budget — if you said free-only, every course it names is free.",
  },
  {
    q: "Is the plan actually personalized, or a template with my job title dropped in?",
    a: "Personalized. Your hours per week determine how much fits in each phase, your budget filters the course recommendations, your existing skills change which gaps get flagged as high-priority, and your current field drives the portfolio projects — the whole point is finding the leverage your background gives you.",
  },
  {
    q: "What if my target career isn't a common one?",
    a: "The generator handles any role. For the most common transitions it draws on curated data — real course prices, salary bands, named communities. For less common targets it still produces the full twelve-section plan, and tells you where to verify the specifics yourself rather than inventing them.",
  },
  {
    q: "Will it tell me if my plan is unrealistic?",
    a: "Yes, and that's deliberate. The risk section gives an honest difficulty rating, names the setbacks that actually derail people at your specific transition, and includes a Plan B that reuses most of the same preparation. If your timeline doesn't fit your available hours, it says so in the verdict rather than producing a fantasy schedule.",
  },
  {
    q: "How long does it take?",
    a: "Roughly three minutes to answer the questions, then under a minute to generate. You see the first three sections immediately.",
  },
  {
    q: "What's the refund policy?",
    a: "Thirty days, no questions. If the roadmap doesn't give you something you can act on, it hasn't earned the money.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-ink/[0.08] overflow-hidden rounded-3xl border border-ink/[0.08] bg-paper-soft">
      {ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left transition-colors hover:bg-paper-deep/40 sm:px-8"
            >
              <span className="font-display text-lg font-semibold text-ink">{item.q}</span>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink/15 text-ink-soft transition-transform duration-300 ${
                  isOpen ? "rotate-45 border-ever bg-ever-night text-signal" : ""
                }`}
                aria-hidden
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            <div
              className={`grid transition-all duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-6 text-[15px] leading-relaxed text-ink-soft sm:px-8">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
