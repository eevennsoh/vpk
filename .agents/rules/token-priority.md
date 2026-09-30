---
description: Token selection priority, theming, and common styling mistakes
---

# Token Selection Priority

When styling VPK components, follow this hierarchy:

## Priority Order

1. **shadcn-theme semantic classes** — `bg-surface-raised`, `text-text-subtle`, `border-border-bold`, `bg-bg-neutral`, etc.
2. **tailwind-theme accent colors** — Decorative hue-based colors only: `bg-blue-400`, `text-purple-500`, `bg-red-50`
3. **Raw `var(--ds-…)` / `token()`** — Only for dynamic values or tokens without any Tailwind mapping

## Tailwind v4 Naming Convention

CSS variables in `shadcn-theme.css` use `--color-*` which Tailwind v4 maps as:

- `--color-text-subtle` → `text-text-subtle` (text utility + token name)
- `--color-icon-danger` → `text-icon-danger` (icons use text utility for color)
- `--color-bg-danger` → `bg-bg-danger` (bg utility + token name)
- `--color-surface-raised` → `bg-surface-raised`
- `--color-border-bold` → `border-border-bold`

The double-prefix (e.g., `bg-bg-*`, `text-text-*`) is correct Tailwind v4 behavior.

## Authoring Custom CSS Classes

Tailwind v4 replaced `@layer components` with the `@utility` API for utility-shaped classes. Pick the directive based on what the rule targets:

| Rule shape | Directive | Why |
|---|---|---|
| Class applied directly to elements (`.scrollbar-auto-hide`) | `@utility name { … }` in `app/globals.css` (or `app/tailwind-theme.css`) | Auto-routes to the utilities layer with property-count-aware sorting. Composes with Tailwind variants (`hover:`, `focus:`, `dark:`, `md:`). |
| Raw selectors with no class name (`[data-streamdown="mermaid-block"] > div`, `[data-sonner-toast]:focus-visible`) | `@layer components { … }` in `app/globals.css` | `@utility` requires a name. These rules target framework-emitted DOM that we can't add classes to. |
| Global escape hatches with `!important` (`html[data-embedded] [data-shell-chrome]`, `@media (prefers-reduced-motion)`) | Unlayered (no wrapper) | `!important` reverses cascade — unlayered `!important` beats every layered `!important`. Right behavior for accessibility hammers and pre-hydration anti-flash rules. |

**Layer cascade order is locked in `globals.css`:** the `@layer theme, base, components, utilities;` statement at the top pre-declares positions before any import. Subsequent `@layer components { … }` blocks anywhere in the bundle just append to that layer in the locked position. Don't move that statement; if you remove all `@layer components` content, you can delete it, but right now `globals.css` has streamdown + sonner rules that need it.

## Special-Purpose Radius Tokens

In addition to the standard `rounded-xs` through `rounded-4xl` size scale, VPK maps these special ADS radius tokens:

- `rounded-tile` → `var(--ds-radius-tile)` = `25%` — Proportional rounded-square for Tile and IconTile components. Scales with element size (unlike fixed-px values). Use on any element that needs the ADS tile shape.

## Font Heading Tokens

ADS font heading tokens (`font.heading.xxsmall` through `font.heading.xxlarge`) are composite CSS `font` shorthand values (size + weight + line-height). There is no Tailwind utility class for the `font` shorthand property.

**Pattern:** Use `style` for the font shorthand, `className` for color:

```tsx
<h2 style={{ font: token("font.heading.xxlarge") }} className="text-text">
  Title
</h2>
```

| Token | Usage |
|---|---|
| `font.heading.xxsmall` | Section labels, small headings |
| `font.heading.xsmall` | Subsection headings |
| `font.heading.small` | Card titles |
| `font.heading.medium` | Page section headings |
| `font.heading.large` | Page titles |
| `font.heading.xlarge` | Hero subtitles |
| `font.heading.xxlarge` | Hero titles, greeting headings |

**Common mistake:**

| Wrong | Correct |
|---|---|
| `className="text-3xl font-semibold"` | `style={{ font: token("font.heading.large") }}` |
| Importing `<Heading>` from retired `components/blocks/shared-ui` | Move the callsite to `components/ui/heading` or inline the ADS font token |

## Motion and Transition Tokens

