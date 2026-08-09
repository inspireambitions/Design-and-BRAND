import Link from "next/link";
import { Logo } from "./Logo";

export function SiteHeader({ cta = true }: { cta?: boolean }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink/[0.06] bg-paper/85 backdrop-blur-md">
      <div className="container-page flex h-[68px] items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2 sm:gap-6">
          <Link
            href="/careers"
            className="hidden min-h-11 items-center px-1 text-sm font-medium text-ink-soft transition-colors hover:text-ever-deep sm:inline-flex"
          >
            Explore careers
          </Link>
          <Link
            href="/#how"
            className="hidden min-h-11 items-center px-1 text-sm font-medium text-ink-soft transition-colors hover:text-ever-deep sm:inline-flex"
          >
            How it works
          </Link>
          {cta && (
            <Link
              href="/start"
              className="inline-flex min-h-11 items-center rounded-full bg-ever-night px-5 py-2.5 text-sm font-medium text-paper-soft transition-all hover:bg-ever-deep hover:shadow-lift"
            >
              Build my roadmap
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
