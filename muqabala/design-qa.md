# Muqabala employer link settings design QA

## Evidence

- Source visual truth: `C:\Users\Kim\.codex\generated_images\01a01fce-709f-74d2-a61a-a814e312362b\exec-1654651d-c507-45af-9dec-122812f25d83.png`
- Mobile implementation: `C:\Users\Kim\.codex\visualizations\2026\08\20\01a01fce-709f-74d2-a61a-a814e312362b\muqabala-link-settings-mobile.png`
- Desktop implementation: `C:\Users\Kim\.codex\visualizations\2026\08\20\01a01fce-709f-74d2-a61a-a814e312362b\muqabala-link-settings-desktop.png`
- Focused comparison: `C:\Users\Kim\.codex\visualizations\2026\08\20\01a01fce-709f-74d2-a61a-a814e312362b\muqabala-link-settings-comparison.png`
- State: employer signed-in form with company, job title and job description complete; default 100 places and 14 days; both actions enabled.

## Normalisation

- Source pixels: 853 × 1844 at 72 dpi.
- Mobile browser CSS viewport: 390 × 844. Browser screenshot output: 375 × 1385 at 72 dpi.
- Source was proportionally normalised to 375 × 811 for the focused comparison.
- The implementation was cropped to the matching form region at 375 × 1000.
- The in-app browser emitted a screenshot 15 pixels narrower than its reported CSS viewport. DOM measurements confirmed a 390-pixel viewport and no horizontal overflow, so the clipped right edge in the comparison is a capture artefact.
- Desktop browser CSS viewport: 1440 × 1000. Browser screenshot output: 1425 × 1348 at 72 dpi.

## Required fidelity surfaces

- Fonts and typography: display and body families, weights, hierarchy and line lengths follow the existing Muqabala employer design. Labels remain readable at 320 pixels.
- Spacing and layout rhythm: the two-value settings row, reset action, helper copy and action order match the selected compact direction. Controls remain at least 44 pixels high. No horizontal overflow was found at 320, 390 or 1440 pixels.
- Colours and tokens: paper, ink, muted text and jade accents use the existing employer tokens. The chosen count and closing date receive the same jade emphasis as the source.
- Image quality and assets: the target contains no image assets. No substitute icons, emoji, SVG drawings or placeholder art were introduced.
- Copy and content: the setting names, limits, closing rule and recruiter-facing summary are clear. The singular option reads `1 day`, not `1 days`.

## Full-view comparison evidence

The desktop capture confirms that the settings section sits between the job description and the two actions without widening the existing form. The mobile capture confirms the same hierarchy in one column, while keeping the two settings on one compact row.

## Focused comparison evidence

The combined comparison shows the selected source on the left and the rendered form on the right. Both use a quiet divider, one compact row for capacity and expiry, clear helper text, an outlined generation action, a solid link action and a closing summary. The numbered action markers are an intentional carry-over from the existing Muqabala sequence so employers still understand which action comes first.

## Comparison history

### Iteration 1

- [P2] The reset action sat below the settings heading instead of on the same line.
- [P2] The one-day option read `1 days`.
- Fix: replaced the fieldset legend layout with an accessible labelled header row and added a singular translation.
- Post-fix evidence: the mobile and desktop captures show the heading and reset action aligned, with no overflow.

### Iteration 2

- [P2] The summary described a duration but did not show the exact closing date or emphasise the two chosen values.
- Fix: added the calculated closing date and jade emphasis for the candidate limit and date.
- Post-fix evidence: the final focused comparison shows the values clearly below the two actions.

## Interaction and console checks

- Native number and select controls are exposed with accessible names.
- All inputs and buttons meet the 44-pixel minimum target at 320 pixels.
- The create action remains disabled until the required vacancy content and valid limits are present.
- The Reset action restores 100 places and 14 days in component state.
- No browser console errors were recorded.
- The complete resilience suite passed, including link-setting validation and atomic capacity enforcement.

## Findings

No actionable P0, P1 or P2 visual findings remain.

## Follow-up polish

- [P3] A future employer-dashboard redesign may reuse the same compact settings summary when a recruiter opens an existing link.

final result: passed
