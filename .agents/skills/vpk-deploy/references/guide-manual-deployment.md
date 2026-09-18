# Manual deployment commands

Use the canonical deploy script unless it cannot cover the requested operation.
These commands expose the same current contract for diagnosis or a controlled
manual run. They mutate registry and Micros state; do not run them for a status
request. Run the manual blocks in Bash with `set -euo pipefail`; a failed
identity/stash guard must stop the operation before image or Micros mutation.

## Inputs

```bash
set -euo pipefail
SERVICE_NAME="your-service-name"
ENV="pdev-west2"
VERSION="1.0.1"
source .agents/skills/vpk-deploy/scripts/deploy-lib.sh
vpk_resolve_atlas
```

Only `pdev-west2` and `pdev-apse2` are supported. Resolve the URL region from
the selected environment:

```bash
case "$ENV" in
  pdev-west2) REGION="us-west-2" ;;
  pdev-apse2) REGION="ap-southeast-2" ;;
  *) echo "Unsupported environment: $ENV"; exit 1 ;;
esac
```

## Initial service setup

Create the service only after `atlas micros service show` confirms it does not
exist:

```bash
"$VPK_ATLAS_BIN" micros service create --service="$SERVICE_NAME" --no-sd
```

The descriptor and the selected environment's stash must contain:

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
ALLOWED_ORIGINS
VPK_RUNTIME_ADMIN_TOKEN
```

The full-backend paths require `ALLOWED_ORIGINS` set to their deployed HTTPS
origin. Bind it through `((ssm:/<service>/ALLOWED_ORIGINS))`; use the equivalent
mapping for `VPK_ORIGIN` when external Create actions need it. Include additional
provider settings only when configured. Every descriptor SSM reference must
have a stash in the selected environment. See the deployment guide for runtime
scope and protected credential provisioning.

Use environment variables loaded from authoritative local configuration rather
than copying secrets into shell history:

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
ALLOWED_ORIGINS="https://$SERVICE_NAME.$REGION.platdev.atl-paas.net"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" -k ALLOWED_ORIGINS -v "$ALLOWED_ORIGINS"
```

Preserve the multiline private key through JSON:

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

Generate the production runtime-admin token once, stash it, and unset it:

```bash
VPK_RUNTIME_ADMIN_TOKEN="$(openssl rand -hex 32)"
"$VPK_ATLAS_BIN" micros stash set -s "$SERVICE_NAME" -e "$ENV" \
  -k VPK_RUNTIME_ADMIN_TOKEN -v "$VPK_RUNTIME_ADMIN_TOKEN"
unset VPK_RUNTIME_ADMIN_TOKEN
```

Verify names without reading values:

```bash
"$VPK_ATLAS_BIN" micros stash list -s "$SERVICE_NAME" -e "$ENV"
```

Stop if any required name is missing.

## Build, push, and deploy

Run the checked-in preflight and export wrapper:

```bash
bash .agents/skills/vpk-deploy/scripts/deploy-check.sh
source .agents/skills/vpk-deploy/scripts/deploy-lib.sh
vpk_validate_service_name "$SERVICE_NAME"
vpk_validate_version "$VERSION"
vpk_validate_descriptor_identity "$SERVICE_NAME" service-descriptor.yml
vpk_require_service_and_stashes "$SERVICE_NAME" "$ENV"
corepack pnpm run build:export
vpk_verify_export
```

These identity checks are read-only and must pass before registry login, image
build or push, and Micros deployment. `service show` success is sufficient for
an initial deployment even when that new service has no stack yet.

Build the Node 24 runtime image from the pnpm workspace and prebuilt `out/`:

```bash
if [ -n "${HOME:-}" ] && [ -f "$HOME/.npmrc" ]; then
  docker buildx build --platform linux/amd64 --no-cache \
    --secret "id=npmrc,src=$HOME/.npmrc" \
    -t "docker.atl-paas.net/$SERVICE_NAME:app-$VERSION" \
    -f backend/Dockerfile . --load
else
  docker buildx build --platform linux/amd64 --no-cache \
    -t "docker.atl-paas.net/$SERVICE_NAME:app-$VERSION" \
    -f backend/Dockerfile . --load
fi
docker push "docker.atl-paas.net/$SERVICE_NAME:app-$VERSION"
```

The Dockerfile consumes the optional `npmrc` BuildKit secret only for the
dependency-install layer. This branch is compatible with the macOS system Bash
3 even when `HOME` is unset.

Deploy the exact pushed version:

```bash
export VERSION
"$VPK_ATLAS_BIN" micros service deploy \
  --service="$SERVICE_NAME" \
  --env="$ENV" \
  --file=service-descriptor.yml
```

Follow the returned deployment ID to a final state, then verify the regional
URL:

```bash
"$VPK_ATLAS_BIN" micros events -s "$SERVICE_NAME" -e "$ENV" -d "<deployment-id>"
node .agents/skills/vpk-deploy/scripts/verify-runtime.mjs \
  "https://$SERVICE_NAME.$REGION.platdev.atl-paas.net" / --profile full
```

