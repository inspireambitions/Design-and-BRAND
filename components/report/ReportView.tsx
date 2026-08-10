"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import {
  ApplicationDiagnostic,
  BarrierPriorityPlan,
  GccContextPlan,
  UaeMarketRealitySection,
  UaeOfferScorecard,
  UaeSafetyCard,
} from "./MarketSupport";

const CANONICAL_TOOL_URL = "https://inspireambitions.com/career-change-roadmap/";

export function ReportView() {
  const router = useRouter();
  const [report, setReport] = useState<RoadmapReport | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [emailDelivered, setEmailDelivered] = useState<boolean | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
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

  function unlock(address: string, delivered: boolean) {
    store.setUnlocked(true);
    store.saveEmail(address);
    setUnlocked(true);
    setEmail(address);
    setEmailDelivered(delivered);
    requestAnimationFrame(() =>
      document.getElementById("courses")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  async function copyPlan() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(reportAsText(report));
      setActionStatus("Full plan copied.");
    } catch {
      setActionStatus("Copying was blocked by this browser. Use Save as PDF instead.");
    }
  }

  async function shareSummary() {
    if (!report) return;
    const text = shareText(report);
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Inspire Ambitions career roadmap", text, url: CANONICAL_TOOL_URL });
      } else {
        await navigator.clipboard.writeText(text);
        setActionStatus("Share summary copied.");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name !== "AbortError") setActionStatus("Sharing was not available. Try copying the full plan.");
    }
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
          <div className="report-cover relative overflow-hidden rounded-[2rem] bg-ever-night px-7 py-10 text-paper-soft sm:px-12 sm:py-14">
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-signal/20 blur-3xl"
              aria-hidden
            />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-signal-tint">
                  {report.mode === "hospitality" ? "Your hospitality career roadmap" : "Your career change roadmap"}
                </span>
                <span className="text-sm text-paper-soft/60">
                  Built for {s.from.toLowerCase()} → {s.to.toLowerCase()}
                </span>
                <span className="rounded-full border border-paper-soft/15 px-3 py-1 text-xs text-paper-soft/70">
                  {report.generatedBy === "ai" ? "AI-assisted, with planning-rule checks" : "Built with planning rules"}
                </span>
              </div>

              <p className="print-only mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-paper-soft/60">
                Inspire Ambitions personal career planning report
              </p>

              <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                {s.from} <span className="text-signal-tint">→</span> {s.to}
              </h1>

              <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
                <p className="text-lg leading-relaxed text-paper-soft/85">{report.verdict}</p>

                <div className="rounded-2xl border border-paper-soft/10 bg-paper-soft/[0.07] p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-paper-soft/55">Planning outlook</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-signal-tint">{planningOutlook(report.risk.difficultyLabel)}</p>
                  <p className="mt-3 text-sm leading-relaxed text-paper-soft/70">
                    This is a practical planning judgement, not a test score. Your real fit depends on the work itself, local requirements and evidence you build.
                  </p>
                </div>
              </div>

              <div className="mt-9 grid gap-px overflow-hidden rounded-2xl bg-paper-soft/10 sm:grid-cols-4">
                <Fact label="Timeline" value={`${s.months} months`} />
                <Fact label="Commitment" value={`${s.hoursPerWeek} hrs/week`} />
                <Fact label="Skills that transfer" value={`${s.transferableCount} of ${report.skillGap.length}`} />
                <Fact label="Training approach" value={s.estimatedCost} />
              </div>
            </div>
          </div>
        </section>

        {unlocked && (
          <div className="no-print mt-5 flex flex-col gap-3 rounded-2xl border border-ever/20 bg-signal-wash px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">Your full report is unlocked</p>
              <p className="mt-1 text-sm text-ink-soft">Save a copy now so you can use it away from this device.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={copyPlan} className="btn-ghost bg-paper-soft">Copy plan</button>
              <button onClick={() => window.print()} className="btn-primary">Save report as PDF</button>
            </div>
          </div>
        )}

        <CoachDrawer report={report} />

        {/* ── Section nav ───────────────────────────────────── */}
        <nav className="no-print sticky top-[68px] z-30 -mx-5 mt-8 border-y border-ink/[0.07] bg-paper/90 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8" aria-label="Report sections">
          <label className="block sm:hidden">
            <span className="sr-only">Jump to a report section</span>
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) document.getElementById(event.target.value)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="field-control min-h-11 bg-paper-soft py-2.5"
            >
              <option value="" disabled>Jump to a report section</option>
              {SECTION_META.map((item) => (
                <option key={item.id} value={item.id}>{item.title}{!item.free && !unlocked ? " (locked)" : ""}</option>
              ))}
            </select>
          </label>
          <ul className="hidden gap-1 overflow-x-auto whitespace-nowrap sm:flex">
            {SECTION_META.map((m) => (
              <li key={m.id}>
                <a
                  href={`#${m.id}`}
                  className="inline-flex min-h-11 items-center rounded-full px-3.5 py-2 text-sm text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink"
                >
                  {m.title}
                  {!m.free && !unlocked && <span className="ml-1.5 rounded-full bg-paper-deep px-2 py-0.5 text-[11px] font-semibold text-ink-faint">Locked</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-14 space-y-16">
          {unlocked && <FirstWeek report={report} />}
          {unlocked && <BarrierPriorityPlan report={report} />}
          {unlocked && <GccContextPlan report={report} />}
          <SkillGapSection report={report} />
          <StepsSection report={report} unlocked={unlocked} />
          <TimelineSection report={report} />

          <UaeSafetyCard report={report} />

          {report.guidanceNote && (
            <aside className="rounded-2xl border border-ever/20 bg-signal-wash px-6 py-5 text-sm leading-relaxed text-ink-soft">
              <strong className="text-ink">Important limits: </strong>
              {report.guidanceNote}
            </aside>
          )}

          {unlocked ? (
            <>
              {email && (
                <div className="no-print flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl bg-signal-wash px-6 py-3.5 text-center text-[15px] text-ink">
                  <span>
                    {emailDelivered
                      ? <>Unlocked. A copy of your starting path was sent to <strong className="font-semibold">{email}</strong>.</>
                      : <>Unlocked. We could not confirm email delivery, so save or print the report from this page.</>}
                  </span>
                </div>
              )}

              <CoursesSection report={report} />
              <ProjectsSection report={report} />
              <ResumeSection report={report} />
              <ApplicationDiagnostic report={report} />
              <SalarySection report={report} />
              <UaeMarketRealitySection report={report} />
              <UaeOfferScorecard report={report} />
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
                  <button onClick={copyPlan} className="btn-primary">
                    Copy full plan
                  </button>
                  <button onClick={shareSummary} className="btn-ghost">
                    Share another way
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(shareText(report))}`} target="_blank" rel="noopener noreferrer" className="btn-ghost bg-[#e8f7ee] text-ever-deep">
                    Share on WhatsApp
                  </a>
                  <a href={`mailto:?subject=${encodeURIComponent("My Inspire Ambitions career roadmap")}&body=${encodeURIComponent(shareText(report))}`} className="btn-ghost">
                    Send by email
                  </a>
                  <button onClick={() => window.print()} className="btn-primary">
                    Save as PDF
                  </button>
                  <Link href="/start?fresh=1" className="btn-ghost">
                    Start a fresh plan
                  </Link>
                </div>
                {actionStatus && <p className="mt-4 text-sm text-ink-soft" role="status">{actionStatus}</p>}
              </div>

              <Feedback report={report} email={email} />
            </>
          ) : (
            <>
              <EmailGate report={report} onUnlock={unlock} />
              <Feedback report={report} email={email} />
            </>
          )}
        </div>
      </main>

      <p className="no-print container-page pb-10 text-center text-xs leading-relaxed text-ink-faint">
        Report method: {report.generatedBy === "ai" ? "AI-assisted analysis checked against the built-in planning rules" : "built-in planning rules"}. This is career guidance, not a validated psychometric assessment.
      </p>
    </>
  );
}

function FirstWeek({ report }: { report: RoadmapReport }) {
  const actions = report.steps.slice(0, 3);
  return (
    <section id="first-week" className="scroll-mt-28 overflow-hidden rounded-3xl border border-ever/20 bg-paper-soft shadow-lift">
      <div className="grid gap-6 bg-signal-wash px-6 py-7 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ever-bright">Start here</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">Your first week</h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-ink-soft">
            Do these three things before buying training or making a big career decision.
          </p>
        </div>
        <p className="rounded-full bg-ever-night px-4 py-2 text-sm font-semibold text-paper-soft">
          {report.snapshot.hoursPerWeek} hours available
        </p>
      </div>
      <ol className="divide-y divide-ink/[0.07]">
        {actions.map((action, index) => (
          <li key={action.title} className="grid gap-3 px-6 py-6 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-start sm:px-8">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-ever-night font-mono text-sm font-semibold text-signal-tint">
              {index + 1}
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">{action.title}</h3>
              <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-soft">{action.detail}</p>
            </div>
            <span className="text-sm font-semibold text-ever-bright">{action.duration}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function reportAsText(report: RoadmapReport): string {
  const lines = [
    "INSPIRE AMBITIONS CAREER ROADMAP",
    `${report.snapshot.from} → ${report.snapshot.to}`,
    "",
    report.verdict,
    "",
    "IMPORTANT LIMITS",
    report.guidanceNote || "Verify current local requirements before spending money or leaving a job.",
    "",
    "SKILLS CHECK",
    ...report.skillGap.map((item) => `- ${item.skill}: ${item.status}. ${item.howToAcquire}`),
    "",
    "NEXT STEPS",
    ...report.steps.map((item, index) => `${index + 1}. ${item.title} (${item.duration})\n${item.detail}`),
    "",
    "MONTH-BY-MONTH PLAN",
    ...report.timeline.flatMap((phase) => [`${phase.label}: ${phase.title}`, ...phase.actions.map((action) => `- ${action}`), `Milestone: ${phase.milestone}`]),
    ...(report.snapshot.careerBarriers?.length ? ["", "BARRIERS TO PLAN AROUND", ...report.snapshot.careerBarriers.map((item) => `- ${item}`)] : []),
    "",
    "TRAINING TO CHECK",
    ...report.courses.map((item) => `- ${item.name}; ${item.provider}; ${item.cost}. ${item.why}`),
    "",
    "PROOF OF YOUR SKILLS",
    ...report.projects.map((item) => `- ${item.title}: ${item.description}`),
    "",
    "RISKS AND PLAN B",
    `Planning difficulty: ${report.risk.difficultyLabel}`,
    ...report.risk.setbacks.map((item) => `- ${item.risk}: ${item.mitigation}`),
    `Plan B: ${report.risk.planB}`,
    "",
    `Created by Inspire Ambitions using ${report.generatedBy === "ai" ? "AI-assisted analysis and built-in planning rules" : "built-in planning rules"}.`,
    "Career guidance only; not a psychometric test, licence, visa assessment or salary promise.",
    CANONICAL_TOOL_URL,
  ];
  return lines.join("\n");
}

function shareText(report: RoadmapReport): string {
  const firstSteps = report.steps.slice(0, 3).map((step, index) => `${index + 1}. ${step.title}`).join("\n");
  return `My career roadmap: ${report.snapshot.from} to ${report.snapshot.to}\n\n${planningOutlook(report.risk.difficultyLabel)}. My first steps:\n${firstSteps}\n\nBuild your own free roadmap: ${CANONICAL_TOOL_URL}`;
}

function planningOutlook(label: string): string {
  return /\broute$/i.test(label.trim()) ? label.trim() : `${label.trim()} route`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ever-night px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-paper-soft/50">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
