# Adopt a maintained upstream runtime

Use this when the requested result is an imported, maintained third-party runtime behind a small VPK adapter, or when replacing a local fork with that runtime. Examples include Calligraph, torph, and the libraries.dev visual libraries. This is a dependency ownership decision; importing a package just to inspect its source is a different task.

## Select the ownership model

| Requested result | Workflow |
| --- | --- |
| ADS/Atlaskit/shadcn/Base UI parity implemented in VPK | `vpk-component`; upstream remains evidence, not a runtime dependency |
| AI, voice, or other external behavior translated into VPK-owned primitives | `vpk-component-ext`; keep its no-import/no-vendor migration invariant |
| Maintained upstream code owns runtime behavior; VPK owns an adapter and demos | This playbook |
| Local layout, styling, motion, or bug fix | Normal owner-scoped workflow |

Record the selected model and why the existing VPK owner cannot already satisfy the request. Do not relax the translation skills' invariants to make a runtime adoption fit. When upstream cannot express an essential existing capability, document the gap and resolve the behavior decision before deleting the local implementation.

## Inspect the package and existing consumers

1. Identify the canonical VPK owner, every import/caller, local fork, demo, detail entry, style override, asset, test, and generated guard entry. Search `components/ui-custom/`, `components/ui/`, and the referenced screen before introducing an adapter.
2. Inspect official docs, rendered examples, package exports/types, and published source at the selected release. Confirm React/Next.js compatibility, browser/server boundaries, imperative DOM ownership, CSS registration, global renderers, instance limits, disposal, and reduced-motion behavior. A type-compatible API does not prove equivalent rendering.
3. Inventory the complete relevant upstream surface. Give every export, option/default, meaningful state, and published example a disposition: supported through the adapter, demonstrated, already covered, deferred with a reason, or unavailable. Do not silently omit examples because the default demo renders.

Use this compact map before changing dependencies:

| Upstream export / option / example | Existing VPK owner / consumer | Resulting API or demo | Compatibility gap / disposition |
| --- | --- | --- | --- |
| Name and source URL at inspected release | Exact path and public export | Preserved prop/state or canonical demo key | Evidence and explicit decision |

Record the package's source URL, inspected release/commit, license and attribution obligations, package provenance, and the chosen version policy. Follow **Dependency Pinning** in `AGENTS.md`: Float (`^`), Cautious (`~`), or Locked exact according to the existing policy and the package's risk. Document any exact pin's particular reason; do not force exact versions universally or bypass pnpm trust/provenance checks to obtain latest.

## Adopt behind the existing owner

- Add only the required direct dependency and keep the lockfile consistent when dependency changes are authorized. Preserve VPK public exports, callbacks, controlled state, accessible names, theme behavior, and consumer data flow. Match tabs and `@/` imports.
- Prefer a re-export or thin adapter. Keep VPK demo controls/data separate from upstream rendering. Inspect composition and subtree ownership before adding React children or CSS overrides; an imperative runtime may own that subtree.
- Keep each compatibility wrapper bounded to an inspected upstream defect. Record the affected release, reproduction, responsibility, and a concrete condition for retiring it when upstream fixes the defect. Migrate compatible consumers in the same change; do not retain parallel implementations of the same behavior.
- Put integration notes beside the owner in `VENDOR.md` when package limitations, wrappers, pins, or retained attribution need a durable explanation. Use `components/visual/border-beam/VENDOR.md` and `components/visual/liquid-metal/VENDOR.md` as examples. State **imported** or **vendored** accurately; existing license/provenance files may still have a unique attribution or historical responsibility.
- Wire demos through the owning category's existing registry and detail metadata. Use real VPK components in examples; verify every mapped example is reachable from the canonical component route. Preserve the upstream control surface where requested and disclose unsupported capabilities.

## Prove behavior and rendered pixels

Use `next-dev-loop` after Next.js code edits and [Browser Verify Worktree](browser-verify-worktree.md) for the exact worktree origin. Navigate directly to the requested component, block, or project route before inspecting or interacting; use the homepage for catalog tasks. Verify the canonical docs route and representative feature consumers in light/dark themes and relevant viewports. Exercise controlled updates, reset, repeated mount/unmount, multiple simultaneous instances, pointer/keyboard interaction, and reduced motion as applicable.

Capture rendered output for the capabilities at risk: colors/materials, alpha, shape, geometry, clipping, shadows, theme contrast, and instance differences. For canvas/WebGL, inspect actual rendered pixels or representative pixel samples where DOM/CSS cannot establish the result. A nonempty canvas, green typecheck, or passing unit test does not establish visual parity. Record reproduction conditions and any intentional differences.

Check accessible names, focus visibility/order, decorative surfaces and hit targets, and motion-off behavior. Fetch relevant ADS accessibility guidance with `atlas ads docs a11y <topic>` and use the configured accessibility analysis capability for the rendered route; report unavailable analysis rather than claiming it passed. Store disposable screenshots/recordings under `output/agent-browser/`.

Run relevant behavioral tests, `pnpm run lint`, `pnpm run typecheck`, and affected catalog/source/file-size guards. Classify new `components/**` node:test suites in `scripts/js-unit-test-manifest.mjs` and verify their discovery with unfiltered `node scripts/run-js-unit-tests.mjs`. Use the actual `pnpm run ci:pr` gate before delivery; a subset does not establish that deleted files have no generated references.

## Retire only replaced responsibilities

Remove a local fork, wrapper, style, demo, or asset only when a verified replacement exists, every active consumer/reference has migrated, and no unique behavior, attribution, license, provenance, or historical responsibility remains. Inspect tracked and untracked state; preserve unrelated edits. Retain historical evidence when it still explains the integration, and defer uncertain cleanup.

Update only the specific obsolete catalog/guard/allowlist entries caused by the migration. Inspect generated diffs; do not use blanket ratchet `--update` commands that absorb unrelated line-count or source drift. Confirm residual searches are clean and re-run affected guards. Never remove `artifacts/**` through this workflow; it requires an explicit request naming the exact path.

Finish with the selected ownership model, inspected upstream version, compatibility decisions, reachable demos, rendered/accessibility proof, remaining limitations, wrapper retirement conditions, and exact cleanup performed.
