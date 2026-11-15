---
name: vpk-component
description: Harvest or enrich VPK components from an explicit ADS, Atlaskit, shadcn, Base UI, or @shadcn/react source with upstream mapping, demos, docs metadata, and parity, or translate custom and third-party AI, voice, and audio UI (ai-elements, ElevenLabs UI) into VPK-owned primitives. Use only when the user invokes vpk-component, names or links one of those sources, requests ADS/shadcn parity, or asks to "migrate to ui-custom", "standardize AI components", "adopt ai-elements", or "port ElevenLabs UI". Do not select it merely because a task touches a component or for ordinary edits, fixes, motion, layout, or maintenance without an upstream source; use vpk-design for Figma.
validation_command: pnpm run lint && pnpm run typecheck
---

# VPK component harvesting

Translate upstream component-library behavior into VPK primitives while preserving
the repository's API, token, documentation, and verification conventions. Treat
the upstream library as evidence for visual and interaction parity, not as a new
runtime dependency.

## Routing

Use the ADS lane for `atlassian.design`, `@atlaskit/*`, and `@atlassian/*`.
Use the shadcn lane for shadcn/ui, Base UI, `@shadcn/react`, and registry
components; also read the global shadcn skill for current CLI and composition
rules. Use the external lane for custom or third-party AI, chat, voice, and
audio libraries: follow [external translation](references/external-translation.md)
instead of the workflow below. Use `vpk-design` when a Figma file, screenshot, or bespoke mockup is the source
of truth.

## Hard invariants

- Preserve existing VPK prop, variant, size, sub-component, and export names.
- Add variants only when parity requires them, using the component's existing
  naming style. Never introduce ADS naming into an established shadcn API.
- Reuse VPK primitives and semantic classes. Do not add upstream packages merely
  to inspect them or render Atlaskit icons without the VPK `Icon` wrapper.
- Keep reusable upstream CSS behavior in `app/tailwind-theme.css` as Tailwind v4
  `@utility` rules rather than scattering demo-local arbitrary CSS.
- Verify the live component route, relevant states, accessibility, lint, and
  types before handoff.

Lock these six requirements before implementation. Read
[hard requirements](references/hard-requirements.md) for explanations and
failure examples.

| Lock | Required decision |
| --- | --- |
| Identity and metadata | Map upstream behavior to the correct VPK owner and docs entry. |
| State attributes | Inspect primitive types or runtime DOM; never guess selectors. |
| Icons | Wrap Atlaskit icons with VPK `Icon`; put `size` on the icon. |
| Selected/expanded | Use one consistent selected visual across variants. |
| Overlay elevation | Use the ADS overlay shadow token on popup content. |
| Visual specs | Extract computed styles from the rendered upstream example. |

## Workflow

### 1. Research the source

Classify the source lane and collect primary evidence before editing. For ADS,
prefer the live examples page, then the `atlas ads` CLI (`atlas ads search <q>
--type component`, `atlas ads component <Name>` for the exact entry, `atlas ads
docs a11y <topic>` for accessibility rules; add `--json` when parsing, and batch
several lookups with `atlas ads batch --command … --command …`), then published
package source inspected in a temporary directory. Fall back to the ADS MCP
(`ads_plan`, `ads_search_components`, `ads_get_a11y_guidelines`) only when the
CLI is unavailable or erroring. For shadcn, read
the global shadcn skill, inspect project-aware docs and registry source/examples,
then render the upstream example when parity matters.

Read:

- [visual spec extraction](references/visual-spec-extraction.md) for computed
  style, typography, inner-layout, and container measurements;
- [common mappings](references/common-mappings.md) for canonical prop naming and
  known ADS-to-VPK owners;
- [full checklist](references/checklist-full.md) for the detailed research,
  implementation, and validation sequence.

### 2. Audit and map

Read the existing component, its demos, detail metadata, ADS-equivalent entry,
and any shared utility it depends on. Record the current API as read-only, then
map each existing VPK variant to the upstream visual states. Identify missing
states, utilities, demos, assets, and accessibility behavior before coding.

For component-specific locks such as ADS Toggle geometry, Sonner/Flag mapping,
tile shape, and size-dependent children, read
[component-specific rules](references/component-specific-rules.md).

### 3. Implement the smallest owner-level change

Apply semantic rest, hover, pressed, selected, disabled, focus, loading, and
invalid-state behavior only where the component supports those states. Preserve
source ownership and consolidate duplicate local implementations in the same
change when introducing a shared primitive.

Use [patterns and anti-patterns](references/patterns-anti-patterns.md) while
implementing. Recheck the compact hard-requirements table above before moving on.

### 4. Wire examples and docs

Add representative state and variant demos through the normal demo registry,
detail metadata, ADS-equivalent metadata, and contract-test path. Reuse existing
assets and icons. Do not create a second docs path for the same component.

Read [demo wiring](references/demo-wiring.md) for registry locations, metadata,
hero-link behavior, consolidation rules, and the demo-file template.

### 5. Validate

Run focused tests for the touched component and metadata first, then:

```bash
pnpm run lint
pnpm run typecheck
```

For UI changes, open the real component route and verify all changed states,
relevant viewports, keyboard/focus behavior, and accessibility. Use
`agent-browser` by default. Fetch the applicable rules with `atlas ads docs a11y
<topic>`, then scan with `ads_analyze_a11y` (component source) or
`ads_analyze_localhost_a11y` (live route) and turn material violations into
fixes with `ads_suggest_a11y_fixes` — those three are ADS MCP only and have no
CLI equivalent. If new variants were added, search all call sites for exhaustive
variant maps before handoff.

## Reference index

- [hard-requirements.md](references/hard-requirements.md): the six parity locks
  and common failure examples.
- [checklist-full.md](references/checklist-full.md): end-to-end detailed checklist.
- [common-mappings.md](references/common-mappings.md): canonical API and known
  component mappings.
- [component-specific-rules.md](references/component-specific-rules.md): special
  geometry and child-layout contracts.
- [demo-wiring.md](references/demo-wiring.md): docs, registry, metadata, and demo
  template guidance.
- [patterns-anti-patterns.md](references/patterns-anti-patterns.md): reusable
  implementation patterns and mistakes.
- [visual-spec-extraction.md](references/visual-spec-extraction.md): browser-based
  computed-style extraction.
- [external-translation.md](references/external-translation.md): the external
  lane for AI, voice, and third-party libraries, with its
  [migration detail](references/ai-migration-detail.md),
  [catalog](references/ai-migration-catalog.md),
  [API reference](references/ai-api-reference.md), and
  [examples](references/ai-migration-examples.md).
