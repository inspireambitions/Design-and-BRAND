# Employer Option 2 design QA

## Reference and implementation

- Approved reference: `C:\Users\Kim\.codex\generated_images\01a02dc6-6e35-7c60-961e-89680e3043fe\exec-c73a4399-c4b0-4c1c-b6d9-23f915252aca.png`
- Production-build screenshot: `design-qa-mobile.png`
- Combined side-by-side evidence: `design-qa-comparison.png`
- Reference dimensions: 853 × 1844 pixels
- Browser viewport: 390 × 844 CSS pixels
- Normalised implementation dimensions in the comparison: 853 × 1846 pixels
- State: English, empty form, workplace collapsed

The screen is one continuous mobile view, so the full-view comparison is also the focused comparison. No separate crop is needed.

## Findings and iterations

1. The first implementation was too tall at the phone breakpoint. The title wrapped and the page measured 1,102 pixels high.
2. The title size, field density, textarea rows, form spacing and bottom padding were corrected.
3. The final 390 × 844 production build is exactly one viewport high with no horizontal or vertical overflow.
4. The layout preserves the approved visual hierarchy, warm ivory background, jade controls, single action and human-decision assurance.
5. The CTA intentionally reads “Create 14-day candidate link”, which was the approved copy correction.

No P0, P1 or P2 visual issues remain.

## Responsive and interaction checks

- 320 × 740: no horizontal overflow; title and CTA wrap safely.
- 390 × 844: no horizontal or vertical overflow.
- 768 × 1024: no horizontal overflow.
- 1440 × 900: no horizontal overflow and the content remains centred.
- Arabic: RTL direction, translated heading and retained field values confirmed; no overflow.
- Workplace: disclosure opens and the optional field is usable.
- Short job description: warning appears before any request is sent.
- Console: no errors or warnings in the local production build.

Final result: passed
