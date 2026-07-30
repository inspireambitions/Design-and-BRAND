import type { ReactNode } from "react";

export function Section({
  id,
  n,
  icon,
  title,
  children,
}: {
  id: string;
  n: number;
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ever-night font-mono text-sm font-semibold text-signal-tint">
          {n}
        </span>
        <span className="text-xl" aria-hidden>{icon}</span>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: "have" | "partial" | "need" }) {
  const map = {
    have: { label: "Have", cls: "bg-ever-night text-signal-tint" },
    partial: { label: "Partial", cls: "bg-signal text-white" },
    need: { label: "Need", cls: "bg-clay text-white" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: "high" | "medium" | "low" }) {
  const map = {
    high: "border-clay/50 text-clay",
    medium: "border-signal-deep text-ever-deep",
    low: "border-ink/20 text-ink-faint",
  } as const;
  return (
    <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${map[priority]}`}>
      {priority}
    </span>
  );
}

export function Bar({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]" role="img" aria-label={label}>
      <div
        className="h-full animate-growBar rounded-full bg-gradient-to-r from-ever-deep to-ever-bright"
        style={{ ["--bar-w" as string]: `${Math.max(4, Math.min(100, pct))}%`, width: `${Math.max(4, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