ADS motion tokens are defined as CSS custom properties in `app/tailwind-theme.css`. Use these instead of hardcoded values.

**Duration tokens:**

| Token | Value | Usage |
|---|---|---|
| `--duration-instant` | 0ms | Immediate state changes |
| `--duration-xxshort` | 50ms | Active press feedback |
| `--duration-fast` | 100ms | Hover elevation, tooltip show |
| `--duration-normal` | 150ms | Hover scale, small state changes |
| `--duration-medium` | 200ms | Sidebar, modals, panel transitions |
| `--duration-slow` | 250ms | Complex state changes |
| `--duration-slower` | 400ms | Page-level transitions |
| `--duration-slowest` | 600ms | Scroll-triggered reveals |

**Easing tokens:**

| Token | Value | Usage |
|---|---|---|
| `--ease-linear` | `cubic-bezier(0, 0, 1, 1)` | Progress bars, continuous motion |
| `--ease-in` | `cubic-bezier(0.6, 0, 0.8, 0.6)` | Elements leaving view |
| `--ease-out` | `cubic-bezier(0, 0.4, 0, 1)` | Elements entering view, hover feedback |
| `--ease-out-practical` | `cubic-bezier(0.4, 1, 0.6, 1)` | Compact fade/slide entrances |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0, 1)` | Sidebar, modals, position swaps |
| `--ease-spring` | `linear(...)` | Small tactile branded motion only |

**Pattern:** `app/tailwind-theme.css` defines both the ADS-backed CSS variables and the semantic Tailwind utility aliases. Always prefer the semantic class over arbitrary values; use raw `var()` only inside CSS declarations or inline styles that need a specific transition property list:

```tsx
// Tailwind class (preferred)
className="duration-normal ease-out"
className="duration-medium ease-in-out"

// Inline style (only when no Tailwind utility exists, e.g. specific property transitions)
style={{ transition: "left var(--duration-medium) var(--ease-in-out)" }}
```

Checks enforce the mechanical cases: `scripts/design-token-usage.test.js` rejects `duration-[var(…)]` / `ease-[var(…)]`, and lint rejects numeric `duration-NNN`, hand-written `cubic-bezier()`, and inline Motion curve arrays (use `@/lib/motion`). Still on you: hardcoded `200ms`/`0.2s` in CSS → `var(--duration-medium)`, and elements that move together share one duration + easing.

## Common Mistakes

| Wrong | Correct |
|---|---|
| `bg-[var(--ds-background-neutral)]` | `bg-bg-neutral` |
| `text-[var(--ds-text-danger)]` | `text-text-danger` |
| `bg-[var(--ds-surface-raised)]` | `bg-surface-raised` |
| `border-[var(--ds-border-bold)]` | `border-border-bold` |
| `bg-white` / `bg-black` | `bg-surface` / `bg-bg-neutral-bold` |
| `rounded-lg` on tiles | `rounded-tile` (uses `--ds-radius-tile: 25%`) |
| `rounded-[25%]` | `rounded-tile` (semantic token class) |

## When tailwind-theme Is Still Needed

Use tailwind-theme accent colors for decorative purposes where no semantic meaning applies:

- `bg-blue-400`, `bg-purple-200` — Decorative accent backgrounds
- `text-blue-600`, `text-teal-500` — Decorative accent text

## Brand and Interactive Surface Tokens

These shadcn-theme aliases (defined in `app/shadcn-theme.css`) are used for brand-colored interactive surfaces:

- `bg-primary` → `var(--ds-background-brand-bold)` — Use for brand-colored interactive surfaces (buttons, user chat bubbles)
- `text-primary-foreground` → `var(--ds-text-inverse)` — Use for text on brand-bold backgrounds

## When shadcn Aliases Are Appropriate

Inside shadcn/ui primitive components (`components/ui/*`), use shadcn naming (`bg-card`, `text-foreground`). In custom VPK components, prefer ADS semantic names (`bg-surface-raised`, `text-text`).

## Theming

- Theme provider: `components/utils/theme-wrapper.tsx`
- Persistence key: `ui-theme`
- Applies `light`/`dark` class to `<html>`

Exports:

- `useTheme()`
- `ThemeToggle`
- `ThemeSelector`

## Full Token Reference

See `.agents/skills/vpk-design/references/tokens.md` for the complete mapping of all 200+ semantic tokens.
