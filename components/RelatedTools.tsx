import { SIBLING_TOOLS, TOOLS_HUB } from "@/lib/site-links";

/**
 * Cross-links back into the parent site's tool set, so the roadmap is a stop on
 * the site rather than a dead end. Plain <a> throughout — these are WordPress
 * pages outside this app and must not pick up the basePath.
 */
export function RelatedTools({ heading = "More free tools from Inspire Ambitions" }: { heading?: string }) {
  return (
    <section className="no-print border-t border-ink/[0.07] bg-paper-deep/40">
      <div className="container-page py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Career toolkit</span>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {heading}
            </h2>
          </div>
          <a
            href={TOOLS_HUB.href}
            className="text-sm font-semibold text-ever-bright underline-offset-4 hover:underline"
          >
            {TOOLS_HUB.label} →
          </a>
        </div>

        <ul className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SIBLING_TOOLS.map((tool) => (
            <li key={tool.href}>
              <a
                href={tool.href}
                {...(tool.external ? { target: "_blank", rel: "noopener" } : {})}
                className="group flex h-full flex-col rounded-2xl border border-ink/[0.08] bg-paper-soft p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ever/40 hover:shadow-lift"
              >
                <span className="flex items-start gap-2 font-semibold text-ink group-hover:text-ever-bright">
                  {tool.label}
                  {tool.external && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      className="mt-1 shrink-0 text-ink-faint"
                      aria-label="opens in a new tab"
                    >
                      <path
                        d="M4.5 1.5h6v6M10.5 1.5L5 7M8 10.5H1.5V4"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="mt-1.5 text-sm leading-relaxed text-ink-soft">{tool.blurb}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
