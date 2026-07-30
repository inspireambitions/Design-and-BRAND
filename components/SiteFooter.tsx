import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { PARENT_SITE, SIBLING_TOOLS, TOOLS_HUB } from "@/lib/site-links";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-paper-soft/10 bg-ever-night text-paper-soft/70">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            {BRAND.tagline} A personalised transition plan built from your actual
            constraints — hours, budget, timeline — not a generic checklist.
          </p>
          {/* Plain <a>: this leaves the app for the WordPress site, so it must
              not pick up the basePath the way next/link would. */}
          <a
            href={PARENT_SITE}
            className="mt-4 inline-block text-sm font-medium text-signal-tint underline-offset-4 hover:underline"
          >
            ← Back to {BRAND.parent}
          </a>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-tint">
            This tool
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/start" className="transition-colors hover:text-signal-tint">Build a roadmap</Link></li>
            <li><Link href="/careers" className="transition-colors hover:text-signal-tint">Explore transitions</Link></li>
            <li><Link href="/#sample" className="transition-colors hover:text-signal-tint">See a sample report</Link></li>
            <li><Link href="/#faq" className="transition-colors hover:text-signal-tint">FAQ</Link></li>
          </ul>
        </div>

        {/* The reason this tool doesn't read as a standalone microsite: the rest
            of the toolkit is one click away from every page. */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-tint">
            More career tools
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {SIBLING_TOOLS.slice(0, 4).map((tool) => (
              <li key={tool.href}>
                <a
                  href={tool.href}
                  {...(tool.external ? { target: "_blank", rel: "noopener" } : {})}
                  className="transition-colors hover:text-signal-tint"
                >
                  {tool.label}
                </a>
              </li>
            ))}
            <li>
              <a href={TOOLS_HUB.href} className="font-medium text-signal-tint/90 transition-colors hover:text-signal-tint">
                See all tools →
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-tint">
            {BRAND.parent}
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><a href="/uae-career-guide/" className="transition-colors hover:text-signal-tint">UAE career guide</a></li>
            <li><a href="/career-toolkit/" className="transition-colors hover:text-signal-tint">Hospitality career toolkit</a></li>
            <li><a href="/uae-hospitality-career-coaching/" className="transition-colors hover:text-signal-tint">Career coaching</a></li>
            <li><a href={`mailto:${BRAND.supportEmail}`} className="transition-colors hover:text-signal-tint">Contact</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-paper-soft/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {BRAND.parent}. All rights reserved.</p>
          <p className="text-paper-soft/50">
            Roadmaps are guidance, not guarantees. Salary ranges are market estimates.
          </p>
        </div>
      </div>
    </footer>
  );
}
