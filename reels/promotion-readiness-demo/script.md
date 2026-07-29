# Premium Demo Video — Promotion Readiness Assessment Test

**Product page:** https://inspireambitions.com/promotion-readiness-assessment-test/
**Format:** 9:16 vertical, 1080×1920, 30 fps, ~43 seconds
**Design language:** premium-agency editorial — Playfair Display serif + Inter,
warm ivory/charcoal/antique-gold palette, masked line-rise reveals, hairline
rules, film grain, slow expo easing. Deliberately distinct from the
fast-cut caption style of the gratuity reel.

**Deliverable:** `promotion-readiness-demo.mp4` — ready to post, or add VO + music.

---

## Storyboard

| # | Time | Scene | Content |
|---|------|-------|---------|
| 1 | 0.0–4.5s | Title | Eyebrow "INSPIRE AMBITIONS · CAREER TOOLS" → serif "Are you ready for your *next* promotion?" · line-rise reveals, gold rule draws |
| 2 | 4.5–9.0s | Tension | "Most professionals *guess.*" → "Now you can *know.*" |
| 3 | 9.0–13.5s | Product intro | "INTRODUCING — The Promotion Readiness *Assessment*" + descriptor + level chips (Entry / Mid-level / Management, Management selected) |
| 4 | 13.5–29.0s | **Product demo** | White assessment card, three beats: ① MCQ scenario question — options fade in, best answer selects, progress 4/12→5/12 · ② open-ended question — achievement answer types in live · ③ results — readiness ring draws to **78/100**, verdict "Promotion-ready — *with two gaps to close*", breakdown bars Leadership 82 / Achievements 74 / Visibility 61 |
| 5 | 29.0–35.0s | Value | "Know your gaps *before* your manager does." + 3 check lines (three tracks · real scenarios · actionable score) |
| 6 | 35.0–43.0s | CTA | "Walk into your review with *proof.*" → brand → URL pill → "Free assessment · Link in bio" |

## Optional VO script (~40s at a calm, premium pace)

> Are you ready for your next promotion? Most professionals guess. Now you can
> know. The Promotion Readiness Assessment measures where you actually stand —
> at entry, mid, or management level. Real scenario questions. Real evidence of
> how you work. And at the end: a readiness score you can act on — with the
> exact gaps holding you back. Know them before your manager does. Take the
> free assessment. Link in bio.

**Music note:** a soft piano or warm minimal electronic bed suits this cut —
avoid trending/upbeat TikTok tracks; this is the "quiet luxury" edit.

## Re-render

```
cd reels/_assets && npm i playwright @ffmpeg-installer/ffmpeg
node render.mjs ../promotion-readiness-demo/source/reel.html ../promotion-readiness-demo/promotion-readiness-demo.mp4
```

Preview live: open `source/reel.html?play` in any browser.
