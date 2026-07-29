import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 border-t border-paper-soft/10 bg-ever-night text-paper-soft/70">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            {BRAND.tagline} A personalized transition plan built from your actual
            constraints — hours, budget, timeline — not a generic checklist.
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">Product</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/start" className="transition-colors hover:text-signal">Build a roadmap</Link></li>
            <li><Link href="/careers" className="transition-colors hover:text-signal">Explore careers</Link></li>
            <li><Link href="/#sample" className="transition-colors hover:text-signal">See a sample report</Link></li>
            <li><Link href="/#pricing" className="transition-colors hover:text-signal">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">Company</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link href="/#faq" className="transition-colors hover:text-signal">FAQ</Link></li>
            <li><a href={`mailto:${BRAND.supportEmail}`} className="transition-colors hover:text-signal">Contact</a></li>
            <li><Link href="/#pricing" className="transition-colors hover:text-signal">Free while in beta</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-paper-soft/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</p>
          <p className="text-paper-soft/50">
            Roadmaps are guidance, not guarantees. Salary ranges are market estimates.
          </p>
        </div>
      </div>
    </footer>
  );
}
