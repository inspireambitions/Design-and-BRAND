# Muqabala Product Council

Living charter for product decisions. Every significant ship is reviewed here before release.

---

## Mission

Build products where a Gulf job seeker or hiring manager says: *"I did not know interviews could work like this."*

**Muqabala Coach** (candidates): *"The interview stopped feeling like a trap."*  
**Muqabala Screening** (employers, phase two): *"I can see who can do the job — fairly — at scale."*

One scoring philosophy. Two experiences. Humans decide.

---

## Council roster (9 seats)

| # | Seat | Persona | Veto domain |
|---|---|---|---|
| 1 | Gulf HR buyer | Mariam Al-Suwaidi — Group HR, Riyadh | Trust, compliance, nationalization |
| 2 | Volume recruiter | Rohit Menon — Dubai agency | Bulk workflows, WhatsApp journey |
| 3 | Candidate dignity | Layla Haddad — candidate experience | Fear reduction, transparency, retries |
| 4 | AI integrity | Priya Nair — AI product | Scoring fairness, evidence, consistency |
| 5 | Go-to-market | Daniel Chen — SaaS GTM | Pricing, pilots, proof metrics |
| 6 | Data & law | Fatima Al-Farsi — employment counsel | Consent, retention, PDPL, no surveillance |
| 7 | Category designer | External product design lead (TBD) | Hero journey, kill complexity |
| 8 | Gulf workforce voice | Rotating real candidate (2 per quarter) | Phone, data, language, fear |
| 9 | Founder chair | Inspire Ambitions | Vision, final call, resources |

**Ship rule:** 5 of 9 yes votes required. Layla, Priya and Fatima cannot vote no on anything candidate-facing.

---

## The iPhone bar (decision filter)

Before any major bet, answer all five. Weak answers stop or shrink the work.

1. **One feeling** — Can a user describe the product in one emotional sentence without saying "AI"?
2. **What we killed** — What did we remove this quarter? (No kills = decorating, not innovating.)
3. **Magic moment** — Can a new user reach it in under 3 minutes on a cheap Android phone?
4. **Published proof** — Would we put this metric on the homepage? (Consistency, accent fairness, time-to-shortlist.)
5. **Category vs decoration** — Does this create a new default behaviour or a better checklist?

---

## Operating rhythm

| Cadence | Duration | Focus |
|---|---|---|
| Monthly strategy | 90 min | One metric per side, one kill proposal, one iPhone bet |
| Fortnightly ship review | 45 min | Six-advisor checklist from `CODEX.md` — met / missing / deferred |
| Weekly candidate voice | 30 min | Stories from Seat 8, not surveys |
| Quarterly impact audit | Half day | Score 1–5 on fear, explainability, Gulf specificity, simplicity, defensibility |

---

## Case study #1 — Chef Dil pilot (August 2026)

**Tester:** Negi Solomon, Cluster Learning & Development Manager  
**Candidate:** Chef Dil, Chef Tournant role  
**Context:** Three full mock interviews with job-advert tailoring and transcript editing allowed on the final run.

### Results

| Run | Setup | Overall score |
|---|---|---|
| 1 | Job advert pasted, wrong title (Chef de Partie) | 27/100 |
| 2 | Correct title and description | 29/100 |
| 3 | After reviewing feedback; transcripts edited | 32/100 |

### What worked (council yes)

- Tailored questions matched the role (kitchen duties, Gulf motivation, STAR-style prompts).
- Evidence-based feedback quoted what the candidate actually said.
- Transcript editing before scoring helped when speech recognition garbled answers.
- Score moved up (+5) after the candidate acted on recommendations — progress is visible.

### What failed (council no — must fix)

| Issue | Council owner | Status |
|---|---|---|
| Questions 4–6 returned "Try getting feedback again" instead of real feedback | Priya | **Shipped** — retry button on reports + failed scoring status |
| Desktop Chrome/Explorer could not run video interview | Seat 8 + Category designer | **Shipped** — device guidance + desktop video disabled |
| Video preview dropped on some questions (run 3) | Priya | **Shipped** — capture re-acquire between questions |
| Raw transcript dominates the report; feels utilitarian not premium | Category designer | **Shipped** — premium report redesign |
| Candidate struggled to understand questions and structure answers | Layla | **Shipped (guided)** — STAR follow-up probing after weak scores |

### Council verdict on STAR follow-ups

Negi's suggestion: *"Incorporate follow-up questions using funneling and probing through STAR."*

**Approved as Q1 2026 bet** — not for Screening yet; for Coach only.

Design constraints:

- Follow-ups are **coaching**, not scoring traps. Unlimited retries stay.
- Probe one missing STAR part at a time (Situation → Task → Action → Result).
- Never score face, accent or fluency.
- If the candidate opts out, continue the mock without penalty.

---

## Active mandates (from Case study #1)

### Mandate A — Premium reports (Category designer + Layla)

Reports must feel like something a candidate is proud to share with a coach or recruiter.

- Hero summary with overall score ring and attempt metadata
- Per-question score and headline above the fold; transcript collapsed by default
- Clear pending state when feedback failed (not buried under "What is missing")
- Print/PDF layout that survives WhatsApp forwarding

### Mandate B — Feedback reliability (Priya)

- Retry scoring from the report when integrity check fails
- Log integrity failures with question id only (no transcript in logs)
- Target: fewer than 5% of answers in a full mock without scored feedback

### Mandate C — Guided STAR coaching (Layla + Seat 8)

- After a weak answer, offer one optional follow-up: "Tell me more about what **you** did"
- Ship behind a feature flag; test with 5 candidates like Dil before default-on

### Mandate D — Device honesty (Seat 8)

- Before camera check: "Works best on Chrome for Android or iPhone. Desktop video support is limited."
- Typing path always visible and equal

---

## Category we own

**Fair proof before the real interview.**

Not "AI interview practice." Not "video screening tool." Proof — quoted, explainable, private for candidates; structured and human-decided for employers.

---

## Document history

| Date | Change |
|---|---|
| 2026-08-27 | Charter created. Case study #1 (Chef Dil) logged. Mandates A–D assigned. |
