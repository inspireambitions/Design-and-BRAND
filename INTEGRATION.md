# Adding this tool to inspireambitions.com

Everything below is WordPress-side work. The app itself needs no changes.

## 1. Where it lives

`https://inspireambitions.com/career-change-roadmap`

This follows the convention your main-domain tools already use — flat,
keyword-led root slugs (`/uae-salary-calculator`, `/dubai-living-cost-calculator`,
`/promotion-readiness-assessment-test`).

> **One inconsistency to be aware of:** the CV Builder is the exception. It lives
> on a subdomain (`https://cv.inspireambitions.com/`), as do the hosts in your
> GA4 linker config (`calculator.` and `tools.`). This roadmap is on the main
> domain as instructed, which matches the majority of your tools but *not* the CV
> Builder specifically. If you'd rather it match the CV Builder, it becomes
> `roadmap.inspireambitions.com` — change `BRAND.basePath` to `""`,
> `BRAND.domain` to the subdomain, drop `basePath` from `next.config.mjs`, and
> the canonical/sitemap/robots values follow automatically.

**Reserve the slug.** WordPress must not own `/career-change-roadmap`, or it will
answer before the app does. Check nothing is published there:

```
wp post list --post_type=page --name=career-change-roadmap
```

## 2. List it on the tools hub

Add to `/career-tools/` (page ID **45594**), in the existing **Jobs and Career**
`<ul>`. This matches the format the CV Builder row already uses — link, then a
dash, then one line of description:

```html
<li><a href="/career-change-roadmap/">Career Change Roadmap</a> - Get a month-by-month plan to change careers: skill gaps, courses in your budget, salary stages and an honest difficulty rating</li>
```

Put it directly after the Hospitality Career Path Simulator row — that tool is
the closest neighbour, and the two read naturally as a pair.

Do the same on the other hubs where it fits:

| Page | ID | Slug |
|---|---|---|
| Free UAE Career Tools | 45594 | `/career-tools/` |
| Job & Career Tools | 22768 | `/job-career-tools/` |
| UAE Hospitality Career Toolkit | 46652 | `/career-toolkit/` |

## 3. Add the footer link

Add a **Career Change Roadmap** item to the footer menu pointing at
`/career-change-roadmap/`. To find the right menu:

```
wp menu list
wp menu item list <footer-menu-slug>
wp menu item add-custom <footer-menu-slug> "Career Change Roadmap" /career-change-roadmap/
```

## 4. Overlap worth deciding on

Your existing **Hospitality Career Path Simulator**
(`/gcc-recruitment-guide/internships/hospitality/`) is described as mapping
"your next UAE/GCC hotel role, promotion route, salary movement, blockers and
skill gaps." That is substantially what this roadmap does, for hospitality
specifically.

Two tools competing for the same queries will split their own rankings. Options:

- **Position them as different scopes** — the Simulator for the next step inside
  hospitality, the Roadmap for changing field entirely. Say so in both
  descriptions, and cross-link them.
- **Fold the Simulator's hospitality data into the Roadmap** and retire it,
  redirecting the old URL.

Worth settling before both are indexed, not after.

## 5. Analytics

The parent site runs GA4 `G-PY9B70N583` with cross-domain linking. Because this
tool is on the main domain and the same property, pageviews flow in without any
change. If it ever moves to a subdomain, add that host to the `linker.domains`
array in the GA4 snippet.
