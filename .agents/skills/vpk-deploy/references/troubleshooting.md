# Deployment troubleshooting

Diagnose the first failing boundary and stop. Do not retry a push or deployment
until its prerequisite is repaired.

## Quick reference

| Symptom | Check |
| --- | --- |
| `atlas` shows database commands | Resolve Atlassian Micros capabilities; use `VPK_ATLAS_BIN` |
| `ERR_PNPM_NOTHING_TO_DEPLOY` | Use `pnpm run deploy:micros`, not `pnpm deploy` |
| Missing or stale `out/` | Run `corepack pnpm run build:export`; require `out/index.html` |
| Docker cannot copy `out/` | Confirm the export completed before `docker buildx build` |
| Package install fails in Docker | Check root `pnpm-lock.yaml`, workspace files, and npm registry credentials |
| `exec format error` | Build with `--platform linux/amd64` |
| Docker push returns 401 | Refresh local Docker credentials and registry permissions |
| Production exits before listening | Verify `VPK_RUNTIME_ADMIN_TOKEN` is in the descriptor and selected environment's stash |
| AI/voice route returns 401 or 403 | Verify AI Gateway and ASAP variables and authorization |
| Health or runtime shows missing variables | Restash in the selected environment, then deploy a new version |
| `stash get` is unavailable | Use `atlas micros stash list`; do not print values |
| ALB reports insufficient IP space | Measure subnet capacity before considering `pdev-apse2` |
| Micros remains `CREATE_IN_PROGRESS` | Follow deployment events; allow reconciliation lag |
| EC2 hot swap times out after a successful image push | Inspect the failed SSM command, current compute node, disk, and registered images before selecting a smaller image or retrying |
| Same-origin browser requests fail but localhost Origin works | Check running origin settings and SSM mappings, not descriptor literals alone |
| Font fetch succeeds but fallback font renders | Inspect CSP events, external stylesheet, and the used font face |
| Page is unstyled until JavaScript runs | Check initial HTML theme activation; prove rendering with app scripts blocked |
| CSS/JS/font request returns HTML with 200 | Check asset content types and static-serving fallback behavior |
| Extract verification leaves the app through `/studio/` | Pass `/` explicitly; check external navigation separately |
| Health/token endpoint returns HTML with 200 | Use JSON/content/readiness checks and the correct runtime profile |
| Create agent/skill opens an unavailable VPK | Inspect the configured external source service and URL |

## Wrong CLI or authentication boundary

```bash
source .agents/skills/vpk-deploy/scripts/deploy-lib.sh
vpk_resolve_atlas
"$VPK_ATLAS_BIN" micros service deploy --help
```

An executable named `atlas` is not sufficient: Team EU26 found an unrelated
database CLI on PATH. The helper checks Micros service/stash/events support and
tries the known Atlassian install when PATH is wrong. An explicit invalid
`VPK_ATLAS_BIN` fails without falling back. Use the resolved executable for every
Atlas operation. When Okta sign-in is required, let the user complete it and
resume the original operation after their reply; do not reset credentials
speculatively.
The resolver reads both output streams: Atlassian's `micros --help` can succeed
while writing all its capability help to stderr. If an older copied helper
rejects the verified CLI, sync the helper rather than bypassing CLI validation.

## Preflight or export failure

Run the static contract check first:

```bash
bash .agents/skills/vpk-deploy/scripts/deploy-check.sh --check-only
```

It should confirm the root pnpm workspace, Node 24 Dockerfile, export wrapper,
and `COPY out ./backend/public` contract. A missing `out/` is informational
there because both deploy scripts build it before Docker packaging.

Build the export separately to expose the real Next.js failure:

```bash
corepack pnpm run build:export
test -f out/index.html
```

The wrapper temporarily moves runtime-only routes and restores them in a
`finally` path. If it reports a pre-existing backup path, stop and inspect the
named source and backup before changing either one.

For file-casing errors that only appear in Linux, compare import spelling with
the tracked filename exactly. Do not add duplicate case variants on macOS.

### Unstyled initial render

