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
2. **Install dependencies** → `CI=true pnpm install --prefer-offline` in noninteractive/provider worktrees, or `pnpm install` in an interactive shell (skip if `node_modules` already exists)
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

Multiport mode is sticky by default, not round-robin. Sequential turns usually reuse the same healthy port; extra ports are mainly for concurrency and failover. A post-stream readiness gate prevents immediate reacquire while rovo serve clears its turn state. See [Port Isolation Guide](references/guide-ports.md) for details.

### Rovo Instance Reuse

`pnpm run rovo` (single-instance default) and `pnpm run rovo -- 6` (full pool) are designed for repeated use without resetting your `~/.rovo/config.yaml`:

- **Healthy instances are reused** — if a previous pool is still running and healthy, it's kept as-is
- **Only unhealthy instances are stopped** — stale/crashed processes are gracefully terminated (SIGTERM with SIGKILL fallback)
- **`rovo:setup` is a true one-off** — run it once to approve MCP servers; those approvals persist in `~/.rovo/config.yaml`. In serve mode, all approved MCP tools auto-execute without per-call permission prompts
- **Force clean start is opt-in** — set `ROVO_FORCE_CLEAN_START=true` only if you need to kill all instances and start fresh

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

### What `.env.local` Looks Like (Default Mode)

```bash
# AI Gateway Configuration
AI_GATEWAY_URL=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/bedrock/model/anthropic.claude-sonnet-5/invoke-with-response-stream
AI_GATEWAY_URL_GOOGLE=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/google/publishers/google/v1/chat/completions
GOOGLE_IMAGE_MODEL=gemini-3-pro-image
GOOGLE_TTS_MODEL=tts-latest
GOOGLE_STT_MODEL=gemini-3-flash-preview

# Speech-to-text preset used by live voice mode and /api/speech-transcription
STT_PRESET=qwen3-asr

STT_PRESET_WHISPER_TINY_PROVIDER=local-whisper
STT_PRESET_WHISPER_TINY_MODEL=tiny

STT_PRESET_WHISPER_LARGE_V3_PROVIDER=local-whisper
STT_PRESET_WHISPER_LARGE_V3_MODEL=large-v3

STT_PRESET_GOOGLE_PROVIDER=google
# Uses GOOGLE_STT_MODEL as the selected Google STT model.

STT_PRESET_QWEN3_0_6B_PROVIDER=openai-compatible
STT_PRESET_QWEN3_0_6B_MODEL=qwen3-0.6b

STT_PRESET_QWEN3_ASR_PROVIDER=openai-compatible
STT_PRESET_QWEN3_ASR_MODEL=qwen3-asr

LOCAL_WHISPER_MODEL=tiny
LOCAL_WHISPER_BIN=whisper
# Optional fallback model for openai-compatible audio transcription endpoints
# OPENAI_COMPATIBLE_STT_MODEL=qwen3-asr
# Defaults to http://localhost:8801/v1 for qwen3-0.6b and qwen3-asr presets.
# Uncomment to override:
# OPENAI_COMPATIBLE_STT_BASE_URL=http://localhost:8801/v1
# Optional auth for the openai-compatible STT endpoint:
# OPENAI_COMPATIBLE_STT_API_KEY=

AI_GATEWAY_USE_CASE_ID=your-use-case-id
AI_GATEWAY_CLOUD_ID=internal-dummy-your-use-case-id
AI_GATEWAY_USER_ID=your-email@atlassian.com

# ASAP Credentials
ASAP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
ASAP_KID=your-use-case-id/1234567890
ASAP_ISSUER=your-use-case-id

# Default billing site for rovo serve (override if needed)
ROVO_BILLING_URL=https://product-fabric.atlassian.net

# Rovo Session Token (one-time setup — does not expire)
# On first launch, Rovo Serve prints a session token to the terminal.
# Copy it here, then restart the dev stack.
ROVO_SESSION_TOKEN=<paste-token-from-rovo-serve-output>

# Rovo pool size (plan parallel runs, default: 1)
# ROVO_POOL_SIZE=1

# OpenAI Realtime API (live voice conversation mode via AI Gateway)
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_REALTIME_WS_URL=wss://ai-gateway.us-east-1.staging.atl-paas.net/v1/openai/v1/realtime
OPENAI_REALTIME_VOICE=alloy
```

