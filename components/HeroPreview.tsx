// A static, faithful miniature of the real report header — so the landing page
// shows the product instead of only describing it.
export function HeroPreview() {
  return (
    <div className="relative select-none" aria-hidden>
      <div className="absolute -inset-6 rounded-[2.5rem] bg-signal/25 blur-3xl" />

      {/* back card */}
      <div className="absolute -right-3 top-8 hidden h-full w-full rotate-[3deg] rounded-[1.75rem] border border-ink/[0.06] bg-paper-soft/70 sm:block" />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-ink/[0.07] bg-paper-soft shadow-float">
        {/* report header */}
        <div className="relative overflow-hidden bg-ever-night px-6 py-6 text-paper-soft">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-signal/20 blur-2xl" />
          <div className="relative">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-signal-tint">
              Your roadmap
            </span>
            <p className="mt-3 font-display text-xl font-semibold leading-tight">
              Teacher <span className="text-signal-tint">→</span> UX Designer
            </p>
            <div className="mt-4 flex items-end gap-3">
              <span className="font-display text-3xl font-semibold text-signal-tint">82</span>
              <span className="pb-1 text-xs text-paper-soft/60">/ 100 match</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-paper-soft/15">
              <div className="h-full w-[82%] rounded-full bg-signal" />
            </div>
          </div>
        </div>

        {/* mini skill gap */}
        <div className="px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
            Skill gap analysis
          </p>
          <div className="mt-3 space-y-2.5">
            {[
              { s: "User research", t: "Have", cls: "bg-ever-night text-signal-tint" },
              { s: "Figma & prototyping", t: "Need", cls: "bg-clay text-white" },
              { s: "Information architecture", t: "Need", cls: "bg-clay text-white" },
              { s: "Stakeholder comms", t: "Partial", cls: "bg-signal text-white" },
            ].map((r) => (
              <div key={r.s} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-ink-soft">{r.s}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.cls}`}>
                  {r.t}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* mini timeline */}
        <div className="border-t border-ink/[0.06] px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
            Month-by-month
          </p>
          <div className="mt-3 space-y-2.5 border-l-2 border-ink/[0.08] pl-4">
            {[
              ["Months 1–3", "Foundations"],
              ["Months 4–6", "First portfolio piece"],
              ["Months 7–9", "Proof & positioning"],
            ].map(([m, t]) => (
              <div key={m} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-ever-bright" />
                <p className="font-mono text-[10px] text-ever-bright">{m}</p>
                <p className="text-sm text-ink">{t}</p>
              </div>
            ))}
          </div>
        </div>

        {/* locked teaser */}
        <div className="relative border-t border-ink/[0.06] px-6 pb-6 pt-5">
          <div className="space-y-2 blur-[3px]">
            {[100, 78, 92, 60].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-ink/[0.09]" style={{ width: `${w}%` }} />
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 top-0 grid place-items-center bg-gradient-to-b from-transparent to-paper-soft">
            <span className="mt-6 rounded-full bg-ever-night px-3.5 py-1.5 text-xs font-medium text-paper-soft">
              🔒 9 more sections
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
