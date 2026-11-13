# Dev Environment Gotchas

Moved from `AGENTS.md` so the always-loaded file stays inside Codex's instruction budget. The safety rules (`artifacts/`, `tmux kill-server` / `portless prune`, transitive imports, `.npmrc` tokens) stay in `AGENTS.md`.

- Worktree ports are deterministic. Use `pnpm ports` or `pnpm ports watch` (arrows select, Enter opens, `k` confirms kill, `q` quits). The dashboard discovers active worktrees; browser tools use its Portless `🌐` URL, falling back to `.dev-frontend-port`, never a hardcoded port.
- `pnpm run mem` reports each `next-server`'s CPU, port, worktree, and physical footprint via vmmap; `ps` RSS undercounts it ~50x. Next ≥16.3 is healthy at low single-digit GB; `vpk-system-clean` restarts servers at ≥6 GB.
- Runtime port files: `.dev-rovo-port`, `.dev-rovo-ports`, `.dev-frontend-port`, `.dev-backend-port`. `.claude/launch.json` (Claude preview configs) is also per-checkout: the SessionStart hook writes it via `scripts/write-claude-launch-config.js`; don't commit it.
- Dev API calls traverse Next.js proxy then Express; debug both layers.
- TypeScript checks authored project directories. Generated `output/` evidence and `public/1p/rovo-stage-kit` browser assets are excluded from file discovery; explicitly imported files remain type-checked.
- Keep `@layer theme, base, components, utilities;` atop `app/globals.css`; it fixes cascade order so component layers do not lose to preflight.
- Theme switching uses `setGlobalTheme()` from `@atlaskit/tokens`; toggling only the HTML `dark` class does not update ADS tokens.
- Fresh worktrees need their own `node_modules`. Managed worktrees copy ignored `.env*` and clone matching dependencies or run `CI=true pnpm install --prefer-offline`; manual worktrees must do this themselves. Do not run parallel pnpm validations until warmup completes.
- Tmux/Rovo launchers (`pnpm run dev:tmux:start`, `pnpm run rovo`, `pnpm run dev:rovo`, `pnpm run rovo:tmux:start`) seed `.env.local` from main or `.env.local.example`; copy/symlink it manually only for direct backend/frontend startup or provider bootstrap.
- `ASAP_PRIVATE_KEY` in `.env.local` already includes surrounding double quotes and literal `\n` escapes — do not add extra quotes.
