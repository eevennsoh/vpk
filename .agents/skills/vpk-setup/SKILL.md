---
name: vpk-setup
description: Configure a first-time or repaired VPK checkout, including dependencies, credentials, environment, Rovo Serve, and local dev servers. Use when asked to "set up", "first time setup", "initialize VPK", or "bootstrap", and for errors such as "ASAP key not working", "credentials not found", or "env not configured".
purpose: Guide first-time or repaired VPK local setup for dependencies, credentials, env files, Rovo Serve, AI Gateway, and dev servers.
owner: VPK
category: setup
inputs: Current checkout state, package manager state, env files, credentials, desired runtime mode, and dev-server requirements.
outputs: Installed dependencies, configured env files, started or documented dev servers, Portless URL, and setup verification notes.
required_tools: shell, pnpm, rovo, portless
validation_command: pnpm run dev:tmux:status
generated_artifacts: .env.local and runtime port files when setup is approved.
common_failure_modes: Assuming default ports, double-quoting private keys, running Rovo in unavailable environments, or overwriting existing local env secrets.
---

# VPK Setup - Initial Repository Setup

**Goal:** Get the prototype running locally with the default required runtime:
Rovo Serve as the primary chat backend, plus AI Gateway-backed image/TTS
routes, suggestions, and the current env-driven STT preset block used by
Rovo App live voice mode.

## Quick Workflow

1. **Preflight cleanup** → If `node_modules` exists, clean Next.js cache (see below)
2. **Install dependencies** → `CI=true pnpm install --prefer-offline` in noninteractive/provider worktrees, or `pnpm install` in an interactive shell (skip if `node_modules` already exists). A first install on a machine needs `ATLASSIAN_NPM_TOKEN` and `MOTION_TOKEN` written to the user-level `~/.npmrc` by `node scripts/write-npmrc.mjs`; a 401 for `motion-plus` means `MOTION_TOKEN` is missing (see `references/guide-setup.md` → Install Dependencies)
3. **Collect AI Gateway credentials** → Ask for use case ID and Atlassian email
4. **Configure AI Gateway + Voice STT** → Generate ASAP keys and create `.env.local` with Google endpoint values and the current STT preset block
5. **Set Rovo Session Token** → First launch of `pnpm run rovo` prints a session token; copy it to `ROVO_SESSION_TOKEN` in `.env.local` (one-time, does not expire)
6. **Start servers** → Ask permission, then `pnpm run rovo` for first-time Rovo setup, or `pnpm run dev:tmux:start` when the task only needs frontend + backend browser verification
7. **Verify** → Prefer the worktree's Portless URL from `pnpm ports` (the `🌐 https://…` entry), falling back to the recorded `.dev-frontend-port` / `.dev-backend-port`; do not assume default frontend/backend ports in linked worktrees

## Preflight Cleanup (when node_modules exists)

If `node_modules/` already exists, **always** perform proactive cleanup before starting dev servers to avoid stale lock files and corrupted Turbopack cache:

```bash
if [ -d "node_modules" ]; then
  echo "node_modules exists - performing preflight cleanup..."
  rm -f .next/dev/lock
  rm -rf .next
  echo "Cleanup complete. Skipping pnpm install."
fi
```

This prevents common issues:

- `Unable to acquire lock at .next/dev/lock`
- `Failed to restore task data (corrupted database or bug)`
- `ArrayLengthMismatch` Turbopack errors

**Important:** Always ask the user for permission before starting dev servers. Ask a concise user-facing question to confirm they want to start, then run `pnpm run rovo`. If the user needs the full pool (6 instances), they can use `pnpm run rovo -- 6` instead.

## Runtime Topology

`pnpm run rovo` starts Rovo Serve + Express + Next.js with one Rovo instance (`pnpm run rovo -- 6` for the full pool). `pnpm run dev:tmux:start` starts a worktree-aware, detached frontend + backend stack behind Portless; prefer it for browser verification when Rovo Serve is not under test. Healthy Rovo instances are reused across runs, and ports are reserved per worktree, so never assume default ports. Full detail (tmux session naming, sticky multiport routing, instance reuse, port auto-discovery): [references/runtime-topology.md](references/runtime-topology.md).

## AI Gateway Credential Setup

Required for the default setup path.

### Step 0: Gather User Information

**Atlassian email address**

- Try: `git config user.email`
- If not set or not @atlassian.com, ask user for it
- Needed for: `.env.local` (`AI_GATEWAY_USER_ID`)

**AI Gateway use case ID** (REQUIRED for AI Gateway - always ask user)

- User must provide their own use case ID
- Can request one from #help-ai-gateway channel if they don't have it
- Needed for: `.env.local` (`AI_GATEWAY_USE_CASE_ID`), ASAP key generation

### AI Gateway Credential Commands