## Environment Variables Reference

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `ROVO_BILLING_URL` | Yes | Billing site URL for `rovo serve` (default: `https://product-fabric.atlassian.net`) |
| `ROVO_SESSION_TOKEN` | Yes | Shared secret authenticating backend ↔ Rovo Serve. One-time setup — does not expire or rotate. Copy from Serve's first-launch output. |
| `ROVO_POOL_SIZE` | Optional | Concurrent Rovo instances for agents team (default: 1) |
| `ROVO_FORCE_CLEAN_START` | Optional | Set `true` to kill all Rovo instances on startup (default: `false` — reuses healthy instances) |
| `ROVO_PORT` | Optional | Explicit Rovo Serve port override (normally auto-managed via `.dev-rovo-port`) |
| `AI_GATEWAY_URL` | Yes | Default model endpoint (Bedrock/OpenAI/Google) |
| `AI_GATEWAY_URL_GOOGLE` | Yes | Google endpoint for `provider: "google"` requests + TTS route |
| `AI_GATEWAY_USE_CASE_ID` | Yes | Your AI Gateway use case ID |
| `AI_GATEWAY_CLOUD_ID` | Yes | Cloud ID. For staging/local, use `internal-dummy-<use-case-id>` (Proximity's dummy CloudID). Tenant UUIDs and `local-testing` are rejected by staging AI Gateway. |
| `AI_GATEWAY_USER_ID` | Yes | Your Atlassian email |
| `OPENAI_MODEL` | Optional | GPT model ID (default: `gpt-6.1-sol`) |
| `GOOGLE_IMAGE_MODEL` | Yes | Gemini image model (default: `gemini-3-pro-image`) |
| `GOOGLE_TTS_MODEL` | Yes | TTS model (default: `tts-latest`) |
| `GOOGLE_STT_MODEL` | Yes | Google speech-to-text model used when `STT_PRESET=google` |
| `STT_PRESET` | Yes | Active speech-to-text preset for live voice mode (`whisper-tiny`, `whisper-large-v3`, `google`, `qwen3-0.6b`, `qwen3-asr`) |
| `STT_PRESET_*_PROVIDER` | Auto | Provider markers for each STT preset (auto-generated by `create-env-local.js`) |
| `STT_PRESET_*_MODEL` | Auto | Model names for each STT preset (auto-generated by `create-env-local.js`) |
| `LOCAL_WHISPER_MODEL` | Auto | Default local Whisper checkpoint (default: `tiny`, auto-generated) |
| `LOCAL_WHISPER_BIN` | Auto | Whisper CLI binary name/path (default: `whisper`, auto-generated) |
| `OPENAI_COMPATIBLE_STT_MODEL` | Optional | Fallback model if an openai-compatible preset omits a model |
| `OPENAI_COMPATIBLE_STT_BASE_URL` | Optional | Base URL for OpenAI-compatible STT backends (defaults to `http://localhost:8801/v1`) |
| `OPENAI_COMPATIBLE_STT_API_KEY` | Optional | Bearer token for OpenAI-compatible STT backends |
| `ASAP_PRIVATE_KEY` | Yes | RSA private key (quoted, `\n` escaped) |
| `ASAP_KID` | Yes | Key ID from ASAP config |
| `ASAP_ISSUER` | Yes | Issuer from ASAP config |
| `CONFLUENCE_BASE_URL` | Optional | Confluence base URL for run-summary sharing (e.g. `https://your-site.atlassian.net/wiki`) |
| `CONFLUENCE_USER_EMAIL` | Optional | Atlassian email for Confluence API auth |
| `CONFLUENCE_API_TOKEN` | Optional | Confluence API token (from Atlassian account settings) |
| `CONFLUENCE_DEFAULT_SPACE_KEY` | Optional | Default Confluence space key for run summaries |
| `CONFLUENCE_PARENT_PAGE_ID` | Optional | Optional parent page ID for run-summary pages |
| `SLACK_BOT_TOKEN` | Optional | Slack bot token (`xoxb-…`) for run-summary DM sharing |
| `SLACK_DM_USER_ID` | Optional | Slack user ID to send run-summary DMs to |
| `NEXT_PUBLIC_API_URL` | Production | API URL for production static export builds |
| `PORT` | Optional | Backend port override (default: 8080) |
| `BACKEND_URL` | Optional | Frontend → backend URL override; dev scripts normally inject the backend port recorded in `.dev-backend-port` |
| `DEBUG` | Optional | Set `true` for verbose backend logging |
| `OPENAI_REALTIME_API_KEY` | Optional | Direct OpenAI API key for Realtime — omit to use AI Gateway with ASAP credentials |
| `OPENAI_REALTIME_MODEL` | Yes | Realtime voice model (default: `gpt-4o-realtime-preview`) |
| `OPENAI_REALTIME_WS_URL` | Yes | Realtime WebSocket URL — defaults to AI Gateway staging endpoint when using ASAP auth, or direct OpenAI when API key is set |
| `OPENAI_REALTIME_VOICE` | Yes | Realtime voice preset (default: `alloy`) |

## Speech-to-Text Preset Switching

Rovo App chat model selection is no longer exposed in the frontend. Chat stays on Rovo Serve, while live voice transcription is selected entirely through `.env.local`.

Switch STT by updating only:

```bash
STT_PRESET=whisper-tiny
STT_PRESET=whisper-large-v3
STT_PRESET=google
STT_PRESET=qwen3-0.6b
STT_PRESET=qwen3-asr
```

Notes:

- `STT_PRESET=google` uses `GOOGLE_STT_MODEL` for the actual Google model ID.
- `STT_PRESET=qwen3-0.6b` and `STT_PRESET=qwen3-asr` target an OpenAI-compatible transcription endpoint. If `OPENAI_COMPATIBLE_STT_BASE_URL` is not set, the backend defaults to `http://localhost:8801/v1`.
- Whisper presets require the `whisper` CLI on PATH.
- Restart the backend/dev stack after changing `STT_PRESET`.

## Model Switching (AI Gateway-backed Routes)

Model switching via `.env.local` applies only to AI Gateway-backed routes such
as image, audio, suggestions, and explicit gateway-driven tools. Rovo Serve
manages standard chat internally, and Rovo App live voice STT is controlled
separately via `STT_PRESET`.

| Provider | Model | Endpoint |
| -------- | ----- | -------- |
| **Claude (Default)** | `anthropic.claude-sonnet-5` | `/v1/bedrock/model/{MODEL_ID}/invoke-with-response-stream` |
| **GPT** | `gpt-5.6-terra` | `/v1/openai/v1/chat/completions` |
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
| Auth errors during ASAP save | `atlas upgrade` |
| "EADDRINUSE" error | Servers auto-find available ports within the worktree range. If still failing, check `pnpm ports`, stop the stale tmux stack with `pnpm run dev:tmux:stop` or `pnpm run rovo:tmux:stop`, then restart. |
| Next.js lock error | Remove stale lock: `rm -f .next/dev/lock` then restart |
| Turbopack cache corrupted | Clear cache: `rm -rf .next` then restart |
| Zombie processes blocking ports | `ROVO_FORCE_CLEAN_START=true pnpm run rovo` (graceful SIGTERM then SIGKILL fallback) |
| `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` during dependency bootstrap | Use the noninteractive install path: `CI=true pnpm install --prefer-offline`. Do not start multiple `pnpm run ...` validations in parallel until dependency warmup has finished, because pnpm bootstraps share the same `node_modules` tree. |
| Config keeps resetting (`~/.rovo/config.yaml`) | Ensure you're using `pnpm run rovo` (not `rovo:setup`); setup is a one-off |
| Frontend 500 (providers) | Ensure `components/providers.tsx` matches import casing |
| "ASAP_PRIVATE_KEY: MISSING" | Check .env.local format - private key must be quoted and escaped |
| "Missing credentials" from Rovo Serve | `ROVO_SESSION_TOKEN` not set in `.env.local`. Copy the token from Serve's first-launch output (one-time setup, does not expire). Restart the dev stack after setting it. |
| "Missing credentials" when curling port 8000 | Port 8000 is Rovo Serve (not the VPK backend). Use `curl -H "Authorization: Bearer $ROVO_SESSION_TOKEN" http://localhost:8000/...` or use the backend port from `.dev-backend-port` instead. |
| No AI response (Rovo) | Verify `pnpm run rovo` is running and Rovo Serve started successfully |
| No AI response (AI Gateway-backed route) | Verify the AI Gateway URLs, ASAP credentials, and use case fields are set in `.env.local` |
| **Mismatched ASAP KID** | **You generated timestamp twice! Regenerate with single timestamp** |
| "Model Id [X] not found" | Model not whitelisted. Run `atlas ml aigateway usecase view --id YOUR-USE-CASE-ID -e stg-west` |
| Bedrock 403 while OpenAI works | Pull latest branch and confirm `backend/lib/ai-gateway-helpers.js` does **not** rewrite Bedrock URL; restart backend |
| Want to switch models | See [Model Switching Guide](references/guide-model-switch.md) |
| Rovo App voice mode 500 | Restart the backend so it picks up the latest `.env.local`. If using `STT_PRESET=qwen3-asr` or `qwen3-0.6b`, ensure an OpenAI-compatible transcription backend is available at `OPENAI_COMPATIBLE_STT_BASE_URL` (defaults to `http://localhost:8801/v1`) |
| Stale AI context / wrong answers | Rovo session may be corrupted — restart with `pnpm run rovo` |
| 409 "chat already in progress" | Background tasks may be using pinned panel ports — check that `PINNED_PORT_COUNT` matches your panel count. See [Port Isolation Guide](references/guide-ports.md) |
| 409 on first prompt (tmux) | Watch the affected Rovo pane. The fixed-port supervisor should restart the child automatically if recovery kills it. |
| Port stays unhealthy after recovery (tmux) | Check the specific Rovo pane for repeated restart failures, then restart `pnpm run rovo:tmux:start` if the underlying `rovo serve` command cannot come back healthy. |

### Port Auto-Discovery

VPK dev servers automatically find available ports if defaults are in use:

- **Frontend**: Tries ports 3000+ (configurable via `PORT` env var)
- **Rovo Serve**: Tries ports 8000+ (worktree-aware)
- **Backend**: Tries ports 8080+ (configurable via `BACKEND_PORT` env var)

**Worktree-aware:** Each git worktree gets a deterministic port range based on its name, preventing conflicts when running multiple worktrees simultaneously.

```bash
pnpm ports  # Show port assignments for all worktrees
```

The actual ports are written to `.dev-rovo-port`, `.dev-rovo-ports`, `.dev-frontend-port`, and `.dev-backend-port` at runtime. Agent-browser and other tools should prefer the worktree's Portless URL from `pnpm ports` (the `🌐 https://…` entry — it survives dev-server restarts and is origin-isolated per worktree), falling back to these files or `pnpm ports` for the localhost URL when no portless route exists.

## Next Steps

- **Develop locally:** Run `pnpm run dev:tmux:start` for frontend + backend browser verification, or `pnpm run rovo` / `pnpm run rovo:tmux:start --1` when Rovo Serve is in scope
- **Ready to deploy?** Use `/vpk-deploy` to create a permanent, shareable URL
- **Make changes:** Edit code, test locally, then commit and `/vpk-deploy` again

## References

- [Setup Guide](references/guide-setup.md) - Detailed setup documentation
- [Model Switching Guide](references/guide-model-switch.md) - Switch between Claude, GPT, Gemini (AI Gateway-enabled mode)
- [Port Isolation Guide](references/guide-ports.md) - How the port pool prevents 409 errors in multiport setups
