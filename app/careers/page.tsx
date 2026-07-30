import Link from "next/link";
import { RelatedTools } from "@/components/RelatedTools";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { POPULAR_TARGETS } from "@/lib/careers-data";

export const metadata = {
  title: "Career Change Paths & Salary Data | Inspire Ambitions",
  description:
    "Salary bands, demand, difficulty, and required skills for the most-requested career changes.",
};

export default function CareersPage() {
  return (
    <>
      <SiteHeader />

      <main className="container-page py-16">
        <div className="max-w-2xl">
          <span className="eyebrow">Career library</span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
            Where people are switching to, and what it takes
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Starting salary bands, honest difficulty ratings, and the skills that
            actually get screened for. Pick one to generate a plan built around your
            own background.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          {POPULAR_TARGETS.map((r) => {
            const highPriority = r.coreSkills.filter((s) => s.priority === "high");
            return (
              <article
                key={r.role}
                className="flex flex-col rounded-3xl border border-ink/[0.07] bg-paper-soft p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-float"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-display text-2xl font-semibold text-ink">{r.role}</h2>
                  <span className="rounded-full bg-paper-deep px-3 py-1 text-xs font-semibold text-ink-soft">
                    Difficulty {r.difficultyBase}/10
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      Starting range
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold text-ever-deep">
                      {r.salary[0].range}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                      Senior range
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold text-ever-deep">
                      {r.salary[r.salary.length - 1].range}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">Demand: </span>
                  {r.demand}
                </p>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    What gets screened for
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {highPriority.map((s) => (
                      <span
                        key={s.skill}
                        className="rounded-full bg-paper-deep px-3 py-1.5 text-sm text-ink-soft"
                      >
                        {s.skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl bg-paper-deep/60 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    Cheapest credible starting point
                  </p>
                  <p className="mt-1.5 text-[15px] text-ink">
                    {(r.courses.find((c) => c.minBudget === 0) ?? r.courses[0]).name}
                    <span className="text-ink-faint">
                      {" · "}
                      {(r.courses.find((c) => c.minBudget === 0) ?? r.courses[0]).cost}
                    </span>
                  </p>
                </div>

                <div className="mt-6 flex flex-1 items-end">
                  <Link
                    href={`/start?to=${encodeURIComponent(r.role)}`}
                    className="btn-primary w-full"
                  >
                    Plan my switch to {r.role}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-14 rounded-3xl border border-ink/[0.07] bg-paper-soft p-8 text-center">
          <h2 className="font-display text-2xl font-semibold text-ink">
            Target role not listed?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-ink-soft">
            The generator handles any role. For less common targets it still produces
            the full twelve-section plan and tells you where to verify specifics
            yourself, rather than inventing course prices that don&rsquo;t exist.
          </p>
          <Link href="/start" className="btn-signal mt-6">
            Enter my own target role
          </Link>
        </div>
      </main>

      <RelatedTools />

      <SiteFooter />
    </>
  );
}
