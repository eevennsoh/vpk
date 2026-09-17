# Deployment guide

Use this guide for first-time Micros setup or when local deployment
configuration no longer matches the remote service. For a routine redeploy with
a valid `.deploy.local`, use `pnpm run deploy:micros`.

## Runtime contract

VPK has one source tree and two runtime shapes:

| Mode | Frontend | API |
| --- | --- | --- |
| Local development | Next.js development server | Next.js route adapters proxy to Express |
| Micros | Static export served by Express | Express owns `/api/*`, SSE, and WebSockets |

The production image is `backend/Dockerfile`:

- Node 24 installs production dependencies from the root pnpm workspace and
  `pnpm-lock.yaml`.
- `corepack pnpm run build:export` creates `out/` before the Docker build.
- The image copies `out/` to `backend/public`; it does not build Next.js
  inside Docker.

Do not remove App Router routes by hand for an export. The checked-in
`scripts/build-static-export.mjs` wrapper temporarily moves runtime-only
routes and restores them even when the build fails or is interrupted.

## Preconditions

- Docker Desktop with buildx support.
- Atlas CLI installed and authenticated.
- Docker identity token with access to `docker.atl-paas.net`.
- A lowercase, hyphenated service name no longer than 26 characters.
- One supported environment:

| Micros environment | AWS region | URL suffix |
| --- | --- | --- |
| `pdev-west2` | `us-west-2` | `us-west-2.platdev.atl-paas.net` |
| `pdev-apse2` | `ap-southeast-2` | `ap-southeast-2.platdev.atl-paas.net` |

Micros stashes are environment-specific. Switching environments requires
restashing every required variable.

### Resolve the Atlassian CLI

Do not infer identity from the executable name. On the Team EU26 machine,
`atlas` on PATH was a database CLI; `/opt/atlassian/bin/atlas` was Atlassian's.
Resolve capabilities before login, stash, registry, or service operations:

```bash
source .agents/skills/vpk-deploy/scripts/deploy-lib.sh
vpk_resolve_atlas
"$VPK_ATLAS_BIN" micros service deploy --help
```

The resolver tries PATH and the known Atlassian installation, checking Micros
service/stash/events support from both stdout and stderr (Atlas writes help to
stderr on this machine). Set `VPK_ATLAS_BIN` to a specific executable when
needed; an invalid explicit override fails rather than silently falling back.
Use the resolved executable in all commands below. If Okta opens, let the user
complete sign-in and resume the pending check after their reply.

## Inspect before changing configuration

Read `.deploy.local` when it exists, but confirm its values against Micros:

Record the absolute checkout, service/environment, entry route, capabilities,
and source revision or dirty-tree selection together. A user correction takes
precedence over an earlier project path. Preserve a latest-main-only selection
through deployment; do not pull separate worktree edits into the image.
Review relevant target harness repairs separately from source selection. A
latest-main-only extract can still need generated-layout fixes to render
faithfully. Include reviewed fixes needed for the requested result, preserve
unrelated work, and identify any required fix excluded from the image. A
derivative Docker image includes only its copied files: backend-only copies do
not carry local frontend fixes or a newly generated export.

```bash
"$VPK_ATLAS_BIN" micros service show -s "$SERVICE_NAME" -e "$ENV"
"$VPK_ATLAS_BIN" micros stash list -s "$SERVICE_NAME" -e "$ENV"
```

Use names and counts only when reporting stash state; never print secret
values. `No such service` or `Unknown service` means the service still needs
to be created even when local files contain its name.

## Configure a new or recovered service

### 1. Local deployment configuration

Create ignored `.deploy.local` with the service identity and Docker
credentials:

```bash
SERVICE_NAME="your-service-name"
ENV="pdev-west2"
DOCKER_USERNAME="your-staff-id"
DOCKER_PASSWORD="your-docker-identity-token"
```

Never commit this file or echo `DOCKER_PASSWORD`.
Create it with restrictive permissions (0600). Keep temporary credential JSON
protected and clean it on success, error, and interruption.

### 2. Service descriptor

Replace service-name placeholders in `service-descriptor.yml`, including the
image namespace and SSM paths. A full backend deployment needs these variables
in the descriptor and in the selected environment's stash:

```text
AI_GATEWAY_URL
AI_GATEWAY_USE_CASE_ID
AI_GATEWAY_CLOUD_ID
AI_GATEWAY_USER_ID
ASAP_KID
ASAP_ISSUER
ASAP_PRIVATE_KEY
OPENAI_REALTIME_MODEL
OPENAI_REALTIME_WS_URL
OPENAI_REALTIME_VOICE
VPK_RUNTIME_ADMIN_TOKEN
```

`VPK_RUNTIME_ADMIN_TOKEN` is mandatory in production. Generate a unique,
high-entropy value, stash it, and unset the local shell variable after use:

```bash
VPK_RUNTIME_ADMIN_TOKEN="$(openssl rand -hex 32)"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" \
  -k VPK_RUNTIME_ADMIN_TOKEN -v "$VPK_RUNTIME_ADMIN_TOKEN"
unset VPK_RUNTIME_ADMIN_TOKEN
```