```bash
# Generate ASAP credentials (CRITICAL: generate timestamp ONCE!)
# Replace YOUR-USE-CASE-ID with the user's provided use case ID
TIMESTAMP=$(date +%s)
echo "Using timestamp: $TIMESTAMP"
atlas asap key generate --key YOUR-USE-CASE-ID/$TIMESTAMP --file .asap-config
atlas asap key save --key YOUR-USE-CASE-ID/$TIMESTAMP --service YOUR-USE-CASE-ID --env staging --file .asap-config

# Note: You'll need to authenticate when prompted (browser will open)

# Create .env.local from .asap-config
# Script location: .agents/skills/vpk-setup/scripts/create-env-local.js
node ./.agents/skills/vpk-setup/scripts/create-env-local.js YOUR-USE-CASE-ID
# Optional (explicit email override):
# node ./.agents/skills/vpk-setup/scripts/create-env-local.js YOUR-USE-CASE-ID your-email@atlassian.com
```

### `.env.local` Contents

`create-env-local.js` writes AI Gateway, Google, STT preset, ASAP, Rovo, and Realtime settings. The script sets `ROVO_BILLING_URL` (default `https://product-fabric.atlassian.net`; edit to override). Required by hand: `ROVO_SESSION_TOKEN` (copied once from Rovo Serve's first-launch output). Keep `ASAP_PRIVATE_KEY` double-quoted with literal `\n` escapes. Switch live-voice STT by changing only `STT_PRESET`, then restart the backend.

The full default file, the complete variable table, and STT preset details are in [references/env-reference.md](references/env-reference.md).

## Model Switching (AI Gateway-backed Routes)

Model switching via `.env.local` applies only to AI Gateway-backed routes such
as image, audio, suggestions, and explicit gateway-driven tools. Rovo Serve
manages standard chat internally, and Rovo App live voice STT is controlled
separately via `STT_PRESET`.

| Provider | Model | Endpoint |
| -------- | ----- | -------- |
| **Claude (Default)** | `anthropic.claude-sonnet-5` | `/v1/bedrock/model/{MODEL_ID}/invoke-with-response-stream` |
| **GPT** | default in `backend/lib/openai-model.js` | `/v1/openai/v1/chat/completions` |
| **Gemini** | `gemini-3-pro-image` | `/v1/google/publishers/google/v1/chat/completions` |

Update `AI_GATEWAY_URL` in `.env.local` then restart with `pnpm run rovo`.

For full model switching details, see [references/guide-model-switch.md](references/guide-model-switch.md).

## Setup Checklist

- [ ] Node.js 18+ installed
- [ ] **Preflight cleanup** (if `node_modules` exists: remove `.next/dev/lock` and `.next/`)
- [ ] Dependencies installed (skip if `node_modules` already exists)
- [ ] **User info collected** (email, use case ID)
- [ ] Atlas CLI installed, YubiKey enrolled
- [ ] **ASAP credentials generated (timestamp generated ONCE)**
- [ ] `.env.local` created via `create-env-local.js`
- [ ] `ROVO_BILLING_URL` is set (default: `https://product-fabric.atlassian.net`)
- [ ] `ROVO_SESSION_TOKEN` is set (copy from Rovo Serve first-launch output — one-time setup)
- [ ] Google endpoints enabled in `.env.local`
- [ ] `GOOGLE_STT_MODEL` and `STT_PRESET` are set in `.env.local`
- [ ] Dev servers started with `pnpm run rovo` for full Rovo setup or `pnpm run dev:tmux:start` for frontend + backend verification
- [ ] Backend health check passes at `http://localhost:<backend-port>/api/health` using `.dev-backend-port`
- [ ] Frontend responds at its worktree URL — prefer the Portless `🌐 https://…` URL from `pnpm ports`, falling back to `http://localhost:<frontend-port>` using `.dev-frontend-port`

## Quick Troubleshooting

| Issue | Quick Fix |
| ----- | --------- |
| Chat returns 503 | Rovo Serve not running — use `pnpm run rovo` to start all processes |
| "Missing credentials" from Rovo Serve | `ROVO_SESSION_TOKEN` not set in `.env.local`. Copy the token from Serve's first-launch output, then restart the dev stack. |
| **Mismatched ASAP KID** | **You generated timestamp twice! Regenerate with single timestamp** |
| "ASAP_PRIVATE_KEY: MISSING" | Check .env.local format - private key must be quoted and escaped |
| Next.js lock error / Turbopack cache corrupted | `rm -f .next/dev/lock` or `rm -rf .next`, then restart |

Every other symptom (ports, 409s, model whitelisting, voice mode, config resets): [references/troubleshooting.md](references/troubleshooting.md).

## Next Steps

- **Develop locally:** Run `pnpm run dev:tmux:start` for frontend + backend browser verification, or `pnpm run rovo` / `pnpm run rovo:tmux:start --1` when Rovo Serve is in scope
- **Ready to deploy?** Use `/vpk-deploy` to create a permanent, shareable URL
- **Make changes:** Edit code, test locally, then commit and `/vpk-deploy` again

## References

- [Setup Guide](references/guide-setup.md) - Detailed setup documentation
- [Model Switching Guide](references/guide-model-switch.md) - Switch between Claude, GPT, Gemini (AI Gateway-enabled mode)
- [Port Isolation Guide](references/guide-ports.md) - How the port pool prevents 409 errors in multiport setups
- [Runtime Topology and Ports](references/runtime-topology.md) - Launchers, tmux sessions, Rovo instance reuse, port auto-discovery
- [`.env.local` Reference](references/env-reference.md) - Full default file, every variable, STT presets
- [Setup Troubleshooting](references/troubleshooting.md) - Full symptom-to-fix table
