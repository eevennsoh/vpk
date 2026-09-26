# Workflows (Extended)

## Build and Run

- Build: `pnpm run build`
- Build the static export used in production: `pnpm run build:export` (never run `NEXT_OUTPUT=export pnpm run build` directly — the wrapper temporarily moves runtime-only App Router API routes before invoking the export build)
- Start frontend + backend for browser verification: `pnpm run dev:tmux:start` (runs the dev stack through `portless run`, so it prints a stable `.localhost` URL)
- Start frontend + backend in the foreground when tmux is unavailable: `pnpm run dev`
- Discover actual worktree URLs/ports: `pnpm ports` (prefer the Portless `🌐 https://…` URL), with `.dev-frontend-port` and `.dev-backend-port` as fallback

## Launcher Matrix

- `pnpm run rovo` — 1 Rovo Serve instance + backend + frontend; `pnpm run rovo -- 6` for the full pool. First run prints a `ROVO_SESSION_TOKEN` to copy into `.env.local`.
- `pnpm run rovo:tmux:start --1` / `--6` — frontend, backend, and Rovo pool in the detached tmux session; stop with `pnpm run rovo:tmux:stop`.
- `pnpm run dev:rovo` — Rovo Serve only; `pnpm run dev:frontend` / `pnpm run dev:backend` — single services.
- `pnpm run dev:tmux:attach` — attach to the detached dev session for logs (detach with `Ctrl-b` then `d`); `pnpm run dev:tmux:status` — non-interactive session/port snapshot; `pnpm run dev:tmux:stop` — stop this worktree only.
- Vanilla `portless run` — derives the main and branch hostnames from `package.json`'s package name; use `pnpm ports once` to read the exact URL. Add `--name <worktree-dir>` only when HEAD is detached, and `--script rovo` only when the surface needs Rovo Serve. The `/portless` command resolves this.
- Tmux/Rovo launchers seed `.env.local` (main worktree copy, then `.env.local.example`); copy or symlink it manually only when starting backend/frontend entrypoints outside these launchers.

## Deployment

Preferred path:

- `/vpk-deploy`

Direct scripts:

- `./.cursor/skills/vpk-deploy/scripts/deploy.sh <service> <version> [env]`
- `./.cursor/skills/vpk-deploy/scripts/deploy-check.sh`
- `pnpm run deploy:micros`

Before first deployment:

1. Update `service-descriptor.yml` with your service name
2. Replace `YOUR-SERVICE-NAME`
3. Keep service name <= 26 chars, lowercase + hyphens

## Validation

There is no single `pnpm test` script. Run targeted `node --test` files or
`pnpm exec playwright test <spec>` for touched behavior, and keep observational
checks for UI changes.

Run on every change:

1. `pnpm run lint`
2. `pnpm run typecheck`

Run before shipping broad local changes:

1. `pnpm run validate:local` for the full local gate that mirrors the PR guard
   set: lockfile, route manifest, API surfaces, repo map, file size, catalog,
   lazy load, documented script references, lint, typecheck, Rovo core tests,
   and JS unit tests.

Run for bundle-sensitive changes:

1. `pnpm run perf:budget:warn` to measure a fresh manual baseline and report
   warnings.
2. `pnpm run perf:budget` to measure a fresh baseline and enforce the strict budget
   before shipping performance or bundle work.
3. `pnpm run perf:budget:check:warn` or `pnpm run perf:budget:check` to verify
   an existing `output/perf-baseline.json` without regenerating it.
4. For route load timing, run `pnpm run perf:baseline`, start the dev stack,
   read the Portless URL from `pnpm ports`, then run
   `pnpm run perf:baseline:timing -- --base-url <URL>`.
5. Do not commit `output/perf-baseline.json`; it is local evidence.

Run additionally for UI changes:

1. After editing code served by the local Next.js app, load and follow `next-dev-loop` for the `/_next/mcp` plus `agent-browser` runtime cross-check.
   Resolve the requested object route before opening a browser and navigate directly on the current worktree origin. Follow [Browser Verify Worktree](playbooks/browser-verify-worktree.md); home-first navigation is for explicit catalog/entry-path checks.
2. For browser work that is not verifying a Next.js edit, use `agent-browser` (`npx agent-browser`) by default for local/isolated web work, screenshots, UI probes, visual debugging, and responsive checks. Load and follow the `agent-browser` skill before using it so command patterns match the installed version. Fall back to the Playwright CLI only when `agent-browser` is unavailable or blocked, and load the `playwright` skill before using that fallback. In parallel worktrees, prefer the worktree's Portless URL from `pnpm ports` (the `🌐 https://…` entry — it survives dev-server restarts and is origin-isolated per worktree); fall back to the frontend URL from `.dev-frontend-port` only when no portless route exists. Do not assume the default frontend port.
3. Accessibility checks — both MCP-only, with no `atlas ads` CLI equivalent:
   - `ads_analyze_a11y` for component code
   - `ads_analyze_localhost_a11y` for live page
   - For the ADS guidance behind a finding, use the CLI instead: `atlas ads docs a11y <buttons|forms|images|colors|focus|keyboard|screenReaders|aria|wcag|general>` (add `--json` when parsing). Fall back to `ads_get_a11y_guidelines` only when the CLI is unavailable.

Required UI verification coverage:

- Light and dark theme coverage
- Default, hover, active, disabled, empty, and error states
- Long text / missing optional data / empty-list edge cases
- Keyboard and semantic accessibility
- Responsive behavior on narrow viewport

Keep verification observable:

- Read lint/typecheck output directly
- Inspect browser snapshots/screenshots directly
- Monitor dev server logs for runtime/compile errors
- For UI or user-flow PRs, include browser evidence when practical. This supplements, but does not replace, CI, Codex Cloud auto-review status, or `vpk-git-ship` review-thread remediation.
