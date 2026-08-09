import Link from "next/link";
import { Faq } from "@/components/Faq";
import { HeroPreview } from "@/components/HeroPreview";
import { HeroSearch } from "@/components/HeroSearch";
import { RelatedTools } from "@/components/RelatedTools";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BRAND } from "@/lib/brand";
import { POPULAR_TARGETS } from "@/lib/careers-data";
import { INDUSTRY_OPTIONS, TYPICAL_TARGETS } from "@/lib/industry-data";
import { SECTION_META } from "@/lib/types";

const STEPS = [
  {
    n: "01",
    title: "Tell us what is realistic",
    body: "Answer eight short questions about your work, time, money and goals. Most people finish in four to seven minutes.",
  },
  {
    n: "02",
    title: "We find your leverage",
    body: "The planner finds skills you can reuse, then separates them from the training or supervised practice you still need.",
  },
  {
    n: "03",
    title: "You get a plan, not advice",
    body: "Twelve sections: skills, monthly actions, training checks, local pay research, interview practice, risks and Plan B.",
  },
];

const COMPARISON = [
  { label: "Cost", coach: "Usually paid", generic: "Usually free", ours: "Free in beta" },
  { label: "Turnaround", coach: "Depends on availability", generic: "Instant", ours: "About 4 to 7 minutes" },
  { label: "Personalized to your hours & budget", coach: "Yes", generic: "No", ours: "Yes" },
  { label: "Month-by-month schedule", coach: "Sometimes", generic: "No", ours: "Yes" },
  { label: "Training checks before you pay", coach: "Sometimes", generic: "Often missing", ours: "Built in" },
  { label: "Honest risk assessment & Plan B", coach: "Depends on the coach", generic: "Rarely", ours: "Always" },
  { label: "Something you can re-read at month 7", coach: "Your notes", generic: "Lost in scrollback", ours: "Yes" },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>

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
            <span className="eyebrow">Free AI career coach and career change roadmap</span>
            <h1 className="mt-5 font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-ink text-balance sm:text-6xl lg:text-[4.25rem]">
              Everyone says{" "}
              <span className="relative sm:whitespace-nowrap">
                <span className="relative z-10">&ldquo;just switch careers.&rdquo;</span>
                <span
                  className="absolute inset-x-0 bottom-1 z-0 h-3 -rotate-1 bg-signal-mark sm:bottom-2 sm:h-4"
                  aria-hidden
                />
              </span>{" "}
              Nobody hands you the plan.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl">
              Answer eight simple questions. Get a personal roadmap showing skills you can reuse,
              training to check, safe first steps and a Plan B that fits your time and budget.
            </p>
          </div>

          <div className="animate-rise lg:pl-6" style={{ animationDelay: "300ms" }}>
            <HeroPreview />
          </div>
          </div>

          <div className="mt-14 max-w-3xl animate-rise" style={{ animationDelay: "120ms" }}>
            <HeroSearch />
          </div>

          <div className="mt-5 max-w-3xl animate-rise" style={{ animationDelay: "170ms" }}>
            <a
              href="/hospitality-career-path/"
              className="flex flex-col gap-2 rounded-2xl border border-ever/25 bg-paper-soft px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-ever-bright hover:shadow-lift sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                <strong className="block text-ink">Already work in a hotel or hospitality?</strong>
                <span className="text-sm text-ink-soft">Use the Hospitality Career Path Simulator inside this AI Career Coach.</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-ever-bright">Plan my hospitality path →</span>
            </a>
          </div>

          <div className="mt-3 max-w-3xl animate-rise" style={{ animationDelay: "195ms" }}>
            <a
              href="/career-motivation-assessment/"
              className="flex flex-col gap-2 rounded-2xl border border-ink/[0.09] bg-paper-deep/55 px-5 py-4 transition-colors hover:border-ever/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>
                <strong className="block text-ink">Not ready to choose a target role?</strong>
                <span className="text-sm text-ink-soft">Use the Career Motivation Assessment to understand what drives you at work. Use this roadmap when you want roles, gaps, training checks and next steps.</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-ever-bright">Explore my work drivers →</span>
            </a>
          </div>

          <div
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-faint animate-rise"
            style={{ animationDelay: "220ms" }}
          >
            <span className="inline-flex items-center gap-2">
              <Dot /> Start without an account
            </span>
            <span className="inline-flex items-center gap-2">
              <Dot /> Easy to use on your phone
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
          <Stat value="Free" label="while we're in beta" sub="No card and no subscription" />
          <Stat value="4–7 min" label="for the eight questions" sub="Then allow about a minute to build your report" />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section id="how" className="container-page py-24">
        <div className="max-w-2xl">
          <span className="eyebrow">How it works</span>
          <h2 className="mt-4 font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            A few minutes in. A plan you can start this week.
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
                Twelve sections. Built around your route.
              </h2>
              <p className="mt-5 max-w-md leading-relaxed text-paper-soft/70">
                A working guide that combines role-specific advice with planning and
                safety checks. It covers skills, training, safe evidence tasks, CV
                examples, pay research and a schedule for the hours you have.
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
            Both are reasonable. Here is the honest comparison, including where
            a human coach still wins.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 overflow-hidden rounded-3xl border border-ink/[0.08]">
            <caption className="sr-only">Comparison of a career coach, generic AI chat and the Inspire Ambitions roadmap</caption>
            <thead>
              <tr className="bg-paper-deep/60 text-left">
                <th scope="col" className="px-6 py-5 text-sm font-semibold text-ink-faint">Feature</th>
                <th scope="col" className="px-6 py-5 text-sm font-semibold text-ink-soft">Career coach</th>
                <th scope="col" className="px-6 py-5 text-sm font-semibold text-ink-soft">Generic AI chat</th>
                <th scope="col" className="bg-ever-night px-6 py-5 text-sm font-semibold text-signal-tint">{BRAND.name}</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.label} className={i % 2 ? "bg-paper-soft" : "bg-paper-soft/40"}>
                  <th scope="row" className="border-t border-ink/[0.06] px-6 py-4 text-left text-sm font-medium text-ink">{row.label}</th>
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

      {/* ── Industry coverage ────────────────────────────────── */}
      <section className="border-y border-ink/[0.07] bg-paper-deep/40 py-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="eyebrow">Everyday work included</span>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Career paths across common industries
              </h2>
              <p className="mt-3 max-w-2xl text-ink-soft">
                From warehouse and care work to trades, office jobs, retail and technology. Choose the closest area, then type any job if yours is not shown.
              </p>
            </div>
            <Link href="/careers" className="text-sm font-medium text-ever-deep underline-offset-4 hover:underline">
              See all career paths →
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRY_OPTIONS.filter((item) => !["hospitality", "other"].includes(item.value)).slice(0, 12).map((item) => {
              const target = TYPICAL_TARGETS.find((role) => role.industry === item.value) ?? POPULAR_TARGETS[0];
              return (
              <Link
                key={item.value}
                href={`/start?industry=${encodeURIComponent(item.value)}&to=${encodeURIComponent(target.role)}`}
                className="group rounded-2xl border border-ink/[0.07] bg-paper-soft p-6 transition-all duration-200 hover:-translate-y-1 hover:border-ever/40 hover:shadow-lift"
              >
                <h3 className="font-display text-xl font-semibold text-ink">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">Example path: {target.role}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors group-hover:text-ever-deep">
                  Explore this area
                  <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
                </span>
              </Link>
              );
            })}
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
            <p className="mt-2 text-ink-soft">See your starting route before you share an email.</p>
            <p className="mt-7 font-display text-5xl font-semibold text-ink">Free</p>
            <ul className="mt-7 space-y-3 text-[15px] text-ink-soft">
              <Check>Your planning outlook and important limits</Check>
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
                <Check light>Training options to verify before you pay</Check>
                <Check light>Safe proof-of-skill tasks built on your background</Check>
                <Check light>CV and online-profile examples</Check>
                <Check light>Local pay-research steps</Check>
                <Check light>Message templates and interview practice</Check>
                <Check light>Risks, Plan B and first 90 days</Check>
                <Check light>Follow-up questions answered by the coach</Check>
              </ul>
              <Link href="/start" className="btn-signal mt-8 w-full">
                Build my roadmap free
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

      <RelatedTools />

      </main>

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
