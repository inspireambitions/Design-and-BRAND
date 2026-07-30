import type { RoadmapReport } from "@/lib/types";
import { Bar, PriorityPill, Section, StatusPill } from "./primitives";

export function SkillGapSection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="skill-gap" n={1} icon="📊" title="Skill Gap Analysis">
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
    <Section id="steps" n={2} icon="🪜" title="The Step-by-Step Path">
      <p className="mb-6 max-w-2xl leading-relaxed text-ink-soft">
        {report.steps.length} steps from where you are today to signing an offer.
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
                <span className="shrink-0 text-ink-faint/60" aria-hidden>🔒</span>
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
    <Section id="timeline" n={3} icon="🗓️" title="Month-by-Month Timeline">
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
    <Section id="courses" n={4} icon="🎓" title="Courses & Certifications">
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
              <span>💰 {c.cost}</span>
              <span>⏱ {c.duration}</span>
              {c.rating && c.rating !== "—" && <span>⭐ {c.rating}</span>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ProjectsSection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="projects" n={5} icon="🛠️" title="Portfolio Projects">
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
            <p className="mt-4 font-mono text-xs text-ink-faint">⏱ {p.effort}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function ResumeSection({ report }: { report: RoadmapReport }) {
  return (
    <Section id="resume" n={6} icon="📝" title="Resume & LinkedIn Rewrite">
      <div className="rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
        <p className="text-[15px] leading-relaxed text-ink-soft">{report.resume.summary}</p>
        <div className="mt-4 rounded-xl bg-ever-night px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-signal-tint">Suggested LinkedIn headline</p>
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
        <h3 className="font-display text-lg font-semibold text-ink">LinkedIn checklist</h3>
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
    <Section id="salary" n={7} icon="💰" title="Salary Progression">
      <div className="rounded-3xl border border-ink/[0.07] bg-paper-soft p-6 sm:p-8">
        <div className="space-y-6">
          {report.salary.map((s) => (
            <div key={s.stage}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-ink">{s.stage}</span>
                <span className="font-mono font-semibold text-ever-deep">{s.range}</span>
              </div>
              <div className="mt-2"><Bar pct={s.pct} label={`${s.stage}: ${s.range}`} /></div>
              <p className="mt-1.5 text-sm text-ink-faint">{s.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 border-t border-ink/[0.07] pt-5 text-sm text-ink-faint">
          Ranges are market estimates and vary significantly by city, company size, and
          industry. Verify against Levels.fyi, Glassdoor, and actual postings in your area
          before you use these in a negotiation.
        </p>
      </div>
    </Section>
  );
}

export function NetworkingSection({ report }: { report: RoadmapReport }) {
  const n = report.networking;
  return (
    <Section id="networking" n={8} icon="🤝" title="Networking Strategy">
      <div className="grid gap-4 md:grid-cols-3">
        <ListCard title="Communities to join" items={n.communities} />
        <ListCard title="People worth following" items={n.peopleToFollow} />
        <ListCard title="Events & recurring things" items={n.events} />
      </div>

      <div className="mt-4 rounded-2xl border border-ink/[0.07] bg-paper-soft p-6">
        <h3 className="font-display text-lg font-semibold text-ink">Cold outreach template</h3>
        <p className="mt-1 text-sm text-ink-faint">
          Personalize the bracketed parts. Generic outreach gets ignored; this one asks for
          a specific opinion, not a favor.
        </p>
        <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-ever-night px-5 py-4 font-mono text-sm leading-relaxed text-paper-soft">
{n.outreachTemplate}
        </pre>
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
    <Section id="interview" n={9} icon="⚡" title="Interview Preparation">
      <div className="rounded-2xl bg-ever-night p-6 text-paper-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-signal-tint">Your career-switch narrative</p>
        <p className="mt-3 text-lg leading-relaxed">{iv.narrative}</p>
        <p className="mt-4 text-sm text-paper-soft/60">
          Rehearse this until the 90-second version is effortless. It&rsquo;s the first
          question in every interview you will have this year.
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
                <span className="mt-1.5 text-clay" aria-hidden>✕</span>
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
    <Section id="day-in-life" n={10} icon="☀️" title="A Day in Your New Life">
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
    <Section id="risk" n={11} icon="🎯" title="Risk Assessment & Plan B">
      <div className="rounded-3xl border border-ink/[0.07] bg-paper-soft p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Difficulty</p>
            <p className="mt-1 font-display text-4xl font-semibold text-ink">
              {r.difficulty}<span className="text-2xl text-ink-faint">/10</span>
            </p>
            <p className="text-sm font-medium text-clay">{r.difficultyLabel}</p>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex gap-1" role="img" aria-label={`Difficulty ${r.difficulty} out of 10`}>
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={`h-8 flex-1 rounded ${i < r.difficulty ? "bg-ever-night" : "bg-ink/[0.08]"}`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-ink-faint">
              <span>Straightforward</span><span>Very demanding</span>
            </div>
          </div>
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
    <Section id="ninety" n={12} icon="🚀" title="First 90 Days on the Job">
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
