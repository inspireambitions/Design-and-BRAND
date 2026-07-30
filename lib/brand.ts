// Single place to rebrand or relocate the whole tool.
//
// The product name is deliberately descriptive rather than invented: it lives
// as a section of inspireambitions.com and needs to rank for how people
// actually search ("career change roadmap", "career transition plan"), which an
// abstract brand name cannot do. The parent brand carries the trust; the tool
// name carries the query.
export const BRAND = {
  /** Short name used in nav, buttons, and body copy. */
  name: "Career Change Roadmap",
  /** Compact form for tight spaces (mobile nav, footer). */
  nameShort: "Roadmap",
  /** The parent brand this tool belongs to. */
  parent: "Inspire Ambitions",
  /** Canonical host. The tool is reachable only here — see middleware.ts. */
  domain: "inspireambitions.com",
  /** Path prefix the tool is mounted at. Must match basePath in next.config.mjs. */
  basePath: "/career-change-roadmap",

  tagline: "Your career change, mapped step by step.",

  /** SEO. Front-load the query, keep the title under ~60 characters. */
  seoTitle: "Career Change Roadmap — Free Personalized Plan",
  seoDescription:
    "Answer eight questions and get a personalized career change roadmap: your skill gaps, a month-by-month timeline, courses within your budget, salary stages, and an honest difficulty rating. Free.",

  // Free during beta; the full roadmap unlocks with an email address. When this
  // starts charging, set `price` and restore the paid copy in
  // components/report/EmailGate.tsx and the pricing block on the landing page.
  price: 0,
  priceAnchor: 200, // what an hour with a human coach costs

  supportEmail: "hello@inspireambitions.com",
  /** Resend sender. The domain must be verified in Resend before this works. */
  emailFrom: "Inspire Ambitions <roadmap@inspireambitions.com>",
} as const;

/** Absolute canonical URL for a path inside the tool. */
export function canonicalUrl(path = ""): string {
  const clean = path.replace(/^\/+/, "");
  return `https://${BRAND.domain}${BRAND.basePath}${clean ? `/${clean}` : ""}`;
}
