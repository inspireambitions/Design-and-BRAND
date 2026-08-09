import type { Metadata } from "next";
import { BRAND, canonicalUrl } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  // metadataBase makes every relative canonical/OG URL resolve against the
  // real host, so the tool never advertises a preview domain to crawlers.
  metadataBase: new URL(`https://${BRAND.domain}`),
  title: {
    default: `${BRAND.seoTitle} | ${BRAND.parent}`,
    // Child pages set their own full title; this keeps them from double-branding.
    template: "%s",
  },
  description: BRAND.seoDescription,
  applicationName: BRAND.name,
  keywords: [
    "career change roadmap",
    "AI career coach",
    "online career coach",
    "career transition plan",
    "how to change careers",
    "career change at 30",
    "career switch plan",
    "skill gap analysis",
    "career change timeline",
    "hospitality career path simulator",
    "hotel career path",
    "warehouse career change",
    "skilled trades career path",
    "care worker career progression",
    "retail career change",
    "administration career path",
    "career coach for low paid workers",
  ],
  alternates: { canonical: canonicalUrl() },
  openGraph: {
    title: `${BRAND.seoTitle} | ${BRAND.parent}`,
    description: BRAND.seoDescription,
    url: canonicalUrl(),
    siteName: BRAND.parent,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.seoTitle,
    description: BRAND.seoDescription,
  },
  robots: { index: true, follow: true },
};

// Structured data. The tool is a free web application inside a larger site, so
// it declares both the app and the FAQ answers the landing page already shows —
// those are the fragments most likely to win a rich result for these queries.
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: BRAND.name,
      alternateName: ["Career Change Roadmap", "Hospitality Career Path Simulator"],
      url: canonicalUrl(),
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any (web)",
      description: BRAND.seoDescription,
      isPartOf: { "@type": "WebSite", name: BRAND.parent, url: `https://${BRAND.domain}` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How long does it take to change careers?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It depends on the target role, how many of your existing skills transfer, and how many hours a week you can commit. This tool builds a month-by-month timeline from those three inputs and tells you plainly if your chosen timeline does not fit your available hours.",
          },
        },
        {
          "@type": "Question",
          name: "Is a career change roadmap actually useful?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It is useful when it is specific. A roadmap that names suitable training within your budget, safe work-evidence tasks that reuse your experience, and the honest difficulty of the switch gives you something to act on this week. Generic advice does not.",
          },
        },
        {
          "@type": "Question",
          name: "What does the career change roadmap cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It is free during the beta. The full twelve-section roadmap unlocks with an email address — no card, no subscription.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // Static, developer-authored object — no user input reaches this.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