Realtime model, URL, and voice defaults may exist in local development, but
stash explicit production values so the deployment is reproducible.

For backend-backed extracts, also stash `ALLOWED_ORIGINS` with the deployed
HTTPS origin and bind it through `((ssm:/<service>/ALLOWED_ORIGINS))`. Bind
`VPK_ORIGIN` the same way when Create actions open the source VPK app. Verify
these settings with browser-shaped Origin requests; descriptor-only literal
values are not proof that the running backend received them.

Descriptor declarations of `ALLOWED_ORIGINS` or `VPK_ORIGIN` must use the
matching service's SSM mapping. The scripts also require every additional
SSM-backed variable declared in the descriptor to exist in the chosen stash.
For example, include `AI_GATEWAY_URL_GOOGLE` when that provider is configured;
it is not a universal prerequisite. The canonical scripts retain the full VPK
backend stash baseline above; a minimal static-only scaffold requires its own
appropriate packaging path rather than dummy AI credentials.

The shared CSP must permit the existing Atlassian font CDN in `style-src` and
`font-src`, plus `connect-src` for the peel renderer's font embedding fetches.

### 3. Create the Micros service

```bash
"$VPK_ATLAS_BIN" micros service create --service="$SERVICE_NAME" --no-sd
```

Creating an already-existing service is not a recovery step. Inspect it first.

### 4. Stash variables

Load credential values from their authoritative local stores, then use
`atlas micros stash set` without printing them. Use a JSON file for the
multiline ASAP private key:

```bash
(
  set -e
  umask 077
  STASH_FILE="$(mktemp)"
  trap 'rm -f -- "$STASH_FILE"' EXIT
  trap 'exit 1' HUP INT TERM
  jq '{ASAP_PRIVATE_KEY: .privateKey}' .asap-config > "$STASH_FILE"
  "$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -f "$STASH_FILE"
)
```

Set the remaining variables individually:

```bash
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k AI_GATEWAY_URL -v "$AI_GATEWAY_URL"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k AI_GATEWAY_USE_CASE_ID -v "$AI_GATEWAY_USE_CASE_ID"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k AI_GATEWAY_CLOUD_ID -v "$AI_GATEWAY_CLOUD_ID"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k AI_GATEWAY_USER_ID -v "$AI_GATEWAY_USER_ID"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k ASAP_KID -v "$ASAP_KID"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k ASAP_ISSUER -v "$ASAP_ISSUER"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k OPENAI_REALTIME_MODEL -v "$OPENAI_REALTIME_MODEL"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k OPENAI_REALTIME_WS_URL -v "$OPENAI_REALTIME_WS_URL"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k OPENAI_REALTIME_VOICE -v "$OPENAI_REALTIME_VOICE"
```

Verify names after setting them:

```bash
"$VPK_ATLAS_BIN" micros stash list -s "$SERVICE_NAME" -e "$ENV"
```

Stop if a required name is absent. Do not assume a stash from the other pdev
environment is available.

### 5. Authenticate Docker

```bash
"$VPK_ATLAS_BIN" packages permission grant
"$VPK_ATLAS_BIN" packages secrets -t docker -i "$DOCKER_PASSWORD"
```

The permission command updates registry authorization. The secrets command
updates local Docker credentials; they solve different problems.

## Validate and deploy

Confirm frozen install/lockfile integrity and review the production audit before
shipping dependency changes. Keep registry routing token-free; never dump
historical package/lockfile diffs that contain registry credentials. Removing
unused dependencies or promoting target-specific overrides belongs to the
build/dependency owner and requires import tracing and compatibility checks.
The Team EU26 run reached zero production advisories; that is a recorded result,
not a guarantee about later builds.

For an extracted app, verify the pinned pnpm version, workspace policy, canonical
export wrapper, full backend, Docker context exclusions, and optional npmrc
BuildKit secret. Fix generation in `vpk-build` when applicable; preserve already
applied scaffold repairs instead of creating a second implementation.
If a sibling has an older copied `scripts/dev-deploy-fast.sh`, compare it with
the selected VPK checkout and sync it together with its referenced helpers.
Preserve extraction-specific customizations. Do not mix a new launcher with
missing or stale helper scripts.

Run the static contract check when Docker is intentionally unavailable:

```bash
bash .agents/skills/vpk-deploy/scripts/deploy-check.sh --check-only
```

Before a real deployment, run the full preflight:

```bash
bash .agents/skills/vpk-deploy/scripts/deploy-check.sh
```

Then use the canonical script:

```bash
.agents/skills/vpk-deploy/scripts/deploy.sh "$SERVICE_NAME" 1.0.1 "$ENV"
```

It requires an explicit Docker-tag-safe version, checks that the descriptor
image and every SSM path match `SERVICE_NAME`, and verifies the service and all
required stashes before building or pushing. A service that exists but has no
stack is ready for its initial deployment. The script then runs
`corepack pnpm run build:export`, requires `out/index.html`, validates detected
inline ADS themes before packaging, builds a
`linux/amd64` image, pushes it, and invokes Micros. For the exact underlying
commands, read
[`guide-manual-deployment.md`](guide-manual-deployment.md).

