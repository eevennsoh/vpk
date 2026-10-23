# SVG Style

This is the required figure grammar for generated vpk-html SVGs. It applies to
diagrams, charts, and technical illustrations unless the SVG is a user-supplied
external asset.

## Palette

Use tokens only. Raw hex, rgb, hsl, and named decorative colors are rejected in
figure paint attributes because they cannot invert under `data-theme="dark"`.

| Figure role | Token | Faithful light value |
|---|---|---|
| Focal element | `--focal` | `#000000` |
| Primary linework | `--ill-line` | `#333333` |
| Secondary label | `--ill-ink50` | `#636363` |
| Guide / axis | `--ill-guide` | `#bababa` |
| Dashed guide | `--ill-guide-dashed` | `#d3d3d3` |
| Frame | `--ill-frame` | `#c9c9c9` |
| Primary fill | `--ill-fill` / `--ill-tone2` | `#eaeaea` |
| Alternate fill | `--ill-fill-alt` / `--ill-tone1` | `#f6f6f6` |
| Deep tone | `--ill-tone3` | `#d3d3d3` |

Allowed color values in SVG paint/style fields:

- `none`, `transparent`, `currentColor`, `inherit`
- `var(--allowed-figure-token)`
- `color-mix(in srgb, var(--allowed-figure-token) N%, transparent)`

Forbidden in SVGs:

- raw hex, rgb, rgba, hsl, hsla
- `var(--accent*)`
- `var(--link*)`
- gradients, filters, blur, glow, drop shadows

Exceptions in the iso kit (`references/illustrations.md` § 4): its flat cast shadows are plain token-filled paths (one fill on
`g[data-vpk-iso-shadows]`, `color-mix(in srgb, var(--ill-line) 12%, var(--paper))`, no filter, blur, gradient or opacity), so
they are figure paint, not a drop-shadow effect; and the one accent pair (`--ill-accent`, `--ill-accent-ink`) marks only the
focal or active part, its motion arrow, the focal leader dot and, during the one-shot entry, the layer that is dropping (a SMIL
`class` animation on the scene group switches the accent faces on and hands them back to the neutral tone map; the rest pose
carries no class). Neither is a `var(--accent*)` token. The iso kit draws no hatching, no entry arrow and no ghost outline, and
no `opacity` attribute anywhere.

## Focal Rule

One element may be the darkest-ink focal element:

```html
<path d="..." stroke="var(--focal)" stroke-width="2" />
```

Everything else should use `--ill-line`, `--ill-ink50`, `--ill-tone*`, or rule
tokens. Use `--ill-guide`, `--ill-guide-dashed`, `--ill-frame`,
`--ill-fill`, and `--ill-fill-alt` when the sampled Algebrica figure roles are
more precise. If the figure needs multiple focal elements, split the figure.

## Multi-Series Without Hue

Use tone, dash, marker, and layering:

- solid `--focal` for the single focal series
- `--ill-line` / `--ill-ink50` / `--rule-strong` for supporting series
- `stroke-dasharray="4"` or `stroke-dasharray="8 6"` for alternates
- circles, squares, triangles, or hollow points for markers
- direct labels beside each line or bar when possible
- heatmap or intensity charts use `--heat0` through `--heat4`

For animated or interactive charts, follow `references/charts.md`. Keyframe
classes, transforms, CSS custom properties such as `--vpk-draw-length`,
`data-*` hooks, ARIA attributes, and inline `data-vpk-chart-runtime` scripts
are allowed when the SVG still renders complete without JavaScript and every
paint value remains token-safe.

## SMIL motion

One contract for every SVG that uses `<animate>`, `<animateTransform>`,
`<animateMotion>` or `<set>`: diagrams, charts, illustrations and figure-engine
output alike.

1. The rules apply to every SVG in a document, not only illustrations.
2. Each SMIL element uses `begin="indefinite"`, or chains from one by syncbase
   (`begin="a1.end+0.2s"`; a `;`-list of syncbase values is also gated).
   Nothing autoplays on load.
3. The authored offset goes in `data-vpk-begin="80ms"`. Without it, elements
   are staggered by their index: 70 ms by default, overridden per figure with
   `data-vpk-smil-stagger="<ms>"` on the root `<svg>` (`0` is allowed).
4. Each root `<svg>` picks one mode:

   | Mode | Authored as | Starter behaviour |
   |---|---|---|
   | offset (default; diagrams, charts, v1 illustrations) | `begin="indefinite"` plus `data-vpk-begin`, or the index stagger | starts on viewport entry; before its offset an element shows its base (final) pose |
   | shared begin (iso kit) | `data-vpk-smil-stagger="0"`, the stagger baked into `keyTimes` | every animation begins together |
   | armed (opt-in) | `data-vpk-smil-arm` on the root, with shared begin | on load it pauses at t = 0 so an off-screen figure holds keyframe 0; it plays on entry |

   Use `data-vpk-smil-arm` only when every element shares one begin and the
   stagger is baked into `keyTimes`. Arming an offset-mode figure would hold
   only its offset-0 elements at their start pose.
