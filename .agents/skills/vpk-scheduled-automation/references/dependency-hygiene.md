# Dependency Hygiene Lanes

Read this reference only for the Dependency hygiene automation, after the main
`vpk-scheduled-automation` policy. Choose exactly one lane per run. Never combine
package/install changes with a logo-asset harvest in one branch or PR.

## Choose one lane

- **Lane A — package/install hygiene:** direct dependencies, catalog families,
  overrides, advisories, and evidence-backed removals. This lane uses the repo
  `.npmrc`, pnpm lockfile, trust policy, and minimum-release-age rules.
- **Lane B — third-party SVG fallback harvest:** visual-asset freshness via
  `npm pack` outside the repo. Use it only when a current local-fallback brand
  under `public/3p/<brand>/` needs package-sourced artwork and a normal package
  update is blocked or not the goal. `@atlaskit/logo` has no current
  `public/1p` destination contract; do not invent one during a sweep.

Select the lane from current evidence, not a previous run's registry result. If
both lanes have plausible work, choose the higher-confidence single candidate
and leave the other for a later run. If lane ownership is unclear, stop.

## Lane A — package/install hygiene

### Discover and rank

Inspect `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and `.npmrc`, then
run:

```bash
corepack pnpm run deps:check
corepack pnpm outdated --long
corepack pnpm audit --json
```

Rank candidates in this order:

1. Narrow security-advisory or correctness fixes.
2. Patch/minor in-range Float (`^`) or Cautious (`~`) updates.
3. Proven-unused dependencies, obsolete overrides, or superseded packages.
4. Small deliberate latest-stable direct bumps.
5. One coordinated catalog-family bump.
6. Locked exact bumps with clear release, peer, and migration evidence.

Confirm the target is stable rather than prerelease/canary/experimental. Review
official notes, peer ranges, advisories, and migrations. Prove the exact target
resolves through the repo registry with a dry scratch install/add; an outdated
row alone is not reachability evidence. Registry 404, `NO_MATCHING_VERSION`,
private-auth uncertainty, or unexplained tarball-source changes are stop signals.
The tracked registry is npmjs for public packages and `@atlaskit/*`; only the
internal `@atlassian/*` scope uses `atlassian-npm`. Do not route public package
tarballs through `npm-remote`.

### Apply one narrow change

- Float/Cautious: prefer a targeted `corepack pnpm update <pkg>` or narrow
  manifest edit plus `corepack pnpm install` when a full update would re-resolve
  unrelated packages.
- Workspace-root adds require `corepack pnpm add -w`.
- Locked framework/core dependencies require a deliberate manifest edit and
  `corepack pnpm install`.
- Coordinated `tiptap`, `json-render`, and `remotion` families move only through
  the `catalog:` version in `pnpm-workspace.yaml`; never replace individual
  `"catalog:"` references.
- Overrides require a documented security, compatibility, or dedupe reason.
- Removal requires zero tracked imports, runtime/config/script references, and
  generated/vendored consumers. Re-resolve the lockfile and prove behavior.
- Revert unrelated lockfile churn unless it is mechanically required and fully
  explained.

`trustPolicy: no-downgrade` is a safety boundary. Never bypass it with
`--config.trustPolicy=none`. A benign false positive may justify a separate,
version-pinned `trustPolicyExclude` infrastructure candidate only when evidence
is strong enough for human review; otherwise stop.

### Lane A validation and handoff

After the scoped install/update/removal, run:

```bash
corepack pnpm run verify:lockfile
```

It must report `Verified pnpm-lock.yaml`. Public package tarballs must use
`registry.npmjs.org`; preserve the verifier's narrowly allowed
`@atlassian/logo-third-party` internal tarball source. Never hand-edit an
unexplained lockfile URL: rerun the scoped install against the correct registry
and review the resulting lockfile. Then run the focused package or
touched-surface check followed by the main skill's validation contract.

Use `[Automation] Dependency hygiene: <summary>` and request the existing
`automation`, `codex`, and `dependencies` labels. Add before/after versions or
removed packages, selection evidence, release/advisory notes, peer and migration
risk, lockfile verification, and any trust-policy decision to the normal PR
evidence. Dependency PRs are serialized because they usually touch
`pnpm-lock.yaml`; any overlapping dependency PR is a no-PR stop condition.

## Lane B — third-party SVG fallback harvest

Use this lane only for visual-asset freshness without an install-graph change.
It should not modify package manifests or `pnpm-lock.yaml`.

The repository has no committed logo-harvest command. Do not infer or invoke
one. The live local-fallback contract is nested
`public/3p/<brand>/{16,20,24,32,16-borderless}.svg` plus
`components/ui/data/logo-third-party-data.ts`; most brands render directly from
`@atlassian/logo-third-party` and need no vendored copy. Use the manual path only
for a proven local-fallback brand:

1. Create a temporary directory outside the repo and run `npm pack` there so
   user-level `atlassian-npm` authentication applies instead of repo `.npmrc`:

   ```bash
	 npm pack @atlassian/logo-third-party@latest
   ```

2. Extract the required SVG variants from the package artifact. Preserve CSS
   custom-property defaults so assets render standalone and remain themeable.
3. Normalize the brand id and update only its existing nested
   `public/3p/<brand>/` size files. Add `16-borderless.svg` only when the package
   exposes a borderless mark and the VPK tile contract needs it.
4. Update `THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES` and the existing logo demo only
   when the local-fallback set changes.
5. Run `components/ui/logo-third-party.source.test.js` and produce a precise
   added/changed/removed file diff. Stop rather than creating `public/1p` or a
   flat `public/3p/<brand>.svg` convention.

Run focused asset/demo checks, then the main skill's validation contract. Use
`$agent-browser` only when rendered demo proof is
needed; spot-check representative logos, including light/dark theming where it
matters. Confirm the final diff contains no manifest or lockfile changes.

Use `[Automation] Logo asset refresh: <n brands updated>` and request the
existing `automation`, `codex`, and `dependencies` labels. Add source package
versions, the brand diff, focused validation, and representative screenshots to
the normal PR evidence.

## Lane-specific stop rules

Stop without a PR for unsafe/overlapping state, mixed lanes, more than one
dependency family, unclear migration or removal evidence, unstable or
unreachable versions, unresolved supply-chain policy, unexplained lockfile
churn, asset extraction that cannot be verified, or any validation failure not
proven unrelated under the main skill.
