"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { POPULAR_TARGETS } from "@/lib/careers-data";
import { store } from "@/lib/storage";
import type { Profile } from "@/lib/types";
import { apiUrl } from "@/lib/api";

const SKILL_BANK = [
  "Communication", "Project management", "Data analysis", "Writing", "Public speaking",
  "Teaching / training", "Customer service", "Sales", "Budgeting", "Team leadership",
  "Research", "Problem solving", "Excel / Sheets", "SQL", "Python", "JavaScript",
  "Design tools (Figma/Adobe)", "Marketing", "Operations", "Negotiation",
];

const MOTIVATIONS = [
  { id: "money", label: "Better pay", icon: "💰" },
  { id: "growth", label: "Room to grow", icon: "📈" },
  { id: "flexibility", label: "Flexibility / remote", icon: "🌍" },
  { id: "meaning", label: "More meaningful work", icon: "🎯" },
  { id: "burnout", label: "Escaping burnout", icon: "🔋" },
  { id: "interest", label: "Genuine interest in the field", icon: "✨" },
  { id: "stability", label: "Job security", icon: "🛡️" },
  { id: "autonomy", label: "More autonomy", icon: "🔓" },
];

const TOTAL_STEPS = 8;

const empty: Profile = {
  currentRole: "",
  targetRole: "",
  yearsExperience: "3-5",
  existingSkills: [],
  hoursPerWeek: 10,
  timelineMonths: 12,
  budget: "500",
  workStyle: "any",
  motivations: [],
  location: "",
};

