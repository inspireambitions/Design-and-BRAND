# Product Launch Reel — UAE Gratuity Calculator

**Product page:** https://inspireambitions.com/uae-gratuity-calculator/
**Format:** 9:16 vertical, 1080×1920, 30 fps, ~31 seconds
**Style system:** per `studies/ali-abdaal-tiktok-editing-study.md` — captions are the
primary visual, one yellow keyword per phrase (red for negative words), pop-in
bounce, hard cuts only, fully consumable on mute.

Two ways to use this package:

1. **Motion-graphics reel (rendered, in this folder):** `uae-gratuity-launch-reel.mp4`
   — ready to post as-is, or drop into CapCut to add VO + music (checklist below).
2. **Talking-head variant (HeyGen):** paste Block 1 of
   `studies/heygen-style-prompt.md` as the style preset, then use the script below
   as the spoken script.

---

## Script (HeyGen-ready, follows the repo template)

**[HOOK]**
Most UAE employees get underpaid when they leave their job.

**[PROMISE]**
Here's how to know exactly what you're owed — in thirty seconds, for free.

**[POINT 1 — the law]**
UAE Labour Law is clear. Twenty-one days of basic pay for every year you've
worked — thirty days per year once you pass five years.

**[POINT 2 — the tool]**
Type in your basic salary and your years of service. Five years on ten thousand
dirhams basic? That's thirty-five thousand dirhams. Your money.

**[POINT 3 — credibility]**
This calculator was built by an HR insider with over twenty years in UAE hotel
HR — it handles limited and unlimited contracts, and it's completely free.

**[PAYOFF/CTA]**
Know your number before you sign anything. Link in bio.

---

## Storyboard / caption timings (as rendered in the MP4)

| # | Time | Scene | On-screen captions (yellow = highlighted keyword) |
|---|------|-------|---------------------------------------------------|
| 1 | 0.0–3.2s | **Hook** — dark navy, captions only | "MOST UAE EMPLOYEES" / "GET **UNDERPAID**" (red) / "when they leave their job." |
| 2 | 3.2–6.4s | **Promise** | "Know **EXACTLY** what you're owed" / "in 30 seconds — for **FREE**." / badge: "UAE Labour Law • 2026" |
| 3 | 6.4–13.0s | **Point 1 — the law** (stacked list card) | "YOUR GRATUITY, BY LAW:" / "**21 days** basic pay / year (first 5 years)" / "**30 days** / year after that" / footnote: Federal Decree-Law No. 33 of 2021 |
| 4 | 13.0–22.0s | **Point 2 — calculator demo** (phone mockup) | Inputs type in: Basic salary AED 10,000 · 5 years → button press → count-up to "**AED 35,000**" / caption: "See **YOUR** number in seconds" |
| 5 | 22.0–26.0s | **Point 3 — credibility** | "Built by a UAE **HR INSIDER**" / "**20+ years** in Gulf hotel HR" / badges: "Limited & unlimited contracts" · "Free • No signup" |
| 6 | 26.0–31.0s | **CTA card** | "Know your number **BEFORE** you resign." / INSPIRE AMBITIONS / URL pill: inspireambitions.com/uae-gratuity-calculator / "**Link in bio** 🔗" |

Worked example shown in scene 4 uses the standard MOHRE convention:
basic salary ÷ 30 × 21 days × 5 years = AED 10,000 ÷ 30 × 21 × 5 = **AED 35,000**.

---

## Post checklist (CapCut/Submagic — per Block 3 of the HeyGen preset)

1. **VO:** record the script above (or HeyGen avatar) and lay it under the render —
   scene timings above match the script's natural pace at ~150 wpm.
2. **Music:** quiet lo-fi bed, ~−20 dB under voice.
3. **SFX:** soft pop on each caption hit, whoosh on scene cuts, a "ding" or subtle
   cash register on the AED 35,000 count-up landing.
4. **Hook check:** the bold claim is readable at frame one — do not add an intro.

---

## Source

- `reel-source/reel.html` — the full animation (deterministic, seekable by time)
- `reel-source/render.mjs` — Playwright frame renderer + ffmpeg encode
- Re-render: `cd reel-source && npm i playwright @ffmpeg-installer/ffmpeg @fontsource/montserrat && node render.mjs`
