import { BRAND } from "./brand";

/**
 * Client-side fetch URLs must carry the basePath themselves.
 *
 * Next.js prefixes basePath onto `<Link>`, `router.push`, and static assets,
 * but NOT onto `fetch()` — a bare `fetch("/api/roadmap")` resolves against the
 * origin root and 404s the moment the app is mounted under a path. Route every
 * internal API call through this helper.
 */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BRAND.basePath}${p}`;
}
