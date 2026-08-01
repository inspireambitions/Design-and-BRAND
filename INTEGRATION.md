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
answer before the app does. Checked against the live database — nothing claims it
today. The nearest neighbours are all posts and none collide:

```sql
SELECT ID, post_title, post_type, post_status FROM wpof_posts
WHERE post_name LIKE '%career-change%';
```

Re-run before launch in case something is published in the meantime.

## 2. List it on the tools hub

Add to `/career-tools/` (page ID **45594**), in the existing **Jobs and Career**
`<ul>`. This matches the format the CV Builder row already uses — link, then a
dash, then one line of description:

```html
<li><a href="/career-change-roadmap/">Career Change Roadmap</a> - Get a month-by-month plan to change careers: skill gaps, courses in your budget, salary stages and an honest difficulty rating</li>
```

Put it directly after the Hospitality Career Path Simulator row — that tool is
the closest neighbour, and the two read naturally as a pair.

**The other two hubs need different treatment.** They list tools as prose, not as
a link list, so the `<li>` above has nothing to sit in:

| Page | ID | Slug | How it lists tools |
|---|---|---|---|
| Free UAE Career Tools | 45594 | `/career-tools/` | Gutenberg `<ul>`, one `link - description` row per tool. Use the markup above. |
| Job & Career Tools | 22768 | `/job-career-tools/` | Hand-written HTML prose. Tools are named inside paragraphs under **What Each Tool Does**, then an FAQ in `<details>` blocks. |
| UAE Hospitality Career Toolkit | 46652 | `/career-toolkit/` | Gutenberg prose under **What You Will Find in This Toolkit**, tools grouped into four named categories. |

For 22768 and 46652, add a sentence naming the tool in the paragraph where it
belongs and link it there — a bare list item would read as pasted-in. On 46652
that means picking which of the four categories it falls under first; it is a
planning tool rather than a calculator, so it does not obviously belong to any
of them, and that choice is yours to make.

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