export function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(empty);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customSkill, setCustomSkill] = useState("");

  useEffect(() => {
    const from = params.get("from") ?? "";
    const to = params.get("to") ?? "";
    const saved = store.loadProfile();
    setP((prev) => ({
      ...prev,
      ...(saved ?? {}),
      ...(from ? { currentRole: from } : {}),
      ...(to ? { targetRole: to } : {}),
    }));
  }, [params]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const toggle = (key: "existingSkills" | "motivations", value: string) =>
    setP((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((x) => x !== value) : [...prev[key], value],
    }));

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0: return p.currentRole.trim().length > 1;
      case 1: return p.targetRole.trim().length > 1;
      default: return true;
    }
  }, [step, p.currentRole, p.targetRole]);

  async function generate() {
    setGenerating(true);
    setError(null);
    store.saveProfile(p);
    try {
      const res = await fetch(apiUrl("/api/roadmap"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Generation failed.");
      }
      const report = await res.json();
      store.saveReport(report);
      store.setUnlocked(false);
      router.push("/report");
    } catch (e) {
      setGenerating(false);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  function next() {
    if (step === TOTAL_STEPS - 1) return void generate();
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }

  if (generating) return <GeneratingScreen from={p.currentRole} to={p.targetRole} />;

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* progress */}
      <div className="mb-10">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium text-ink-soft">
            Question {step + 1} of {TOTAL_STEPS}
          </span>
          <span className="font-mono text-ink-faint">
            {Math.round(((step + 1) / TOTAL_STEPS) * 100)}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]">
          <div
            className="h-full rounded-full bg-ever-night transition-[width] duration-500 ease-out"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div key={step} className="animate-rise">
        {step === 0 && (
          <Step title="What do you do right now?" hint="Your current job title — close enough is fine.">
            <input
              autoFocus
              value={p.currentRole}
              onChange={(e) => set("currentRole", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canAdvance && next()}
              placeholder="e.g. High school teacher"
              className="input-lg"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {["Teacher", "Nurse", "Accountant", "Retail Manager", "Administrative Assistant", "Sales Rep", "Recent Graduate"].map((r) => (
                <button key={r} type="button" onClick={() => set("currentRole", r)} className={`chip ${p.currentRole === r ? "chip-active" : ""}`}>
                  {r}
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title="Where are you trying to get to?" hint="Any role works — the popular ones come with curated salary and course data.">
            <input
              autoFocus
              value={p.targetRole}
              onChange={(e) => set("targetRole", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canAdvance && next()}
              placeholder="e.g. UX Designer"
              className="input-lg"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {POPULAR_TARGETS.map((r) => (
                <button key={r.role} type="button" onClick={() => set("targetRole", r.role)} className={`chip ${p.targetRole === r.role ? "chip-active" : ""}`}>
                  {r.role}
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title="How long have you been in your current field?" hint="This shapes how much seniority carries over.">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { v: "0-2", l: "Under 2 years", s: "Early career — least to unlearn" },
                { v: "3-5", l: "3–5 years", s: "Enough depth to be credible" },
                { v: "6-10", l: "6–10 years", s: "Real domain expertise to leverage" },
                { v: "10+", l: "10+ years", s: "Deep expertise — a genuine differentiator" },
              ].map((o) => (
                <OptionCard key={o.v} selected={p.yearsExperience === o.v} onClick={() => { set("yearsExperience", o.v); setTimeout(next, 180); }} label={o.l} sub={o.s} />
              ))}
            </div>
          </Step>
        )}

        {step === 3 && (
          <Step title="What are you already good at?" hint="Pick everything that genuinely applies. These become your transferable-skill credits.">
            <div className="flex flex-wrap gap-2">
              {[...SKILL_BANK, ...p.existingSkills.filter((s) => !SKILL_BANK.includes(s))].map((s) => (
                <button key={s} type="button" onClick={() => toggle("existingSkills", s)} className={`chip ${p.existingSkills.includes(s) ? "chip-active" : ""}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <input
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customSkill.trim()) {
                    e.preventDefault();
                    toggle("existingSkills", customSkill.trim());
                    setCustomSkill("");
                  }
                }}
                placeholder="Add your own…"
                className="flex-1 rounded-xl border border-ink/12 bg-paper-soft px-4 py-3 text-ink placeholder:text-ink-faint focus:border-ever-bright focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (customSkill.trim()) {
                    toggle("existingSkills", customSkill.trim());
                    setCustomSkill("");
                  }
                }}
                className="btn-ghost px-5 py-3"
              >
                Add
              </button>
            </div>
            <p className="mt-3 text-sm text-ink-faint">
              {p.existingSkills.length} selected{p.existingSkills.length === 0 && " — you can skip this, but the analysis gets sharper with a few"}
            </p>
          </Step>
        )}

        {step === 4 && (
          <Step title="Honestly — how many hours a week?" hint="Be realistic. The whole schedule is built from this number, and overestimating is the most common way these plans fail.">
            <div className="rounded-3xl border border-ink/[0.07] bg-paper-soft p-8">
              <div className="text-center">
                <span className="font-display text-6xl font-semibold text-ink">{p.hoursPerWeek}</span>
                <span className="ml-2 text-xl text-ink-soft">hrs/week</span>
              </div>
              <input
                type="range"
                min={2}
                max={40}
                step={1}
                value={p.hoursPerWeek}
                onChange={(e) => set("hoursPerWeek", Number(e.target.value))}
                className="mt-8 w-full accent-ever-night"
                aria-label="Hours per week"
              />
              <div className="mt-2 flex justify-between text-xs text-ink-faint">
                <span>2 hrs</span><span>20 hrs</span><span>40 hrs</span>
              </div>
              <p className="mt-6 rounded-2xl bg-paper-deep/60 px-5 py-4 text-center text-sm text-ink-soft">
                {p.hoursPerWeek <= 5 && "Tight but workable — the plan will prioritize ruthlessly and lean on free resources."}
                {p.hoursPerWeek > 5 && p.hoursPerWeek <= 12 && "The realistic zone for someone working full-time. Most successful switchers live here."}
                {p.hoursPerWeek > 12 && p.hoursPerWeek <= 25 && "Serious commitment. You can compress the timeline meaningfully."}
                {p.hoursPerWeek > 25 && "Near full-time study. Fastest path — make sure it's sustainable for the whole run."}
              </p>
            </div>
          </Step>
        )}

        {step === 5 && (
          <Step title="What's your target timeline?" hint="When do you want to be working in the new role?">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { v: 6, l: "6 months", s: "Aggressive — needs high weekly hours" },
                { v: 12, l: "12 months", s: "The most common successful timeline" },
                { v: 18, l: "18 months", s: "Comfortable pace alongside a full-time job" },
                { v: 24, l: "24 months", s: "Gradual — lowest risk, lowest pressure" },
              ].map((o) => (
                <OptionCard key={o.v} selected={p.timelineMonths === o.v} onClick={() => { set("timelineMonths", o.v); setTimeout(next, 180); }} label={o.l} sub={o.s} />
              ))}
            </div>
          </Step>
        )}

        {step === 6 && (
          <Step title="What can you spend on learning?" hint="This is a hard filter — nothing above your budget will be recommended.">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { v: "free", l: "$0 — free only", s: "Every recommendation will be genuinely free" },
                { v: "500", l: "Up to $500", s: "Covers most professional certificates" },
                { v: "2000", l: "Up to $2,000", s: "Opens up intensive cohort programs" },
                { v: "flexible", l: "Flexible", s: "Including bootcamps, if the return justifies it" },
              ].map((o) => (
                <OptionCard key={o.v} selected={p.budget === o.v} onClick={() => { set("budget", o.v); setTimeout(next, 180); }} label={o.l} sub={o.s} />
              ))}
            </div>
          </Step>
        )}

        {step === 7 && (
          <Step title="Last one — what's driving this?" hint="Pick as many as apply. This shapes the tone of the advice and the roles emphasized.">
            <div className="grid gap-3 sm:grid-cols-2">
              {MOTIVATIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle("motivations", m.id)}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-150 ${
                    p.motivations.includes(m.id)
                      ? "border-ever-deep bg-ever-night text-paper-soft"
                      : "border-ink/[0.09] bg-paper-soft hover:border-ever/50"
                  }`}
                >
                  <span className="text-xl" aria-hidden>{m.icon}</span>
                  <span className="font-medium">{m.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-soft">Work preference</span>
                <select
                  value={p.workStyle}
                  onChange={(e) => set("workStyle", e.target.value)}
                  className="w-full rounded-xl border border-ink/12 bg-paper-soft px-4 py-3 text-ink focus:border-ever-bright focus:outline-none"
                >
                  <option value="any">No strong preference</option>
                  <option value="remote">Fully remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink-soft">Location <span className="text-ink-faint">(optional)</span></span>
                <input
                  value={p.location ?? ""}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="e.g. Dubai, UAE"
                  className="w-full rounded-xl border border-ink/12 bg-paper-soft px-4 py-3 text-ink placeholder:text-ink-faint focus:border-ever-bright focus:outline-none"
                />
              </label>
            </div>
          </Step>
        )}
      </div>

      {error && (
        <p className="mt-6 rounded-2xl border border-clay/40 bg-clay-soft/40 px-5 py-4 text-sm text-ink">
          {error}
        </p>
      )}

      {/* nav */}
      <div className="mt-10 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-sm font-medium text-ink-faint transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-0"
        >
          ← Back
        </button>
        <button type="button" onClick={next} disabled={!canAdvance} className="btn-primary text-base disabled:opacity-40">
          {step === TOTAL_STEPS - 1 ? "Generate my roadmap" : "Continue"}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-ink text-balance sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 leading-relaxed text-ink-soft">{hint}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function OptionCard({ selected, onClick, label, sub }: { selected: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-5 text-left transition-all duration-150 ${
        selected
          ? "border-ever-deep bg-ever-night text-paper-soft shadow-lift"
          : "border-ink/[0.09] bg-paper-soft hover:-translate-y-0.5 hover:border-ever/50 hover:shadow-lift"
      }`}
    >
      <span className="block font-display text-lg font-semibold">{label}</span>
      <span className={`mt-1 block text-sm ${selected ? "text-paper-soft/70" : "text-ink-faint"}`}>{sub}</span>
    </button>
  );
}

const PHASES = [
  "Reading your background",
  "Mapping skill gaps against the target role",
  "Finding the leverage your experience gives you",
  "Filtering courses to your budget",
  "Sequencing a month-by-month schedule",
  "Pricing the salary progression",
  "Writing your interview narrative",
  "Stress-testing the plan and drafting Plan B",
];

function GeneratingScreen({ from, to }: { from: string; to: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => Math.min(PHASES.length - 1, v + 1)), 2600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center text-center">
      <div className="relative grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 animate-pulseSoft rounded-full bg-signal/40 blur-xl" aria-hidden />
        <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-ever-night text-signal-tint">
          <svg width="24" height="24" viewBox="0 0 18 18" fill="none" className="animate-pulseSoft">
            <path d="M2 15.5L6.2 8.4L9.4 11.2L15.8 2.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11.8 2.5H15.8V6.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <h1 className="mt-8 font-display text-3xl font-bold tracking-tight text-ink">
        Building your roadmap
      </h1>
      <p className="mt-2 text-ink-soft">
        {from || "your role"} <span className="text-ink-faint">→</span> {to || "your target"}
      </p>

      <ul className="mt-10 w-full space-y-2.5 text-left">
        {PHASES.map((phase, idx) => {
          const done = idx < i;
          const active = idx === i;
          return (
            <li
              key={phase}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-300 ${
                active ? "bg-paper-soft text-ink shadow-lift" : done ? "text-ink-faint" : "text-ink-faint/40"
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${
                  done ? "bg-ever-night text-signal-tint" : active ? "bg-signal text-white" : "bg-ink/[0.08]"
                }`}
                aria-hidden
              >
                {done ? "✓" : active ? "•" : ""}
              </span>
              {phase}
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-sm text-ink-faint">
        This usually takes 30–60 seconds. Don&rsquo;t close the tab.
      </p>
    </div>
  );
}
