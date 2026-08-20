# Muqabala

**AI interview practice for Gulf job seekers.** Answer real interview questions on camera,
get specific feedback on what you actually said, and retry until your score climbs.

> Practice until the interview feels less scary.

## Quick start

```bash
npm install
npm run dev     # http://localhost:3000
```

The app is fully functional with no configuration. Add an `ANTHROPIC_API_KEY` to
`.env.local` to switch scoring from the built-in practice scorer to the Claude-powered
AI coach:

```bash
cp .env.example .env.local
# then paste your key into ANTHROPIC_API_KEY
```

## What it does

- **12 roles across 11 industries** — hospitality, retail, healthcare, logistics, finance,
  construction, education, security, HR, sales, corporate admin
- **Bilingual** — full English and Arabic UI with proper right-to-left layout
- **Records on camera** with a live transcript, and a countdown that does not punish you
- **Unlimited retries** on any question
- **Evidence-based feedback** — every competency score quotes your own words back to you,
  plus one concrete thing to change next time
- **Progress tracking** across attempts, so improvement is visible

## Privacy

Your video never leaves your device — only the text transcript is sent for scoring.
Practice history is stored in your browser's local storage, not on a server.

## Scoring principles

Answers are judged on **content only**. Never appearance, facial expression, emotion,
accent, or grammar fluency. A candidate with imperfect English who tells a specific,
well-structured story scores higher than a fluent but vague one. Garbled or too-short
transcripts are flagged honestly rather than scored low.

## Deploying

Deploys to Vercel with no configuration (framework auto-detected). Set `ANTHROPIC_API_KEY`
in the project's environment variables to enable AI scoring in production.

## For AI collaborators

See [`CODEX.md`](./CODEX.md) — the full briefing on architecture, hard rules, roadmap and
the advisory board the product is reviewed against.

## Stack

Next.js (App Router) · TypeScript · hand-written CSS · Anthropic SDK · zod

---

Muqabala · Inspire Ambitions
