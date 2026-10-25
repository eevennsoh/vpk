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
when absent and never overwrite it. Pages that show hairline's ready figures record `content="hairline"`
(`references/figure-engines.md` § 10).

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
| R1 | one hue plus white | Paper and raised surface plus ≤ 8 distinct face fills (`top`, `light`, `dark`, `pale`, `accent`, `ink`, and later `recess` and `glow`); the three accent faces, the three ink faces and any pattern fill each count once | A2 |
| R2 | opaque plates, back to front | every face opaque; parts in painter order (anatomy `depthOf`); a guide precedes its plate | A5, A6 |
| R3 | 1px strokes, 2px for the focal and active path | edges are 1; the focal outline is 2 (the emitted attribute), the active edge 2 from CSS only; a numbered mark's paper ring is 1.5; non-scaling strokes from CSS | A4 |
| R4 | one emphasis | `brief.emphasis` is `accent` (default), `ink` or `none` (root `data-vpk-iso-emphasis` when not `accent`). `accent`: at least one `data-vpk-iso-focal` part (`focal` is an id or a list, a group drawn alike), its faces the three accent faces (`ACCENT_FACES`) with a 2 px darker-accent outline; accent paint appears nowhere else except the focal leader dot and an owned arrow. `ink`: focal parts (optional) keep their faces with a 2 px ink outline, and no accent paints anywhere, in the rest art, the entry hand-off or on hover. `none`: no focal part and no accent. A part with `state` takes the pale fill without the outline; a part with `tone: "ink"` takes the three ink faces | A3 |
| R5 | flat side faces (hatching removed) | every side face is a plain flat face in the tone map, like the reference videos; the kit emits no hatch pattern and no `cut` role, and a brief part with `cut` fails validation with a message naming the field | A15, `scene.test.mjs` |
| R6 | dashed explode guides | `3 3` dash, the 72% ink mix, 1; from the part's extreme base corners straight down to the part beneath | A16 |
| R7 | mono labels near the part on leaders, or none | `brief.labels` is a list of labels (`"leaders"`, no count limit), or `"none" (root `data-vpk-iso-labels="none"`: no labels, tags, legend or gutters, and no `part.label`; the drawing takes the full width). Leaders: Geist Mono 11 units, sentence case as the brief writes it (never forced to capitals), no extra tracking, ink; off the silhouettes, near the part, on a straight leader that ends in an ink dot on visible ink of the target; below 720 px the text becomes numbered gutter tags plus an HTML legend (see Narrow stages) | A7, A8, A20, browser (19) |
| R8 | figure ids, no chrome | the plate carries `data-vpk-fig-id="FIG_001"` and no chrome corners: the frame holds the drawing, its labels and the readout only; label text never rotates, and face text (detail `text`) is projected onto its face | A9, A11, browser (15) |
| R9 | the assembled figure is the static art | no `transform` attributes or `opacity < 1` at rest; runtime offsets are removed at rest, so the SVG's outerHTML equals the static art | A11, browser (3)(4) |
| R10 | Decision 2 | paint values only from `ALLOWED_ISO_TOKENS` (grayscale, no status/heat/selected/code) plus the accent pair (`ACCENT_ISO_TOKENS`, alone or leading a srgb mix to a grey token); no `data-vpk-external-asset` or `data-vpk-raw-colors-allowed` in a plate | A1 |
| R11 | one-shot drop assembly 1–1.8 s, no ghost or arrow | every SMIL element `begin="indefinite" data-vpk-begin="0s"`; root `data-vpk-smil-arm`; any number of layers (each layer group animates its own generic `vpk-iso-wait`/`vpk-iso-drop` class, so the CSS is the same size for 3 layers or 300); an even, overlapping stagger (every gap `staggerFor(layers)` = min(180, (1800 − 700) / (layers − 1)) ms, no floor: 180 ms up to 7 layers, 100 ms at 12, 11 ms at 100, always shorter than the 700 ms drop) baked into `keyTimes`; total ≤ 1800 ms; keySplines `0.16 1 0.3 1`; last keyframe is rest; no repeats | A12 |
| R12 | hairline rules 01, 02, 04, 08 | one behaviour per figure (`select`, `explode`, `step` or `scrub`); step = discrete states (click, Enter, Space, arrows, Home/End, Escape to rest) on the 700 ms tween; scrub = a continuous position from a drag, `pointer-x` or arrow keys (snap to whole states) on the spring, with a slider under the frame; hovering a part during step or scrub only names it in the readout and outlines it; hits use rest silhouettes; neighbours stagger 10 ms by distance; the hover lift is a 180 ms tween (`SELECT_MS`), other discrete moves 700 ms, continuous = spring (k 100, c 18); active = a 2 px accent outline only, never a face fill (filling large parts flickered as the pointer crossed boundaries) | browser (3)(4) |
| R13 | reduced motion | no assembly; the pointer still answers and lands in one step; a live switch lands at once; print shows the rest pose, also after an interaction | browser (1)(5)(7)(8) |
| R14 | loops sleep | all interactive motion in `vpkFrameLoop` ticks that return false when settled; no per-figure rAF; the only CSS animation is the motion at rest (§ 8), gated by `data-vpk-iso-rest`; one idle `setTimeout` per stage | browser (6), `runtime.test.mjs` |
| R17 | flat cast shadows | one shadow per part with faces, flat paths in one group painted before every part, one fill (`SHADOW.TONE`, dark `SHADOW.DARK_TONE`), no stroke, filter, opacity or transform; gaps and rings cast none; shadows move with their part on the ground and carry no transform at rest | A21, `runtime.test.mjs` |
| R15 | page weight | no size limit: SVG warns above 250 KB (`svgWarnBytes` 256,000) and never fails (`svgFailBytes` null); gallery pages may pass the data-URL viewer budget (a build warning, not an error); coordinates rounded to 0.1; merge each part's line work into one path per role. `data-vpk-iso-dense` is retired and tolerated as a no-op | A17 |
| R16 | anatomy readout and ARIA | mono readout in true units (`gap 0.60`, part names, `rest`, or a state readout: the state's own `readout`, else the `interact.readout` template with `{name}`, `{n}`, `{count}`, `{t}` and `values` keys, `{key:0.1}` for decimals, interpolated while scrubbing); the live region speaks only on a discrete commit (a step change, a scrub release, a key or a slider change) | browser (3)(4) |

## 6. Acceptance checks

Mechanical checks run in `scripts/iso/audit.mjs` and `build.mjs --check-iso <file> [--strict]`
(advisory unless `--strict`; `build-figure.mjs` treats errors as fatal):

| Id | Check |
|---|---|
| A1 | every paint value in the plate (fill, stroke, stop-color, color, SMIL paint) is `none`, `transparent`, a local pattern `url(#…)`, `var(--t)` or `color-mix(in srgb, var(--t) N%, var(--u))` with t, u in `ALLOWED_ISO_TOKENS`, or the accent (`var(--ill-accent)`, `var(--ill-accent-ink)`, or a mix led by `--ill-accent` towards a grey token); no escape-hatch attribute |
| A2 | ≤ 8 distinct fills on `fill`/`shade`/`top` faces (`fillsMax`; the accent faces, the ink faces and a pattern fill each count once) |
| A3 | per emphasis (R4): under `accent` at least one focal part, each with faces equal to `ACCENT_FACES` per role and a 2 px darker-accent outline, accent paint only on focal faces (or a faceless focal's edge), the motion arrow that names a focal part (`data-vpk-iso-arrow-for`) and the accent marker; under `ink` focal edges are 2 px `var(--ill-line)` and any accent paint is an error; under `none` a focal part is an error too; `state` parts pale; no non-focal part has a heavier outline |
| A4 | every `stroke-width` attribute is in {1, 1.5, 2}; the root carries `data-vpk-iso-style="manual"` (any other value is an error naming the one style; a missing one is a warning) |
| A5 | of two parts whose rest hulls overlap, the larger `data-vpk-iso-depth` comes later. The depth is the painter key from the vendored depth audit (`scripts/iso/painter.mjs`), so it follows the true front-to-back order; a painter cycle (two solids that each cover the other) is a model-audit warning |
| A6 | each guide sits in `g[data-vpk-iso-fade]` before the fill of its `data-vpk-iso-from` part |
| A7 | with labels `"none"` any label or tag group is an error and nothing else is read. Otherwise label boxes stay outside the scene hull; leaders start at their label, end inside (or within 2px of) the target's rest silhouette, and cross no other label. Before emitting, `auditScene` repeats this at rest and at every Gap slider stop from `min` to `max`: each leader ends on a visible point of its target (no part painted after it within 4px), touches no label and crosses no other leader |
| A8 | labels are sentence-case Geist Mono at 10–12 units (a label of four or more letters in all capitals fails; short acronyms pass) |
| A9 | `data-vpk-fig-id` matches `FIG_nnn` and is unique; SVG ids start with `vpk-iso-<id>-` and are unique; `data-vpk-figure` equals `data-vpk-iso-id` |
| A10 | the root carries exactly one valid `data-vpk-camera` that agrees with `data-vpk-iso-zdepth`; parts carry none |
| A11 | no `transform=` outside SMIL, no `patternTransform`, no nested `<svg>`, no `opacity` below 1. One exception: `<text data-vpk-iso-role="face-text" class="iso-face-text">` carries one `matrix(…)` that projects it onto its face (print hides face text, because print resets transforms) |
| A12 | SMIL per R11: gated begins, one shared `dur` ≤ 1800 ms, non-decreasing `keyTimes`, matching counts, rest last, root `data-vpk-smil-arm`, any number of `animateTransform` hold offsets, every gap `staggerFor(layers)` (180 ms shrinking with no floor; label and guide fades are not layers), no repeats |
| A13 | browser behaviour: `tests/vpk-html/iso-runtime.spec.ts` checks (1)–(5) and (7)–(10); `iso-runtime-print.spec.ts` checks (7b), (7c) and (12)–(15) |
| A14 | browser loop: the same spec, checks (6) and (11) |
| A15 | every `url(#…)` paint resolves to a `<pattern>` in the same SVG, without `patternTransform`; a stale hatched cut face (a `data-vpk-iso-role="cut"` path or a `-hatch` pattern) is an error: rebuild the figure |
| A16 | guide dash, stroke and width match R6 |
| A17 | SVG warning above `svgWarnBytes` (256,000 B), never an error on size; path numbers have ≤ 1 decimal |
| A18 | a focal part renders something a reader can see (a visible stroke, or at least 30% of its fill uncovered inside its clip window) |
| A19 | detail budget as drawn segments (each `L` in a `mark`, `hatch` or `recess` path; each dot of a `dot` path counts one): warning above 400 per part; the fail limits follow `checks-thresholds.json` (null: off). Every detail entry is kept, merged into one path per role (`marksKept` is gone) |
| A20 | (A7) a leader dot sits on visible ink of its target |
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
`focal` (a part id, a non-empty list of ids drawn alike, or absent when `emphasis` is `ink` or `none`), `emphasis`
(`accent` | `ink` | `none`, default `accent`), `labels` (a list, or `"none"`), `annotations`, `marks`, `dims`, `scale`,
`assemble`, `interact`, `meta` (`margin`, `corner`). The numeric caps live in `references/checks-thresholds.json` → `iso`
(read by `scripts/iso/thresholds.mjs`): `partsWarn` 240, `partsMax` (null: off), `svgWarnBytes`, `svgFailBytes` (null: off), `fillsMax` (null: off),
every count and size key is `null` (off): there is no layer, label, mark, detail or size limit, and no warning for any of them.

- **Parts** (any number after expansion; the build warns above `partsWarn`): `{ id, kind, at, size, r?, bevel?, yaw?, axis?, up?, dividers?, marks?, detail?, label?, explode?, clipTo?, clipPad?, state?, tone?: "ink" | "glass" }`,
  `kind` ∈ `slab | box | plate | cylinder | tray | ring | gap` plus the turned, tube and ball kinds below. `at` is the min corner (centre for
  `cylinder`/`ring`), `size` is `[w, d, h]` in world units, z up (`[r, r, h]` for a `cylinder`,
  `[r, r, 0]` for a `ring`; r is the radius). A `tray` splits into `:back` and
  `:front` pieces so its contents sort between them; a `ring` is a flat disc (optionally clipped to
  another part's top, or, with `clipPad` (0–200 world units, `ring` + `clipTo` only), to that part's plan
  grown by `clipPad` on every side, so a ring wider than its target still shows an arc); a `gap` is a
  dashed reserved outline. `state` (`"new"` | `"active"`) gives a part the pale fill
  without the focal's outline. `tone: "ink"` draws the part in three ink faces (`INK_TONES`, `--ill-line` at 62/78/90% into the
  raised surface, swapped in dark so the top stays lightest) with an ink edge; it receives no shadows. `cut` is gone: the kit draws side faces flat, and a part that still says `cut` fails
  validation (`parts[n].cut is no longer supported`), with no silent fallback.
- **Part kinds: turned, tube and ball** (`scripts/iso/geometry.mjs`, `kinds.mjs`; drawn with the vendored `lathe`, `tubePieces` and
  `sphereOf` under the same camera; none takes `size`). `axis` is `x | y | z | -x | -y | -z | [ax, ay, az]` (default `z`); `up`
  (optional, not parallel to the axis) fixes where angle 0 points.
  - `lathe`: `{ at, axis, up?, profile: [[s, r] | [s, r, "soft"], …] (2–64 points, s never decreasing, r ≥ 0), closed? (default true:
    capped to the axis; false: an open shell), hole?: [s, r], steps? (8–160), bevel? }`. `cutaway` is not supported yet.
  - `cylinder` + `axis` (any axis but +z) is the lathe `[[0, r], [h, r]]` from `at` along the axis; upright cylinders draw as before.
  - `cone`: `{ at, axis, r0, r1, length }`. `torus`: `{ at, axis, R, r }` (r < R), a closed tube in chunks.
  - `ring` + `thickness` (and `inner`, the bore radius, default 0.6 r): a washer whose bore stays open (even-odd fill); a ring without
    `thickness` is the flat line-work ring.
  - `tube`: `{ points: [[x, y, z], …] (2–512), radius, fillet?, closed?, caps?, corrugate?: { every } }`. `rod`: `{ from, to, radius,
    caps? }`. `leg`: `{ at (top), radius, ground? (default 0), foot?: { r, h } }`. `spring`: `{ from, to, radius (coil), wire, turns }`.
    `catenary`: `{ from, to, sag, radius }`. Tubes are chunked (at most 30 units each) into pieces `<id>:<k>` with `of`, so painter
    order can pass a pipe behind one part and in front of another, and each chunk hits by its own hull. Tubes thinner than 0.8 cast
    no shadow.
  - `wire`: `{ points } | { from, to, sag? }`, a stroke drawn in the edge role (no radius, no shadow; its hit area is padded).
  - `sphere`: `{ at, r }` (a circle on screen, three tones from the vendored caps). `pin`: `{ at, length, r, head, axis? }`, a rod and
    a ball in one piece.
  New kinds never act as supports for explode vectors or receive shadows (only flat legacy tops do); they cast shadows from their
  sampled hull, and guides drop from their bounding plan.
- **Prisms, turned boxes, open trays, glass** (`scripts/iso/prism.mjs`, `polygon.mjs`, `tray.mjs`):
  - `prism`: `{ at, axis?, up?, yaw?, polygon: [[u, v], …] (3–128 points, simple: no two edges cross or touch), depth > 0, round? ≥ 0 }`.
    The polygon lies in the frame's `u, v` plane and is extruded `depth` along `axis` from `at`. `v` is `up` made perpendicular to the
    axis (default world z, or world y for a vertical axis), and `u = v × axis`. So an axis-`z` prism draws its polygon in plan, and an
    axis-`-y` prism stands it upright with `u` along +x. `round` fillets every corner. A concave polygon (a key, zigzag bitting, an L
    kerb) is split into convex solids (ear clipping, then merging diagonals while each piece stays convex). The solids are painted
    back to front in one piece, the true outline is drawn with no internal diagonals, and the piece carries `data-vpk-iso-hit="solids"`,
    so a point in a notch hits nothing. Its shadow is one hull per solid. A hole is drawn as a closed `tube`, not a holed prism.
  - `box`, `slab`, `plate` take `yaw` (degrees about world z, ±360; the box turns about its own centre) and `axis`/`up` (`size` runs
    w along `u`, d along `v`, h along the axis). Either one draws the box as a rounded-rect prism. Yaw 0 or an axis of `z` keeps the
    legacy drawing byte for byte. An upright convex prism or turned box offers its top like a box: it supports parts for explode and
    receives shadows. `repeat.polar.face` and a state `rotate` about `z` turn these kinds through yaw; a horizontal rotate axis is rejected.
  - Orientation (R): `axis` must be non-zero, `up` must not be parallel to it, and `up` needs an `axis`. Geometry is baked, so there is
    no transform at rest.
  - `tray` takes `axis`, the open face: `+z` (default), `-z`, `+x`, `-x`, `+y` or `-y` (`x | y | z` mean `+`). At the 45/30 camera a
    front the reader looks into is `+x` or `+y`. It also takes `dividers: { x?: [u…], y?: [v…], z?: [w…] }`, offsets from `at` that
    make thin internal walls (x dividers full height, y between them, z shelves between both). The far walls are `<id>:back` (painted
    before the contents), the near walls and the roof are `<id>:front` (painted after), and each divider is its own piece
    `<id>:div-…`, ordered by the depth audit. Contents standing on the floor move with the tray. A side-open tray receives shadows
    on its roof. A `+z` tray without dividers draws as before.
  - Shallow wells and slots are the `recess` detail (see **Detail**). It works on a turned box's faces too, named in its own frame.
  - `tone: "glass"` (on any part) paints no face. Its visible edges are the 1 px edge stroke and its hidden edges are dashed creases
    (`stroke-dasharray="2 2"`, the hidden-line look), so parts behind it show through. It casts and receives no shadow, adds no fill
    to A2, and stays hoverable: its hit polygon is the hull of its edges. A glass box draws through the prism path. A glass focal
    takes its outline on the edge stroke, like a faceless part.
- **Detail** (`part.detail`, `scripts/iso/detail.mjs`; at most 64 entries): drawn on a face in part-local `u, v`, or around a turned
  part's axis. Box-like faces are `top | +x | -x | +y | -y` (side faces run `u` along the face from its min corner and `v` up from the
  base); a tray offers its floor `top`; an upright cylinder its `top` (origin at the centre); turned parts `start | end` (and `top` on
  an upright one), with `s` to move a cap face along the axis. Detail on a face turned away from the camera is skipped with a warning.
  Types: `ticks { face, from, to, step, every?, lengths?, side? }`, `radialTicks { face?, at?, r, count, every?, lengths?, from?, span? }`,
  `knurl { count, s0?, s1? }`, `ribs { count, s0?, s1?, phase? }`, `bands { at: [s, …] }`, `spokes { face?, at?, r0?, r1, count, phase? }`,
  `bolts { face?, at?, r, count, size? }`, `dots { face, at?, grid: [cols, rows] (≤ 4000 dots), gap, size?, weights? }`,
  `inset { face, by, r? }`, `recess { face, shape?: circle|rect|stadium, at, size, depth? }` (a recess-tone fill plus its outline and
  far inner wall; one more fill tone for A2), `hatch { face: top, spacing ≥ 0.5, angle? }` (top faces only),
  `spiral { face?, at?, r0?, r1, turns }`, `line { face, points, dash? }` and `text { face, at, text (≤ 48 ASCII or common symbols),
  size? (2–6 world units), anchor? }`. Legacy `marks` are `line` detail on the top face and emit the same path as before. Each role
  is one path per part (`mark`, a dashed `mark`, `hatch`, `dot`, `recess`), plus one `<text>` per face-text entry (A11's exception).
- **Repeat, instances, vary** (`scripts/iso/expand.mjs`, expanded before validation, so caps and warnings count instances; ids are
  `<id>-<k>`): `repeat: { linear: { count, step: [x, y, z] } }`, `{ grid: { count: [nx, ny(, nz)], step } }` or
  `{ polar: { count, centre: [x, y], radius, from?, span?, face? } }` (the part's anchor, `at` or `from` or its first point, moves onto
  the circle; `face: true` also turns turned and tube kinds towards the angle, and boxes, slabs, plates and prisms through yaw).
  `instances: [{ …overrides }]` merges each override over the base part. `vary: { field: "size.2", values: […] }` or
  `{ field, fn: "gauss", sigma, floor? }` (a Gaussian fall-off from the grid centre) sets one field per instance. A base id in `focal`
  or `assemble.layers` names every instance; in `labels`, `marks`, an arrow's `of` or `clipTo` it names the first.
- **Painter order** (`scripts/iso/painter.mjs`): every piece carries the vendored signed-distance shapes of its solids, and the
  vendored `overlapsOf` + `orderKeys` order each pair that overlaps on screen by which is in front; pairs that never overlap keep the
  old depth-point order, so separate parts sort as before. A long shaft between two posts, a card in a tray, letters in a cubby and a
  long card beside a small box all sort correctly (`painter.test.mjs`).
- **Labels**: `{ text, target, side?: left|right|auto, anchor?: [x, y, z] }`, any number; or `labels: "none"`, which drops labels,
  tags, legend and gutters and forbids `part.label` (recommended above about 60 parts, with a readout).
  The kit anchors each leader on a visible point of its target; a crowded figure fails A7 instead
  of moving labels, so fix it with `side` or `anchor`. `side` is a hint: a label moves to
  the nearer hull edge when that edge is at least a third nearer, and labels keep 28 units apart.
- **Marks, dimensions, scale**: `marks: [{ target, at?: [x, y, z], offset?: [dx, dy], n? }]` (any number;
  `n` 1–99, unique, default the list position) draws a numbered disc on a leader to a visible point of
  the target; `dims: [{ from: [x, y, z], to: [x, y, z], text, offset? }]` (world points, at most 8, text ≤ 40
  chars, `offset` within ±80) draws a tick-ended dimension line with a boxed mono label (a v1
  `dimension` annotation renders the same way); `scale: { length, text, at? }` draws a tick-ended scale bar of `length` world
  units along +x with its real length (`text` ≤ 24 chars, for example `"1,000 PX"`), only for a
  figure with real units. All three are validated by `scene.validateBrief` (`scene.test.mjs`).
- **Assembly**: `assemble.layers` lists every part once, in as many layers as it needs (the stagger shrinks past 7 so the total stays ≤ 1.8 s); `from` (default `[0, 0, 30]`, `ENTRY.DROP_Z`) is the
  offset parts drop from (the camera fit counts only its first 14 units, so a part may start above the frame and fall in). The timing is fixed (rule 10 below); `staggerMs` and `partMs` still validate but
  do not change it.
- **Behaviour**: `interact` is `null` (static, zoomable), `{ behavior: "select", rest?, lift? }`
  (pointer or arrow keys lift one part and name it; Escape returns to rest) or
  `{ behavior: "explode", explode: { rest, min, max, step, unit } }` (hovering the figure opens it to `max` and leaving
  closes it; a touch tap toggles; pointer position plays no part; the range input commits the resting gap). The brief's `at` values are the rest pose; offsets are
  `explode × (gap − rest)`. `rest` must be a slider stop (`min + n × step`), or the range input
  would snap it and the figure could not return to its static art. Pick `min` and `max` so every
  stop keeps each label's target visible: a range that slides the focal part under another part,
  or crosses two leaders, fails A7 (the exemplar stops at 0.4). On touch, a tap does what a hover
  does and the result holds for 1.4 s after the finger lifts.
- **States** (`scripts/iso/states.mjs`, runtime `state-runtime.mjs`): `{ behavior: "step" | "scrub", input?, rest?, loop?, values?,
  readout?, states }`. `input` is `click` | `keys` for step (default `click`) and `drag` | `pointer-x` | `keys` for scrub
  (default `drag`); `rest` is a state index or name (default 0); `loop: false` stops step at the ends; `values` is
  `{ key: [one number per state] }` (a state may also carry its own `values`); `readout` is a template (see R16). Each of the
  two or more `states` is `{ name, readout?, values?, parts?: { id: { variant?, hidden?, move?: [x, y, z], turn? } } }`.
  The rest state is the static art: the brief's geometry, so its parts take no `move` (other states carry the difference);
  its `hidden` parts and `variant`s are what the static SVG draws. Part fields for states:
  `variants: { name: { ...geometry overrides } }` (each drawn as its own `<id>@<name>` piece with `data-vpk-iso-variant`, the
  base as `@base`; `id`, `kind`, `label`, `explode`, `clipTo` and expansion keys cannot be overridden) and
  `rotate: { axis, about?, deg: [a0, a1], samples? }` (12 samples by default, no cap; drawn as `turn-<i>` pieces, and a state's
  `turn` or, by default, an even sweep of `deg` across the states picks the nearest). Pieces the rest state does not show
  carry `display="none"` (last attribute) and drop out of A5, A7, A18, A20 and A21. The stage carries the state model as
  `data-vpk-iso-states` (per state: screen moves for each part and its cast shadow, hidden/variant/turn, values, text, and
  `o`, the painter order computed for that state); scrub interpolates moves, values and turns and switches the discrete parts
  and the order at the middle of each segment; the runtime reorders the DOM only when the order string changes. Variants and
  rotating parts cast their own ground shadows; received shadows are drawn only between parts that keep one shape and show
  at rest. Back at rest the SVG's outerHTML equals the static art, also after reordering (each piece moves with its leading
  whitespace).

