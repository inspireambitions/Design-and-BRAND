"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { matchBand } from "@/lib/match";
import { store } from "@/lib/storage";
import { SECTION_META, type RoadmapReport } from "@/lib/types";
import { CoachDrawer } from "./CoachDrawer";
import {
  CoursesSection,
  DayInLifeSection,
  InterviewSection,
  NetworkingSection,
  NinetySection,
  ProjectsSection,
  ResumeSection,
  RiskSection,
  SalarySection,
  SkillGapSection,
  StepsSection,
  TimelineSection,
} from "./Sections";
import { Feedback } from "./Feedback";
import { EmailGate } from "./EmailGate";

export function ReportView() {
  const router = useRouter();
  const [report, setReport] = useState<RoadmapReport | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const r = store.loadReport();
    if (!r) {
      router.replace("/start");
      return;
    }
    setReport(r);
    setUnlocked(store.isUnlocked());
    setEmail(store.loadEmail());
    setLoading(false);
  }, [router]);

  function unlock(address: string) {
    store.setUnlocked(true);
    store.saveEmail(address);
    setUnlocked(true);
    setEmail(address);
    requestAnimationFrame(() =>
      document.getElementById("courses")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  if (loading || !report) {
    return (
      <div className="container-page py-24">
        <div className="mx-auto h-64 max-w-3xl animate-pulseSoft rounded-3xl bg-paper-deep/50" />
      </div>
    );
  }

  const s = report.snapshot;

  return (
    <>
      <main className="container-page pb-24 pt-10">
        {/* ── Snapshot header ───────────────────────────────── */}
        <section id="snapshot" className="scroll-mt-28">
          <div className="relative overflow-hidden rounded-[2rem] bg-ever-night px-7 py-10 text-paper-soft sm:px-12 sm:py-14">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-signal/20 blur-3xl"
              aria-hidden
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-signal-tint">
                  Your roadmap
                </span>
                <span className="text-sm text-paper-soft/60">
                  Built for {s.from.toLowerCase()} → {s.to.toLowerCase()}
                </span>
              </div>

              <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                {s.from} <span className="text-signal-tint">→</span> {s.to}
              </h1>

              <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
                <p className="text-lg leading-relaxed text-paper-soft/85">{report.verdict}</p>

                <div className="rounded-2xl bg-paper-soft/[0.07] p-6">
                  <p className="font-display text-3xl font-semibold text-signal-tint">
                    {matchBand(report.matchScore)}
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-mono text-sm text-paper-soft/70">
                      {report.matchScore}/100 match
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-soft/15">
                    <div
                      className="h-full rounded-full bg-signal transition-[width] duration-1000"
                      style={{ width: `${report.matchScore}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-paper-soft/60">
                    Based on your transferable skills, weekly hours, timeline, and the
                    difficulty of this specific transition.
                  </p>
                </div>
              </div>

              <div className="mt-9 grid gap-px overflow-hidden rounded-2xl bg-paper-soft/10 sm:grid-cols-4">
                <Fact label="Timeline" value={`${s.months} months`} />
                <Fact label="Commitment" value={`${s.hoursPerWeek} hrs/week`} />
                <Fact label="Skills that transfer" value={`${s.transferableCount} of ${report.skillGap.length}`} />
                <Fact label="Estimated cost" value={s.estimatedCost} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Section nav ───────────────────────────────────── */}
        <nav className="no-print sticky top-[68px] z-30 -mx-5 mt-8 overflow-x-auto border-y border-ink/[0.07] bg-paper/90 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
          <ul className="flex gap-1 whitespace-nowrap">
            {SECTION_META.map((m) => (
              <li key={m.id}>
                <a
                  href={`#${m.id}`}
                  className="inline-block rounded-full px-3.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
                >
                  {m.title}
                  {!m.free && !unlocked && <span className="ml-1.5 text-ink-faint" aria-label="locked">🔒</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-14 space-y-16">
          <SkillGapSection report={report} />
          <StepsSection report={report} unlocked={unlocked} />
          <TimelineSection report={report} />

          {unlocked ? (
            <>
              {email && (
                <div className="no-print flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl bg-signal-wash px-6 py-3.5 text-center text-[15px] text-ink">
                  <span aria-hidden>✓</span>
                  <span>
                    Unlocked. Your {report.steps.length}-step path is on its way to{" "}
                    <strong className="font-semibold">{email}</strong>.
                  </span>
                </div>
              )}

              <CoursesSection report={report} />
              <ProjectsSection report={report} />
              <ResumeSection report={report} />
              <SalarySection report={report} />
              <NetworkingSection report={report} />
              <InterviewSection report={report} />
              <DayInLifeSection report={report} />
              <RiskSection report={report} />
              <NinetySection report={report} />

              <div className="no-print rounded-3xl border border-ink/[0.07] bg-paper-soft p-8 text-center">
                <h2 className="font-display text-2xl font-semibold text-ink">That&rsquo;s the whole plan.</h2>
                <p className="mx-auto mt-2 max-w-xl text-ink-soft">
                  Save it, print it, and put the month-one actions in your calendar today.
                  The coach button stays available for follow-up questions.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button onClick={() => window.print()} className="btn-primary">
                    Save as PDF
                  </button>
                  <Link href="/start" className="btn-ghost">
                    Plan a different transition
                  </Link>
                </div>
              </div>

              <Feedback />
            </>
          ) : (
            <>
              <EmailGate report={report} onUnlock={unlock} />
              <Feedback />
            </>
          )}
        </div>
      </main>

      <CoachDrawer report={report} />
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ever-night px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-paper-soft/50">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}