On Team EU26, the exported head included ADS theme CSS, but `<html>` lacked
`data-theme`. CSS selectors stayed inactive until `ThemeWrapper` hydrated.
The local fix had also been left out of the deployed image. HTTP 200 checks and
screenshots taken after hydration missed this failure.

Run `verify-initial-theme.mjs out/index.html` locally and `verify-runtime.mjs`
with `--check-ads-theme` against the deployed route. Generated layouts must use
`getThemeHtmlAttrs(THEME_STATE)` alongside `getThemeStyles(THEME_STATE)`; fix the
generator in `vpk-build` and include the corrected frontend export in the image.
Use the deployment guide's script-blocked browser check to prove initial
rendering, then reload normally. Theme attributes alone do not prove Tailwind
utilities, font delivery, or the full CSS pipeline.

## Docker dependency or registry failure

`backend/Dockerfile` installs production dependencies from:

- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `backend/package.json`

Repair those pnpm inputs instead of creating a backend npm lockfile. If private
registry access fails, confirm `$HOME/.npmrc` contains token-free routing plus
the required user credential and that the Docker build receives it as the
`npmrc` secret.

For a push 401, refresh both local credentials and server-side permission:

```bash
source .deploy.local
"$VPK_ATLAS_BIN" packages secrets -t docker -i "$DOCKER_PASSWORD"
"$VPK_ATLAS_BIN" packages permission grant
```

`atlas packages secrets` repairs the local keychain entry.
`atlas packages permission grant` updates registry authorization. A successful
Docker login alone does not prove push access.

## Missing production variables

The full backend runtime needs these descriptor and stash names:

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

Inspect names without exposing values:

```bash
"$VPK_ATLAS_BIN" micros stash list -s "$SERVICE_NAME" -e "$ENV"
```

Stashes do not cross environments. After changing a stash, reconcile the
running deployment so the container receives the configuration. A verified
existing image can be reused for a config-only hot swap; code changes need a
new built/pushed image. See the manual guide's recovery sequence.

Every descriptor SSM reference is checked for stash presence, including
configured optional provider/origin settings. Presence still does not prove
runtime propagation. Do not provision unused settings just to satisfy a check.

### Same-origin failures and absent origin settings

On Team EU26, literal `ALLOWED_ORIGINS` and `VPK_ORIGIN` appeared in the
descriptor but were absent at runtime. Browser-shaped requests with the
deployed Origin failed with 500, while localhost Origin worked. Compare the
same request with/without the deployed Origin and inspect configuration
presence without values. This is a recorded failure, not a claim that all
literal Micros variables always fail.

Stash the deployed HTTPS origin and bind `ALLOWED_ORIGINS` through the matching
`((ssm:/<service>/ALLOWED_ORIGINS))` reference. Bind `VPK_ORIGIN` similarly when
the app uses it. Reconcile through the guarded manual config-only path, then
rerun browser-shaped font/token requests. Preserve CORS/authentication logic;
do not accept arbitrary Origins to hide the configuration problem.
The full-backend deployment guards reject an omitted origin mapping or stash
before building or changing registry/deployment state. `VPK_ORIGIN` remains optional.

### Font CSP and actual font use

HTTP success cannot establish that the browser permits a font stylesheet or
uses the intended face. Inspect `securitypolicyviolation` events and the exact
directive/blocked host. Team EU26 needed
`https://ds-cdn.prod-east.frontend.public.atl-paas.net` in `styleSrc` and
`fontSrc`; the shared peel renderer also needs its existing `connect-src`
permission for font embedding. Add only permissions proven necessary for the
app, test the shared security policy, then deploy the corrected image.

Check the face used by visible text (the Latin Atlassian Sans face loaded in
this case). Unused Unicode faces remaining unloaded are not a failed check.
Keep CSP diagnosis distinct from same-origin HTTP/CORS failure.

### ASAP private-key formatting

Preserve the multiline key through JSON rather than shell newline rewriting:

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

If AI Gateway still rejects the principal, verify the use-case authorization
and key registration through the owning platform. Do not rotate or restash
credentials speculatively.