For a redeploy, choose a new version and repeat the build, push, deploy, and
verification sequence. Never deploy a version that was not pushed.

## Hot-swap recovery

Inspect the existing service, running stack, and current image version first.
Check the installed CLI's `micros service deploy --help`; the supported syntax
on the Team EU26 run was `--mode=hot-swap`. Do not use hot swap for initial setup
or pass flags that bypass health, deep, semantic, run-once, or compliance checks.

For code changes, build and push a new version using the steps above, then:

```bash
export VERSION
"$VPK_ATLAS_BIN" micros service deploy \
  --service="$SERVICE_NAME" --env="$ENV" \
  --file=service-descriptor.yml --mode=hot-swap
```

For a config-only repair, preserve the exact existing image version. Derive the
`VERSION` suffix from the verified deployed `app-<version>` tag; do not use an
auto-generated version, the deployment ID, or a tag that was never pushed.
After repairing stashes/descriptor mappings, run the same identity and remote
prerequisite gates without rebuilding or pushing:

```bash
VERSION="<verified-existing-version-suffix>"
vpk_validate_service_name "$SERVICE_NAME"
vpk_validate_version "$VERSION"
vpk_validate_descriptor_identity "$SERVICE_NAME" service-descriptor.yml
vpk_require_service_and_stashes "$SERVICE_NAME" "$ENV"
export VERSION
"$VPK_ATLAS_BIN" micros service deploy \
  --service="$SERVICE_NAME" --env="$ENV" \
  --file=service-descriptor.yml --mode=hot-swap
```

Follow the returned deployment ID to a final state and confirm the expected
image/runtime configuration through status plus actual Origin/functional checks.
For hot swap, service status must show the expected version and
`UPDATE_COMPLETE`; events for a reused deployment ID may show only the original
creation. For an extracted static root, also run `verify-runtime.mjs` with
`--expect-html-file out/index.html`; the prior image can still answer healthy
HTTP checks after an `UPDATE_FAILED` attempt. Record the prior successful image
version/digest before an update.
For a runtime regression, the guarded existing-image procedure above can
restore that version; review any changed stashes/configuration as well.
If Micros rejects the mode, diagnose its stated preconditions; do not retry with
check bypasses. The config-only repair in Team EU26 proved origin propagation
before the later CSP code change needed a new image.

### Compact frontend image after a full-image EC2 timeout

Follow [EC2 timeout diagnosis](troubleshooting.md#ec2-hot-swap-timeout-and-compact-recovery)
first. This path applies only when the selected target's `backend/`, `lib/`,
`rovo/`, and `scripts/lib/worktree-ports.js` files are byte-identical to the previous verified
image and the requested change is in the exported frontend. Compare the entire
runtime file set, excluding the image's static `backend/public/` and test/data
files. If runtime code differs, use the full backend build and review those
changes instead.

Extract only the verified prior image's `/app/backend`, `/app/lib`,
`/app/rovo`, `/app/scripts/lib/worktree-ports.js`, and root `package.json`, `pnpm-lock.yaml`,
`pnpm-workspace.yaml`, and `.npmrc` into a temporary prior-image root. The
backend copy includes its static `backend/public/`. Review the immutable prior
registry digest, then run the dry plan:

```bash
node .agents/skills/vpk-deploy/scripts/plan-frontend-delta.mjs \
  <target-root> <prior-image-root> \
  --base-image docker.atl-paas.net/<service>@sha256:<verified-prior-digest>
```

The planner checks service identity, full runtime file parity, root dependency
inputs, and changed/new `out/` files by content. It lists old-only files for
review; old Next chunks may remain when the new HTML no longer references them.
If the dependency inputs differ, a frontend layer retains the previous installed
packages. Use a full image for a requested dependency refresh. For an approved
frontend-only release, record that inherited dependency layer and explicitly
add `--accept-prior-dependencies` when writing the candidate:

```bash
node .agents/skills/vpk-deploy/scripts/plan-frontend-delta.mjs \
  <target-root> <prior-image-root> \
  --base-image docker.atl-paas.net/<service>@sha256:<verified-prior-digest> \
  --out <empty-overlay-dir> --apply
```

Add `--accept-prior-dependencies` only after that review. The planner writes a
context containing changed export files, a plan JSON beside it, and a Dockerfile
beside it. Build and push that exact context with a new Docker-tag-safe version:

```bash
docker buildx build --platform linux/amd64 \
  -f <empty-overlay-dir>.Dockerfile \
  -t "docker.atl-paas.net/$SERVICE_NAME:app-$VERSION" \
  --load <empty-overlay-dir>
docker push "docker.atl-paas.net/$SERVICE_NAME:app-$VERSION"
```

Inspect the candidate image's `backend/public/index.html` and representative
new chunks against the selected `out/` before deployment. Run the
service/descriptor/stash guards under Bash before the manual `--mode=hot-swap`
command above. Confirm `UPDATE_COMPLETE`, expected `sd.buildNumber`, and exact
live export HTML. A `101` WebSocket upgrade and a tool-free chat turn are
separate runtime checks.
