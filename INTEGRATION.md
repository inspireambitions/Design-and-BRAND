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
answer before the app does. It was unclaimed when checked; re-run this before
launch:

```sql
SELECT ID, post_title, post_type, post_status FROM wpof_posts
WHERE post_name LIKE '%career-change%';
```

## 2. List it on the tools hub

Add to `/career-tools/` (page ID **45594**), in the existing **Jobs and Career**
`<ul>`. This matches the format the CV Builder row already uses — link, then a
dash, then one line of description:

```html
<li><a href="/career-change-roadmap/">AI Career Coach and Career Change Roadmap</a> - Build a personalised step-by-step plan for changing careers, including skill gaps, realistic actions, training options and an honest difficulty rating</li>
```

Put it directly after the Hospitality Career Path Simulator row — that tool is
the closest neighbour, and the two read naturally as a pair.

The other two hubs use prose, not the same list format:

| Page | ID | Slug | How it lists tools |
|---|---|---|---|
| Free UAE Career Tools | 45594 | `/career-tools/` | Gutenberg list. Use the row above. |
| Job & Career Tools | 22768 | `/job-career-tools/` | Hand-written prose under **What Each Tool Does**. Add a linked sentence. |
| UAE Hospitality Career Toolkit | 46652 | `/career-toolkit/` | Gutenberg prose in named categories. Link the hospitality entry route in the planning section. |

## 3. Add the footer link

Add a **Career Change Roadmap** item to the footer menu pointing at
`/career-change-roadmap/`. To find the right menu:

```
wp menu list
wp menu item list <footer-menu-slug>
wp menu item add-custom <footer-menu-slug> "Career Change Roadmap" /career-change-roadmap/
```

## 4. Hospitality merge decision

The decision is made: hospitality uses the same coach, report, email gate and
follow-up chat. Keep `/hospitality-career-path/` as the specialist search and
entry page. It starts the shared coach at
`/career-change-roadmap/start?industry=hospitality`.

Do not redirect the hospitality URL to the internship guide or publish a second
independent scoring engine. Replace the page with
`wordpress/hospitality-career-path.html` only after the shared coach is live and
tested. The complete URL and claims contract is in `MERGE-AND-SEO-CONTRACT.md`.

## 5. Analytics

The parent site runs GA4 `G-PY9B70N583` with cross-domain linking. Because this
tool is on the main domain and the same property, pageviews flow in without any
change. If it ever moves to a subdomain, add that host to the `linker.domains`
array in the GA4 snippet.
