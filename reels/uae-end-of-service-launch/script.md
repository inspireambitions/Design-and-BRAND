# Premium Launch Video — UAE End of Service Calculator

**Product page:** https://inspireambitions.com/uae-end-of-service-calculator/
**Format:** 9:16 vertical, 1080×1920, 30 fps, ~34 seconds
**Design language:** cinematic premium-agency — deep ink navy + champagne gold,
Playfair Display serif + Inter, masked line-rise reveals, hairline ledger
rules, film grain, slow expo easing. Companion piece to the promotion-readiness
demo (same type system, dark palette variant).

**Deliverable:** `uae-end-of-service-launch.mp4` — ready to post, or add VO + music.

---

## Storyboard

| # | Time | Scene | Content |
|---|------|-------|---------|
| 1 | 0.0–4.0s | Cold open | Eyebrow "FOR EVERY UAE PROFESSIONAL" → serif "Leaving a job in the *UAE?*" |
| 2 | 4.0–8.5s | Premise | "Your final settlement is *more* than gratuity." + "Unused leave. Basic-salary rules. The two-year cap. It all changes your number." |
| 3 | 8.5–12.5s | Reveal | "NEW · UPDATED FOR 2026 — The UAE End of Service *Calculator*" + "Your complete settlement — not just an estimate of one part." |
| 4 | 12.5–21.0s | **Settlement ledger** (centerpiece) | Elegant ledger draws line by line: Gratuity (21 days × 5 yrs) counts to **AED 35,000** → Unused leave payout (12 days) counts to **AED 4,000** → gold rule → FINAL SETTLEMENT counts to **AED 39,000** in champagne serif · "Yours will be different. That's the point." |
| 5 | 21.0–26.0s | Legal grounding | "Grounded in the *law.*" + card: Federal Decree-Law No. 33 of 2021, Articles 51 & 53 · "Basic-salary based · two-year cap applied · updated March 2026" |
| 6 | 26.0–34.0s | CTA | "Know your number. *Then* sign." → INSPIRE AMBITIONS → URL pill → "Free · No signup · Link in bio" |

Example figures use the MOHRE convention (basic AED 10,000 ÷ 30 × 21 × 5 =
AED 35,000) plus an illustrative 12-day leave payout; the tool computes the
viewer's actual numbers.

## Optional VO script (~32s, low, assured delivery)

> Leaving a job in the UAE? Your final settlement is more than gratuity.
> Unused leave, basic-salary rules, the two-year cap — it all changes your
> number. The new UAE End of Service Calculator gives you the complete figure,
> in seconds. Built on Federal Decree-Law thirty-three of twenty-twenty-one,
> Articles fifty-one and fifty-three. Know your number. Then sign. Link in bio.

**Music note:** sparse cinematic piano/strings or a deep ambient pulse;
let the count-ups land in near-silence for weight.

## Re-render

```
cd reels/_assets && npm i playwright @ffmpeg-installer/ffmpeg
node render.mjs ../uae-end-of-service-launch/source/reel.html ../uae-end-of-service-launch/uae-end-of-service-launch.mp4
```

Preview live: open `source/reel.html?play` in any browser.
