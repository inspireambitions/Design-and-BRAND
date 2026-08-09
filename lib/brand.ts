// Single place to rebrand or relocate the whole tool.
//
// The product name is deliberately descriptive rather than invented: it lives
// as a section of inspireambitions.com and needs to rank for how people
// actually search ("career change roadmap", "career transition plan"), which an
// abstract brand name cannot do. The parent brand carries the trust; the tool
// name carries the query.
export const BRAND = {
  /** Short name used in nav, buttons, and body copy. */
  name: "AI Career Coach",
  /** Compact form for tight spaces (mobile nav, footer). */
  nameShort: "AI Coach",
  /** The parent brand this tool belongs to. */
  parent: "Inspire Ambitions",
  /** Canonical host. The tool is reachable only here — see middleware.ts. */
  domain: "inspireambitions.com",
  /** Path prefix the tool is mounted at. Must match basePath in next.config.mjs. */
  basePath: "/career-change-roadmap",

  tagline: "Your next career move, mapped step by step.",

  /** SEO. Front-load the query, keep the title under ~60 characters. */
  seoTitle: "AI Career Coach & Career Change Roadmap",
  seoDescription:
    "Build a personalised career change roadmap with realistic job options, skill gaps, training checks and practical next steps for the UAE, Gulf or beyond.",

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