## Runtime verification failure

`/api/health` proves only that Express responds. Use the runtime verifier and
exercise every changed backend-backed interaction:

```bash
node .agents/skills/vpk-deploy/scripts/verify-runtime.mjs \
  "https://$SERVICE_NAME.$REGION.platdev.atl-paas.net" / --profile full
```

If production exits with:

```text
VPK_RUNTIME_ADMIN_TOKEN is required when runtime admin protection is enabled
```

ensure the token exists in both the selected environment's stash and
`service-descriptor.yml`. Never print the token while diagnosing it.

Choose `static`, `backend`, `chat`, or `full` according to the app's capabilities
(see the deployment guide). Defaults are root `/` and profile `full`; there is
no implicit `/studio/`. Unexpected external redirects fail before the verifier
requests their destination. JSON readiness/token failures, timeouts, and static
request failures are labeled; a pass still does not prove chat or WSS/audio.

For functional proof, use one non-sensitive tool-free chat turn and, when
applicable, a real token-backed WSS connection with prompt cleanup. Run
`verify-wss.mjs <deployed-HTTPS-origin>`; it obtains the scoped token without
printing it and closes after the upgrade. For an extracted localhost preview,
use `--discovery --allow-tokenless-dev` to prove the URL and upgrade proxy when
local runtime-admin tokens are disabled. Do not send audio or exercise mutating
tools as part of an unrequested probe. A 101 upgrade proves transport only;
report untested audio separately.

When HTTP/token discovery works but a sandboxed WSS probe returns only a
transport error, retry that read-only verifier once outside the sandbox network
path before investigating or redeploying the service. Team EU26 passed an
authenticated `101` on that retry. Preserve scoped-token/Origin checks and never
print the socket URL's token.

### External source VPK dependency

Inspect the configured `VPK_ORIGIN` service and URL independently. Team EU26's
source VPK service was registered but had no active environment/stacks, and its
URL did not resolve. Create agent/skill redirects therefore remained
unavailable despite a successful standalone deployment. Report that dependency;
do not change the destination or deploy a separate service without authorization.

### Browser drag automation

Before changing product code for a failed automated drag, check visibility,
`elementFromPoint`, and scroll state. In this run `scrollintoview` could leave
`data-scrolling` active, suppressing row pointer events. Selecting an already
visible hittable row, hovering the target to reveal Create, and performing an
atomic drag succeeded. Verify source removal, target count, and dropzone cleanup,
then reload to reset synthetic state. Record fresh console/accessibility checks
and inspect desktop/narrow screenshots under ignored `output/agent-browser/`.

## EC2 hot-swap timeout and compact recovery

A successful Docker push and `sd.buildNumber` update do not prove that the new
image runs. In the 2026-09-18 Team EU26 refresh, the full image was pushed,
then Micros returned `EC2 hot-swap failed` for an SSM command. The stack became
`UPDATE_FAILED`, while the previous image still served `/`, `/api/health`, fonts,
and the full HTTP profile. The failed command reported `ExecutionTimedOut`; the
node had free disk and had not registered the new image. Timeout alone did not
prove a disk-full cause. The subsequent 6.7 MB frontend layer succeeded and
retained the prior installed dependency layer.

Read the command ID from the Micros error, then use the Micros CLI's read-only
views and built-in diagnostics before assuming a broader AWS role:

```bash
"$VPK_ATLAS_BIN" micros compute command show -s "$SERVICE_NAME" -e "$ENV" -c <command-id> -o json
"$VPK_ATLAS_BIN" micros compute show -s "$SERVICE_NAME" -e "$ENV"
"$VPK_ATLAS_BIN" micros compute command docs -s "$SERVICE_NAME" -e "$ENV" -d MICROS-df
"$VPK_ATLAS_BIN" micros compute command run -s "$SERVICE_NAME" -e "$ENV" \
  --document MICROS-df -i <current-instance-id> -y -t 120
"$VPK_ATLAS_BIN" micros compute command run -s "$SERVICE_NAME" -e "$ENV" \
  --document MICROS-docker-daemon-images -i <current-instance-id> -y -t 120
```

