# Technical Illustrations

Read `references/svg-style.md` before drawing or modifying any SVG. Illustrations are
grayscale: premium comes from structure, tone and motion, never hue (locked decision 2). The one exception
is the iso kit's single accent (`scripts/iso/accent.mjs`, shared with the 3D assembly prototype): an orange
alias pair, `--ill-accent` and `--ill-accent-ink`, used only on the focal part, the hovered or selected part,
the focal and active label chip and the focal leader dot (§ 4).

Concept, behaviour rules, step-guide guidance and the review checklist: [figure craft](figure-craft.md). Everything the
kit needs ships in this skill; never install the upstream hairline or 3d-assembly-manual skills.

## 1. Two families

- **Diagram primitives** (`assets/diagrams/`): data shapes, flows, hierarchies, timelines and
  system maps with one `--focal` element.
- **Technical illustrations** (`assets/illustrations/`): objects, mechanisms, assemblies,
  cross-sections and pipelines on the grayscale `--ill-*` ramp.

Use an illustration when the reader must inspect structure or mechanics; use a diagram for a data
shape. Illustrations come two ways:

- **Iso kit** (`scripts/iso/`, engine id `iso-kit`): a JSON brief becomes an isometric SVG
  with painter-ordered opaque plates (every side face a plain flat face, never hatched), guides, labels, a one-shot assembly and one pointer
  behaviour. Use it for an interactive isometric figure (objects, stacks, assemblies). It is the
  default engine when nobody answers the engine question (`references/figure-engines.md` §1).
