# VPK Setup Guide

Complete setup guide for local development with ASAP authentication to Atlassian AI Gateway.

---

## Quick Start (5 Minutes)

**Prerequisites:**

- Node.js 18+
- pnpm installed
- ASAP credentials (you'll generate these in the Terminal)

**Architecture:**

**Local Development:**

```
Browser → Next.js Server (actual port in .dev-frontend-port; default base 3000) with API proxy routes
        → Express Backend (actual port in .dev-backend-port; default base 8080)
        → Rovo Serve (primary chat)
        → AI Gateway-assisted routes (image, voice, suggestions)
```

**Production (Micros Deployment):**

```
Browser → Single Express Server (port 8080)
        → Serves Next.js static build + API routes
        → AI Gateway
```

The same code works in both environments! Next.js API routes (`/api/chat-sdk`, `/api/health`) run in development directly and are bundled into the Express server for production.

### Option 1: Worktree-Aware Browser Verification

```bash
pnpm run dev:tmux:start
pnpm run dev:tmux:status
```

This starts Express backend and Next.js frontend in a detached, worktree-aware tmux session, running the dev stack through `portless run` so it prints a stable `.localhost` URL. Prefer that Portless URL (the `🌐 https://…` entry from `pnpm ports`); otherwise use the printed URLs or `.dev-frontend-port` / `.dev-backend-port`. Do not assume default ports in linked worktrees.

### Option 2: Full Rovo Stack

```bash
pnpm run rovo
# For browser verification with Rovo in tmux:
pnpm run rovo:tmux:start --1
```

This starts Rovo Serve, Express backend, and Next.js frontend. Use this when chat behavior explicitly selects or delegates to Rovo.

### Option 3: Manual / Foreground Fallback

**Terminal 1 - Rovo Serve:**

```bash
pnpm run dev:rovo
```

**Terminal 2 - Backend + Frontend:**

```bash
pnpm run dev
```

Use the manual fallback when tmux is unavailable or you need foreground logs in the current terminal.

### Verify It Works

1. **Check backend health:**

   ```bash
   curl "http://localhost:$(cat .dev-backend-port)/api/health"
   ```

   Should show `"authMethod": "ASAP"`

2. **Open browser:** prefer the worktree's Portless `🌐 https://…` URL from `pnpm ports`, falling back to `http://localhost:$(cat .dev-frontend-port)`

### Troubleshooting

**"EADDRINUSE" error:** Kill processes on ports

```bash
pkill -f 'node backend/server.js'
pkill -f 'next dev'
```

**"Unable to acquire lock at .next/dev/lock":** Another Next.js dev server is already running for this repo.

```bash
pnpm run dev:tmux:stop
rm -f .next/dev/lock
pnpm run dev:tmux:start
```

**Frontend 500 with "Can't resolve '@/app/providers'":** Ensure the file is named `app/providers.tsx` (lowercase) and matches the import casing.

**No available port found:** Another process is using this worktree's dev port range. Check `pnpm ports`, stop stale dev servers for this worktree, and retry.

**No AI response:** Check `.env.local` has ASAP credentials properly set (ASAP_KID, ASAP_ISSUER, ASAP_PRIVATE_KEY)

**Bedrock 403 but OpenAI works:** Pull latest backend code and verify `backend/lib/ai-gateway-helpers.js` does not rewrite Bedrock URLs to `/provider/bedrock/format/openai/...`; restart backend after updating.

**More help:** Enable `DEBUG=true` in `.env.local`

---

## Prerequisites & Access Setup

**Test SSH access:** `ssh -T git@bitbucket.org`

**If not authenticated:**

1. Generate key: `ssh-keygen -t ed25519 -C "your-email@atlassian.com"` (press Enter for all prompts)
2. Copy public key: `cat ~/.ssh/id_ed25519.pub`
3. Add to Bitbucket: https://bitbucket.org/account/settings/ssh-keys/
4. Verify: `ssh -T git@bitbucket.org`

---

## Setup Project

### Install Dependencies

`pnpm install` needs two private-registry tokens in your **user-level** npm
config (never in tracked files: the repository is public):

| Variable | Needed for |
| --- | --- |
| `ATLASSIAN_NPM_TOKEN` | `@atlassian/logo-third-party` from `packages.atlassian.com` (otherwise a 404) |
| `MOTION_TOKEN` | Motion+ (`motion-plus`, an alias of `@motionplus/core` on `api.motion.dev/npm`) (otherwise a 401) |

Write both once per machine, then install:

```bash
ATLASSIAN_NPM_TOKEN=<token> MOTION_TOKEN=<token> node scripts/write-npmrc.mjs
pnpm install
```

`scripts/write-npmrc.mjs` upserts the registry routing and both auth lines into
`~/.npmrc` and is safe to rerun. CI does the same with the `ATLASSIAN_NPM_TOKEN`
and `MOTION_TOKEN` Actions secrets.

### Generate ASAP Credentials for AI Gateway

**Authentication: Use ASAP (Recommended)**

This repo uses **ASAP authentication** which works everywhere:

- ✅ Browser-based VMs (Volt Studio)
- ✅ Local laptop development
- ✅ Production deployments
- ✅ No dependency on atlas CLI or background services

**Why ASAP?**

- Works in all environments (browser VMs, local, production)
- Cryptographic keys can be embedded in environment
- No background services required

Requirements:

- YubiKey enrolled in Okta (for initial setup)
- Atlas CLI installed (for generating credentials)

---

## Authentication Setup: ASAP

**⚠️ The `.asap-config` file does NOT exist when you clone this repo!** You must generate your own.

**Security Note:**

- The `.asap-config` file is gitignored and will NEVER be committed to the repository
- DO NOT share your ASAP private key with others
- Each person/team must generate their own credentials

### Step 1: Generate the ASAP key pair

In your terminal, run this command (replace YOUR-USE-CASE-ID and TIMESTAMP):

```bash
# Using timestamp for uniqueness to avoid "key already exists" errors
# Replace TIMESTAMP with current Unix timestamp (e.g., 1735075200)
atlas asap key generate --key YOUR-USE-CASE-ID/TIMESTAMP --file .asap-config
```

Example:

```bash
atlas asap key generate --key my-use-case/1735075200 --file .asap-config
```

You should see: `Wrote key to config file .asap-config`

**Tip:** Generate a timestamp with: `date +%s`

### Step 2: Register the key with AI Gateway keyserver

Use the SAME timestamp from Step 1:

```bash
atlas asap key save --key YOUR-USE-CASE-ID/TIMESTAMP --service YOUR-USE-CASE-ID --env staging --file .asap-config
```

**⚠️ Authentication Required - WebAuthn/YubiKey Flow:**

When you run this command, you'll see:

```
Opening browser to use yubikey webauthn...
Authenticating using "webauthn" to "browser"
```

**What to do:**

1. A browser window will open automatically with Okta authentication
2. The activation code should be pre-filled - click **"Next"**
3. When prompted, **tap your physical YubiKey** (or use Touch ID/Face ID)
4. Authentication completes automatically

You should see: `Saved asap key successfully`

**If you get "Key already exists" error**: Generate a new timestamp and re-run both Step 1 and Step 2 with the new timestamp.

### Step 3: Create `.env.local` with ASAP credentials

**Create `.env.local` file** (gitignored) in project root. It should contain:

```
AI_GATEWAY_URL=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/openai/v1/chat/completions
AI_GATEWAY_USE_CASE_ID=your-use-case-id
AI_GATEWAY_CLOUD_ID=internal-dummy-your-use-case-id
AI_GATEWAY_USER_ID=your-email@atlassian.com
ASAP_KID=your-use-case-id/YOUR-TIMESTAMP
ASAP_ISSUER=your-use-case-id
ASAP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nYOUR-KEY-CONTENT-HERE\n-----END RSA PRIVATE KEY-----"
```

**Optional — Per-request Gemini routing for image + voice generation:**

```
AI_GATEWAY_URL_GOOGLE=https://ai-gateway.us-east-1.staging.atl-paas.net/v1/google/publishers/google/v1/chat/completions
```

Add this alongside `AI_GATEWAY_URL` to enable Google routing for features that request `provider: "google"` (image generation) and for voice synthesis route derivation (`/api/sound-generation` -> Google synth endpoint) without changing the default chat model. See `guide-model-switch.md` for details.

**Speech-to-text preset switching (Rovo App live voice mode):**

The current setup also writes a live-voice STT block into `.env.local`. Switch only `STT_PRESET` to choose between:

- `whisper-tiny`
- `whisper-large-v3`
- `google`
- `qwen3-0.6b`
- `qwen3-asr`

Notes:

- `STT_PRESET=google` uses `GOOGLE_STT_MODEL` for the actual Google model.
- Qwen presets target an OpenAI-compatible transcription endpoint (defaults to `http://localhost:8801/v1`). Override with `OPENAI_COMPATIBLE_STT_BASE_URL`.
- Whisper presets require the `whisper` CLI on PATH.

**Default Rovo billing site (recommended):**

```
ROVO_BILLING_URL=https://product-fabric.atlassian.net
```

`scripts/dev-rovo.js` passes this value as `--site-url` to `rovo serve`. Override this value when you need a different billing site.

**WebSocket connection caps (optional):**

```
VPK_WS_MAX_CONNECTIONS=64
VPK_WS_MAX_CONNECTIONS_PER_ADDRESS=16
```

The backend's preview and realtime WebSockets together allow `VPK_WS_MAX_CONNECTIONS` open sockets (default 64). Past that, a new socket gets 503. `VPK_WS_MAX_CONNECTIONS_PER_ADDRESS` adds a per-client-address cap and is off by default. Set it only where the backend sees each client's own address: behind a proxy every client shares the proxy's address, so it would cap all users together. A value that is not a positive integer is ignored, with a `[STARTUP]` warning.

**Rovo Session Token (required, one-time setup):**

Rovo Serve requires a session token for authentication. The backend sends it as `Authorization: Bearer <token>` on every request to Serve.

```
ROVO_SESSION_TOKEN=<paste-token-from-rovo-serve-output>
```

**How to get it:**

1. Run `pnpm run rovo` (or `rovo`) for the first time
2. Rovo Serve prints a session token to the terminal output
3. Copy the token and paste it into `.env.local` as `ROVO_SESSION_TOKEN=<token>`
4. Restart the dev stack so the backend picks it up

**Important notes:**

- This is a **one-time setup** — the token does not expire or rotate
- The supervisor passes this token to Serve as `ROVO_SERVE_SESSION_TOKEN` so both sides share the same secret
- If `ROVO_SESSION_TOKEN` is missing, all `/v3/*` endpoints on Serve return `"Missing credentials"` (the `/healthcheck` endpoint is unauthenticated and still works)
- If you see `"Missing credentials"` when curling the Rovo port directly, remember that Rovo Serve is not the VPK backend. The backend port is in `.dev-backend-port`; use that for `/api/health`.

**Optional — TTS model verification (`tts-latest`):**

```bash
atlas ml aigateway model view --modelId tts-latest
atlas ml aigateway usecase view --id YOUR-USE-CASE-ID -e stg-west
```

If `tts-latest` is available for your use case, use the AI Gateway speech endpoint for text-to-audio generation:
https://developer.atlassian.com/platform/ai-gateway/rest/v1/api-group-google/#api-v1-google-v1-text-synthesize-post

**Where to find these values:**

- `ASAP_KID`: From your `.asap-config` file (e.g., `my-use-case/1735075200`)
- `ASAP_ISSUER`: Your use case ID
- `ASAP_PRIVATE_KEY`: From your `.asap-config` file - **CRITICAL:** Must use escaped newlines `\n` and be quoted
- `AI_GATEWAY_USER_ID`: Your Atlassian email address

**Tip:** The helper script `./.agents/skills/vpk-setup/scripts/create-env-local.js` uses `git config user.email` by default. You can pass an explicit email if needed:

```bash
node ./.agents/skills/vpk-setup/scripts/create-env-local.js YOUR-USE-CASE-ID your-email@atlassian.com
```

**⚠️ IMPORTANT - Private Key Format:**

The `ASAP_PRIVATE_KEY` must be:

1. **Quoted** with double quotes
2. Use `\n` (literal backslash-n), NOT actual line breaks
3. All on one line

### ✅ Correct Format

```
ASAP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
```

### Converting from .asap-config

**Method 1: Using Node.js (Easiest)**

```bash
node -e "
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('.asap-config', 'utf8'));
const escaped = config.privateKey.replace(/\n/g, '\\\\n');
console.log(\`ASAP_PRIVATE_KEY=\"\${escaped}\"\`);
"
```

Then copy-paste the output into your `.env.local` file.

### Verification

After creating `.env.local`, verify it's correct:

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const key = process.env.ASAP_PRIVATE_KEY;
console.log('✓ ASAP_PRIVATE_KEY loaded:', key ? 'YES' : 'NO');
console.log('✓ Valid PEM format:', key && key.includes('-----BEGIN') ? 'YES' : 'NO');
console.log('✓ Has newlines:', key && key.includes('\n') ? 'YES' : 'NO');
console.log('✓ Key length:', key ? key.length : 0);
"
```

Expected output:

```
✓ ASAP_PRIVATE_KEY loaded: YES
✓ Valid PEM format: YES
✓ Has newlines: YES
✓ Key length: 1674
```

Need help? Ask in #help-ai-gateway on Slack

---

## Test Locally

### Start Development Services

**Option 1 - Worktree-Aware Browser Verification (Recommended):**

```bash
pnpm run dev:tmux:start
```

**Option 2 - Full Rovo Stack:**

```bash
pnpm run rovo
# For browser verification with Rovo in tmux:
pnpm run rovo:tmux:start --1
# For full pool mode:
pnpm run rovo:tmux:start --6
```

**Option 3 - Manual / Foreground Fallback:**

```bash
# Terminal 1
pnpm run dev:rovo

# Terminal 2
pnpm run dev
```

**Important:** Only run one stack command at a time. Running `pnpm run rovo` while another foreground or tmux stack is active can trigger lock/port conflicts.

### Verify Everything Works

1. **Open** the worktree's Portless `🌐 https://…` URL from `pnpm ports`, or fall back to `http://localhost:$(cat .dev-frontend-port)` / the frontend URL printed by `pnpm run dev:tmux:start` (which runs through `portless run`)
2. **Check backend:** `curl "http://localhost:$(cat .dev-backend-port)/api/health"` should show `"authMethod": "ASAP"`

**Troubleshooting .env.local Issues:**

**If you see "ASAP_PRIVATE_KEY: MISSING" in the health check:**

1. Check if `.env.local` exists: `ls -la .env.local`
2. Check format: Must be quoted and use `\n` for newlines
3. Verify with: `node -e "require('dotenv').config(); console.log(process.env.ASAP_PRIVATE_KEY?.substring(0,30))"`

---

## Deploy to Micros (Optional)

For complete step-by-step deployment instructions, see the vpk-deploy skill at `.agents/skills/vpk-deploy/` or run `/vpk-deploy`.

The deployment guide includes:

- First-time deployment walkthrough
- How to update existing deployments
- Environment variable setup
- Docker build and push instructions
- Comprehensive troubleshooting section

**Quick path:**

1. Update `service-descriptor.yml` with your service name
2. Follow the **Path A: First-Time Deployment** section in DEPLOYMENT_GUIDE.md
3. Test your deployment using the verification steps provided
