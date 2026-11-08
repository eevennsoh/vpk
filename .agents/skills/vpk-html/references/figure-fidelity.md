# Figure fidelity: what a product-UI figure looks like

Owner of figure fidelity for [SKILL.md](../SKILL.md). Load when you draw or review a product-UI scene: cards, boards, walls.

Numbers come from the accepted EU26 figure (`artifacts/vpk-html/eu26-animation-explained/_figures/`) as calibration. Frame cost: [figure engines § 12](figure-engines.md#12-measure-frame-cost-never-cap-detail).

Contents: [outlines](#1-container-outlines-on-opaque-surfaces) · [text](#2-no-text-in-product-ui-scenes-except-named-exceptions) · [shading](#3-shading-after-the-reference-video) · [copies](#4-copies-outside-the-root-share-the-colour-scope) · [surface detail](#5-surface-detail-in-plan-units-one-matrix-per-surface) · [reference match](#6-match-production-frames-not-your-own-render)

## 1. Container outlines on opaque surfaces

Draw each product surface as an opaque paper slab whose top face shows **container outlines**: the panels, inputs, pills, lists and rings of the screen, never their content.

| Surface | Calibration range | EU26 measured | Made of |
| --- | --- | --- | --- |
| Story card | 3-8 outlines | 3-5 | cover panel, 1-3 cover containers, avatar |
| Wall tile | 1-2 inner containers | 1-2 | tile card plus an input, list, table, chart, media or glyph |
| Bento tile | 2-5 containers | 2-5 (`sessions` 5, `artifacts` 4, `record` 2) | panels, windows, rings, bars (`TILES` in `eu26-face-detail.mjs`) |
| Board chrome | 0 inner outlines | 0 | the slabs are the bars and columns |

A list, table or chart counts as one container; its 2-4 rows or bars are its line work (`rows`, `table`, `chart` in `eu26-face-wall.mjs`). Scale the count with your reference.

```js
// GOOD: a story card. eu26-face-detail.mjs, cardDetail:
p.rect(5, 5, card.w - 10, 74, 3, "dp");                 // cover panel
(COVERS[code] || COVERS["TEU-2"])(p.sub(5, 5));         // cover containers
p.circle(card.w - 15, 99, 6);                           // assignee
// COVERS["TEU-7"]: window, title bar, button
p => { p.rect(6, 8, 158, 36, 4, "dw"); p.rect(60, 14, 70, 8, 2, "dp"); p.pill(56, 52, 70, 14, "dw"); }
```

**BAD, empty:** cards are bare rectangles. The tell: at 240px nobody can name what is on the grey tiles.

**BAD, over-detailed:** cards carry titles, text lines, worded chips and icons. The tell: one line per text row.

**GOOD:** cards show their cover containers. The tell: the silhouette names the screen; no shape stands for a word, icon or text line.

## 2. No text in product-UI scenes, except named exceptions

Diagrams, charts and schematics keep labels, axes and legends ([diagrams](diagrams.md), [charts](charts.md)). List each exception in the brief’s `figures[].job`, give it a selector, and assert in your behaviour test (no gate checks it) that no other `<text>` exists. EU26 excepts its title lockup (“Team ’26 / Europe”, `.dtt`) and cursor name pills, asserted in `explorer.behavior.test.mjs` (`artworkAndLabels`):

```js
const allowed = ".dtt, [data-eu26-cursor-name]"; // your named exceptions
assert.equal([...svg.querySelectorAll("text")].filter(text => !text.matches(allowed)).length, 0);
```

**BAD, over-labelled:** `<text>Sprint board</text>` on a card. The tell: a word appears that the brief never listed.

**BAD, stripped:** exceptions dropped for zero text. The tell: cursor moves read as anonymous.

**GOOD:** empty title bands; named cursors. The tell: the assertion passes and each exception shows in its chapter.

## 3. Shading after the reference video

No solid black fill in any figure, diagram or scene. Full ink goes only to strokes and lettering: cursor arrows, cursor names and a diagram’s one `--focal` stroke ([svg style](svg-style.md#one-focal-element-per-figure)).

Product-UI scenes set the values below in figure-scoped light and dark token blocks (§ 4); kit diagrams keep 72% hairlines ([illustrations](illustrations.md)). Values are `color-mix(in srgb, var(--ink) N%, var(--paper))`; edit this table and [paper-shading.json](paper-shading.json) together (`scripts/paper-shading.test.mjs`).

<!-- paper-shading:begin -->
| Part | Light | Dark | Token |
| --- | --- | --- | --- |
| Top face | 0% | 10% | `--anatomy-top`, `--anatomy-paper` |
| Side faces, by facing | 4%, 6%, 7%, 8% | 7%, 6%, 5%, 4% | `--anatomy-shade-3` … `--anatomy-shade-0` |
| Hairlines hi, mid, lo | 42%, 30%, 20% | 44%, 32%, 22% | `--anatomy-hi`, `--anatomy-mid`, `--anatomy-lo` |
| Ground shadow | 6% | `--surface-sunken` 75% into paper | `--eu26-shadow` |
| Landing ring, live figure only | 24% | 24% | `.dring`, 1.2px |
<!-- paper-shading:end -->

Sides stay darker than tops in both themes (less ink in dark). Surface edges are 0.55px, detail strokes 0.5px, both `vector-effect: non-scaling-stroke`.

Offset ground shadows by height: `lift = clamp((topZ - groundZ) * 0.5, 10, 140)`, shifted `lift * 0.7` across and `lift * 0.45` down (`eu26-scene-live.mjs`). Parts resting on a supporting surface cast none, so no shadow pokes past its edge.

**BAD, leaking shadow:** a card resting on a column casts its shadow past the column edge. The tell: a pale band sits beside a column on bare ground.

**BAD, heavy shadow:** a ground shadow darker than any side face, or offset beyond `lift`. The tell: the shadow is the second-darkest tone after hairlines.

**BAD, too dark:** light sides above 8% or hairlines above 42%. The tell: the light figure reads as dark theme.

**BAD, washed out:** light sides under 4% or hairlines under 20%. The tell: tops and sides merge into flat stickers.

**GOOD:** near-white tops, pale sides, grey hairlines, shadows paler than any side. The tell: apart from cursors and the named lettering exceptions, the darkest light-theme pixel is a hairline (42%).

Orange goes on the subject only, mixed in `oklab` from `--ill-accent` into `--ill-accent-ink`: top 100%, side 86%, outlines 55%, faint outlines 75%, lettering 50%. Inner panels mix it toward `--paper` in light (82%, 62%) and `--ink` in dark (78%, 62%).

**BAD, spread:** orange off the subject, or a second hue for a state. The tell: at 240px you count two orange things.

**BAD, faint:** the subject barely tinted. The tell: at 240px you cannot find it without the caption.

**GOOD:** one orange subject, lighter top, slightly deeper side, dark-orange lettering. The tell: at 240px the eye lands on it first, in both themes.

## 4. Copies outside the root share the colour scope

Thumbnails and snapshots are SVG clones outside the figure root; every token and colour rule must select them too.

```css
/* explorer.css, verbatim; repeat both under [data-theme="dark"] */
:is(#animation-explorer [data-vpk-figure="eu26-hero"] svg, svg.eu26-thumb-svg) { --anatomy-shade-3: …; } /* tokens */
:is(#animation-explorer, .eu26-thumb-svg) [data-eu26-face] .dp { fill: var(--d-panel); }                /* rules */
```

```js
// explorer.js: one id prefix per copy; rewrite id, url(#id), href, aria-labelledby
function snapshot(index, scope = "thumb") { /* id -> `eu26-${scope}-${index}-${id}` */ }
```

**BAD, root only:** shading selects only `#animation-explorer`. The tell: the live figure is pale and its thumbnails dark grey.

**BAD, shared prefix:** two snapshot callers share one `scope`. The tell: a thumbnail clips to another’s element.

**GOOD:** scopes are `:is()` lists naming the copy class; each snapshot caller passes its own `scope`; live-only marks (`.dring`, cursors) stay live. The tell: light and dark contact sheets match each thumbnail to its frame.

## 5. Surface detail in plan units, one matrix per surface

Draw detail once, in plan units (0..w across, 0..d down). Each frame, place the detail group with one matrix from three projected corners, inside the surface’s group, so it inherits depth order and clipping. Counter-scale lettering to `min(sx, sy)` so it never stretches; keep `<text>` static and write its transform only when it changes.

```js
// eu26-scene-live.mjs, after "Face detail is drawn in the plan's local units"
const [o, a, d] = [[0, 0], [plan.w, 0], [0, plan.d]].map(([u, v]) => project(world([plan.x + u, plan.y + v, faceZ])));
detail.setAttribute("transform", `matrix(${(a[0]-o[0])/plan.w} ${(a[1]-o[1])/plan.w} ${(d[0]-o[0])/plan.d} ${(d[1]-o[1])/plan.d} ${o[0]} ${o[1]})`);
const even = Math.min(sx, sy); // per letter: translate(x y) scale(even/sx even/sy) translate(-x -y), "" when sx == sy
if (value !== letter.last) { letter.last = value; value ? letter.el.setAttribute("transform", value) : letter.el.removeAttribute("transform"); }
```

**BAD, per point:** each detail point is reprojected per frame. The tell: script time tracks outline count.

**BAD, outside the surface:** detail sits in a shared top layer. The tell: it paints over nearer cards or past the clipped Done column.

**BAD, outlined glyphs:** lettering converted to paths. The tell: the HTML grows about 3x (1.3MB to 4.45MB, with layout cost doubled) and the figure has 0 `<text>` nodes.

**BAD, stretched lettering:** text inherits the card’s non-uniform scale. The tell: the title letters widen as a card changes aspect.

**GOOD:** one `matrix()` per surface per frame inside the surface group; static `<text>` counter-scaled to `min(sx, sy)`. The tell: detail sorts and clips with its card, and letters keep their proportions through every aspect change.

SVG text is already vector; WebGL text libraries (pmndrs/glyph) matter only in three.js scenes.

## 6. Match production frames, not your own render

Take counts and shading from production frames first; [verification § 2](verification.md#2-extract-reference-frames-before-you-draw) owns capture.

**BAD:** you tune by eye on your own render. The tell: the user’s next message is “too detailed”, “too dark” or “not true to production”.

**GOOD:** your crop beside the production frame, same size and theme, before you tune. The tell: each reference container and tone has its match in yours.
