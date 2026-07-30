"use client";

import { useEffect, useRef, useState } from "react";
import type { RoadmapReport } from "@/lib/types";
import { apiUrl } from "@/lib/api";

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "What should I do in my first week?",
  "Is my timeline actually realistic?",
  "How do I explain this switch to my current employer?",
  "Which skill gap should I close first, and why?",
];

export function CoachDrawer({ report }: { report: RoadmapReport }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: message }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/coach"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, report }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setTurns([
        ...next,
        { role: "assistant", content: data.reply ?? data.error ?? "Something went wrong." },
      ]);
    } catch {
      setTurns([
        ...next,
        { role: "assistant", content: "I couldn't reach the server. Check your connection and try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        // Icon-only on small screens: at full width this button sits on top of
        // the email field and the report's own CTAs.
        className="no-print fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-full bg-ever-night p-4 font-medium text-paper-soft shadow-float transition-all hover:bg-ever-deep hover:shadow-glow sm:bottom-6 sm:right-6 sm:px-6 sm:py-4"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path
            d="M15.75 8.6a6.3 6.3 0 0 1-6.75 6.3 7 7 0 0 1-2.7-.5L2.25 15.75l1.4-4a6.1 6.1 0 0 1-.65-2.8 6.3 6.3 0 0 1 6.75-6.3 6.3 6.3 0 0 1 6 6z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="sr-only sm:not-sr-only">Ask your coach</span>
      </button>

      {open && (
        <div className="no-print fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 animate-fadeIn bg-ink/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-lg animate-rise flex-col bg-paper shadow-float">
            <div className="flex items-center justify-between border-b border-ink/[0.08] px-6 py-5">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">Your coach</h2>
                <p className="text-sm text-ink-faint">Knows your roadmap. Ask anything.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close coach"
                className="grid h-9 w-9 place-items-center rounded-full text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              {turns.length === 0 && (
                <div>
                  <p className="text-[15px] leading-relaxed text-ink-soft">
                    I&rsquo;ve read your roadmap — the {report.snapshot.from} to{" "}
                    {report.snapshot.to} transition over {report.snapshot.months} months.
                    What do you want to work through?
                  </p>
                  <div className="mt-5 space-y-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="w-full rounded-xl border border-ink/[0.09] bg-paper-soft px-4 py-3 text-left text-sm text-ink-soft transition-all hover:border-ever/50 hover:text-ink"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((t, i) => (
                <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                      t.role === "user"
                        ? "bg-ever-night text-paper-soft"
                        : "bg-paper-soft text-ink-soft"
                    }`}
                  >
                    {t.content}
                  </div>
                </div>
              ))}

              {busy && (
                <div className="flex gap-1.5 px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 animate-pulseSoft rounded-full bg-ink-faint"
                      style={{ animationDelay: `${i * 160}ms` }}
                    />
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="border-t border-ink/[0.08] p-4"
            >
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your plan…"
                  className="flex-1 rounded-xl border border-ink/12 bg-paper-soft px-4 py-3 text-ink placeholder:text-ink-faint focus:border-ever-bright focus:outline-none"
                />
                <button type="submit" disabled={busy || !input.trim()} className="btn-primary px-5 py-3 disabled:opacity-40">
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
