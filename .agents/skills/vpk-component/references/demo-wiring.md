# Demo Wiring

Detailed procedures for registering demos, consolidating components, and wiring metadata.

## Contents

- [Register demos](#register-demos)
- [Add detail metadata](#add-detail-metadata)
- [ADS equivalents entry](#ads-equivalents-entry)
- [Doc hero display contract](#doc-hero-display-contract)
- [Component consolidation](#component-consolidation)
- [Demo file template](#demo-file-template)

## Register Demos

The primary demo needs no hand registration: add the manifest line in `app/data/component-manifest.ts` and the demo at `components/website/demos/ui/[slug]-demo.tsx`, then run `pnpm run fix:generated`. That writes the entry into the generated region of `components/website/registry/ui/primary.ts` (ui-custom: `registry/ui-custom/primary.ts`; other categories: `registry/<category>.ts`). `pnpm run catalog:add-plan -- ui/[slug]` prints the exact files.

Register example (variant) demos by hand in the matching variants shard, `components/website/registry/ui/variants-*.ts` (ui-custom: `registry/ui-custom/variants-*.ts`). Use the `.then()` wrapper to extract named exports from the shared demo file:

```ts
"[slug]-example-default": dynamic(() => import("../../demos/ui/[slug]-demo").then(mod => ({ default: mod.[Component]ExampleDefault })), { ssr: false }),
"[slug]-example-variant": dynamic(() => import("../../demos/ui/[slug]-demo").then(mod => ({ default: mod.[Component]ExampleVariant })), { ssr: false }),
```

A primary entry that is not `<slug>-demo` with a default export (a named export, a shared demo, another file name) is written by hand below the generated region, with a one-line comment giving the reason.

## Add Detail Metadata

Add an `examples` array and `adsUrl` to the component's detail leaf, `app/data/details/ui/[slug].ts` (ui-custom: `app/data/details/ui-custom/[slug].ts`). The barrel `app/data/details/ui.ts` is generated; never edit it:

```ts
adsUrl: "https://atlassian.design/components/[name]",
examples: [
	{ title: "Default", demoSlug: "[slug]-example-default" },
	{ title: "Variant name", description: "Brief description.", demoSlug: "[slug]-example-variant" },
],
```

Always set `adsUrl` to the correct atlassian.design page for the component. For sub-pages (e.g., icon-button under button), use the full path: `https://atlassian.design/components/button/icon-button`.

## ADS Equivalents Entry

If the component maps to an ADS package, ensure an entry exists in `app/data/ads-equivalents.ts`:

- **Default export** (package = component): use a plain string: `"badge": "@atlaskit/badge"`
- **Named export** from a shared package: use the object form:
  ```ts
  "icon-button": { package: "@atlaskit/button", importPath: "@atlaskit/button/new", namedExport: "IconButton" },
  ```

Use `getAdsDisplayInfo(slug)` from `app/data/ads-equivalents.ts` to get the display text and package name for rendering. The display text is always the **import path** — never the named export. For simple entries it returns the package string (e.g. `@atlaskit/badge`); for named-export entries it returns the `importPath` (e.g. `@atlaskit/button/new`).

## Doc Hero Display Contract

When adding ADS metadata for a component, preserve the existing doc hero display pattern:

- Keep ADS label text concise — always the import path, e.g. `@atlaskit/toggle`, `@atlaskit/button/new`
- Never format the label as `{ Export } from @atlaskit/...` — just use the import path
- Keep the URL in the link target (`href`) via `adsUrl`; do not append the raw URL to visible label text
- Avoid modifying `components/website/component-doc/components/doc-hero.tsx` for single-component mapping tasks unless explicitly requested

### `adsLinks` Convention

When a VPK component maps to multiple ADS packages, use the `adsLinks` array. Each entry must follow this format:

- **`label`**: Always use the `@atlaskit/package-name` format (e.g., `@atlaskit/textfield`, `@atlaskit/textarea`). Never use human-readable names like "Text field" or "Text area".
- **`url`**: Always point to the main component page (e.g., `https://atlassian.design/components/textfield`). Never point to sub-pages like `/examples`.

```ts
// Correct
adsLinks: [
	{ label: "@atlaskit/textfield", url: "https://atlassian.design/components/textfield" },
	{ label: "@atlaskit/textarea", url: "https://atlassian.design/components/textarea" },
],

// Wrong — human-readable labels and /examples sub-pages
adsLinks: [
	{ label: "Text field", url: "https://atlassian.design/components/textfield/examples" },
	{ label: "Text area", url: "https://atlassian.design/components/textarea/examples" },
],
```

## Component Consolidation

When an ADS component is a thin wrapper or re-export that can be covered by an existing VPK component, consolidate rather than maintain a separate file. This applies when:

- The ADS component is a re-export of another VPK component (e.g., `inline-dialog` was a re-export of `popover`)
- The ADS component is a thin wrapper with minimal logic (e.g., `inline-message` was a one-element wrapper around `alert`)
- The existing VPK component already covers the same use case (e.g., `hover-card` covers both `inline-dialog` and `inline-message` use cases)

### Consolidation Checklist

1. Delete the thin wrapper component file (`components/ui/[slug].tsx`)
2. Delete its demo file (`components/website/demos/ui/[slug]-demo.tsx`)
3. Update `app/data/ads-equivalents.ts` — remove old entry, add ADS package to the target component
4. Remove the old manifest line from `app/data/component-manifest.ts` and delete its detail leaf `app/data/details/ui/[slug].ts`; update the target component's leaf (`adsUrl`, description)
5. Remove the old variant registrations from `components/website/registry/ui/variants-*.ts`, then run `pnpm run fix:generated` to rewrite the generated detail barrel and primary registry region
6. Update `lib/json-render/catalog.ts` — remove catalog entry if present
7. Update `lib/json-render/registry.tsx` — remove renderer and import if present
8. Update `backend/lib/genui-system-prompt.js` — replace references in AI system prompt
9. Regenerate `backend/lib/generated-catalog-prompt.json` via `node scripts/generate-catalog-prompt.js`
10. Update `related` arrays in other component detail entries that referenced the removed component

### Known Consolidations

| Removed Component | Target Component | ADS Package |
|---|---|---|
| `inline-dialog` | `hover-card` | `@atlaskit/inline-dialog` |
| `inline-message` | `hover-card` (demos) / `alert` (component) | `@atlaskit/inline-message` |
| `text-field` | `field` | `@atlaskit/textfield` |
| `textarea` (page) | `field` | `@atlaskit/textarea` |
| `input` (page) | `field` | (demos merged into field) |
| `flag` | `sonner` | `@atlaskit/flag` |

## Demo file template

Keep demo files declarative and use the real VPK primitive. Include only states
that teach meaningful API or parity behavior; avoid decorative wrappers that
obscure the component.

```tsx
"use client"

import { Example } from "@/components/ui/example"

export default function ExampleDemo() {
	return (
		<div className="flex flex-wrap items-center gap-3">
			<Example>Default</Example>
			<Example variant="secondary">Secondary</Example>
			<Example disabled>Disabled</Example>
		</div>
	)
}
```

Use grouped sections only when the component has enough independent states to
justify them. Reuse repository icons and assets through the component's public
API. Register every exported demo and verify the hero, navigation entry, and
examples on the live component route.
