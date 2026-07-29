import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5">
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 ${
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
      <span
        className={`font-display text-[1.35rem] font-semibold tracking-tight ${
          light ? "text-paper-soft" : "text-ink"
        }`}
      >
        {BRAND.name}
      </span>
    </Link>
  );
}
