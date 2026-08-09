import { BRAND } from "./brand";

/**
 * Links back into the parent site.
 *
 * Two rules that are easy to get wrong:
 *
 * 1. **Use a plain `<a>`, never next/link.** Next prefixes `basePath` onto
 *    `<Link href="/uae-salary-calculator">`, producing
 *    `/career-change-roadmap/uae-salary-calculator`, which does not exist. These
 *    are WordPress pages outside this app.
 * 2. **Keep the trailing slash.** The WordPress permalink structure uses them,
 *    and omitting one costs a 301 on every click.
 *
 * Verified against the live site's `/career-tools` page. The CV Builder is the
 * one that lives on a subdomain rather than a path.
 */
export interface SiteLink {
  label: string;
  href: string;
  blurb: string;
  /** True when the destination leaves inspireambitions.com. */
  external?: boolean;
}

export const PARENT_SITE = `https://${BRAND.domain}`;

/** The tools hub this roadmap should be listed on. */
export const TOOLS_HUB: SiteLink = {
  label: "All free UAE career tools",
  href: "/career-tools/",
  blurb: "Calculators, assessments and planners for building a career in the Gulf",
};

/**
 * Sibling tools, ordered by how closely they follow on from a roadmap. The
 * Career Path Simulator is deliberately first — it is the nearest neighbour and
 * the most useful next click for someone who just planned a transition.
 */
export const SIBLING_TOOLS: SiteLink[] = [
  {
    label: "Hospitality Career Path Simulator",
    href: "/hospitality-career-path/",
    blurb: "Use the hospitality route inside the AI Career Coach to plan a promotion, department move or leadership path",
  },
  {
    label: "Dubai CV Builder",
    href: "https://cv.inspireambitions.com/",
    blurb: "Build a CV tailored to the UAE job market, with AI feedback",
    external: true,
  },
  {
    label: "UAE Salary Calculator",
    href: "/uae-salary-calculator/",
    blurb: "What a role actually pays, and what lands in your account",
  },
  {
    label: "Should I Take This Dubai Job?",
    href: "/should-i-take-this-dubai-job/",
    blurb: "Score an offer before you accept it",
  },
  {
    label: "Promotion Readiness Assessment",
    href: "/promotion-readiness-assessment-test/",
    blurb: "Find out whether you are ready to ask, and what is missing",
  },
  {
    label: "AI Job Risk Calculator",
    href: "/ai-job-replacement-calculator/",
    blurb: "Check your role's automation risk in 60 seconds",
  },
];

/** Absolute URL for a parent-site path (used in the emailed footer). */
export function parentUrl(link: SiteLink): string {
  return link.external ? link.href : `${PARENT_SITE}${link.href}`;
}
