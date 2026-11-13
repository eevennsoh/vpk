# Cursor Cloud Environment Setup

Provider-specific setup for running this repo in Cursor Cloud VMs. Everything here supplements `AGENTS.md`, which stays the canonical context.

## Required secrets

| Secret | Purpose |
|--------|---------|
| `ATLASSIAN_NPM_TOKEN` | Auth for `@atlassian/logo-third-party` from the private registry — **required for `pnpm install`** |
| `MOTION_TOKEN` | Auth for Motion+ (`motion-plus`, an alias of `@motionplus/core` on `api.motion.dev/npm`) — **required for `pnpm install`** |
| `ROVO_SESSION_TOKEN` | Backend → Rovo Serve auth (only needed for Rovo chat flows) |
| `ASAP_PRIVATE_KEY` | AI Gateway ASAP auth |
| `ASAP_KID` | AI Gateway ASAP key ID |
| `ASAP_ISSUER` | AI Gateway ASAP issuer |
| `AI_GATEWAY_URL` | AI Gateway endpoint |
| `AI_GATEWAY_USE_CASE_ID` | AI Gateway use case |

## Update script (paste into the Update Script box)

```
node scripts/write-npmrc.mjs
test -f .env.local || cp .env.local.example .env.local
CI=true pnpm install --frozen-lockfile
```

`scripts/write-npmrc.mjs` upserts the registry routing, both atlassian-npm auth lines and the Motion+ auth line into `~/.npmrc`: each managed key appears exactly once, other lines are preserved, and reruns are no-ops. It exits non-zero with a clear message when `ATLASSIAN_NPM_TOKEN` or `MOTION_TOKEN` is empty, instead of letting `pnpm install` 404 or 401. Do not hand-write `~/.npmrc` with `>>`; repeated runs stack duplicate entries.

## Services overview

| Service | Command | Default Port | Required? |
|---------|---------|-------------|-----------|
| Next.js Frontend | `pnpm run dev:frontend` | 3000 | Yes |
| Express Backend | `pnpm run dev:backend` | 8080 | Yes |
| Rovo Serve | `pnpm run dev:rovo` | 8000 | Only for Rovo-selected chat/tool flows |

Start frontend + backend together: `pnpm run dev`. Without a Portless route, the frontend defaults to `localhost`, which can bind only to IPv6 on Linux. Export `HOST=127.0.0.1` when tools need the IPv4 loopback address, such as `control-vpk`'s fallback URL. A registered Portless route already makes the launcher bind to IPv4. Start all three (including Rovo): `pnpm run rovo` (requires the `rovo` CLI on PATH).

Cloud agent `start`:

```
test -f .env.local || cp .env.local.example .env.local
export HOST=127.0.0.1
exec pnpm run dev
```

## Running checks

- Lint: `pnpm run lint`
- Typecheck: `pnpm run typecheck`
- Build: `pnpm run build`
- No single `pnpm test`; run targeted `node --test` against specific `.test.js`/`.test.ts` files

## Non-obvious caveats

- `ATLASSIAN_NPM_TOKEN` and `MOTION_TOKEN` must be configured as secrets and written to `~/.npmrc` by `node scripts/write-npmrc.mjs` before `pnpm install` will succeed (CI runs the same script). Without them, the private `@atlassian/logo-third-party` package fails to resolve and `motion-plus` returns a 401.
- The backend reads secrets from `process.env` directly (with `.env.local` as dotenv fallback), so injected env vars work without writing them to `.env.local`. `.env.local` is still useful for `next dev`; create it from `.env.local.example` if missing.
- Backend port is written to `.dev-backend-port`, frontend to `.dev-frontend-port` at startup.
- `pnpm run dev` starts both services via `concurrently`; do not run `pnpm run rovo` at the same time or you'll get port conflicts.
- The `pnpm install` warning about ignored build scripts (better-sqlite3, node-llama-cpp) is expected and harmless.
- Health endpoint: `curl http://localhost:<backend-port>/api/health` — returns JSON with service status and auth config summary.
- The `rovo` CLI (Rovo Serve) is not available in cloud VMs — use `pnpm run dev` instead. AI Gateway-backed routes still work when credentials and egress are available.
- AI Gateway endpoints need outbound HTTPS to `ai-gateway.us-east-1.staging.atl-paas.net`; with restricted egress, gateway-backed features return errors gracefully.
- `ASAP_PRIVATE_KEY` formatting: see `.agents/docs/dev-environment.md` (the value already includes quotes and literal `\n` escapes).
