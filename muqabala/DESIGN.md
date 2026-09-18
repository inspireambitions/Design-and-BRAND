# Muqabala Design System & Aesthetic Foundation

## 1. Design Thesis
Muqabala is a high-trust, institutional, evidence-based career development platform.
It is built for higher education career centres, university faculty, employer talent teams, and ambitious candidates across the Gulf and globally.

It is **NOT**:
- An opaque AI scoring widget
- A gamified test with superficial confetti or emojis
- A generic HR SaaS with garish KPI stripes or arbitrary colored borders
- A psychometric profiling engine

**Core Pillars:**
1. **Institutional Serenity:** Calm, legible, dignified, and authoritative layout. Generous white space, clear typography hierarchy, and purposeful information density.
2. **Pedagogical Clarity:** Student feedback is structured strictly for growth:
   - What you did well
   - What to strengthen
   - Evidence from your response
   - What to practise next
   - Secondary rubric breakdown
3. **Evidence-Based Review by Exception:** Educators and advisers review by exception based on factual behavioral signals (sparse answers, repeated fallbacks, low evidence coverage, deadline pressure). No opaque AI overall scores, no peer ranking.
4. **Bilingual Legibility (EN/AR):** First-class English and Modern Standard Arabic typography and layout symmetry, respecting bidirectional reading flows.

---

## 2. Design Tokens

### Semantic Color Palette
```css
:root, .schools-shell {
  /* Surfaces */
  --surface: #ffffff;
  --surface-ground: #f8f6ef;
  --surface-muted: #f1f5f2;
  --surface-subtle: #fafaf8;

  /* Typography */
  --text-main: #163e39;
  --text-muted: #42665b;
  --text-dim: #64748b;
  --text-inverse: #ffffff;

  /* Institutional Identity & Actions */
  --brand: #075c50;
  --brand-hover: #05483f;
  --brand-focus: #b44e0d;
  --brand-subtle: #eef4ec;

  /* Structure & Borders */
  --border-subtle: #c9d8d0;
  --border-strong: #54796e;
  --border-focus: #075c50;

  /* Factual Evaluation Feedback */
  --success-surface: #f0fdf4;
  --success-border: #bbf7d0;
  --success-text: #166534;

  --warning-surface: #fffbeb;
  --warning-border: #fef3c7;
  --warning-text: #92400e;

  --danger-surface: #fef2f2;
  --danger-border: #fca5a5;
  --danger-text: #991b1b;
}
```

### Typography Hierarchy
```css
:root, .schools-shell {
  --font-sans: 'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-heading: 'Bricolage Grotesque', 'Public Sans', -apple-system, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```
- **Primary Body & Form Controls:** `var(--font-sans)` (`Public Sans`). Highly legible, geometric proportions, optimal for technical and institutional reading.
- **Display Headings (`h1`, `h2`):** `var(--font-heading)` (`Bricolage Grotesque`). Distinctive, authoritative editorial presence without eccentricity.
- **Case Rule:** Strict sentence case across all headings, badges, and action buttons. No title case screaming or ALL CAPS badges.

---

## 3. Component & Layout Standards

### Educator Workspace Layout
- **Max Width:** 1280px &ndash; 1440px desktop container (`max-width: 1320px; margin: auto; padding: 40px 24px`).
- **Student Focus Flow:** 780px &ndash; 840px max width for active interview and feedback review to preserve reading comfort and avoid eye strain.
- **Card Styling:** Unified institutional subtle borders (`1px solid var(--border-subtle)`), border-radius 10px &ndash; 12px, background white.
- **Borders Policy:** No arbitrary colored 4px KPI top/left borders. Status is conveyed via structured text, calm badges (`.schools-state`), and explicit exception summaries.

### Attempt Comparison
- Side-by-side on desktop (> 600px) using CSS Grid `repeat(auto-fit, minmax(280px, 1fr))`.
- Stacked on mobile (< 600px) without horizontal scrolling or truncation.

### Voice and Copy Principles
- **No AI Hype / Slop:** Never use buzzwords like "supercharge", "unleash", "cutting-edge AI", or "revolutionary".
- **Factual & Reassuring:** State what happens simply and clearly: "One moment…", "Continue", "Your answers are saved securely."
- **Calm Completion:** Complete an interview with quiet dignity: "Practice interview complete. Your responses across all questions have been recorded." No emojis or confetti animations.