Both documents read state; inspect the instance ID named by the failed command,
then confirm it is currently returned by `compute show` for that deployment.
A different healthy node does not establish the failed node's disk/image state. A transient rollout node can disappear after failure and make
an SSM probe time out. The Team EU26 service role lacked AWS
`ssm:GetCommandInvocation`; use owner-level Micros diagnostics first. If those
checks cannot identify the boundary, seek the required read-only role access
rather than treating a timed-out SSM command as proof of one cause.

If the release changes runtime files or dependencies, use the guarded
[full-image cutover recovery](guide-manual-deployment.md#full-image-cutover-recovery)
after diagnostics and a deliberate mode decision. It reuses the selected pushed
image on a fresh stack and requires the new stable deployment ID plus live byte
parity. This is an alternative to in-place updating, not an automatic retry.

Use `plan-frontend-delta.mjs` before a compact frontend recovery. Extract
the prior verified image's runtime, static files, and root package/lockfile
inputs to a temporary directory. The planner compares `backend/`, `lib/`,
`rovo/`, and `scripts/lib/worktree-ports.js` file contents, target descriptor service identity,
root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, and new
`out/` files. It refuses a frontend-only candidate when runtime files differ.
A dependency-input difference means the candidate inherits prior installed
packages. Build the full image when the selected release requires new packages;
for a reviewed frontend-only release, explicitly accept and report the prior
layer with `--accept-prior-dependencies`. The Team EU26 target's lockfile and
workspace policy differed from its compact image's prior base in this run.

The planner's `--apply` mode writes only changed/new export files, an immutable
prior-digest Dockerfile, and a manifest for review. Keep source paths, list
old-only files, and inspect candidate HTML/new chunks against `out/`. Do not
copy a staging checkout's descriptor or backend launcher into the image.
Build/push a new `linux/amd64` tag and use the
[guarded manual hot-swap path](guide-manual-deployment.md#compact-frontend-image-after-a-full-image-ec2-timeout).

After Micros reports success, resolve the stable/requested deployment IDs with
`deployment-status.mjs` and require the expected build plus `UPDATE_COMPLETE` or
`CREATE_COMPLETE`. Array order and build number alone are insufficient. For an extracted static
root, run `verify-runtime.mjs <origin> / --expect-html-file out/index.html`
before browser checks. This catches the older healthy image that remained live
after the failed attempt. Events for a reused deployment ID can show only the
original creation and cannot prove the new image state.

## ALB subnet exhaustion

An ALB needs at least eight free addresses in every selected subnet. When
`pdev-west2` reports insufficient IP space, measure the subnets before
retrying:

```bash
aws ec2 describe-subnets --region us-west-2 \
  --query 'Subnets[].{AZ:AvailabilityZone,Free:AvailableIpAddressCount,Subnet:SubnetId}' \
  --output table
```

If the selected subnets cannot satisfy the requirement, `pdev-apse2` is the
only other supported pdev environment. Before switching:

1. Set `ENV="pdev-apse2"` in `.deploy.local`.
2. Restash every required variable into `pdev-apse2`.
3. Verify the stash names.
4. Deploy a new version with the explicit environment.
5. Verify the `ap-southeast-2` URL.

Do not treat an environment switch as a blind retry.

## Micros reconciliation lag

The deploy command can return before Micros finishes reconciling the stack.
Follow the deployment ID:

```bash
"$VPK_ATLAS_BIN" micros events -s "$SERVICE_NAME" -e "$ENV" -d "<deployment-id>"
"$VPK_ATLAS_BIN" micros service show -s "$SERVICE_NAME" -e "$ENV"
```

Wait for a final state. If direct AWS inspection is authorized and necessary,
assume the service role for the same service/environment and inspect the
matching region; do not infer success from the image push alone.
For hot swap, confirm the expected version and `UPDATE_COMPLETE` through
service status. Events for a reused ID may contain only the original creation;
those old success events are not evidence of the current update.
