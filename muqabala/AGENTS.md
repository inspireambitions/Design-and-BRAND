<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Muqabala Multi-Agent Operating Contract

## 1. Absolute Rule: Production Safety
`trymuqabala.com` is a **LIVE PRODUCTION PRODUCT**.
- **NEVER** push directly to `main` or the default production branch (`claude/gulf-hospitality-video-interview-m9skfu`).
- **NEVER** run migrations against the production Supabase database (`hmaxzpgsefzpflrwzopa`) without explicit user sign-off.
- **NEVER** deploy to Vercel production without a verified preview deployment and explicit approval.
- **NEVER** delete, rebase, or force-push branches or active worktrees.

## 2. Mandatory Pre-Flight Protocol (Run Before Any Work)
Before modifying code or executing commands, every AI agent must execute this sequence:

1. **Check Production Baseline:**
   - Verify the current deployed production commit SHA (see `docs/PRODUCT_STATE.md`).
   - Confirm your baseline does not overwrite or regress deployed features.

2. **Inspect Active Worktrees:**
   - Run `/Library/Developer/CommandLineTools/usr/bin/git worktree list`.
   - Never edit in a worktree owned or recently used by another branch or active agent unless explicitly instructed.
   - Do all isolated integration or experimental work in a dedicated worktree (e.g. `muqabala-integration`).

3. **Read Shared Memory:**
   - Read `docs/PRODUCT_STATE.md` (truth on branches, deployments, and database status).
   - Read `docs/CURRENT_SPRINT.md` (active work, locks, and deliverables).
   - Read `docs/DECISIONS.md` (architectural decisions and constraints).

4. **Verify Clean Baseline:**
   - Run `/Library/Developer/CommandLineTools/usr/bin/git status` to ensure a clean working tree.
   - Run `npx tsc --noEmit` and targeted test suites to confirm baseline health before changing files.

## 3. Database Migration Protocol
- **Monotonic Timestamps:** Migration files in `supabase/migrations/` MUST strictly follow monotonic timestamp ordering (`YYYYMMDDHHMMSS_name.sql`).
- **Never backdate:** If production is at `20260916023211`, any new migration must have a timestamp strictly greater (e.g. `20260916120000`).
- **Additive & Idempotent:** All migration scripts must use `IF NOT EXISTS`, safe column additions, and non-destructive DDL. Never drop production columns or tables.

## 4. Verification Gates
Before committing or marking any task as complete, run and pass:
```bash
# 1. Type check
npx tsc --noEmit

# 2. Linter check
npm run lint

# 3. Production build test
npm run build

# 4. Domain test suites
npm run test:recruiter-suite
node scripts/employer-delivery-sql.test.mjs
node scripts/employer-video-screening.test.mjs
node scripts/schools-access-routing.test.mjs
node scripts/schools-pilot-operations.test.mjs
node scripts/schools-practice-retry.test.mjs
node scripts/schools-pilot-receipt.test.mjs
npm run test:security
```

## 5. Tooling & Platform Constraints
- **Git binary:** On macOS, invoke `/Library/Developer/CommandLineTools/usr/bin/git` (avoid `/usr/bin/git` which can trigger the Xcode CLI license prompt).
- **Node modules in worktrees:** Turbopack requires `node_modules` inside the workspace directory (do not use external symlinks; copy or clone via APFS `cp -c -R`).
- **Next.js Font Fetch:** `npm run build` downloads Google Fonts at build time and requires network access.

## 6. Agent Handoff Protocol
Before completing your execution turn:
1. Ensure the working tree is clean.
2. Update `docs/CURRENT_SPRINT.md` with active tasks and completed milestones.
3. Append a handoff entry to `docs/AGENT_HANDOFF.md` detailing:
   - What was accomplished
   - Git commit SHAs
   - Verified test results
   - Exact next steps for the incoming agent
