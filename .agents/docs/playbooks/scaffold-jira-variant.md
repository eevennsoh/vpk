# Scaffold a Jira Golden Journey Variant

Use the generator when a new Jira Golden Journey version must begin as an
independent copy of an existing version. Do not use it for ordinary edits to an
existing v0-v3 route.

## Plan first

Run from a clean, current worktree:

```bash
corepack pnpm run scaffold:jira-variant -- --source v3 --target v4 --json
```

Dry run is the default. Review the proposed copied paths, rewrites,
registrations, generated files, validation commands, and `planFingerprint`.
The copied paths include the version-owned experimental Jira Work Item tree
and its unit tests, which run by file name. Registrations also cover the Work Item chooser
API/map, chooser page, demo exports, block registries, detail metadata, preview
allowlist, and their source-contract tests; these are part of the reviewed plan,
not manual follow-up. Stop if the target
exists, a rewrite is ambiguous, source content changed during planning, or any
source-version identifier (including a bare `v3`) would remain unresolved.

The default manifest is
`scripts/fixtures/jira-variant-manifest.json`. Change the manifest only when the
repository's route, catalog, detail, unit-test, lazy-load, or public-asset
contract changes; do not add one-off target exceptions to the generator.

## Apply the approved plan

After the dry run is reviewed:

```bash
corepack pnpm run scaffold:jira-variant -- \
	--source v3 \
	--target v4 \
	--apply \
	--plan-fingerprint <fingerprint-from-reviewed-dry-run>
```

`--apply` refuses to run without the exact fingerprint of the current plan, so
any source, registration, rewrite, or command drift requires a new review.
Apply stages copies and registration edits, regenerates declared generated
files, and runs the manifest's catalog, lazy-load, typecheck, and unit-test
validation commands. A source-drift or
validation failure rolls back paths, registrations, and generated-file changes
owned by the run. Pre-existing target paths are never overwritten.

## Review the result

- Confirm the new route and project labels use the target version.
- Search the copied paths for unintended source slug/Pascal/camel/upper names.
- Verify instance IDs and ARIA relationships are unique when two variants can
  render together.
- Inspect catalog, detail metadata, lazy-load rules,
  and generated repo-map changes.
- Run `corepack pnpm run ci:pr` and follow `vpk-verify` on the target route.

Creating a future v4 is a separate product decision. Generator tests use
temporary workspaces and must not create a tracked variant.
