import { groq } from 'next-sanity';

export type GuideListItem = {
  title: string;
  titleAr: string;
  slug: string;
  excerpt: string;
  excerptAr: string;
  updatedAt: string;
};

export type GuideDocument = GuideListItem & {
  body: unknown[];
  bodyAr: unknown[];
  practiceHref: string;
  metaDescription: string;
  heroImageUrl: string;
  jsonLdRaw: string;
  faqJsonLdRaw: string;
};

export const guidesQuery = groq`*[_type == "guide" && defined(slug.current)] | order(_createdAt desc) {
  title,
  "titleAr": coalesce(titleAr, title),
  "slug": slug.current,
  "excerpt": coalesce(excerpt, ""),
  "excerptAr": coalesce(excerptAr, excerpt, ""),
  "updatedAt": _updatedAt
}`;

export const guideBySlugQuery = groq`*[_type == "guide" && slug.current == $slug][0] {
  title,
  "titleAr": coalesce(titleAr, title),
  "slug": slug.current,
  "excerpt": coalesce(excerpt, ""),
  "excerptAr": coalesce(excerptAr, excerpt, ""),
  "updatedAt": _updatedAt,
  "body": coalesce(body, []),
  "bodyAr": coalesce(bodyAr, body, []),
  "practiceHref": coalesce(practiceHref, "/practice"),
  "metaDescription": coalesce(metaDescription, excerpt, ""),
  "heroImageUrl": coalesce(heroImageUrl, ""),
  "jsonLdRaw": coalesce(jsonLdRaw, ""),
  "faqJsonLdRaw": coalesce(faqJsonLdRaw, "")
}`;
