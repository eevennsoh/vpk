# vpk-html design system

Owner of the visual system of every template other than the story kit for [SKILL.md](../SKILL.md). Load when you style any template other than a story explainer.

Contents: [Three embedded Geist faces, mono in figures](#three-embedded-geist-faces-mono-in-figures) · [Tokens](#tokens) · [Dark theme resolves the same tokens](#dark-theme-resolves-the-same-tokens) · [Hierarchy comes from position, not weight or colour](#hierarchy-comes-from-position-not-weight-or-colour)

The visual system is the Algebrica editorial identity: white paper, dark ink typography, quiet rules, and figures that look like media-library line art rather than product UI chrome. It is built for technical briefs, strategy decks, reports, and code explanations that need to feel printed and precise.

## Three embedded Geist faces, mono in figures

Generated HTML embeds local OFL font files as data URIs:

| Role | Family | Note |
|---|---|---|
| Display and body | `Geist` | Never inside figures |
| Mono | `Geist Mono` | Every SVG `<text>` |
| Numeric | `Geist Mono Numeric` | Sourced from Geist Mono with `unicode-range: U+0030-0039` |

## Tokens

Every colour comes from the VPK app’s design tokens (ADS, `@atlaskit/tokens`), on a pure white page in light. `scripts/ads-tokens.mjs` holds the role-to-ADS map below, resolves each token from the `atlassian-light` and `atlassian-dark` themes (the pair VPK’s `theme-wrapper` passes to `setGlobalTheme`) and writes plain hex into `references/tokens.json`. `build.mjs --write-styles` mirrors that into root `styles.css`, and the renderer embeds the resolved block in every HTML document, so documents stay offline single files and never link `@atlaskit/tokens`. ADS tokens that carry alpha (`color.border`, `color.background.neutral`) are flattened over `elevation.surface`. Templates do not own independent palettes.

```sh
node scripts/ads-tokens.mjs            # regenerate references/tokens.json from @atlaskit/tokens
node scripts/build.mjs --write-styles  # mirror it into styles.css, then build.mjs --refresh-library
node scripts/ads-tokens.mjs --check    # fail when tokens.json or iso/accent.mjs drifts from ADS
```

The figure tones are one stepped neutral scale (`gray.subtlest` rest, hovered, pressed). Iso tops are `elevation.surface.raised`, so tops stay the lightest face in both themes and the tone order holds: light tops `#ffffff` > near side `#f0f1f2` > far side `#dddee1`; dark tops take tone 2 `#3d3f43` > `#303134` > `#18191a`. Chrome stays grayscale (`--accent` is `color.background.neutral.bold`; links are ink, underlined on hover/focus). The one saturated hue in figures is the iso accent pair, ADS orange (`scripts/iso/accent.mjs`, also read by the 3D prototype).

### ADS token map

| Role | ADS token | Light | Dark |
|---|---|---|---|
| `--paper` | `elevation.surface` | `#ffffff` | `#1f1f21` |
| `--paper-background` | `elevation.surface` | `#ffffff` | `#1f1f21` |
| `--surface-raised` | `elevation.surface.raised` | `#ffffff` | `#242528` |
| `--surface-overlay` | `elevation.surface.overlay` | `#ffffff` | `#2b2c2f` |
| `--surface-sunken` | `elevation.surface.sunken` | `#f8f8f8` | `#18191a` |
| `--headline` | `color.text` | `#292a2e` | `#cecfd2` |
| `--body-text` | `color.text` | `#292a2e` | `#cecfd2` |
| `--ink` | `color.text` | `#292a2e` | `#cecfd2` |
| `--muted-text` | `color.text.subtle` | `#505258` | `#a9abaf` |
| `--subtlest-text` | `color.text.subtlest` | `#6b6e76` | `#96999e` |
| `--inverse-text` | `color.text.inverse` | `#ffffff` | `#1f1f21` |
| `--accent` | `color.background.neutral.bold` | `#292a2e` | `#cecfd2` |
| `--accent-soft` | `color.background.accent.gray.subtlest` | `#f0f1f2` | `#303134` |
| `--accent-soft-strong` | `color.background.accent.gray.subtler` | `#dddee1` | `#4b4d51` |
| `--focal` | `color.text.accent.gray.bolder` | `#1e1f21` | `#e2e3e4` |
| `--ill-line` | `color.icon` | `#292a2e` | `#cecfd2` |
| `--ill-tone1` | `color.background.accent.gray.subtlest` | `#f0f1f2` | `#303134` |
| `--ill-tone2` | `color.background.accent.gray.subtlest.hovered` | `#dddee1` | `#3d3f43` |
| `--ill-tone3` | `color.background.accent.gray.subtlest.pressed` | `#b7b9be` | `#4b4d51` |
| `--ill-hatch` | `color.background.accent.gray.subtler.hovered` | `#b7b9be` | `#63666b` |
| `--ill-ink50` | `color.icon.subtle` | `#505258` | `#a9abaf` |
| `--ill-guide` | `color.background.accent.gray.subtler.hovered` | `#b7b9be` | `#63666b` |
| `--ill-guide-dashed` | `color.background.accent.gray.subtler` | `#dddee1` | `#4b4d51` |
| `--ill-frame` | `color.border.accent.gray.subtle` | `#b7b9be` | `#4b4d51` |
| `--ill-fill` | `color.background.accent.gray.subtlest.hovered` | `#dddee1` | `#3d3f43` |
| `--ill-fill-alt` | `color.background.accent.gray.subtlest` | `#f0f1f2` | `#303134` |
| `--rule` | `color.border` | `#dddedd` | `#37373a` |
| `--rule-strong` | `color.border.accent.gray.subtle` | `#b7b9be` | `#4b4d51` |
| `--table-header` | `color.background.neutral` | `#f0f1f2` | `#2b2b2e` |
| `--chip-border` | `color.border` | `#dddedd` | `#37373a` |
| `--chip-text` | `color.text.subtlest` | `#6b6e76` | `#96999e` |
| `--chip-selected` | `color.text.subtle` | `#505258` | `#a9abaf` |
| `--pill-border` | `color.border` | `#dddedd` | `#37373a` |
| `--pill-fill` | `color.background.neutral.bold` | `#292a2e` | `#cecfd2` |
| `--pill-fill-hover` | `color.background.neutral.bold.hovered` | `#3b3d42` | `#bfc1c4` |
| `--search-border` | `color.border.input` | `#8c8f97` | `#7e8188` |
| `--search-focus` | `color.border.focused` | `#4688ec` | `#8fb8f6` |
| `--meta-text` | `color.text.subtlest` | `#6b6e76` | `#96999e` |
| `--review-meta` | `color.text.subtlest` | `#6b6e76` | `#96999e` |
| `--heat0` | `color.background.accent.gray.subtlest` | `#f0f1f2` | `#303134` |
| `--heat1` | `color.background.accent.gray.subtler` | `#dddee1` | `#4b4d51` |
| `--heat2` | `color.background.accent.gray.subtle` | `#8c8f97` | `#63666b` |
| `--heat3` | `color.background.accent.gray.bolder` | `#6b6e76` | `#96999e` |
| `--heat4` | `color.text.subtle` | `#505258` | `#a9abaf` |
| `--link` | `color.text` | `#292a2e` | `#cecfd2` |
| `--link-pressed` | `color.text` | `#292a2e` | `#cecfd2` |
| `--selected` | `color.background.selected` | `#e9f2fe` | `#1c2b42` |
| `--accent-lime` | `color.background.accent.lime.subtler` | `#d3f1a7` | `#37471f` |
| `--accent-purple` | `color.background.accent.purple.subtler` | `#eed7fc` | `#48245d` |
| `--accent-saffron` | `color.background.accent.yellow.subtler` | `#f5e989` | `#533f04` |
| `--accent-orange` | `color.background.accent.orange.subtler` | `#fce4a6` | `#693200` |
| `--accent-navy` | `color.text.accent.blue.bolder` | `#123263` | `#cfe1fd` |
| `--accent-green` | `color.background.accent.green.subtler` | `#baf3db` | `#164b35` |
| `--accent-red` | `color.text.accent.red` | `#ae2e24` | `#fd9891` |
| `--collection-software` | `color.background.accent.blue.subtler` | `#cfe1fd` | `#123263` |
| `--collection-product` | `color.background.accent.teal.subtler` | `#c6edfb` | `#164555` |
| `--collection-service` | `color.background.accent.magenta.subtler` | `#fdd0ec` | `#50253f` |
| `--focus-ring` | `color.border.focused` | `#4688ec` | `#8fb8f6` |
| `--code-surface` | `color.background.neutral` | `#f0f1f2` | `#2b2b2e` |
| `--code-ink` | `color.text` | `#292a2e` | `#cecfd2` |
| `--code-inverse` | `color.text.inverse` | `#ffffff` | `#1f1f21` |
| `--syntax-keyword` | `color.text.code.keywords` | `#ae2e24` | `#fd9891` |
| `--syntax-identifier` | `color.text` | `#292a2e` | `#cecfd2` |
| `--syntax-string` | `color.text.code.strings` | `#4c6b1f` | `#b3df72` |
| `--syntax-comment` | `color.text.code.comments` | `#505258` | `#a9abaf` |
| `--syntax-literal` | `color.text.code.numbers` | `#7f5f01` | `#eed12b` |
| `--math-highlight` | `color.background.accent.yellow.subtlest` | `#fef7c8` | `#332e1b` |
| `--success` | `color.text.success` | `#4c6b1f` | `#b3df72` |
| `--success-tint` | `color.background.success` | `#efffd6` | `#28311b` |
| `--warning` | `color.text.warning` | `#9e4c00` | `#fbc828` |
| `--warning-tint` | `color.background.warning` | `#fff5db` | `#3a2c1f` |
| `--danger` | `color.text.danger` | `#ae2e24` | `#fd9891` |
| `--danger-tint` | `color.background.danger` | `#ffeceb` | `#42221f` |
| `--info` | `color.text.information` | `#1558bc` | `#8fb8f6` |
| `--info-tint` | `color.background.information` | `#e9f2fe` | `#1c2b42` |
| `--diff-add-text` | `color.text.accent.green` | `#216e4e` | `#7ee2b8` |
| `--diff-del-text` | `color.text.accent.red` | `#ae2e24` | `#fd9891` |
| `--diff-add-tint` | `color.background.accent.green.subtlest` | `#dcfff1` | `#1c3329` |
| `--diff-del-tint` | `color.background.accent.red.subtlest` | `#ffeceb` | `#42221f` |
| `--ill-accent` (iso block) | `color.background.accent.orange.bolder` | `#bd5b00` | `#fca700` |
| `--ill-accent-ink` (iso block) | `color.text.inverse` | `#ffffff` | `#1f1f21` |

Contrast (WCAG 2, checked by `tokens.test.js` and `iso/palette.test.mjs`): body text on paper 14.34:1 light, 10.56:1 dark; muted text 7.81:1 / 7.15:1; subtlest text 5.10:1 / 5.76:1; SVG labels (`--ill-line`) 14.34:1 / 10.56:1; accent ink on the accent 4.51:1 light (white on `#bd5b00`), 8.36:1 dark (`#1f1f21` on `#fca700`).

## Dark theme resolves the same tokens

Every rendered document includes `color-scheme: light dark` and a full `[data-theme="dark"]` token block with the ADS `atlassian-dark` values (surface `#1f1f21`, a neutral gray). Figure colors must route through tokens so SVGs invert correctly under `data-theme="dark"`.

| Wrong | → Right |
|---|---|
| `<path stroke="#172b4d">` | → `<path stroke="var(--ill-line)">`, which flips under `data-theme="dark"` |
| A second dark palette in the template | → none: the token block already carries `atlassian-dark` |

## Hierarchy comes from position, not weight or colour

| Rule | Value |
|---|---|
| Display heading weight | Geist 400-500; never 600+ for page titles |
| Long-form body | 17px / 23px, justified, hyphenated, 25px paragraph spacing, 42rem measure |
| Section rhythm | 60px bottom padding, `--rule-strong` hairline, 50px before the next section |
| Eyebrow (the one uppercase role) | Geist Mono 12px, weight 600, 2px letter-spacing, muted ink |
| Metadata, figure tags, counters | 13px muted Geist; Geist Mono only for numbers, file names, dates, identifiers |
| Card radius | ≤ 6px; the Algebrica bordered list-table card is the 12px exception |
| Side stripe | Never a coloured `border-left`/`border-right` over 1px |
| Entrance and micro-interaction motion | About 140ms with `--ease-out`, `--ease-in-out`, `--vpk-dur-*` |

### Type hierarchy

Hierarchy comes from position, measure, weight, and whitespace. Display headings use Geist at weight 400-500; do not use 600+ for page titles. Body copy is 17px / 23px in long-form prose. Long-form `.post-section` content is justified, hyphenated, and break-word safe, with 25px paragraph spacing and the Algebrica section rhythm: 60px bottom padding, a `--rule-strong` hairline, and 50px margin before the next section. Use a 42rem reading measure for document prose unless the template has a specific page or deck geometry.

### Case

Use normal case and direct technical labels. The single uppercase role is the breadcrumb/eyebrow: Geist Mono, 12px, weight 600, 2px letter-spacing, muted ink, and `text-transform: uppercase`. Metadata, figure tags, counters, and route labels are 13px muted Geist; use Geist Mono only when the label is a number, file name, date, or technical identifier.

### Spacing rhythm

Spacing follows an 8px rhythm except where Algebrica components define fixed rhythm: post sections use 60px / 50px separation, tables and figures end with 30px margin, bordered list-table cards start 40px below their centered section head, and centered section heads use a 500px measure. Screen-first long docs should leave enough air around anchor jumps to feel intentional.

### Borders and elevation

The surface is flat. Separate content with whitespace, hairline borders, and subtle `--surface-sunken` or `--surface-raised` shifts. Prefer borders over shadows. Generic cards and callouts may use a 1px ink/rule border and radius no larger than 6px; the Algebrica bordered list-table card is the explicit 12px radius exception. Hard shadows are not part of the default identity.

Side stripes remain banned: no `border-left` or `border-right` greater than 1px as a colored accent on cards, list items, callouts, or alerts.

### Color discipline

Use semantic aliases, never raw color literals in authored or generated surfaces. Links never show a default underline. Content links (prose links, table-of-contents rows, index/list-row titles) use `text-decoration-line: underline` with transparent decoration that transitions to ink on hover/focus over about 180ms and keeps a 4px underline offset. Chrome links (sidebar nav, header/meta, footer links, breadcrumbs, and docnav controls) never underline; they shift opacity or muted/ink color on hover. Focus-visible states keep the ink focus ring and do not rely on hover-only affordance. `--accent` resolves to ink, while `--accent-soft` and `--accent-soft-strong` are neutral gray washes for pill controls, selection, and key-insight emphasis.

There is no hue accent in the built-in identity (the iso kit’s single figure accent, `--ill-accent`, is the one exception; see `references/illustrations.md` § 4). Figure emphasis uses `--focal` plus stroke-width 2-2.5. Series are distinguished by tone, dash, and markers, not hue. Heatmap and intensity charts use the official warm ramp `--heat0` -> `--heat4`.

Status colors are meaning-bearing only. Success is grayscale; warning and danger keep their semantic tints and dark variants. Do not use them as decoration.

### Figure grammar

There is one figure style, paper; see [paper system](paper-system.md) for the two-column story layout, the figure page, code blocks and the chart direction. Do not offer alternative materials (outline, sculpted) as a picker.

All generated SVGs follow `references/svg-style.md`: token-only grayscale fills/strokes, no gradients, no filters, Geist Mono labels, numeric stroke-widths from 0.5 to 2.5, and no `--accent*` or `--link*` tokens. User logos/screenshots can opt out with `data-vpk-external-asset` on the SVG root.

Tables follow the Algebrica article treatment: Geist 12px, collapsed borders, all cells `1px solid var(--rule)`, `8px 12px` centered padding, `th` weight 500, `--table-header` header wash, no radius, no zebra striping, and no hover row treatment.

### Motion discipline

Shared motion comes from `scripts/shared.mjs`, not per-template timing tweaks. Use `--ease-out`, `--ease-in-out`, and the `--vpk-dur-*` tokens. Entrance and micro-interaction motion should sit around 140ms unless a document-specific runtime has a reason to go slower. Print CSS neutralizes motion, and reduced-motion removes movement while preserving legibility.

Chart motion prefers the shared `.vpk-chart-*` utilities; SMIL choreography follows `references/svg-style.md` § SMIL motion. With the utilities, draw strokes with `--vpk-draw-length`, grow bars/areas with transform-based scale, reveal points with `--vpk-stagger-index`, and reserve the focal pulse for a single focal value. Charts must render complete static SVGs when JavaScript is disabled and must snap to their final state under reduced motion. See `references/charts.md` before adding chart templates.

### Presentation layer

Deck screen behavior is additive. Presentation CSS and JS live behind `@media screen` and `data-vpk-presentation-runtime`; print/PDF geometry remains the template source of truth. Speaker notes are hidden in the main deck and print output, then read only by the presenter window.