For an existing running service, append `--hot-swap` to the canonical command,
or run `pnpm run deploy:micros <new-version> --hot-swap`. This still builds and
pushes the new image. Config-only recovery with an existing image is a separate
manual operation described in that guide. Initial deployments may take 10–20
minutes or longer (Team EU26 took about 18); do not infer failure from the timer.
Hot swap still uploads/distributes an image and updates containers; it is not
instant. Record the prior successful image version/digest before replacing it.
If the new runtime regresses, use the manual guarded hot-swap procedure with
that verified existing version; check whether changed configuration also needs
restoring. Do not create a rollback tag for an image that was never pushed.

## Verify

Follow the deployment ID returned by Micros until it reaches a final state:

```bash
"$VPK_ATLAS_BIN" micros events -s "$SERVICE_NAME" -e "$ENV" -d "<deployment-id>"
```

For hot swap, the ID can remain unchanged and events can show only the original
creation. Query service status and confirm the selected environment's stack has
the expected `sd.buildNumber` and final `UPDATE_COMPLETE` status. An old
`CREATE_COMPLETE` event does not establish that the new image is running.

Map the environment to its region and verify the deployed runtime:

```bash
node .agents/skills/vpk-deploy/scripts/verify-runtime.mjs \
  "https://$SERVICE_NAME.<region>.platdev.atl-paas.net" / --profile full
```

A backend-backed prototype is complete only when:

- The Micros stack reaches a stable success state.
- The main route, static assets, fonts, and `/api/health` return successfully.
- Changed AI, voice, SSE, WebSocket, or API interactions work in the deployed
  browser.
- Browser console and server logs show no new errors.

The service URL requires Atlassian VPN. If a command fails, stop and diagnose
with [`troubleshooting.md`](troubleshooting.md) instead of retrying blindly.

### Choose HTTP checks for the runtime

| Profile | Checks |
| --- | --- |
| `static` | Intended routes, referenced Next static assets, browser-shaped font requests |
| `backend` | Static checks plus JSON `/api/health` with status `OK` |
| `chat` | Backend checks plus `llmRouting.aiGatewayConfigured === true` |
| `full` (default) | Chat checks plus JSON realtime token with a nonempty token and positive `expiresInMs` |

Supply route arguments such as `/` or `/studio/` explicitly. Extracted root apps
must not inherit an assumed `/studio/`. Cross-origin redirects fail without
following their destination; verify intentional external navigation separately.
Each request has a timeout, adjustable through `--timeout-ms` (default 15000).
Response bodies and tokens are not printed.
Routes must serve HTML; CSS, JavaScript, and font assets must have compatible
content types. This catches static requests that incorrectly return an HTML
fallback with HTTP 200.

For tokenized VPK apps, add `--check-ads-theme` to require server-rendered ADS
theme attributes and active theme CSS in the initial HTML. Detected inline ADS
themes are checked even without the flag; the flag also catches missing setup.
Validate an export directly with:

```bash
node .agents/skills/vpk-deploy/scripts/verify-initial-theme.mjs out/index.html
```

The deploy scripts use `--if-present` to leave non-ADS apps unaffected. These
checks target VPK's inline color, spacing, typography, and shape theme contract;
apps intentionally serving theme CSS through another mechanism need an
appropriate first-render check for that mechanism.

### Functional and browser evidence

The HTTP verifier cannot establish usable chat, audio, or fonts permitted by CSP:

1. Open the exact deployed route in a scoped real browser and confirm its route
   marker. Check fresh console errors and CSP events, the font face actually
   used by visible text, desktop/narrow geometry, and representative interactions.
   For initial styling, use a fresh diagnostic session: open `about:blank`,
   block `**/_next/**/*.js*` via `agent-browser network route ... --abort`, then
   open the route. Inspect computed `--ds-text`, `--ds-space-200`, colors, font
   use, and geometry, and capture a screenshot. Remove the route interception
   and reload to verify normal hydration. Intentional script-blocking errors in
   the diagnostic run are separate from fresh errors after the normal reload.
2. For chat, send one non-sensitive, tool-free prompt and verify an assistant turn.
   For realtime, obtain a real scoped token and connect to the app's documented
   WSS endpoint; close promptly without printing the token. A 101 upgrade proves
   transport only. Test microphone/playback separately before claiming audio works.
3. Record accessibility violations and incomplete checks accurately; an inherited
   finding does not justify claiming a clean scan. Save screenshots under ignored
   `output/agent-browser/` and inspect them. Reset synthetic UI state and close
   only this task's browser session when finished.
4. Inspect external dependencies such as `VPK_ORIGIN` independently. A source
   service with no active stack/unresolvable URL leaves Create agent/skill actions
   unavailable; report that limitation without deploying the separate service.

Finish by reporting URL/VPN, stable service state and image version, capabilities
actually tested, known unavailable actions, and unverified checks. Local commit
and source shipping are separate outcomes from a live image.
