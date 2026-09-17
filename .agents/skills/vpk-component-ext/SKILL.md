---
name: vpk-component-ext
description: Translate custom or third-party AI, voice, and adjacent libraries into VPK-owned primitives. Use when asked to "migrate to ui-custom", "standardize AI components", "adopt ai-elements", "port ElevenLabs UI", or "use ui-audio".
validation_command: pnpm run lint && pnpm run typecheck
---

# VPK external component translation

Replace custom or third-party UI with VPK-standardized primitives while
preserving behavior, controlled state, accessibility, and repository docs. The
source library supplies behavior and composition evidence; VPK owns the final
API and visual language.

## When to use

Use this skill for local custom AI/chat UI, ai-elements, ElevenLabs UI, voice
and audio libraries, or another third-party component that should become a VPK
primitive or migrate to one. Use `vpk-component` instead when an explicit ADS,
Atlaskit, shadcn, Base UI, or `@shadcn/react` component is the parity target.
Use the normal component workflow for local layout, styling, motion, or bug
fixes that do not translate an external implementation.

When the requested result retains a maintained upstream package as the runtime
owner, use [Adopt a maintained upstream runtime](../../docs/playbooks/adopt-upstream-runtime.md).
This translation skill's no-import/no-vendor invariant still applies to VPK-owned migrations.

## Hard invariants

- Reuse an existing VPK primitive before creating a wrapper or new component.
- Choose the target family by behavior: generic UI in `components/ui`, AI/chat
  in `components/ui-custom`, and voice/audio in `components/ui-audio`.
- Do not import or vendor upstream packages as the migration result. Inspect
  upstream generators in a scratch area when source evidence is needed.
- Preserve callbacks, controlled state, data flow, and user-visible behavior;
  keep adapters thin when APIs do not match exactly.
- Use VPK semantic tokens, primitives, icons, demo wiring, and accessibility
  conventions rather than copying upstream styling.
- Do not delete legacy wrappers until every consumer has migrated and the
  residual-import search is clean.

## Workflow

### 1. Discover and classify

Read the target code or official source, trace its providers and state flow,
then choose the owning VPK family. Inspect local candidates before upstream
docs. For generic reusable UI, run ADS planning and topic-specific accessibility
guidance before implementation.

Read [migration detail](references/migration-detail.md) for the family resolver,
duplicate-name decisions, detection checklist, source hierarchy, and gotchas.
Use [migration catalog](references/migration-catalog.md) to locate likely
`ui-custom` targets and [API reference](references/api-reference.md) to confirm
their composition and props.

### 2. Map the migration

Write a compact map from each source component to its VPK component, family,
match quality (`exact`, `approximate`, or `gap`), props/events, and retained
local behavior. When no direct primitive exists, compose existing VPK pieces or
keep the smallest possible adapter.

For common message, conversation, suggestion, action, and code-display
translations, read [migration examples](references/migration-examples.md).

### 3. Migrate the owner and consumers

Replace imports with explicit `@/components/ui*` paths and keep source behavior
intact. Rich assistant content generally uses `ui-custom/MessageResponse`;
plain transcript and voice labels should remain plain content or use the audio
family response primitive. Alias duplicate component names at import sites.

Label icon-only controls, leave decorative icon labels empty, use each VPK
primitive's supported render/composition API, and preserve submit/select
semantics. Update all consumers before removing replaced code.

### 4. Wire canonical demos and docs

Put the source-of-truth demo in the matching `components/website/demos/ui*`
folder, register it in `components/website/registry.ts`, and add the matching
detail metadata. Keep named exports, registry keys, and `demoSlug` values
aligned. Feature surfaces should reuse this canonical pattern.

### 5. Validate

Run focused tests, then:

```bash
pnpm run lint
pnpm run typecheck
```

If the global baseline is noisy, also lint the changed files and report both
results. Verify the live docs/feature route in light and dark themes, exercise
at least one stateful interaction, inspect console/hydration output, and run the
relevant ADS accessibility analysis. Finish with a residual import search for
the removed source component or package.

All project directories, including `components/ui-custom/**`, are type-checked;
the repository TypeScript configuration excludes only `node_modules`.

## References

- [migration-detail.md](references/migration-detail.md): family resolution,
  detection, source selection, migration constraints, and gotchas.
- [migration-catalog.md](references/migration-catalog.md): available AI/chat
  migration targets.
- [api-reference.md](references/api-reference.md): quick API guide for core
  `ui-custom` primitives.
- [migration-examples.md](references/migration-examples.md): worked replacement
  patterns.
