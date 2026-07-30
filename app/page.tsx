import Link from "next/link";
import { Faq } from "@/components/Faq";
import { HeroPreview } from "@/components/HeroPreview";
import { HeroSearch } from "@/components/HeroSearch";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";
import { POPULAR_TARGETS } from "@/lib/careers-data";
import { SECTION_META } from "@/lib/types";

const STEPS = [
  {
    n: "01",
    title: "Tell us your constraints",
    body: "Eight questions: where you are, where you're going, how many hours a week you actually have, what you can spend, and why you're doing this. Three minutes.",
  },
  {
    n: "02",
    title: "We find your leverage",
    body: "The generator looks for what your current career gives you that a fresh graduate doesn't have — and builds the portfolio strategy around exactly that.",
  },
  {
    n: "03",
    title: "You get a plan, not advice",
    body: "Twelve sections: skill gaps, a month-by-month schedule, named courses within your budget, salary stages, an interview narrative, and an honest risk assessment.",
  },
];

const COMPARISON = [
  { label: "Cost", coach: `$${BRAND.priceAnchor}+ per hour`, generic: "Free", ours: "Free in beta" },
  { label: "Turnaround", coach: "1–2 weeks to book", generic: "Instant", ours: "Under 4 minutes" },
  { label: "Personalized to your hours & budget", coach: "Yes", generic: "No", ours: "Yes" },
  { label: "Month-by-month schedule", coach: "Sometimes", generic: "No", ours: "Yes" },
  { label: "Named courses with real prices", coach: "Sometimes", generic: "Often outdated", ours: "Yes, budget-filtered" },
  { label: "Honest risk assessment & Plan B", coach: "Depends on the coach", generic: "Rarely", ours: "Always" },
  { label: "Something you can re-read at month 7", coach: "Your notes", generic: "Lost in scrollback", ours: "Yes" },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] opacity-70"
          style={{
            background:
              "radial-gradient(60% 60% at 20% 30%, rgba(26,125,196,0.16) 0%, transparent 70%), radial-gradient(50% 50% at 85% 10%, rgba(11,34,57,0.10) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div className="container-page relative pb-20 pt-16 sm:pt-24">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center lg:gap-16">
          <div className="animate-rise">
            <span className="eyebrow">Free career change roadmap</span>
            <h1 className="mt-5 font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-ink text-balance sm:text-6xl lg:text-[4.25rem]">
              Everyone says{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10">&ldquo;just switch careers.&rdquo;</span>
                <span
                  className="absolute inset-x-0 bottom-1 z-0 h-3 -rotate-1 bg-signal-mark sm:bottom-2 sm:h-4"
                  aria-hidden
                />
              </span>{" "}
              Nobody hands you the plan.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft sm:text-xl">
              {BRAND.parent} builds the plan. Answer eight questions about your situation
              and get a personalized career change roadmap out the other side — your skill
              gaps, a month-by-month timeline, real courses inside your budget, portfolio
              projects built around the career you already have, and an honest read on how
              hard this is going to be.
            </p>
          </div>

          <div className="animate-rise lg:pl-6" style={{ animationDelay: "300ms" }}>
            <HeroPreview />
          </div>
          </div>

          <div className="mt-14 max-w-3xl animate-rise" style={{ animationDelay: "120ms" }}>
            <HeroSearch />
          </div>

          <div
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-faint animate-rise"
            style={{ animationDelay: "220ms" }}
          >
            <span className="inline-flex items-center gap-2">
              <Dot /> First 3 sections free
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot /> No account needed to start
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot /> Full roadmap free in beta
            </span>
          </div>
        </div>
      </section>

      {/* ── Stat strip ───────────────────────────────────────── */}
      <section className="border-y border-ink/[0.07] bg-paper-deep/50">
        <div className="container-page grid gap-8 py-10 sm:grid-cols-3">
          <Stat value="12" label="sections in every roadmap" sub="From skill gaps to your first 90 days on the job" />
          <Stat value="Free" label="while we're in beta" sub={`A career coach charges $${BRAND.priceAnchor}+ for one hour`} />
          <Stat value="~4 min" label="from first question to full plan" sub="Three minutes of answers, under one to generate" />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section id="how" className="container-page py-24">
        <div className="max-w-2xl">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Three minutes in. A plan you could start Monday out.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="group relative overflow-hidden rounded-3xl border border-ink/[0.07] bg-paper-soft p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-float"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="font-mono text-sm font-semibold text-ever-bright">{s.n}</span>
              <h3 className="mt-4 font-display text-2xl font-semibold text-ink">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{s.body}</p>
              <span
                className="absolute -bottom-6 -right-4 font-display text-[7rem] font-semibold leading-none text-ink/[0.04] transition-transform duration-500 group-hover:scale-110"
                aria-hidden
              >
                {s.n}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── What's inside ────────────────────────────────────── */}
      <section id="sample" className="bg-ever-night py-24 text-paper-soft">
        <div className="container-page">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-tint">
                What&rsquo;s inside
              </span>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Twelve sections. All of them specific to you.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-paper-soft/70">
                Not a checklist of things to think about. A document with course
                prices, community names, salary bands, before-and-after resume
                bullets, and a schedule that fits the hours you actually have.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/start" className="btn-signal">
                  Build mine free
                </Link>
                <Link
                  href="/careers"
                  className="inline-flex items-center justify-center rounded-full border border-paper-soft/25 px-6 py-3 font-medium text-paper-soft transition-colors hover:border-signal hover:text-signal-tint"
                >
                  Browse transitions
                </Link>
              </div>
            </div>

            <ol className="grid gap-px overflow-hidden rounded-3xl bg-paper-soft/10 sm:grid-cols-2">
              {SECTION_META.slice(1).map((s) => (
                <li key={s.id} className="bg-ever-night p-6 transition-colors hover:bg-ever-deep">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-xl" aria-hidden>{s.icon}</span>
                    <div>
                      <h3 className="font-display text-lg font-semibold leading-snug text-paper-soft">
                        {s.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-paper-soft/60">{s.blurb}</p>
                      {s.free && (
                        <span className="mt-2.5 inline-block rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-signal-tint">
                          Free preview
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────── */}
      <section className="container-page py-24">
        <div className="max-w-2xl">
          <span className="eyebrow">Why not just&hellip;</span>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Hire a coach? Ask a chatbot?
          </h2>
          <p className="mt-5 leading-relaxed text-ink-soft">
            Both are reasonable. Here&rsquo;s the honest comparison — including where
            a human coach still wins.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 overflow-hidden rounded-3xl border border-ink/[0.08]">
            <thead>
              <tr className="bg-paper-deep/60 text-left">
                <th className="px-6 py-5 text-sm font-semibold text-ink-faint">&nbsp;</th>
                <th className="px-6 py-5 text-sm font-semibold text-ink-soft">Career coach</th>
                <th className="px-6 py-5 text-sm font-semibold text-ink-soft">Generic AI chat</th>
                <th className="bg-ever-night px-6 py-5 text-sm font-semibold text-signal-tint">{BRAND.name}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.label} className={i % 2 ? "bg-paper-soft" : "bg-paper-soft/40"}>
                  <td className="border-t border-ink/[0.06] px-6 py-4 text-sm font-medium text-ink">{row.label}</td>
                  <td className="border-t border-ink/[0.06] px-6 py-4 text-sm text-ink-soft">{row.coach}</td>
                  <td className="border-t border-ink/[0.06] px-6 py-4 text-sm text-ink-soft">{row.generic}</td>
                  <td className="border-t border-paper-soft/10 bg-ever-night px-6 py-4 text-sm font-medium text-paper-soft">
                    {row.ours}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-faint">
          Where a coach still wins: accountability over months, reading your specific
          industry&rsquo;s politics, and negotiating a real offer with you. If you can
          afford one, a roadmap plus two coaching sessions beats either alone.
        </p>
      </section>

      {/* ── Popular transitions ──────────────────────────────── */}
      <section className="border-y border-ink/[0.07] bg-paper-deep/40 py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">Where people are going</span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                The most-requested target roles
              </h2>
            </div>
            <Link href="/careers" className="text-sm font-medium text-ever-deep underline-offset-4 hover:underline">
              See all with salary data →
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {POPULAR_TARGETS.map((r) => (
              <Link
                key={r.role}
                href={`/start?to=${encodeURIComponent(r.role)}`}
                className="group rounded-2xl border border-ink/[0.07] bg-paper-soft p-6 transition-all duration-200 hover:-translate-y-1 hover:border-ever/40 hover:shadow-lift"
              >
                <h3 className="font-display text-xl font-semibold text-ink">{r.role}</h3>
                <p className="mt-2 font-mono text-sm text-ever-bright">{r.salary[0].range}</p>
                <p className="mt-1 text-xs text-ink-faint">starting range</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors group-hover:text-ever-deep">
                  Plan this switch
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="container-page py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Pricing</span>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            One price. One plan. No subscription.
          </h2>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 lg:grid-cols-2">
          <div className="card p-9">
            <h3 className="font-display text-2xl font-semibold text-ink">Preview</h3>
            <p className="mt-2 text-ink-soft">See if the plan is any good before you pay for it.</p>
            <p className="mt-7 font-display text-5xl font-semibold text-ink">Free</p>
            <ul className="mt-7 space-y-3 text-[15px] text-ink-soft">
              <Check>Your match score and verdict</Check>
              <Check>Full skill gap analysis</Check>
              <Check>Month-by-month timeline</Check>
              <Check>No account, no card</Check>
            </ul>
            <Link href="/start" className="btn-ghost mt-8 w-full">
              Start free
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-ever-night p-9 text-paper-soft shadow-float">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-signal/20 blur-3xl"
              aria-hidden
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-semibold">Full roadmap</h3>
                <span className="rounded-full bg-signal px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  Everything
                </span>
              </div>
              <p className="mt-2 text-paper-soft/70">All twelve sections, yours to keep and re-read.</p>
              <p className="mt-7 flex items-baseline gap-3">
                <span className="font-display text-5xl font-semibold">Free</span>
                <span className="text-paper-soft/60">while in beta</span>
              </p>
              <p className="mt-2 text-sm text-paper-soft/60">
                One email address, no card. We&rsquo;re building this in the open and would
                rather have your feedback than your money.
              </p>
              <ul className="mt-7 space-y-3 text-[15px] text-paper-soft/85">
                <Check light>Everything in the free preview</Check>
                <Check light>Courses filtered to your budget, with real prices</Check>
                <Check light>Portfolio projects built on your background</Check>
                <Check light>Resume and LinkedIn rewrites, before and after</Check>
                <Check light>Salary progression across four stages</Check>
                <Check light>Networking scripts and interview narrative</Check>
                <Check light>Risk assessment, Plan B, and first 90 days</Check>
                <Check light>Follow-up questions answered by the coach</Check>
              </ul>
              <Link href="/start" className="btn-signal mt-8 w-full">
                Build my roadmap — free
              </Link>
              <p className="mt-4 text-center text-sm text-paper-soft/60">
                No card, no subscription, no upsell at the end.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section id="faq" className="container-page pb-24">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="eyebrow">Questions</span>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            The honest answers
          </h2>
        </div>
        <Faq />
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="container-page pb-24">
        <div className="relative overflow-hidden rounded-[2rem] border border-ink/[0.07] bg-paper-soft px-8 py-16 text-center sm:px-16">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 80% at 50% 0%, rgba(124,192,238,0.30) 0%, transparent 65%)",
            }}
            aria-hidden
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink text-balance sm:text-5xl">
              The plan takes four minutes. The wondering has taken years.
            </h2>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-ink-soft">
              Start with the free preview. If the first three sections don&rsquo;t tell
              you something useful about your own situation, close the tab.
            </p>
            <Link href="/start" className="btn-primary mt-9 text-base">
              Build my roadmap
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full bg-ever-bright" aria-hidden />;
}

function Stat({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div>
      <p className="font-display text-4xl font-semibold text-ink">{value}</p>
      <p className="mt-1 font-medium text-ink">{label}</p>
      <p className="mt-1 text-sm text-ink-faint">{sub}</p>
    </div>
  );
}

function Check({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
          light ? "bg-signal text-white" : "bg-ever-night text-signal-tint"
        }`}
        aria-hidden
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 5.5L4 8L9.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>{children}</span>
    </li>
  );
}
