import type { RoadmapReport } from "@/lib/types";
import { PriorityPill, Section, StatusPill } from "./primitives";

export function SkillGapSection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="skill-gap" n={1} icon="01" title="Skills check">
      <div className="overflow-hidden rounded-3xl border border-ink/[0.08] bg-paper-soft">
        <div className="hidden grid-cols-[minmax(0,1.2fr)_5rem_5.5rem_minmax(0,2fr)] gap-4 border-b border-ink/[0.07] bg-paper-deep/50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-ink-faint sm:grid">
          <span>Skill</span><span>Status</span><span>Priority</span><span>How to acquire it</span>
        </div>
        {report.skillGap.map((s) => (
          <div
            key={s.skill}
            className="grid gap-2 border-b border-ink/[0.05] px-6 py-5 last:border-0 sm:grid-cols-[minmax(0,1.2fr)_5rem_5.5rem_minmax(0,2fr)] sm:items-start sm:gap-4"
          >
            <span className="min-w-0 font-medium text-ink">{s.skill}</span>
            <span className="flex gap-2 sm:block"><StatusPill status={s.status} /></span>
            <span className="hidden sm:block"><PriorityPill priority={s.priority} /></span>
            <span className="min-w-0 text-sm leading-relaxed text-ink-soft">{s.howToAcquire}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-faint">
        {report.skillGap.filter((s) => s.status !== "need").length} of {report.skillGap.length} core
        skills already transfer from your background. Start with the high-priority gaps.
      </p>
    </Section>
  );
}

export function StepsSection({
  report,
  unlocked,
}: {
  report: RoadmapReport;
  unlocked: boolean;
}) {
  return (
    <Section id="steps" n={2} icon="02" title="Your next steps">
      <p className="mb-6 max-w-2xl leading-relaxed text-ink-soft">
        {report.steps.length} steps from where you are today to being ready for realistic applications.
        {!unlocked && " The route is yours to see; the execution detail unlocks with the full report."}
      </p>

      <ol className="space-y-3">
        {report.steps.map((step, i) => (
          <li
            key={step.title}
            className="rounded-2xl border border-ink/[0.07] bg-paper-soft p-6"
          >
            <div className="flex items-start gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ever-night font-mono text-sm font-semibold text-signal-tint">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                  {step.title}
                </h3>
                <p className="mt-1 font-mono text-sm italic text-ever-bright">{step.duration}</p>

                {unlocked ? (
                  <p className="mt-3 leading-relaxed text-ink-soft">{step.detail}</p>
                ) : (
                  <div className="relative mt-4" aria-label="Locked — unlock the full report to read this step">
                    <div className="space-y-2" aria-hidden>
                      {[100, 94, 62].map((w, k) => (
                        <div key={k} className="h-2.5 rounded-full bg-ink/[0.07]" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {!unlocked && (
                <span className="shrink-0 rounded-full bg-paper-deep px-2 py-1 text-[11px] font-semibold text-ink-faint">Locked</span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function TimelineSection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="timeline" n={3} icon="03" title="Month-by-month plan">
      <ol className="relative space-y-4 border-l-2 border-ink/[0.08] pl-8">
        {report.timeline.map((phase, i) => (
          <li key={phase.label} className="relative">
            <span
              className="absolute -left-[41px] grid h-6 w-6 place-items-center rounded-full bg-ever-night font-mono text-[11px] font-semibold text-signal-tint"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-sm font-semibold text-ever-bright">{phase.label}</span>
                <h3 className="font-display text-xl font-semibold text-ink">{phase.title}</h3>
              </div>
              <p className="mt-2 leading-relaxed text-ink-soft">{phase.focus}</p>
              <ul className="mt-4 space-y-2">
                {phase.actions.map((a) => (
                  <li key={a} className="flex items-start gap-2.5 text-[15px] text-ink-soft">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ever-bright" aria-hidden />
                    {a}
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-xl bg-signal-wash px-4 py-3 text-sm text-ink">
                <strong className="font-semibold">Milestone:</strong> {phase.milestone}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function CoursesSection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="courses" n={4} icon="04" title="Training to check">
      <div className="grid gap-4">
        {report.courses.map((c) => (
          <div key={c.name} className="rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-semibold text-ink">
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                      {c.name}
                    </a>
                  ) : (
                    c.name
                  )}
                </h3>
                <p className="mt-1 text-sm text-ever-bright">{c.provider}</p>
              </div>
              {c.badge && (
                <span className="rounded-full bg-signal-wash px-3 py-1 text-xs font-semibold text-ever-bright">
                  {c.badge}
                </span>
              )}
            </div>
            <p className="mt-3 leading-relaxed text-ink-soft">{c.why}</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-mono text-sm text-ink-faint">
              <span>Cost: {c.cost}</span>
              <span>Time: {c.duration}</span>
              {c.rating && c.rating !== "—" && <span>Check: {c.rating}</span>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ProjectsSection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="projects" n={5} icon="05" title="Proof of your skills">
      <div className="grid gap-4 md:grid-cols-3">
        {report.projects.map((p) => (
          <div key={p.title} className="flex flex-col rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
            <h3 className="font-display text-lg font-semibold leading-snug text-ink">{p.title}</h3>
            <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-soft">{p.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {p.skills.map((s) => (
                <span key={s} className="rounded-full bg-paper-deep px-2.5 py-1 text-xs text-ink-soft">{s}</span>
              ))}
            </div>
            <p className="mt-4 font-mono text-xs text-ink-faint">Time: {p.effort}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ResumeSection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="resume" n={6} icon="06" title="CV and profile">
      <div className="rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
        <p className="text-[15px] leading-relaxed text-ink-soft">{report.resume.summary}</p>
        <div className="mt-4 rounded-xl bg-ever-night px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-signal-tint">Suggested CV or profile headline</p>
          <p className="mt-1.5 font-medium text-paper-soft">{report.resume.headline}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {report.resume.bullets.map((b, i) => (
          <div key={i} className="grid gap-3 rounded-2xl border border-ink/[0.07] bg-paper-soft p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-clay">Before</p>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-faint line-through decoration-clay/40">{b.before}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ever-bright">After</p>
              <p className="mt-2 text-[15px] leading-relaxed text-ink">{b.after}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
        <h3 className="font-display text-lg font-semibold text-ink">CV and online-profile checklist</h3>
        <ul className="mt-3 space-y-2">
          {report.resume.linkedinTips.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-[15px] text-ink-soft">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ever-bright" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export function SalarySection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="salary" n={7} icon="07" title="Pay research">
      <div className="rounded-3xl border border-ink/[0.07] bg-paper-soft p-6 sm:p-8">
        <div className="space-y-6">
          {report.salary.map((s) => (
            <div key={s.stage}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-ink">{s.stage}</span>
                <span className="font-mono font-semibold text-ever-deep">{s.range}</span>
              </div>
              <p className="mt-1.5 text-sm text-ink-faint">{s.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 border-t border-ink/[0.07] pt-5 text-sm text-ink-faint">
          Pay changes by country, city, employer, shift, licence and experience. Compare at
          least 10 recent local adverts and official labour-market information. Treat any
          online salary figure as a clue, not a promise.
        </p>
      </div>
    </Section>
  );
}

export function NetworkingSection({ report }: { report: RoadmapReport }) {
  const n = report.networking;
  const people = [
    n.peopleToFollow[0] || `A working ${report.snapshot.to}`,
    n.peopleToFollow[1] || "A supervisor in the target team",
    n.peopleToFollow[2] || "A recruiter who hires this role",
    `A former colleague who knows your ${report.snapshot.from} work`,
    "A trainer or association member who understands local requirements",
  ].slice(0, 5);
  const places = [
    "Employer staff list, professional profile or a friend’s introduction",
    "Your workplace, a target employer or an industry event",
    "A trusted recruitment firm or employer careers event",
    "Your phone contacts, former workplace or community group",
    n.communities[0] || "A recognised training centre or professional association",
  ];
  return (
    <Section id="networking" n={8} icon="08" title="People who can help">
      <div className="grid gap-4 md:grid-cols-3">
        <ListCard title="Places to ask" items={n.communities} />
        <ListCard title="People to speak with" items={n.peopleToFollow} />
        <ListCard title="Useful events" items={n.events} />
      </div>

      <div className="mt-4 rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
        <h3 className="font-display text-lg font-semibold text-ink">Message template</h3>
        <p className="mt-1 text-sm text-ink-faint">
          Change the bracketed parts and ask a specific question. Do not ask a stranger to promise you a job.
        </p>
        <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-ever-night px-5 py-4 font-mono text-sm leading-relaxed text-paper-soft">
{n.outreachTemplate}
        </pre>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-ever/20 bg-paper-soft">
        <div className="bg-signal-wash px-6 py-6 sm:px-8">
          <h3 className="font-display text-2xl font-semibold text-ink">Your seven-day referral plan</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">The goal is five useful conversations, not five requests for a job. Ask one clear question and follow up once after three days.</p>
        </div>
        <ol className="divide-y divide-ink/[0.07]">
          {people.map((person, index) => (
            <li key={`${person}-${index}`} className="grid gap-3 px-6 py-5 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.2fr)] sm:px-8">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ever-night font-mono text-xs font-semibold text-signal-tint">{index + 1}</span>
              <div><p className="font-semibold text-ink">{person}</p><p className="mt-1 text-sm text-ink-faint">Where: {places[index]}</p></div>
              <p className="text-sm leading-relaxed text-ink-soft">Ask: “What one requirement should I prove before I apply for {report.snapshot.to} work?”</p>
            </li>
          ))}
        </ol>
        <div className="grid gap-px bg-ink/[0.07] sm:grid-cols-4">
          {["Day 1: choose the five people", "Days 2–3: send two messages each day", "Day 4: improve one proof example", "Day 7: follow up once and record answers"].map((action) => <p key={action} className="bg-paper-soft px-5 py-4 text-sm font-medium text-ink">{action}</p>)}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
        <h3 className="font-display text-lg font-semibold text-ink">Your weekly routine</h3>
        <ul className="mt-3 space-y-2">
          {n.weeklyRoutine.map((r) => (
            <li key={r} className="flex items-start gap-2.5 text-[15px] text-ink-soft">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ever-bright" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export function InterviewSection({ report }: { report: RoadmapReport }) {
  const iv = report.interview;
  return (
    <Section id="interview" n={9} icon="09" title="Interview practice">
      <div className="rounded-2xl bg-ever-night p-6 text-paper-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-signal-tint">Your career-switch narrative</p>
        <p className="mt-3 text-lg leading-relaxed">{iv.narrative}</p>
        <p className="mt-4 text-sm text-paper-soft/60">
          Practise this aloud until you can explain it clearly in about 90 seconds.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {iv.commonQuestions.map((q) => (
          <div key={q.question} className="rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
            <h3 className="font-display text-lg font-semibold text-ink">&ldquo;{q.question}&rdquo;</h3>
            <p className="mt-2 leading-relaxed text-ink-soft">{q.approach}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ListCard title="Frameworks to have ready" items={iv.frameworks} />
        <div className="rounded-2xl border border-clay/30 bg-clay-soft/25 p-6">
          <h3 className="font-display text-lg font-semibold text-ink">Things that lose you the offer</h3>
          <ul className="mt-3 space-y-2">
            {iv.redFlags.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[15px] text-ink-soft">
                <span className="mt-1 text-xs font-bold uppercase text-clay" aria-hidden>No</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

export function DayInLifeSection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="day-in-life" n={10} icon="10" title="What the work may involve">
      <div className="overflow-hidden rounded-3xl border border-ink/[0.07] bg-paper-soft">
        {report.dayInLife.map((d) => (
          <div key={d.time + d.activity} className="flex gap-5 border-b border-ink/[0.05] px-6 py-4 last:border-0">
            <span className="w-14 shrink-0 font-mono text-sm font-semibold text-ever-bright">{d.time}</span>
            <span className="text-[15px] leading-relaxed text-ink-soft">{d.activity}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-faint">
        If this day doesn&rsquo;t appeal to you, that&rsquo;s worth knowing now rather than
        after nine months of study.
      </p>
    </Section>
  );
}

export function RiskSection({ report }: { report: RoadmapReport }) {
  const r = report.risk;
  return (
    <Section id="risk" n={11} icon="11" title="Risks and Plan B">
      <div className="rounded-3xl border border-ink/[0.07] bg-paper-soft p-6 sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Planning difficulty</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ink">{r.difficultyLabel}</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">This broad label helps set the pace. It is not a test score or a prediction that you will be hired.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ListCard title="What makes this work" items={r.successFactors} />
        <div className="rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
          <h3 className="font-display text-lg font-semibold text-ink">What derails people</h3>
          <div className="mt-3 space-y-4">
            {r.setbacks.map((s) => (
              <div key={s.risk}>
                <p className="font-medium text-ink">{s.risk}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ever-deep">Mitigation:</span> {s.mitigation}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-ever-night p-6 text-paper-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-signal-tint">Plan B</p>
        <p className="mt-3 text-lg leading-relaxed">{r.planB}</p>
      </div>
    </Section>
  );
}

export function NinetySection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="ninety" n={12} icon="12" title="First 90 days on the job">
      <div className="grid gap-4 md:grid-cols-3">
        {report.firstNinetyDays.phases.map((ph) => (
          <div key={ph.window} className="rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
            <h3 className="font-display text-lg font-semibold text-ink">{ph.window}</h3>
            <ul className="mt-3 space-y-2">
              {ph.goals.map((g) => (
                <li key={g} className="flex items-start gap-2.5 text-[15px] text-ink-soft">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ever-bright" aria-hidden />
                  {g}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2.5 text-[15px] text-ink-soft">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ever-bright" aria-hidden />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