5. Base attributes are the final pose, so static, PDF and reduced-motion
   renders show the assembled figure.
6. Animate `transform` only with `<animateTransform type="translate|scale|rotate|skewX|skewY">`.
   Chromium ignores `<animate attributeName="transform">`.
7. No infinite repeats (`repeatCount`/`repeatDur="indefinite"`): WCAG 2.2.2
   would need a pause control. Use a finite repeat.
8. SMIL paint values (`fill`, `stroke`, `stop-color`, `color`, `flood-color`,
   `lighting-color` animations: every `values` item and `from`/`to`/`by`) use
   the grayscale figure tokens.
9. One shared `data-vpk-smil-starter` block (`<!-- vpk-smil-starter:start -->`)
   starts each figure once on viewport entry, does nothing under
   `prefers-reduced-motion: reduce`, lands every figure when reduced motion
   turns on, and lands on print. No other script starts, arms or strips SMIL.
   Runtimes control figures only through `window.vpkSmil`
   (`version`, `figures()`, `start(svg?)`, `land(svg?)`, `hold(t, svg?)`,
   `duration(svg?)`), read lazily at call time because block order is not
   guaranteed.
10. `build.mjs --inject-runtime <file>` (artifacts) and `--refresh-library`
    (skill assets) normalise autoplay SMIL to the gated form and insert the
    starter. `check-html.mjs` enforces the static rules; `--verify` and
    `scripts/runtime/smil-starter.mjs --sweep` check behaviour in Chromium.
11. Prefer the `.vpk-chart-*` CSS utilities (`references/charts.md`) for
    single-step chart entrances; use SMIL for choreography they cannot express.

## Line Grammar

- SVG root: `fill="none"`
- Stroke width: numeric 0.5-2.5
- Usual linework: 1-2px
- Focal stroke: 2px
- Line caps and joins: round when the geometry benefits from it
- Frames: rounded rects are allowed, `rx <= 9`
- Arrowheads: filled triangles, not open chevrons
- Construction lines: `stroke-dasharray="4"` or similar short dashes

## Figure Text

SVG text uses Geist Mono. Typical label size is 11-13px; tighter diagrams may
drop below that only when the label remains legible. Secondary labels use
`var(--ill-ink50)`. Avoid long single-line labels in fixed boxes; wrap text
into multiple `<text>` lines or widen the node.

## Dark Parity

Dark mode works only when figures route all paint through tokens. Raw grayscale
is not an exception. The lint rejects raw `#000000`, `#333333`, `#636363`,
`#bababa`, `#d3d3d3`, `#c9c9c9`, `#eaeaea`, `#f6f6f6`, and every other fixed
color inside generated SVGs.

## Patterns and hatching

`fill`/`stroke` may reference `url(#id)` only when `id` is a `<pattern>` in the same SVG
(check-html: "fill references url(#x) that is not a local <pattern>"). Prefix ids `vpk-…` so
`#id` never reads as a hex colour, bake the 45° diagonals into the tile, and never use
`patternTransform`; the print CSS neutralises transforms, so a rotated hatch prints vertical. This applies to hand-drawn
figures (the v1 `hatched-cross-section` exemplar strokes its hatch directly). The iso kit no longer hatches: its side faces are
plain flat faces, a brief part with `cut` fails validation, and the audit (A15) rejects a stale `cut` face or `-hatch` pattern.

## Print

The print stylesheet sets `transform: none` and `opacity: 1` on everything, so static figures must
not rely on `transform` attributes, rotated text or `opacity < 1`: the base pose is what prints.
Use `writing-mode` for vertical labels. Anatomy heroes are class-painted through `--ill-*` and
`--focal` tokens; their rest pose carries no `transform` or `opacity` attribute (live code moves
parts by delta from rest), and engraved face text is hidden in print.

## Status Quarantine

Status tokens are allowed only when the figure communicates a real semantic
state: success, warning, danger, or neutral information. They are not chart
series colors and not decoration. Human-review or approval-gate states default
to warning/yellow semantics, not danger/red semantics, unless the node means an
actual failure.

## External Asset Opt-Out

User-supplied logos, screenshots, or third-party SVGs can opt out:

```html
<svg data-vpk-external-asset aria-label="Partner logo">...</svg>
```

Use this only for externally supplied assets. Generated vpk-html diagrams and
illustrations must not use the opt-out.

## Lint Rules

`scripts/check-html.mjs` hard-fails generated SVGs when:

- fill, stroke, stop-color, or style color is not token-safe
- gradients, filters, or drop shadows appear
- SVG `font-family` does not resolve to Geist Mono
- numeric `stroke-width` is outside 0.5-2.5
- `--accent*` or `--link*` appears inside SVG paint/style

The lint does not reject chart keyframes, transforms, `data-*` attributes,
ARIA attributes, or inline progressive-enhancement scripts by themselves.

`scripts/build.mjs --check-templates` runs the same SVG grammar lint across all
templates.
