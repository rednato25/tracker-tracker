## Design workflow

DESIGN.md and PRODUCT.md are the source of truth. If a skill conflicts with them, follow DESIGN.md and report the conflict.
The dashboard must show in 3 seconds: total uploaded, total downloaded, overall ratio, and how far each tracker is from its next rank.
For UI work, use one skill per step, in this order:
1. Direction: /impeccable critique, then distill or typeset if needed. Update DESIGN.md when a decision changes.
2. Build to DESIGN.md.
3. Stress test: break-ui. Put worst-case data in e2e/test fixtures, never a toggle in the shipped app. Report breaks before fixing.
4. Phone: mobile-native at 390px.
5. Check: web-design-guidelines, then /impeccable polish.
6. Optional: emil-design-eng for a final detail pass.
For dashboard layout and visual direction, use Yata-Dash (GPL-3.0, https://github.com/Yata-Dash/Yata-Dash) as the reference. Use IBM Carbon's data-visualization guidance (carbondesignsystem.com) only to choose which chart answers each question; remove charts that don't answer one.
Do not use other design skills (palette generators, alternative DESIGN.md writers) unless asked. Keep dashboard motion minimal; no new animations without approval.
Only run this workflow when a task asks for design work. Feature and fix tasks follow DESIGN.md without running the full skill sequence.

## Running commands

- Unit tests: `pnpm test:run`. Never plain `pnpm test`; Vitest watch mode never exits.
- Local Node 26 hides `localStorage` in jsdom, which causes about 25 false test failures. Locally, run tests with the `--localstorage-file` flag (as used in PR #51) or Node 24. CI on Node 24 is the gate.
- Never start `pnpm dev` or `pnpm start` in the foreground. For screenshots, rely on Playwright's webServer config. If Postgres or the e2e database is not running, stop and report instead of waiting.
- Give any command that could run longer than 10 minutes a timeout, and report if it times out.
- Never stash, move, commit or delete `docs/TRACKER_TRACKER_KILO_PLAN.md`.
- Commit and push after each numbered step. One PR per task.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
