# Hard requirements

Use these locks after research and before implementation. They protect the
component owner, state selectors, icon semantics, visual consistency, elevation,
and measured upstream parity.

## Contents

- [Identity and metadata](#identity-and-metadata)
- [State attributes](#state-attributes)
- [VPK icon wrapper](#vpk-icon-wrapper)
- [Selected and expanded states](#selected-and-expanded-states)
- [Overlay elevation](#overlay-elevation)
- [Visual specifications](#visual-specifications)

## Identity and metadata

Confirm which existing VPK component owns the upstream behavior before adding a
new file. Known locks include:

- ADS Toggle (`@atlaskit/toggle`) maps to VPK `Switch`, not VPK `Toggle`.
- VPK `Toggle` is a pressed toolbar-button pattern and must not carry ADS Toggle
  metadata.
- ADS InlineDialog maps to VPK `HoverCard` rather than a new inline-dialog.
- ADS InlineMessage is represented by VPK `Alert` and `HoverCard` demos rather
  than a separate primitive.

For ADS Toggle parity, set `adsUrl` in `app/data/details/ui/switch.ts`, map
`switch` to `@atlaskit/toggle` in `app/data/ads-equivalents.ts`, and ensure the
`toggle` entries contain neither mapping. Verify `/components/ui/switch` shows
the package link and `/components/ui/toggle` does not.

When no direct shadcn equivalent exists, select the closest shadcn/Radix API
shape and apply the canonical naming rules in `common-mappings.md`. Preserve
existing exports and use React 19 `ref` as a regular prop rather than adding
`forwardRef`.

## State attributes

Read the primitive API, installed type declarations, or live DOM before writing
state selectors. Common Base UI sources of truth are:

| Primitive | State attributes |
| --- | --- |
| Toggle | `data-pressed` |
| Switch | `data-checked`, `data-unchecked` |
| Radio | `data-checked`, `data-unchecked`, plus invalid/disabled/required flags |

Do not substitute Radix-style `data-[state=on]` unless the rendered primitive
actually emits it. A wrong selector can leave controlled behavior functional
while silently breaking the visual state.

## VPK icon wrapper

Always render Atlaskit icons through `components/ui/icon.tsx`:

```tsx
import SearchIcon from "@atlaskit/icon/core/search"
import { Icon } from "@/components/ui/icon"

<Icon render={<SearchIcon label="" />} label="Search" className="text-icon" />
```

The wrapper owns `data-slot="icon"`, accessible image semantics, centering, and
color utilities. Atlaskit core icons own their SVG dimensions, so pass `size`
to the icon component itself:

```tsx
<Icon render={<SearchIcon label="" size="small" />} label="Search" />
```

A `size-*` class on the wrapper does not resize the internal SVG.

## Selected and expanded states

Use the same selected visual for every button-like variant, regardless of its
resting appearance:

```text
aria-pressed:bg-bg-selected aria-pressed:text-text-selected aria-pressed:border-border-selected
aria-expanded:bg-bg-selected aria-expanded:text-text-selected aria-expanded:border-border-selected
```

Do not make selection variant-specific, use opacity alone, omit selected text
color, or style only `aria-pressed` when the component also exposes
`aria-expanded`.

## Overlay elevation

Popup content such as dialogs, popovers, dropdowns, selects, tooltips, and hover
cards must use the ADS overlay elevation shadow:

```tsx
import { token } from "@/lib/tokens"

style={{ boxShadow: token("elevation.shadow.overlay") }}
```

Use the raised shadow only for raised surfaces that are not overlays. Avoid
hardcoded shadow values and arbitrary `shadow-*` utilities when the semantic
token exists.

## Visual specifications

Rendered upstream examples are the source of truth for visual parity. Use
`agent-browser` and `getComputedStyle()` to measure dimensions, radius, gap,
padding, typography, borders, colors, shadows, and relevant state changes. For
container components also measure parent display, direction, alignment, and
gap. For compound controls measure inner SVG and child geometry, not only the
outer box.

Do not infer pixels from token names. A token called `radius.small`, for
example, is not proof of the browser-computed radius. Record exact measurements
and map them to existing semantic utilities only after extraction. Follow
`visual-spec-extraction.md` for the complete browser procedure.

## State decision rules

- Add loading only to controls that initiate asynchronous work.
- Use `aria-pressed` for button toggles; use each primitive's native data
  attribute for checkbox, switch, radio, and tabs.
- Filled variants use disabled background and text tokens. Transparent or
  bordered variants use the disabled opacity token. All disabled controls block
  pointer events.
- Add variants only for a real upstream appearance gap and name them in the
  component's established vocabulary.
- Form inputs expose invalid state through the primitive's supported ARIA/data
  attributes and semantic danger tokens.
