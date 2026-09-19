# Fast refresh of an existing prototype

Use this path for a configured sibling whose target and runtime contract are
already authorized. Select and record the source revision, trace the route, and
scaffold a disposable stage. Install dependencies and build in the actual
sibling once; the disposable stage is for file review and needs no install,
build, or browser session.

Warm dependency state once before parallel pnpm validations. pnpm 11's pre-run
dependency verification can start an install; simultaneous cold `pnpm run`
commands can contend over the module layout and request a non-interactive purge.
Wait for one project's install to finish first. For Node-only repository/skill
validators, the documented underlying Node commands avoid repeated pnpm
dependency checks while retaining the same validation.

## Plan and apply the source delta

Take `BASELINE_SHA` from the previous verified release's provenance, rather than
the sibling's Git HEAD: its older initial commit can make already shipped files
appear dirty. Run from VPK with the plan, stage, target, and manifest paths set:

```bash
node .agents/skills/vpk-build/scripts/plan-target-refresh.mjs \
  "$PLAN_FILE" "$STAGE_DIR" "$TARGET_DIR" \
  --baseline "$BASELINE_SHA" --out "$REFRESH_MANIFEST"
```

The planner compares actual bytes against the selected and baseline Git trees.
It discovers local CSS, ambient types, public assets, and backend/runtime files
from the staged tree, including files outside the TypeScript trace's `files`
array. It reports:

- `copy`: canonical upstream changes whose target still matches the baseline.
- `localOverrides`: local changes in files that upstream has not changed.
- `overlaps`: upstream and local changes in the same file, including deletions.
- `manualReview`: generated harness, dependency-policy, dirty-source, or newly
  reached pre-existing file differences that need an owner decision.
- `preserved`: target README, descriptor, metadata, and backend launcher.
- `oldOnly`: retained files; the planner never deletes them.

Review the actual diffs and every manual decision. Root dependency additions can
belong to another route; compare traced packages and backend requirements before
changing the target or accepting a prior installed dependency layer. Preserve
required extraction harness fixes. For overlaps, merge the owner changes through
the manual refresh path; automatic apply stops before writing any file.

```bash
node .agents/skills/vpk-build/scripts/plan-target-refresh.mjs \
  --apply "$REFRESH_MANIFEST"
```

Apply checks all staged and target file hashes before copying and checks each
again immediately before its write. The selected stage remains usable when the
live source checkout later switches revision. Keep its recorded provenance.

Staging requests filesystem clones where supported, with Node's ordinary-copy
fallback; destinations remain independently editable. The full public tree is
copied once, without recopying the traced asset subset afterward.

## Produce one export

For the backend-backed harness:

```bash
.agents/skills/vpk-build/scripts/verify-target.sh "$TARGET_DIR" --export
```

This keeps install and typecheck and replaces the normal-build-then-export pair
with one export build. The minimal static scaffold's normal `build` already
exports, so use the default verifier for it. Reuse a current-run export only
while source, local overrides, dependency policy, harness, public assets, and
build environment remain unchanged. `out/` presence or a Git SHA alone is not
freshness proof.

The verifier prepares compression and writes `output/release-receipt.json`.
Consume it with `pnpm run deploy:micros <version> --receipt
output/release-receipt.json --mode=cutover` from the target. Receipt validation
compares the actual target, environment-file hashes, public build settings,
source/harness/dependency/assets and prepared export bytes before any registry or
Micros mutation. Without a receipt, the deploy command owns its export build.

The refresh also records `.vpk-source.json` after checking its preimage. Keep this
metadata with the selected source; the target's older Git HEAD is not a VPK
release baseline.

## Keep verification focused

Run required source gates and one relevant local browser regression matrix on
the extracted `/`, including changed behavior, normal/reduced motion, responsive
layout, console, accessibility, API proxy, and WebSocket discovery/upgrade.
Preserve the export while `next dev` runs, then stop that preview and restore
the scaffold's minimal `next-env.d.ts` when it acquired `.next/dev` imports.

After deployment, exact export HTML/new-chunk parity plus browser smokes for the
changed capabilities usually permits reusing that local regression evidence.
Rerun the full matrix on the deployed URL when CSP, origins, fonts, auth,
production-only behavior, or a discrepancy creates a remaining risk. Keep live
browser/chat/WSS checks even when static parity passes.

When adapting an existing source browser suite, supply the extracted `/` route.
A disposable spec under ignored `output/` needs an explicit Playwright config
with `testDir` pointing there and an exact `testMatch`; default discovery may
ignore it and report `No tests found`. This is a test-discovery issue, not an app
failure. Keep the adapted spec and evidence ignored.