- **Hand-drawn SVG** (the v1 recipe): flat parallelogram faces in `--ill-tone1…3`, 1–2px
  `--ill-line` outlines, `--ill-hatch` parallel strokes, `--ill-guide` dimension lines with filled
  triangle arrowheads, Geist Mono labels in `--ill-ink50`, `--ill-frame` frames with `rx ≤ 9`. Use
  it for orthographic sections and mechanisms the kit does not model, and it stays the recipe of the
  five hand-drawn library exemplars (§9). No shadows, blur, glow, gradients, `filter` or decorative
  hue. (The iso kit's flat cast shadows, § 4 "Cast shadows", are its own exception, not a v1 recipe.)

The iso kit has one style, `manual` (§7, "Style"): every figure is drawn in it, and a brief needs no `style`
field. The five hand-drawn library exemplars keep the v1 recipe and are not migrated.

## 2. Figure engines

A document may mix engines (locked decision 4). The agent records the choice at contract lock in
`<meta name="vpk-figure-engine" content="none|iso-kit|anatomy-hero|both">`; the builders insert it
when absent and never overwrite it.

| | Iso kit (this file) | Anatomy hero (`references/figure-engines.md`) |
|---|---|---|
| Use for | figures inside the argument: stacks, trays, walls, assemblies | one detailed interactive machine per document |
| Labels | leader labels hugging the object (R7), numbered marks and boxed dimensions | plate corners plus a legend |
| Stroke | 1 (2 for the focal outline and the active edge) | 0.6, overridable with `--vpk-figure-stroke` (anatomy only) |
| Root | `figure.vpk-iso-plate[data-vpk-engine="iso-kit"]` | `div[data-vpk-engine="anatomy-hero"]` |

Both engines share one camera, one loop and one lightbox opt-out:

- **Camera:** `scripts/figures/camera.mjs` `FIGURE_CAMERA` (45°/30°); both roots carry
  `data-vpk-camera="45 30"`. Projection maths come from the vendored anatomy kit only.
- **Loop:** all motion runs through `window.vpkFrameLoop` (`scripts/runtime/frame-loop.mjs`): one
  rAF chain and one IntersectionObserver per page, asleep off-screen and at rest.
- **Lightbox:** interactive roots carry `data-vpkh-no-lightbox`; static figures stay zoomable.
  The zoom shows the bare SVG outside its plate, so the iso stroke rule and dark tone overrides
  also match `svg[data-vpk-iso]` (tops stay lightest in the zoom too).
- **CSS:** iso rules sit under `:where([data-vpk-engine="iso-kit"] …)`, `svg[data-vpk-iso]` or
  `.vpk-iso-*`; bare `.iso-*` classes belong to anatomy.

## 3. Projection

One camera per figure, never mixed. Objects use `dimetric` (`FIGURE_CAMERA`, edges at 26.57°), the
anatomy default. Flows, sections and timelines use the orthographic `front` (screen = x, −z) or
`top` (screen = x, y) presets. `true-iso` (45°/35.26°) is allowed only in a
document with no anatomy hero.

## 4. Tone map (grayscale plus the one accent, both themes)

Tops are the lightest face and away-facing sides the darkest, in both themes (integration K13).
The light values are the SVG attributes; the dark overrides are CSS in the iso block.

| Role (`data-vpk-iso-role` / tone) | Light (SVG attribute) | Dark override |
|---|---|---|
| `top` / `top` | `var(--surface-raised)` | `var(--ill-tone2)` |
| `fill` (hull, near side) / `light` | `var(--ill-tone1)` | none |
| `shade` (away side) / `dark` | `var(--ill-tone2)` | `var(--surface-sunken)` |
| focal faces / `accent` | top `var(--ill-accent)`, near side `color-mix(in srgb, var(--ill-accent) 62%, var(--surface-raised))`, away side `color-mix(in srgb, var(--ill-accent) 70%, var(--ill-line))` (`ACCENT_FACES`, the prototype's three accent faces) | none (the alias pair switches with the theme) |
| hovered or selected part (`.is-active`) | the same three accent faces, from CSS only | none |
| `state` faces / `pale` | `color-mix(in srgb, var(--ill-tone3) 60%, var(--surface-raised))` on every face | `var(--ill-tone3)` (`DARK_MANUAL_OVERRIDES`) |
| label chip (`data-vpk-iso-chip`, rx 2) | `none`; the focal label's chip `var(--ill-accent)` with text `var(--ill-accent-ink)`; the active part's label from CSS the same | none |
| `edge` / `crease` / `mark` / `guide` | `color-mix(in srgb, var(--ill-line) 60%, var(--paper))` / 38% / 45% / 72% with a `3 3` dash (edges and creases recede so the accented part leads: `NEUTRAL_LINES`) | none |
| focal `edge` | `var(--ill-line)`, 2 | none |
| `leader`, label | the 72% mix, ending in an ink dot (the focal leader ends in the accent dot, `-arrow-accent`, with a 1 px ink ring); 11-unit sentence-case mono (Geist Mono) in `--ill-line`, no extra tracking | none |
| `arrow` (annotation) | edge colour, 2px (CSS, `data-vpk-iso-weight`), its own `-flow` arrowhead; stays visible on narrow stages. An arrow that names the part it moves (`of`) draws its head as a filled path and takes `var(--ill-accent)` when that part is the focal one, and from CSS while it is hovered or selected | none |
| `shadow` (cast shadow) | `color-mix(in srgb, var(--ill-line) 12%, var(--paper))` on the shadow group (`SHADOW.TONE`) | `var(--surface-sunken)` (`SHADOW.DARK_TONE`) |

Resolved order (ADS tokens, `references/design.md` § ADS token map): light `#ffffff` (tops) > `#f0f1f2` > `#dddee1`; dark `#3d3f43` > `#303134` > `#18191a`. The edges,
not the shading, carry the drawing. The focal part takes the accent faces with its 2 px darker-accent outline; the pale fill
(parts with `state` only) is `#d4d5d8` in light, 1.47:1 off the tops, and tone 3 in dark through one more CSS
override. Accent values (`scripts/iso/accent.mjs`, ADS `color.background.accent.orange.bolder` with `color.text.inverse` on it):
light `#bd5b00` with white ink (4.51:1), dark `#fca700` with `#1f1f21` ink (8.36:1); `palette.test.mjs` checks the
ink-on-accent ratio is AA in both themes and `scripts/ads-tokens.mjs --check` holds the pair to `@atlaskit/tokens`. A flat `ring` is drawn as a stroked arc with no fill.
`iso/palette.test.mjs` asserts the order from `styles.css`.

**Cast shadows** (`SHADOW` in `scripts/iso/accent.mjs`, shared with the 3D prototype). One distant light: azimuth 190 and
elevation 75 in the figure camera's frame, so at the dimetric camera a shadow falls down and to the right and is about a
quarter as long as its part is high above the surface it lands on (`1 / tan 75` = 0.27). At 62 (0.53) the exploded stack's top
shell threw its shadow past the base plate onto the floor at full gap, where it read as nobody's; at 75 every shadow sits close
under its caster. A part's shadow is the convex hull of its plan outline at
its bottom and at its top, each pushed along the light onto the receiving plane, so it keeps the caster's own footprint shape.
Each part's shadow lands on the first surface beneath it along the light:

- **Received shadows.** Every part whose top face lies below a caster gets one `g[data-vpk-iso-received]` inside its own part
  group, after its top face and before its line work. The group is clipped to that top face (`clip-path` to a local
  `<clipPath id="vpk-iso-<id>-recv-<part>">`) and carries the one received fill, `SHADOW.RECEIVED` (the ink 12% into the raised
  surface, one step below a white top). In dark it is `SHADOW.DARK_RECEIVED` (tone 1, one step below the dark tops). On an
  accented top (the focal part, a hovered part, the dropping entry layer) the CSS repaints it `SHADOW.RECEIVED_ACCENT`, a deeper
  orange that stays lighter than the far face. Each caster contributes one path, its full shadow on that plane; the clip trims it
  to the face.
- **Ground shadows.** Every part with faces also casts its full shadow onto the figure's ground, the lowest base of a caster, in
  the one `g[data-vpk-iso-shadows]` painted before every part (fill `SHADOW.TONE`; `DARK_TONE` in dark). Wherever a lower part
  stands in the way, that part covers it, so only the share that misses every receiving face shows on the ground. A shadow that
  overflows a top therefore carries on to the next surface down.

The base plate's ground shadow is only its own thickness long. No shadow carries a stroke, filter, blur, gradient, opacity or
transform. Every shadow on one surface sits in one group with one opaque fill, so overlaps merge and never darken. Gaps (dashed
outlines) and rings (stroked arcs) are line work and cast none.

Motion: `data-vpk-iso-cast` is a shadow's screen move per unit of the figure's motion (the lift or one Gap unit). It sits on the
group when every shadow moves alike, otherwise on each path. A received shadow also carries `data-vpk-iso-cast-on`, its
receiver's move, and the runtime translates it by caster minus receiver in the same frame as the parts. This is exact, because a
prism's shadow on a parallel plane only translates as the gap changes, and the clip rides with the receiver. The fit covers the
rest pose's shadows; a lifted shadow's tail may run past the frame, and the narrow-stage crop ignores shadows. In an assembled
figure each caster's shadows (ground and received) slide in with its layer. Audit A21 checks both kinds: the groups, fills,
clips to the receiver's top, the caster standing above the receiver, and the forbidden attributes.

**Selective colour.** Only the focal part, the hovered or selected part, the focal label's leader dot and an owned motion arrow
(`annotations[].of`, accent while its part is focal or active) take the accent; everything else is the white and light grey
tone map, with edges and creases receded towards the paper (`NEUTRAL_LINES`). The faces keep the shared tone map so the iso kit
and the anatomy hero resolve the same face tones (K13). The kit's fixtures carry no ownership data for their arrows (the bento's
glide arrow moves the whole wall, not one part), so those arrows stay neutral.

Plate text clears 4.5:1 on `--paper` in both themes. The Gap label takes the
plate colour, `color-mix(in srgb, var(--muted-text) 80%, var(--ink))` (5.4:1 light, 9.8:1 dark),
because `--muted-text` alone is 4.44:1 in light. This matches the anatomy plate. The readout uses
`--ink` and the SVG labels `--ill-line`. The figcaption keeps the house `figcaption` style.
`palette.test.mjs` checks every `color:` in the iso CSS and the label fill.

## 5. Rules

| Rule | Origin | Grayscale rule | Check |
|---|---|---|---|
| R1 | one hue plus white | Paper and raised surface plus ≤ 5 distinct face fills; pattern fills count once | A2 |
| R2 | opaque plates, back to front | every face opaque; parts in painter order (anatomy `depthOf`); a guide precedes its plate | A5, A6 |
| R3 | 1px strokes, 2px for the focal and active path | edges are 1; the focal outline is 2 (the emitted attribute), the active edge 2 from CSS only; a numbered mark's paper ring is 1.5; non-scaling strokes from CSS | A4 |
| R4 | one focal fill | exactly one `data-vpk-iso-focal` part, its faces the three accent faces (`ACCENT_FACES`) with a 2 px darker-accent outline; a part with `state` takes the pale fill without the outline; accent paint appears nowhere else in the SVG except the focal label chip and text and the accent marker | A3 |
| R5 | flat side faces (hatching removed) | every side face is a plain flat face in the tone map, like the reference videos; the kit emits no hatch pattern and no `cut` role, and a brief part with `cut` fails validation with a message naming the field | A15, `scene.test.mjs` |
| R6 | dashed explode guides | `3 3` dash, the 72% ink mix, 1; from the part's extreme base corners straight down to the part beneath | A16 |
| R7 | mono labels near the part on leaders | Geist Mono 11 units, sentence case as the brief writes it (never forced to capitals), no extra tracking, ink; off the silhouettes, near the part, on a straight leader that ends in an ink dot on visible ink of the target; below 720 px the text becomes numbered gutter tags plus an HTML legend (see Narrow stages) | A7, A8, A20, browser (19) |
| R8 | figure ids, no chrome | the plate carries `data-vpk-fig-id="FIG_001"` and no chrome corners: the frame holds the drawing, its labels and the readout only; SVG text never rotates | A9, A11, browser (15) |
| R9 | the assembled figure is the static art | no `transform` attributes or `opacity < 1` at rest; runtime offsets are removed at rest, so the SVG's outerHTML equals the static art | A11, browser (3)(4) |
| R10 | Decision 2 | paint values only from `ALLOWED_ISO_TOKENS` (grayscale, no status/heat/selected/code) plus the accent pair (`ACCENT_ISO_TOKENS`, alone or leading a srgb mix to a grey token); no `data-vpk-external-asset` or `data-vpk-raw-colors-allowed` in a plate | A1 |
| R11 | one-shot drop assembly 1–1.8 s, no ghost or arrow | every SMIL element `begin="indefinite" data-vpk-begin="0s"`; root `data-vpk-smil-arm`; ≤ 6 layers; an even, overlapping stagger (every gap `ENTRY.STAGGER_MS` = 180 ms, shorter than the 700 ms drop) baked into `keyTimes`; total ≤ 1800 ms; keySplines `0.16 1 0.3 1`; last keyframe is rest; no repeats | A12 |
| R12 | hairline rules 01, 02, 04, 08 | one behaviour per figure (`select` or `explode`); hits use rest silhouettes; neighbours stagger 10 ms by distance; the hover lift is a 180 ms tween (`SELECT_MS`), other discrete moves 700 ms, continuous = spring (k 100, c 18); active = a 2 px accent outline only, never a face fill (filling large parts flickered as the pointer crossed boundaries) | browser (3)(4) |
| R13 | reduced motion | no assembly; the pointer still answers and lands in one step; a live switch lands at once; print shows the rest pose, also after an interaction | browser (1)(5)(7)(8) |
| R14 | loops sleep | all interactive motion in `vpkFrameLoop` ticks that return false when settled; no per-figure rAF; the only CSS animation is the motion at rest (§ 8), gated by `data-vpk-iso-rest`; one idle `setTimeout` per stage | browser (6), `runtime.test.mjs` |
| R17 | flat cast shadows | one shadow per part with faces, flat paths in one group painted before every part, one fill (`SHADOW.TONE`, dark `SHADOW.DARK_TONE`), no stroke, filter, opacity or transform; gaps and rings cast none; shadows move with their part on the ground and carry no transform at rest | A21, `runtime.test.mjs` |
| R15 | page weight | ≤ 60 KB SVG per figure (≤ 120 KB with `data-vpk-iso-dense`, > 40 parts); coordinates rounded to 0.1 | A17 |
| R16 | anatomy readout and ARIA | mono readout in true units (`gap 0.60`, part names, `rest`); the live region speaks only on a discrete commit | browser (3)(4) |

## 6. Acceptance checks

Mechanical checks run in `scripts/iso/audit.mjs` and `build.mjs --check-iso <file> [--strict]`
(advisory unless `--strict`; `build-figure.mjs` treats errors as fatal):

| Id | Check |
|---|---|
| A1 | every paint value in the plate (fill, stroke, stop-color, color, SMIL paint) is `none`, `transparent`, a local pattern `url(#…)`, `var(--t)` or `color-mix(in srgb, var(--t) N%, var(--u))` with t, u in `ALLOWED_ISO_TOKENS`, or the accent (`var(--ill-accent)`, `var(--ill-accent-ink)`, or a mix led by `--ill-accent` towards a grey token); no escape-hatch attribute |
| A2 | ≤ 5 distinct fills on `fill`/`shade`/`top` faces (a pattern fill counts once) |
| A3 | exactly one focal part, its faces equal to `ACCENT_FACES` per role, with a 2 px darker-accent outline; `state` parts pale; accent paint only on focal faces (or a faceless focal's edge), the motion arrow that names the focal part (`data-vpk-iso-arrow-for`) and the accent marker; no other part has a heavier outline (R4) |
| A4 | every `stroke-width` attribute is in {1, 1.5, 2}; the root carries `data-vpk-iso-style="manual"` (any other value is an error naming the one style; a missing one is a warning) |
| A5 | of two parts whose rest hulls overlap, the larger `data-vpk-iso-depth` comes later |
| A6 | each guide sits in `g[data-vpk-iso-fade]` before the fill of its `data-vpk-iso-from` part |
| A7 | label boxes stay outside the scene hull; leaders start at their label, end inside (or within 2px of) the target's rest silhouette, and cross no other label. Before emitting, `auditScene` repeats this at rest and at every Gap slider stop from `min` to `max`: each leader ends on a visible point of its target (no part painted after it within 4px), touches no label and crosses no other leader |
| A8 | labels are sentence-case Geist Mono at 10–12 units (a label of four or more letters in all capitals fails; short acronyms pass) |
| A9 | `data-vpk-fig-id` matches `FIG_nnn` and is unique; SVG ids start with `vpk-iso-<id>-` and are unique; `data-vpk-figure` equals `data-vpk-iso-id` |
| A10 | the root carries exactly one valid `data-vpk-camera` that agrees with `data-vpk-iso-zdepth`; parts carry none |
| A11 | no `transform=` outside SMIL, no `patternTransform`, no nested `<svg>`, no `opacity` below 1 |
| A12 | SMIL per R11: gated begins, one shared `dur` ≤ 1800 ms, non-decreasing `keyTimes`, matching counts, rest last, root `data-vpk-smil-arm`, ≤ 6 `animateTransform` hold offsets 80–700 ms apart (label and guide fades are not layers), no repeats |
| A13 | browser behaviour: `tests/vpk-html/iso-runtime.spec.ts` checks (1)–(5) and (7)–(10); `iso-runtime-print.spec.ts` checks (7b), (7c) and (12)–(15) |
| A14 | browser loop: the same spec, checks (6) and (11) |
| A15 | every `url(#…)` paint resolves to a `<pattern>` in the same SVG, without `patternTransform`; a stale hatched cut face (a `data-vpk-iso-role="cut"` path or a `-hatch` pattern) is an error: rebuild the figure |
| A16 | guide dash, stroke and width match R6 |
| A17 | SVG ≤ 60 KB (≤ 120 KB dense); path numbers have ≤ 1 decimal |
| A21 | cast shadows (R17): one `g[data-vpk-iso-shadows]` painted before every part, filled `SHADOW.TONE`; every `data-vpk-iso-role="shadow"` is a path inside it, outside any part, with no stroke, filter, opacity, transform, style, mask or clip; each names a part with faces (a gap or ring shadow is an error); a figure with parts and no shadows warns |

check-html enforces the shared part for every SVG: `url(#id)` paint only for a local `<pattern>`,
and SMIL paint values on the figure tokens.

Human checks (the rubric): **H1** the point is obvious in 5 s;
**H2** craft (line quality, tone, restraint); **H3** part relationships are legible; **H4** motion
explains rather than decorates; **H5** the pointer reveals something true; **H6** it fits the
Algebrica identity in both themes and reads at 320 px wide.

## 7. Using the kit

**Brief** (`vpk-iso-brief/1`, validated by `scene.validateBrief`): `id` (`^[a-z][a-z0-9-]{0,39}$`,
the `data-vpk-figure`), `figId` (`FIG_nnn`), `title` (≤ 48; the plate corner shows about 25
characters in full on a 320 px screen and cuts longer titles there), `label` (the SVG `aria-label`),
`caption` (the insight, not an echo of the title), `style` (optional; absent or `"manual"`, the kit's one style; any
other value fails validation),
`camera` (`preset`, `scale: "fit"`, `pad`), `viewBox` (default 720 × 450), `texture`, `parts`,
`focal`, `labels`, `annotations`, `marks`, `dims`, `scale`, `assemble`, `interact`, `meta` (`margin`, `corner`).

- **Parts** (1–160): `{ id, kind, at, size, r?, bevel?, marks?, label?, explode?, clipTo?, clipPad?, state?, fixed?, liftMode? }`,
  `kind` ∈ `slab | box | plate | cylinder | tray | ring | gap`. `at` is the min corner (centre for
  `cylinder`/`ring`), `size` is `[w, d, h]` in world units, z up (`[r, r, h]` for a `cylinder`,
  `[r, r, 0]` for a `ring`; r is the radius). A `tray` splits into `:back` and
  `:front` pieces so its contents sort between them; a `ring` is a flat disc (optionally clipped to
  another part's top, or, with `clipPad` (0–200 world units, `ring` + `clipTo` only), to that part's plan
  grown by `clipPad` on every side, so a ring wider than its target still shows an arc); a `gap` is a
  dashed reserved outline. `state` (`"new"` | `"active"`) gives a part the pale fill
  without the focal's outline. `cut` is gone: the kit draws side faces flat, and a part that still says `cut` fails
  validation (`parts[n].cut is no longer supported`), with no silent fallback.
- **Fixed parts**: `fixed: true` makes a part scenery: it never lifts or separates, never takes the hover outline, is not
  a keyboard stop and cannot be selected (a select figure's pointer passes over it, and its faces drawn in front of a part
  still block that part's hit). Use it for plinths, bases, housings and mats that hold the figure up. A select figure's
  **support**, its one lowest part (not the focal) whose plan holds every other part's plan, is fixed by default; write
  `fixed: false` to keep it selectable. Every other base (several feet, a plate on a housing, benches side by side) needs
  `fixed: true`. A brief whose parts are all fixed, or a fixed part with a `liftMode`, fails validation.
- **Lift mode** (select only): `interact.liftMode` (figure default) or a part's `liftMode` is `"raise"` (default: the part
  rises whole) or `"grow"` (its base stays on what it stands on and only its top rises by `lift`, like a bar extending; the
  terrain's pillars). `grow` takes a vertical prism (`box`, `slab`, `plate`, `cylinder`); the build checks that the solid
  `lift` taller is the rest solid with its top-face points moved, and a solid that is not (a bevelled slab) raises instead,
  with a build warning. A grown part's ground shadow holds still.
- **Labels**: `{ text, target, side?: left|right|auto, anchor?: [x, y, z] }`.
  The kit anchors each leader on a visible point of its target; a crowded figure fails A7 instead
  of moving labels, so fix it with `side` or `anchor`. `side` is a hint: a label moves to
  the nearer hull edge when that edge is at least a third nearer, and labels keep 28 units apart.
- **Marks, dimensions, scale**: `marks: [{ target, at?: [x, y, z], offset?: [dx, dy], n? }]` (at most 12;
  `n` 1–99, unique, default the list position) draws a numbered disc on a leader to a visible point of
  the target; `dims: [{ from: [x, y, z], to: [x, y, z], text, offset? }]` (world points, at most 8, text ≤ 40
  chars, `offset` within ±80) draws a tick-ended dimension line with a boxed mono label (a v1
  `dimension` annotation renders the same way); `scale: { length, text, at? }` draws a tick-ended scale bar of `length` world
  units along +x with its real length (`text` ≤ 24 chars, for example `"1,000 PX"`), only for a
  figure with real units. All three are validated by `scene.validateBrief` (`scene.test.mjs`).
- **Assembly**: `assemble.layers` lists every part once, in ≤ 6 layers; `from` (default `[0, 0, 30]`, `ENTRY.DROP_Z`) is the
  offset parts drop from (the camera fit counts only its first 14 units, so a part may start above the frame and fall in). The timing is fixed (rule 10 below); `staggerMs` and `partMs` still validate but
  do not change it.
- **Behaviour**: `interact` is `null` (static, zoomable), `{ behavior: "select", rest?, lift?, liftMode?, guides? }`
  (pointer or arrow keys lift one part and name it; Escape returns to rest; a lifted part keeps its painter-order place, so
  the parts in front of it still cover it; `guides: true` draws the explode figure's dashed drop guides, whose upper ends
  ride the lift) or
  `{ behavior: "explode", explode: { rest, min, max, step, unit } }` (hovering the figure opens it to `max` and leaving
  closes it; a touch tap toggles; pointer position plays no part; the range input commits the resting gap). The brief's `at` values are the rest pose; offsets are
  `explode × (gap − rest)`. `rest` must be a slider stop (`min + n × step`), or the range input
  would snap it and the figure could not return to its static art. Pick `min` and `max` so every
  stop keeps each label's target visible: a range that slides the focal part under another part,
  or crosses two leaders, fails A7 (the exemplar stops at 0.4). On touch, a tap does what a hover
  does and the result holds for 1.4 s after the finger lifts.

**Style.** The kit has one style, `manual` (credit: `SkylarKitchen/skills` `design/3d-assembly-manual`, MIT,
`LICENSE`): a near-white model, ink hairlines at 72%, one accent focal with a 2 px darker-accent outline, labels near the part on
short leaders ending in an ink dot, numbered marks, boxed dimensions and a scale bar. A brief omits `style` (or sets
`"manual"`); `--style` accepts only `manual`. The short rules, each enforced by the audit or a unit test:

1. **Tones:** tops are the lightest kit tone, the two sides the next two light steps, no dark sides; dark
   theme mirrors the steps so tops stay lightest (R5, K13).
2. **Edges:** 1 px ink hairlines at about 72%, non-scaling; plates stay opaque.
3. **Detail:** one interior mark per part, the longest (A19); the focal keeps all of its own.
4. **Emphasis:** exactly one focal part, the three accent faces plus a 2 px darker-accent outline (A3); a part with `state`
   takes the pale fill without the outline; everything else is near-white. Its label sits on an accent chip with
   ink text, and its leader ends in the accent dot. A focal that renders no visible stroke
   or fill (a ring clipped away by a window it never crosses) fails A18.
5. **Labels:** inside the frame, near the part, on a 1 px straight leader that ends in a small ink dot; sentence-case
   Geist Mono 11 units (A8), drawn at up to 1.5 times its viewBox width on a wide page (so about 11–16 px, like B's),
   never under 9 px at 390 px (the narrow stage swaps labels for ink-disc tags, scaled to the floor). Labels
   never overlap a silhouette or each other (A7).
6. **Marks:** numbered 20 px ink discs, a paper numeral (mono 500, 11), a 1.5 px paper ring and a 1 px ink ring.
7. **Dimensions:** a tick-ended line with a boxed mono label (paper ground, 1 px ink border, square corners).
8. **Scale bar:** only when the figure has real units.
9. **Slots:** reserved slots (a `gap` part) are dashed hairlines; they are content and stay. The entry draws no ghost or
   target outline and no direction arrow (the user's redline): the falling part shows the direction, and nothing paints over a
   moving part except that its cast shadow sits under it.
10. **Motion:** one-shot assembly on entry (§ 8 "Entry"): each layer drops 30 world units (`ENTRY.DROP_Z`) in 700 ms on the
    ease-out curve, drawn in the accent while it drops, then hands off to the neutral tone map over 300 ms, 180 ms after it
    starts (every layer alike, the last included); an even stagger (layer i starts at i × 180 ms, so each drop overlaps the previous one's last ~20%) starting at 0, total under 1.8 s; reduced motion and print
    show the rest pose.
11. **Pointer:** hover or focus on a `select` figure blinks the part, holds a 2 px darker-accent outline and paints it with
    the accent faces; its label chip takes the accent too; `explode` and `select` keep working.
13. **Motion at rest:** see § 8.
12. **Chrome:** the frame holds the drawing, labels, marks, dimensions and the readout only (no chrome corners);
    the Gap slider sits under it; the caption follows below.
13. **Grammar:** token fills only, no gradients or filters, Geist Mono only, every SVG labelled
    (`check-html`, `--check-iso --strict`).
14. **Cast shadows:** every part with faces casts a flat pale shadow down and to the right; see § 4 "Cast shadows".

The viewBox height of a figure shrinks to its drawing plus the camera pad (a 720 × 450 brief renders
720 × 318 for the Done column), and the svg fills its frame up to 1.5 times its viewBox width. Every document
with an iso figure inlines the same runtime block (the style's CSS, the select blink and the runtime), measured
against one budget, `ISO_BUDGET_BYTES` = 27,648 B in `scripts/iso/inline.mjs` (27,432 B measured 2026-10-23; the comment there
explains the rise from 25,600 B for the entry hand-off).

**Commands** (writes under `.agents/skills/` or `artifacts/` are unsandboxed):

```bash
# brief → standalone page (validate, audit, runtime pipeline, check-html; exit 1 on any failure)
node .agents/skills/vpk-html/scripts/iso/build-figure.mjs --brief _figures/fig-001.iso.json --out fig.html
# in a document: keep briefs in _figures/, place empty regions, then inject (idempotent)
#   <!-- vpk-figure:begin engine="iso-kit" id="fig-001" src="_figures/fig-001.iso.json" --><!-- vpk-figure:end id="fig-001" -->
node .agents/skills/vpk-html/scripts/iso/build-figure.mjs --inject artifacts/vpk-html/<slug>/<slug>.html
node .agents/skills/vpk-html/scripts/iso/build-figure.mjs --inject artifacts/vpk-html/<slug>/<slug>.html --check   # exit 1 if stale
# checks
node .agents/skills/vpk-html/scripts/check-html.mjs artifacts/vpk-html/<slug>/<slug>.html
node .agents/skills/vpk-html/scripts/build.mjs --check-iso artifacts/vpk-html/<slug>/<slug>.html --strict
```

`build-figure.mjs` also takes `--style manual` (any other value is a usage error), `--fragment` (region only), `--no-runtime` and
`--print-bytes`. `--inject` rebuilds only regions with a `src` (relative to the document's folder,
no `..`), keeps the plate root's `data-vpk-id`/`data-vpk-revision`, inserts the engine meta when
absent and runs the runtime pipeline. An audit error is fatal: it exits 1 and leaves the
document as it was. Place regions in the body: a marker inside `<script>` or
`<style>` text is ignored with a warning. Copying a plate from `assets/illustrations/` by hand also
works; then run `build.mjs --inject-runtime <file>`.

**Runtime.** The pipeline adds one `vpk-iso` block (`<style data-vpk-iso-css>` plus
`<script data-vpk-iso-runtime>`, one block for every document, within `ISO_BUDGET_BYTES`; the kit's locals are
renamed, the frame loop's are not) whenever a document
has an `svg[data-vpk-iso-id]`, and removes it when none remains. `window.vpkIso` drives `select`
and `explode`, keyboard and live regions; `window.__vpkIsoRehearsal` (and `__vpkRehearsal` when
absent) delegates to `window.vpkSmil` for captures. Printing (`beforeprint` through the frame
loop's `rest`, or a print media change) writes one rest frame, because the print CSS cannot reach
the runtime's guide and leader `d` or the active stroke; `afterprint` puts the interactive state
back. A native range input stands in for an SVG drag
handle, so the control is keyboard- and AT-accessible without custom ARIA; it carries
`autocomplete="off"`, so after Back the browser does not restore a gap the figure no longer shows.

**Narrow stages.** The SVG scales with its box, so 11-unit callout text renders near 4 px on a phone.
On screens up to 720 px wide a labelled figure (`data-vpk-iso-narrow`) swaps the callouts for numbered
tags on each target's anchor, drawn inside the target's part group so they move with it, and shows the
labels as an HTML legend under the figure (11 px mono, plus any dimension notes). It also crops the empty
label gutters (`--vpk-iso-crop-w`, `--vpk-iso-crop-x` on the root `<svg>`), so the scene is drawn about
twice as large and the digits render at 9-12 px from 320 px up. Above 720 px the labels render at 9 px or
more and nothing changes. Print and the lightbox keep the labels, and the explode preview spans the visible
stage. `A7` checks one tag per label, on its target, and warns on a labelled figure with no tags (built
before they existed): rebuild it with `build-figure.mjs`.

**Reduced motion on load.** The plate and everything in it carry `transition: none` under reduce, because
`styles.css` gives every element a 200 ms transition there and the plate's box rules arrive after the first
style pass; without the rule the figure glided to its width for 200 ms (browser (18)).

**Decks.** In `slides.html` the slide is a fixed 158 mm frame and the template caps every SVG at
105 mm, so the plate centres a narrower SVG, and the runtime fits each slide that holds iso figures
when the slide is shown. It shrinks the SVGs until the slide's content ends inside its frame, above a
pinned `.co` callout and the page number, as long as each SVG keeps half its size. Otherwise it fits
only the plate (foot and caption included), and content after the figure is yours to move to the
next slide. A figure in a hidden container (an inactive tab panel, a closed `<details>`) is left
out of the fit and shows at full size when opened; it is fitted the next time the slide is shown.
Give an iso figure a slide with at most an eyebrow, a heading and a lead above it.

## 8. Motion policy

SMIL in illustrations follows [svg-style.md § SMIL motion](svg-style.md#smil-motion), the same
contract as diagrams and charts. Static and PDF output show the base (assembled) pose: `pdf.mjs`
renders with reduced motion, and the shared starter does nothing under it.

Kit specifics:

- **Assembly (R11):** shared begin with the stagger baked into `keyTimes` and `data-vpk-smil-arm`,
  so an off-screen figure holds its start pose and plays once on entry. Hand-drawn figures may use
  offset mode (`data-vpk-smil-stagger`; `exploded-assembly` uses `90`) but must not arm.
- **Reduced motion (R13):** nothing assembles; the pointer lands in one step; the iso CSS switches
  transitions off inside the figure, because the shared stylesheet would otherwise glide every
  change for 200 ms under `body[data-vpk-motion]`.
- **Loops (R14):** interactive motion only in `vpkFrameLoop` ticks; pointer, key and slider handlers set
  targets and wake the board. There is no idle tour.
- **Entry** (`ENTRY` in `scripts/iso/accent.mjs`, shared with the 3D prototype; matched to the barrel-sauna and fall-bed
  step guides, then trimmed by the user's redline). Each assembly layer drops from `DROP_Z` = 30 world units above its rest over
  `PART_MS` = 700 ms on the `0.16 1 0.3 1` spline and lands, its cast shadows sliding in on the ground under it. While it drops it
  is the current step and wears the three accent faces with darker-accent line work; `ACCENT_HOLD_MS` = 180 ms after it starts
  (the same for every layer, the last included) it hands back to the neutral tone map over `HANDOFF_MS` = 300 ms. The focal part keeps its accent. There is no entry arrow and no ghost or target
  outline (they were tried and removed: the falling part already shows the direction, and a ghost painted over the moving part).
  Mechanism: one discrete SMIL `class` animation on `g[data-vpk-iso-scene]` steps class lists (`vpk-iso-h<j>` hides layer j
  and its shadows until it starts, `vpk-iso-a<i>` accents the dropping layer, the rest value `vpk-iso-set` paints nothing);
  the iso CSS paints the classes and transitions `fill` for the hand-off. The base art carries no class, so a static, print or
  reduced-motion render is the neutral rest pose, and the grammar needs no `opacity`, filter or new rAF. The 3D prototype
  reads the same constants: its entry sampler returns an accent weight instead of a ghost, and its tour title fades from grey to
  ink over `TITLE_FADE_MS` = 400 ms while the camera eases to frame the step over `STEP_CAMERA_MS` = 600 ms.
- **Motion at rest** (`REST_MOTION` in `scripts/iso/accent.mjs`, the same constants the 3D prototype's idle sway
  reads): on an interactive stage, 3000 ms after the assembly has ended (the longest SMIL `dur`; the prototype waits the
  same after its entry) or after the last input (pointer, wheel, key, focus), the runtime sets `data-vpk-iso-rest` on the stage (never on the svg, so its
  outerHTML stays the static art, R9). CSS keyframes then
  drift the drawing 1.5 px on a Lissajous path (x over 8 s through `translate`, y over 11 s through `transform`) and
  bob the focal part 2 px over 2.5 s through `translate`, so the runtime's `transform` attribute is never touched and
  the static art is unchanged. Any input removes the attribute at once. It is off under reduced motion, in a hidden
  tab, off screen (an IntersectionObserver), in print (the rest pose) and during the entrance. Rest motion uses no
  rAF: one `setTimeout` per stage and compositor-only CSS. Static figures (no `interact`) have no runtime and no rest
  motion. The prototype's "done state" (after its tour) has no SVG equivalent: the SVG has no tour.

`scripts/check-html.mjs` enforces the static rules; `build.mjs --verify` and
`scripts/runtime/smil-starter.mjs --sweep` check the behaviour.

## 9. Exemplars

Iso-kit brief exemplars (`scripts/iso/briefs/`), rendered to `assets/illustrations/<slug>.html` and
`assets/demos/demo-illustration-<slug>.html`:

- `iso-exploded-stack` (`briefs/exploded-stack.json`): the Done-when figure; assembles on entry,
  `explode` behaviour, still under reduced motion.
- `iso-flatpack-shelf` (`briefs/flatpack-shelf.json`): assembly-manual step; panels explode along the dowel axis.
- `iso-phone-anatomy` (`briefs/phone-anatomy.json`): stacked device layers; hover lifts a layer, battery accented.
- `iso-cache-shelves` (`briefs/cache-shelves.json`): system figure; select a cache tier to lift it.
- `iso-parcel-tray` (`briefs/parcel-tray.json`): open tray with parcels and a tape roll seen from above.
- `iso-turntable-anatomy` (`briefs/turntable-anatomy.json`): a boxed true dimension (no scale bar: at its narrow-stage scale, under 0.4x, the bar label would render near 6 px inline and collide with the gutter tags, while the dimension moves into the legend); explodes upward.
- `iso-card-stack-ui` (`briefs/card-stack-ui.json`): UI card layers; select a layer, primary button accented.

`assets/demos/demo-illustration-gallery.html` is the gallery hub: it shows all seven on one page (one inlined iso
block; the builder renumbers each figure to its own `FIG_nnn`) and links the gallery pages. The 88 recreations of hairline
(`hl-*`) and the anatomy collection (`an-*`) are `BRIEF_EXAMPLES` entries with a `gallery` key. They appear only on
their gallery page, `demo-illustration-gallery-hairline-<shelf>.html` or `demo-illustration-gallery-anatomy-<n>.html`
(`GALLERY_PAGES`). Each page must stay inside the data-URL viewer budget, and the builder fails if one does not.

Hand-drawn exemplars, maintained in place by `--refresh-library` (not migrated to the kit): `isometric-device`, `exploded-assembly`, `annotated-mechanism`, `hatched-cross-section`,
`isometric-pipeline`.

```bash
node .agents/skills/vpk-html/scripts/build-illustrations.mjs            # brief exemplars only
node .agents/skills/vpk-html/scripts/build-illustrations.mjs --check    # exit 1 on drift
node .agents/skills/vpk-html/scripts/build.mjs --refresh-library        # library fixed point
```

`build-illustrations.mjs --legacy` also rewrites the hand-drawn exemplars from their v1 source; the
committed copies have drifted from it, so review that diff before keeping it.