**Style.** The kit has one style, `manual` (credit: `SkylarKitchen/skills` `design/3d-assembly-manual`, MIT,
`LICENSE`): a near-white model, ink hairlines at 72%, one accent focal with a 2 px darker-accent outline, labels near the part on
short leaders ending in an ink dot, numbered marks, boxed dimensions and a scale bar. A brief omits `style` (or sets
`"manual"`); `--style` accepts only `manual`. The short rules, each enforced by the audit or a unit test:

1. **Tones:** tops are the lightest kit tone, the two sides the next two light steps, no dark sides; dark
   theme mirrors the steps so tops stay lightest (R5, K13).
2. **Edges:** 1 px ink hairlines at about 72%, non-scaling; plates stay opaque.
3. **Detail:** every part keeps all of its marks, merged into one path per role; the budget is drawn segments (A19: warn above
   400 per part; there is no fail limit).
4. **Emphasis:** by default one or more focal parts take the three accent faces plus a 2 px darker-accent outline (A3);
   `emphasis: "ink"` outlines them in 2 px ink with no accent anywhere, `emphasis: "none"` emphasises nothing; a part with `state`
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
against one budget, `ISO_BUDGET_BYTES` = 49,152 B in `scripts/iso/inline.mjs` (29,703 B measured 2026-10-25 with 12 entry
layers and the ink rules; the headroom is for the step, scrub and variant runtime).

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
  Mechanism: each layer group (`g[data-vpk-iso-enter]`, and each `g[data-vpk-iso-shadow-enter]`) carries one discrete SMIL `class`
  animation (`vpk-iso-wait` hides it until its layer starts, `vpk-iso-drop` accents a dropping part group, the rest value
  `vpk-iso-set` paints nothing), so one rule set serves any number of layers;
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
block; the builder renumbers each figure to its own `FIG_nnn`) and links the gallery pages. The 52 recreations of the
anatomy collection (`an-*`) are `BRIEF_EXAMPLES` entries with a `gallery` key. They appear only on their gallery page,
`demo-illustration-gallery-anatomy-<n>.html` (`GALLERY_PAGES`). The nine `demo-illustration-gallery-hairline-<shelf>.html`
pages are not recreations: they show hairline's 36 figures drawn by the vendored hairline engine
(`references/figure-engines.md` § 10, `scripts/hairline/figures.mjs`), which replaced the old `hl-*` iso briefs.
Each page must stay inside the data-URL viewer budget, and the builder fails if one does not.

Hand-drawn exemplars, maintained in place by `--refresh-library` (not migrated to the kit): `isometric-device`, `exploded-assembly`, `annotated-mechanism`, `hatched-cross-section`,
`isometric-pipeline`.

```bash
node .agents/skills/vpk-html/scripts/build-illustrations.mjs            # brief exemplars only
node .agents/skills/vpk-html/scripts/build-illustrations.mjs --check    # exit 1 on drift
node .agents/skills/vpk-html/scripts/build.mjs --refresh-library        # library fixed point
```

`build-illustrations.mjs --legacy` also rewrites the hand-drawn exemplars from their v1 source; the
committed copies have drifted from it, so review that diff before keeping it.
