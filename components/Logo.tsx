import Link from "next/link";
import { BRAND } from "@/lib/brand";

/**
 * The parent brand carries recognition, the product name carries the search
 * query — so both appear, locked up rather than competing. The product line
 * drops on very small screens where it would wrap.
 */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label={`${BRAND.parent} — ${BRAND.name}`}>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 ${
          light ? "bg-signal text-ever-night" : "bg-ever-night text-signal"
        }`}
        aria-hidden
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M2 15.5L6.2 8.4L9.4 11.2L15.8 2.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M11.8 2.5H15.8V6.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <span className="flex flex-col leading-none">
        <span
          className={`font-display text-[1.15rem] font-semibold tracking-tight sm:text-[1.25rem] ${
            light ? "text-paper-soft" : "text-ink"
          }`}
        >
          {BRAND.parent}
        </span>
        <span
          className={`mt-[3px] hidden text-[0.66rem] font-semibold uppercase tracking-[0.14em] sm:block ${
            light ? "text-signal/80" : "text-ever-bright"
          }`}
        >
          {BRAND.name}
        </span>
      </span>
    </Link>
  );
}
