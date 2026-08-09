import type { MetadataRoute } from "next";
import { BRAND, canonicalUrl } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: BRAND.basePath,
        // Stateful pages and endpoints have nothing to index.
        disallow: [`${BRAND.basePath}/start`, `${BRAND.basePath}/report`, `${BRAND.basePath}/api/`],
      },
    ],
    sitemap: `${canonicalUrl()}/sitemap.xml`,
  };
}
