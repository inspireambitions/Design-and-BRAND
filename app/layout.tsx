import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description:
    "Answer eight questions. Get a month-by-month plan to change careers: skill gaps, courses, portfolio projects, salary expectations, and an honest risk assessment.",
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description:
      "A personalized career transition roadmap in under three minutes. Built by AI, structured like a coaching engagement.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
