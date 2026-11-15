# Runtime Topology and Ports

Moved from `SKILL.md`: how `pnpm run rovo` and the tmux launchers lay out Rovo Serve, Express, and Next.js, how Rovo instances are reused, and how dev-server ports are discovered per worktree.

## Runtime Topology

### Always-On Default

`pnpm run rovo` starts all three processes with a single Rovo instance by default:

```text
rovo serve (:8000) + Express (:8080) + Next.js (:3000)
```

Rovo Serve handles primary chat. AI Gateway-backed routes handle image,
sound, suggestions, and Realtime transport when configured. Google endpoint
variables are used for `provider: "google"` image and TTS routes.
Rovo billing site is set via `ROVO_BILLING_URL` in `.env.local` (required, no hardcoded fallback).

For the full pool (6 instances, needed for agent team parallel runs), use `pnpm run rovo -- 6` instead.

### Multiport / tmux Mode

`pnpm run dev:tmux:start` starts frontend + backend in a worktree-aware detached tmux session, running the dev stack through `portless run` so it prints a stable `.localhost` URL. Prefer this for browser verification when Rovo Serve is not part of the behavior under test. Use `pnpm ports` (prefer the Portless `🌐 https://…` URL) or `pnpm run dev:tmux:status` / the `.dev-frontend-port` / `.dev-backend-port` files to get the actual URLs.

`pnpm run rovo:tmux:start` starts a tmux session with 8 panes: frontend, backend, and 6 rovo serve ports.

Session naming is worktree-aware by default: `vpk-dev-<worktree>` (or `vpk-dev-main` in the main worktree), so multiple worktrees can run tmux mode in parallel without session-name collisions. You can override the name with `ROVO_TMUX_SESSION`, or change the prefix with `ROVO_TMUX_SESSION_PREFIX`.

Port reservation is also worktree-unique across active git worktrees (no overlap). Each worktree receives a dedicated 20-port slot per service family, leaving room for port auto-increment and 6-port Rovo pools without colliding with another worktree.

```text
Primary interactive thread → sticky preferred port
On failure / stuck turn     → fail over to another healthy pool port
Background helper turns     → avoid the active interactive port when alternatives exist
```

Multiport mode is sticky by default, not round-robin. Sequential turns usually reuse the same healthy port; extra ports are mainly for concurrency and failover. A post-stream readiness gate prevents immediate reacquire while rovo serve clears its turn state. See [Port Isolation Guide](guide-ports.md) for details.

### Rovo Instance Reuse

`pnpm run rovo` (single-instance default) and `pnpm run rovo -- 6` (full pool) are designed for repeated use without resetting your `~/.rovo/config.yaml`:

- **Healthy instances are reused** — if a previous pool is still running and healthy, it's kept as-is
- **Only unhealthy instances are stopped** — stale/crashed processes are gracefully terminated (SIGTERM with SIGKILL fallback)
- **`rovo:setup` is a true one-off** — run it once to approve MCP servers; those approvals persist in `~/.rovo/config.yaml`. In serve mode, all approved MCP tools auto-execute without per-call permission prompts
- **Force clean start is opt-in** — set `ROVO_FORCE_CLEAN_START=true` only if you need to kill all instances and start fresh

## Port Auto-Discovery

VPK dev servers automatically find available ports if defaults are in use:

- **Frontend**: Tries ports 3000+ (configurable via `PORT` env var)
- **Rovo Serve**: Tries ports 8000+ (worktree-aware)
- **Backend**: Tries ports 8080+ (configurable via `BACKEND_PORT` env var)

**Worktree-aware:** Each git worktree gets a deterministic port range based on its name, preventing conflicts when running multiple worktrees simultaneously.

```bash
pnpm ports  # Show port assignments for all worktrees
```

The actual ports are written to `.dev-rovo-port`, `.dev-rovo-ports`, `.dev-frontend-port`, and `.dev-backend-port` at runtime. Agent-browser and other tools should prefer the worktree's Portless URL from `pnpm ports` (the `🌐 https://…` entry — it survives dev-server restarts and is origin-isolated per worktree), falling back to these files or `pnpm ports` for the localhost URL when no portless route exists.
