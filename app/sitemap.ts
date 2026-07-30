import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/brand";

// Only the two indexable pages are listed. /report and /start depend on
// client-side state and have nothing stable for a crawler to index.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: canonicalUrl(), changeFrequency: "weekly", priority: 1 },
    { url: canonicalUrl("careers"), changeFrequency: "monthly", priority: 0.8 },
  ];
}
