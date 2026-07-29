# Premium Launch Demo — Dubai Internship Eligibility Checker

**Product page:** https://inspireambitions.com/dubai-internship-eligibility-checker/
**Format:** 9:16 vertical, 1080×1920, 30 fps, ~34 seconds
**Design language:** premium-agency editorial — deep emerald + champagne gold,
Playfair Display + Inter, masked line-rise reveals, film grain. Same campaign
type system as the other premium cuts; emerald palette keeps this tool distinct.

**Deliverable:** `dubai-internship-checker-launch.mp4` — ready for TikTok as-is.

---

## Storyboard

| # | Time | Scene | Content |
|---|------|-------|---------|
| 1 | 0.0–4.2s | Hook | "DUBAI INTERNSHIPS · 2026 — Want a Dubai *internship?*" (readable at frame one) |
| 2 | 4.2–8.4s | Tension | "Most students apply *blind* — and never hear back." + "Visa status. Age rules. Permits. Eligibility comes first." |
| 3 | 8.4–12.2s | Reveal | "NEW · FREE TOOL — The Dubai Internship Eligibility *Checker*" |
| 4 | 12.2–24.5s | **Demo** | Ivory checker card: Q1 "How old are you?" → 18–24 selects · Q2 "What's your current status?" → University student selects · verdict: gold circle-and-tick draws, "**You're eligible.**", route "University training permit", 3 requirement lines (enrollment letter · employer-arranged MOHRE permit · health insurance) |
| 5 | 24.5–28.5s | Value | "Stop guessing. Check *first* — then apply." |
| 6 | 28.5–34.0s | CTA | "Your Dubai career starts with *clarity.*" → INSPIRE AMBITIONS → URL pill → "Free · 60 seconds · Link in bio" |

## Optional VO (~30s)

> Want a Dubai internship? Most students apply blind — and never hear back.
> Visa status, age rules, permits: eligibility comes first. The new Dubai
> Internship Eligibility Checker asks three questions and gives you your
> answer — and your exact route, with what you'll need. Stop guessing.
> Check first, then apply. Free, sixty seconds, link in bio.

## TikTok caption (paste-ready)

> Applying for Dubai internships without checking eligibility = applications
> into the void 🕳️ 3 questions. Your route. What you need. Free — link in bio.
> #DubaiInternship #DubaiJobs #UAEStudents #InternshipTips #DubaiCareers

## Re-render

```
cd reels/_assets && npm i playwright @ffmpeg-installer/ffmpeg
node render.mjs ../dubai-internship-checker-launch/source/reel.html ../dubai-internship-checker-launch/dubai-internship-checker-launch.mp4
```
Preview live: open `source/reel.html?play` in a browser.
