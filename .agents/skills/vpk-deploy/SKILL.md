---
name: vpk-deploy
description: Deploy, redeploy, or check status for a VPK prototype on Atlassian Micros.
metadata:
  validation_command: node --test .agents/skills/vpk-deploy/scripts/*.test.js
---

# VPK deploy

Deploy a VPK prototype to Atlassian Micros, update an existing deployment, or
inspect its current service and environment state. Prefer the skill scripts for
the normal path and use the references for setup detail and failures.

## When to use

Use this skill for an initial Micros service, a redeploy, deployment status,
environment inspection, or a Micros failure. Do not use it to extract a route
into a standalone app; run `vpk-build` first. Do not claim a backend-backed AI,
voice, or chat prototype is healthy from static export or `/api/health` alone.

## Preconditions and invariants

- Work from the intended prototype checkout and inspect its current status
  before changing deployment configuration.
- Establish the absolute checkout, service, environment, regional URL, entry
  route, runtime capabilities, and source revision or working-tree selection
  together. Carry forward explicit user corrections and latest-main-only scope.
- Review relevant local scaffold repairs as part of the build selection. A
  latest-main-only source selection still needs target harness fixes required
  for faithful rendering; account for any required fix excluded from the image.
- Resolve the Atlassian CLI by Micros capabilities using `vpk_resolve_atlas`
  from `scripts/deploy-lib.sh`; use `"$VPK_ATLAS_BIN"` for every Atlas call.
  A bare `atlas` may be an unrelated database CLI. See the deployment guide.
- Treat `.deploy.local` and `service-descriptor.yml` as hints; confirm the
  service and stash state in Micros before choosing initial versus redeploy.
- Keep service names at 26 characters or fewer and use only the supported pdev
  environments: `pdev-west2` or `pdev-apse2`.
- Preserve the application's runtime contract. Static-only routes may use the
  minimal export scaffold; API, SSE, realtime, WebSocket, AI, and voice routes
  need the full backend and security/static-serving behavior.
- Stashes are environment-specific. Verify required variables in the chosen
  environment and never print secret values.
- The full-backend deploy paths require the deployed HTTPS `ALLOWED_ORIGINS`;
  its mapping and stash are mandatory even when omitted from the descriptor. Use an
  SSM mapping. Bind `VPK_ORIGIN` likewise when the app opens the source VPK.
  Verify actual Origin behavior after deployment, not descriptor presence alone.
- Build Docker images for `linux/amd64`; verify the deployed browser/runtime,
  not only the image push or deployment command.
- Record the previous verified image version/digest before an update. A failed
  EC2 hot swap can leave that image serving healthy HTTP responses.
- Run manual deployment guard blocks under Bash with `set -euo pipefail` so a
  failed identity or stash check stops before deployment.

## Choose the path

```text
.deploy.local exists                  -> fast redeploy
descriptor still has YOUR-SERVICE-NAME -> initial deploy
custom descriptor, no .deploy.local  -> inspect Micros, then recover config
```

If the local signals disagree or the user did not choose an action, ask whether
they want status, deploy changes, initial setup, or environment inspection.
Read [deployment guide](references/guide-deployment.md) before initial setup or
configuration recovery.

## Status

Read service and environment from `.deploy.local` when present, then query
Micros without exposing values:

```bash
source .agents/skills/vpk-deploy/scripts/deploy-lib.sh
vpk_resolve_atlas
"$VPK_ATLAS_BIN" micros service show -s "$SERVICE_NAME" -e "$ENV"
"$VPK_ATLAS_BIN" micros stash list -s "$SERVICE_NAME" -e "$ENV"
```

Report the service, environment, URL, deployed version/state, variable names or
count, and missing configuration. Use `micros service show -o json` to verify
`stacks[env][0].status` and `stacks[env][0].sd.buildNumber`; a reused deployment
ID's events can describe an older creation. `No such service` or `Unknown
service` means the Micros service must be created even when local files contain
a name.

## Happy path

### Initial deploy or recovered configuration

1. Read [deployment guide](references/guide-deployment.md) and collect the
   service name, target environment, Docker identity token, and required local
   credentials without echoing secrets.
2. Create `.deploy.local`, replace descriptor placeholders, and create the
   Micros service if it does not exist.
3. Stash and list all required variables in the selected environment.
4. Authenticate Docker and run the preflight:

```bash
./.agents/skills/vpk-deploy/scripts/deploy-check.sh
```

5. Deploy with the canonical script:

```bash
./.agents/skills/vpk-deploy/scripts/deploy.sh <service-name> <version> [env]
```

The script requires an explicit Docker-tag-safe version, validates the
descriptor image and SSM identity, and checks the service and every required
stash before any build, push, or deployment. An existing service with no stack
is a valid initial-deploy state. It then produces and verifies the static export
through `corepack pnpm run build:export`, builds and pushes the `linux/amd64`
image, and invokes Micros. Initial deployment can take 10–20 minutes or longer;
the Team EU26 run took about 18 minutes. Follow events rather than a fixed timer.
When a deployment ID is returned, follow events to a final state:

```bash
"$VPK_ATLAS_BIN" micros events -s <service-name> -e <env> -d <deployment-id>
```

Use [manual deployment](references/guide-manual-deployment.md) only when the
canonical script cannot cover the requested operation.

### Fast redeploy

When `.deploy.local` is valid and the existing service is confirmed:

```bash
pnpm run deploy:micros
```

The fast path generates a collision-resistant, Docker-tag-safe version when
one is omitted. It validates descriptor identity, remote service existence, and
required stashes before registry permission or login.

Do not run `pnpm deploy`; that is pnpm's unrelated workspace deployment command
and can fail with `ERR_PNPM_NOTHING_TO_DEPLOY`.

For an existing running deployment, image hot swap is explicit:

```bash
pnpm run deploy:micros <new-version> --hot-swap
# Or: .agents/skills/vpk-deploy/scripts/deploy.sh <service-name> <new-version> <env> --hot-swap
```

The fast command also accepts `pnpm run deploy:micros --hot-swap` with an
automatically generated version. The canonical command can omit `<env>` and
resolve it from `.deploy.local` or the default environment.

Both paths still export, build, push, and check identity/stashes. For config-only
recovery with the existing image, read the manual guide first. Do not use
health/check bypass flags or hot swap as an initial-deployment shortcut.
Hot swap can reuse the deployment ID, whose events may show the original
creation. Confirm the expected image version and `UPDATE_COMPLETE` through
service status, then check the runtime. If the stack is `UPDATE_FAILED`, stop:
the older image can still pass `/api/health` and the HTTP runtime profile. See
the guide for rollback and timing.

## Verify

Run the export/build validation appropriate to the project, then verify the
deployed URL:

```bash
node .agents/skills/vpk-deploy/scripts/verify-runtime.mjs \
  "https://<service-name>.<region>.platdev.atl-paas.net" / --profile full
```

Confirm the service reaches a stable stack, the main route and `/api/health`
succeed, browser-shaped static/font requests return `200`, and every changed
backend-backed interaction works. The service URL requires Atlassian VPN.

Pass the intended routes explicitly; the default is `/`, with no assumed
`/studio/`. Select `static`, `backend`, `chat`, or `full` for the app's runtime
capabilities; see the guide. For an extracted root served byte for byte from
`out/index.html`, add `--expect-html-file out/index.html`; it catches an older
image still answering after an update failure. A verifier pass proves HTTP
checks only. Use a real browser to prove font use/CSP, desktop and narrow
geometry, console, accessibility, and interactions. Verify a bounded tool-free
chat turn and authenticated WSS when applicable:

```bash
node .agents/skills/vpk-deploy/scripts/verify-wss.mjs \
  "https://<service-name>.<region>.platdev.atl-paas.net"
```

The verifier closes the socket and never prints its scoped token. A 101 upgrade
does not prove working audio.

For tokenized VPK apps, also pass `--check-ads-theme`. The verifier checks raw
HTML theme activation and CSS/JavaScript/font content types. Both deploy scripts
reject incomplete inline ADS themes before image packaging. Prove the initial
render in a fresh browser with app JavaScript blocked, then check normal
hydration; a styled screenshot after hydration can hide an unstyled first paint.
See the deployment guide's browser evidence procedure.

Report unavailable external actions separately, including Create agent/skill
when their configured source VPK has no active deployment. Do not deploy that
separate service without authorization. Finish with the correct URL, VPN
requirement, verified version/state, tested capabilities, and remaining gaps;
do not claim local commits or source shipping unless completed.

## Failures

Do not retry blindly. Read [troubleshooting](references/troubleshooting.md) for
Docker authentication, missing packages, ASAP formatting, health failures,
EC2 SSM timeouts, verification lag, and ALB subnet exhaustion. For a full-image
EC2 timeout, inspect the failed SSM command, node disk, and registered images.
A compact frontend recovery image needs byte parity of the prior image's
`backend/`, `lib/`, `rovo/`, and `scripts/lib/` with the selected target and a
reviewed export-file diff. Run `plan-frontend-delta.mjs` to enforce that parity,
service identity, and prior dependency-input comparison. A different
`pnpm-lock.yaml` or workspace policy means the compact image keeps the previous
installed packages; choose a full image for a requested dependency refresh, or
explicitly accept and report the prior dependency layer for a frontend-only
release. If west2 lacks subnet capacity, verify the condition before switching
to `pdev-apse2`, then restash every required variable in that environment.

## References

For changes to this skill's scripts, run
`node --test .agents/skills/vpk-deploy/scripts/*.test.js`; an export build alone
does not exercise deployment guards or runtime verification.

- [guide-deployment.md](references/guide-deployment.md): prerequisites,
  configuration, initial deployment, runtime contracts, and full command detail.
- [guide-manual-deployment.md](references/guide-manual-deployment.md): explicit
  manual command sequence.
- [troubleshooting.md](references/troubleshooting.md): error messages,
  diagnosis, environment fallback, and recovery.
- [verify-wss.mjs](scripts/verify-wss.mjs): scoped-token or localhost-development
  WebSocket transport proof without audio or token logging.
- [plan-frontend-delta.mjs](scripts/plan-frontend-delta.mjs): dry-run runtime,
  dependency, service, and export parity guard before a compact recovery image.
