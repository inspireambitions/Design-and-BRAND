"use client";

import { useState } from "react";

const ITEMS = [
  {
    q: "How is this different from asking a chatbot?",
    a: "A chatbot gives you a conversation. This gives you a structured report: twelve sections sequenced around the time and budget you actually have, with training checks, safe evidence tasks, risks and Plan B.",
  },
  {
    q: "Is the plan actually personalised, or a template with my job title dropped in?",
    a: "It uses your current and target industries, country, role, experience, education, existing skills, time, budget, support and biggest barrier. It is still career guidance, not a validated test of your personality or ability.",
  },
  {
    q: "What if my target career isn't a common one?",
    a: "You can type any role. Common routes use a curated planning base. Less common routes still receive the full structure, but the report tells you which current local facts must be checked rather than inventing them.",
  },
  {
    q: "Will it tell me if my plan is unrealistic?",
    a: "Yes. The report uses a broad planning-difficulty label, names likely setbacks and includes a Plan B that reuses much of the same preparation. It does not pretend to predict whether you will be hired.",
  },
  {
    q: "How long does it take?",
    a: "Most people need four to seven minutes for the eight questions. The report usually takes a few seconds to build, but an AI-assisted route can take longer.",
  },
  {
    q: "What do you do with my email address?",
    a: "Your email unlocks copying and PDF saving. We try to send your starting steps. Inspire Ambitions also receives your email address and career route so we know the tool was completed. You are not added to a newsletter. The full report stays privately in this browser unless you copy, print or share it.",
  },
  {
    q: "Why is it free? What's the catch?",
    a: "It is in beta and we would rather have feedback than revenue right now. Every roadmap marked unhelpful teaches us something. It may cost money later. Roadmaps generated during the beta stay yours either way.",
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
                  isOpen ? "rotate-45 border-ever bg-ever-night text-signal-tint" : ""
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
