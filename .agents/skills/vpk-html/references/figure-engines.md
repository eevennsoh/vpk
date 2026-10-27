# Figure engines: iso kit, anatomy hero and hairline

vpk-html draws technical figures with two authoring engines that share one camera, one frame loop and one face-tone map,
so one document may use either or both. This file owns the anatomy hero and the mixing rules; the iso kit's
own grammar lives in `references/illustrations.md`. SKILL.md step 2 asks the engine question and records the
answer in `<meta name="vpk-figure-engine" content="none|iso-kit|anatomy-hero|both">`. A third engine, `hairline`
(§ 10), draws Lucas Marques's 36 hairline figures from the vendored upstream source; it is a catalogue of
ready figures, not an authoring engine, and a page that shows them records `content="hairline"`. The full set of
meta values is `none|iso-kit|anatomy-hero|both|hairline`; `both` means iso kit plus anatomy hero.

Both engines are built into this skill. The upstream anatomy, hairline and 3d-assembly-manual code is vendored or ported
here, and their authoring guidance is in [figure craft](figure-craft.md); never install or load those skills.

## 1. Choosing an engine

| | iso kit (`iso-kit`) | anatomy hero (`anatomy-hero`) | both (`both`) | hairline (`hairline`) |
|---|---|---|---|---|
| Use for | flows, stacks, exploded assemblies, request paths: several light figures | the one physical mechanism that carries the story, which the reader can work | one hero plus supporting iso figures | one of hairline's 36 ready figures, shown as upstream draws it (§ 10) |
| Authoring cost | a JSON brief, minutes | a hero module: Figure tier 30–90 min, Hero tier 2–4 h | the sum | none: pick a figure id from `scripts/hairline/figures.mjs` |
| Weight | no size limit: an SVG warns above 250 KB and never fails (`checks-thresholds.json` → `iso`); one runtime block within `ISO_BUDGET_BYTES` (`scripts/iso/inline.mjs`) | hero region warns above 300 KB, never fails | no total cap | no size limit (`figures.hairline` thresholds are off) |
| Interaction | select, explode, step or scrub behaviour, no tour | a slider (pointer, keys, idle tour) or live-owned input | per figure | each figure's own pointer answer (riffle also takes arrow keys); no `play` tour |
| Labels | short leaders ending in an ink dot, near the part (numbered gutter tags on narrow stages); the kit has one style, `manual` | plate corners (`Fig n`, title, hint, live readout) and a legend; no leaders or balloons inside the drawing | per engine | none in the drawing; a mono readout under it shows the figure's caption |

Rules: a figure takes as many parts, layers and detail as it needs to look right; there is no size, part or tier cap, and a document may carry several anatomy heroes. The Hero tier (80–150 parts) is a guide, used on an
explicit request. With nobody to ask, the iso kit is the default.

## 2. Anatomy hero workflow

1. **Size it.** Figure tier (40–80 parts) by default. A part is a recorder item with at least one solid.
2. **Truth model first.** Write `model(input, data)` (pure) and `present(state, data)` (the readout and the
   ARIA value text). The readout always comes from `present(model(x))`.
3. **The object is the explanation.** Pick a real machine whose moving part shows the idea.
4. **Parts list** of at least 40 parts, in world units, at the shared 45/30 camera.
5. **Build once at rest.** Moving parts are drawn at their rest position; live code moves them by delta.
6. **Record and settle.** Every solid goes through `R.put({ name, at, svg, shapes: [R.solid(A.slab(…))] })`;
   the builder runs the vendored `settle` for painter's order from real geometry.
7. **Plate.** Corners, legend keys and caption come from `hero.plate`.
8. **`live(ctx)`** moves parts with `ctx.offset`, rebuilds lines with `ctx.kit`, and shows `ctx.show(state)`.
9. **Verify** (section 7).

## 3. The hero module contract

The file `_figures/<id>.hero.mjs` sits next to the artifact. Example: the 12-part fixture
`scripts/anatomy/fixtures/carriage.hero.mjs`; the demo hero is `scripts/anatomy/examples/dial-indicator.hero.mjs`.

```js
export const hero = { id: "dial", tier: "figure", width: 600, height: 380, label: "…",
	plate: { fig: "Fig 1", title: "…", hint: "…", keys: [{ mark: "lit", label: "…" }], caption: "…" },
	stage: { role: "slider", label: "…", input: { min, max, step, bigStep, rest },
		pointer: { axis: "x", from: 0.15, to: 0.85 }, tour: { stops: […], dwell: 2.2, delay: 1.4, resume: 3.6 } } };
export const data = { /* JSON-safe constants shared by model, present, build and live */ };
export function model(input, data) { /* pure */ }
export function present(state, data) { return { readout, valueText }; }
export function build(kit, { state, data }) { /* → { P, R, before: [], after: [] } */ }
export function live(ctx) { return { tick(dt, now, calm) { /* → keep ticking? */ }, rest() {} }; }
export const auditOptions = { allow: [], crowd: [], cover: [] };
```

- `id` matches `^[a-z][a-z0-9-]{0,39}$` and is unique across both engines.
- `model`, `present` and `live` are serialized with `Function.prototype.toString`: they may use only their
  arguments, `ctx`, built-ins and their own locals, and `model` and `present` are pure. When the hero ships a
  script, the builder replays `model` and `present` from their source where only built-ins exist (at rest; for a
  slider also both ends, the tour stops and nine inputs between) and fails the build by name if either throws or
  disagrees with the module. `live` is checked by parse and by `check-runtime`.
- `data` holds only plain objects, arrays, strings, finite numbers, booleans and null. The build reads it as
  written and the page reads it back from the JSON island, so the builder rejects, by path, `NaN`, `Infinity`,
  `-0`, `undefined`, functions, symbols, `BigInt`, cycles, array holes and class instances such as `Date` or `Map`.
- `stage.role`: `slider` (mount-owned input, `tabindex="0"`, `aria-valuemin/max/now/text`), `group` (live owns its
  input and listens on `ctx.stage`), or `img` (static, no tabindex, no script).
- ARIA holds the input (`aria-valuenow`); `aria-valuetext` holds `present(model(target)).valueText`.
- `stage.tour` is optional (omit it or set `null` for no tour). It needs a non-empty `stops` array of finite inputs
  in `[min, max]`; `dwell` (> 0), `delay` and `resume` (≥ 0) are finite seconds and default to 2.2, 1.4 and 3.6,
  which the builder writes into the island. Anything else fails the build by name.
- `input.bigStep` is optional (default 5 steps) and must be a finite number > 0. `stage.pointer` is optional (omit it
  or set `null` for keys and tour only); when present, `axis` is `"x"` or `"y"` and `from` and `to` are two different
  fractions of the drawing in `[0, 1]` (`from > to` reverses the mapping). Anything else fails the build by name.
- The kit (`createKit()`): `k`, `G`, `T`, `A` (vendored iso-kit, lathe, tube, audit), `camera.fit` (always 45/30),
  `S`/`L`/`D` (solids, lines, dots; halos forced off), `fadedSvg` (stroke-opacity), `faceTextSvg` (once per hero).

`ctx` gives `id root stage svg readout P data kit`, `part(name)`, `model(input)`, `present(state)`, `input`
(slider: `min max step rest target touring`), `show(state)` (change-only readout), `offset(el, delta3)` (print-safe
transform from rest), `announce(text)` (group role, polite, never from tick), `wake()`, `calm()`, and the motion
helpers `follow`, `spring`, `settle`, `smooth`, `burst`. Under `calm` the shown value jumps to the target and the
figure still answers input. Live code never calls `requestAnimationFrame`, `IntersectionObserver` or
`setInterval`, and never listens on `document`.

The slider tour starts `delay` [1.4 s] after load, visits `stops` every `dwell` [2.2 s], pauses on hover, focus or
press and while off-screen, resumes `resume` [3.6 s] after the last input, and never runs under reduced motion; clearing reduced motion
mid-page brings it back after `resume` (`check-runtime` B15). Print lands the rest pose.

## 4. vpk deltas from upstream anatomy

- Grayscale only. The 29 `--anatomy-*` properties map onto vpk tokens (`scripts/anatomy/tokens.mjs`); red, green
  and blue tones fall back to the base grey.
- Face tones follow the iso kit's map, tops lightest in both themes: light top `--surface-raised`, near side
  `--ill-tone1`, far side `--ill-tone2`; dark top `--ill-tone2`, near side `--ill-tone1`, far side
  `--surface-sunken`. Tops and near sides match the iso kit in both themes. Far sides need not (K13 as amended at
  B2): the hero keeps upstream's four-tone facing model, so an anatomy box's far side may be one step deeper,
  `--ill-tone3` in light. In dark the deeper sides share `--surface-sunken` (no darker token exists). B8 compares
  the top and near-side fills in both themes (transitions off) and checks the order top, near, far, deeper.
- No halos, blur, gradients (`fadeLineSvg` throws), WebGL or 3D turn mode.
- Print-safe rest: no `transform` or `opacity` attribute at rest; engraved face text and the hint corner are hidden
  in print.
- The plate is a vpk frame (`1px solid var(--rule)`, 6 px radius), Geist Mono corners, 0.6 px hairlines
  (`--vpk-figure-stroke` on `:root` changes them). The corners sit on a grid, not upstream's absolute offsets:
  the hint wraps beside a long readout and stacks above it at 560 px and below, so no corner leaves the frame
  (`check-runtime` B14 measures 320, 390 and 600 px with the longest readout). Corner, legend and caption text
  clears 4.5:1 in both themes (B16): `text` is `--body-text`, `muted` is `--muted-text` mixed 20% towards it.
  The plate's figure is `display:block` with `!important`, so a template's identity block
  (`figure{display:flex !important}`) cannot shrink it to a sliver (`check-runtime` B18).
- The drawing is at most 920 px wide and `100vh - 300px` tall, but never capped below 240 px on a viewport 480 px
  tall or more; under 480 px (as at 200% zoom or in phone landscape) the cap is `100vh - 240px`, at least 120 px.
  Keyboard focus scrolls the whole plate into view with an 80 px margin (60 px when short), so every corner, the
  readout included, stays clear of the shell's fades and the docnav while the stage owns the keys (B17, ten
  viewports including 200% zoom of 1280×800, 1280×720, 1366×768 and 1440×900, and 844×390).
- Never paste upstream `ISO_CSS` or `kitScript()`: the CSS and runtime blocks are generated. The CSS drops the
  vendored declarations the vpk overrides make dead, so both blocks fit the budget even with flow and pulse (T11).

## 5. Mixing rules

- One camera: both engine roots carry `data-vpk-camera="45 30"` (`scripts/figures/camera.mjs`); check-figures A2
  warns on any mismatch.
- One frame loop: `window.vpkFrameLoop` (`scripts/runtime/frame-loop.mjs`), inlined by each runtime.
- One CSS and one runtime block per engine. Anatomy rules are scoped to `:where([data-vpk-engine="anatomy-hero"])`;
  bare `.iso-*` classes are anatomy's, `vpk-iso-*` are the iso kit's.
- Label grammar and stroke weight per engine (section 1); tone parity, not stroke parity, makes one system.
- Interactive roots carry `data-vpkh-no-lightbox`; static iso figures stay zoomable.
- ws1 review: each hero root is one atomic block (`data-vpk-block`; the inner figure is `data-vpk-review-ignore`),
  and `build-hero` carries its `data-vpk-id`/`data-vpk-revision` over byte-exact.

## 6. Files and commands

Region markers (written by `build-hero`):

```html
<!-- vpk-anatomy-hero:start id="dial" src="_figures/dial.hero.mjs" -->
<!-- vpk-anatomy-hero:end id="dial" -->
```

`src` is relative to the document's folder. The builder fills the region (root
`div[data-vpk-engine="anatomy-hero"][data-vpk-figure][data-vpk-camera][data-vpk-anatomy-tier][data-vpk-anatomy-parts]`,
plate, data island, live script), inserts the meta when absent, and refreshes `<style data-vpk-anatomy-css>` in
`<head>` and `<script data-vpk-anatomy-runtime>` before `</body>`.

```bash
node .agents/skills/vpk-html/scripts/build.mjs --build-hero artifacts/vpk-html/<slug>/<slug>.html --audit
node .agents/skills/vpk-html/scripts/build.mjs --build-hero artifacts/vpk-html/<slug>/<slug>.html --check
node .agents/skills/vpk-html/scripts/anatomy/build-hero.mjs --audit-only artifacts/vpk-html/<slug>/_figures/<id>.hero.mjs
node .agents/skills/vpk-html/scripts/build.mjs --check-figures artifacts/vpk-html/<slug>/<slug>.html --strict
node .agents/skills/vpk-html/scripts/anatomy/check-lines.mjs artifacts/vpk-html/<slug>/<slug>.html --theme both
node .agents/skills/vpk-html/scripts/figures/check-runtime.mjs artifacts/vpk-html/<slug>/<slug>.html --out output/vpk-html/figures/<slug>
```

`--build-hero --audit` writes nothing and prints no check mark when the audit fails (exit 1, "not written"), so a
document is never left with a hero that failed its audit. `check-lines` and `check-runtime` run Chromium
(unsandboxed). The skill demos are rebuilt with
`node .agents/skills/vpk-html/scripts/figures/build-engine-demo.mjs --page anatomy|engines|all` (unsandboxed) and
checked with `--check`. `assets/demos/demo-figure-engines.html` is the worked example of both engines in one
document: an iso-kit figure from `scripts/figures/briefs/round-trip.json` (a shared tray holding three plates) and
the dial hero, under meta `both`, one camera and one loop. Rebuild it whenever the iso kit's output changes, because
its table prints the measured bytes. On a document that carries both engines, also run
`node .agents/skills/vpk-html/scripts/build.mjs --check-iso <file> --strict`.

Hard checks in check-html (`scripts/figures/check-figures.mjs`): E1 roots without the meta; E2 an unknown meta or a
root the meta does not cover; E3 (warning) meta `both` with one kind, or a meta naming an engine with no root; H1
exactly one CSS block in `<head>` and one runtime block per document with heroes, none without; H2 ids and the
data island; H3 no halo, status hue, canvas, gradient or filter; H4 no transform or opacity at rest, as an
attribute or a style declaration (H3 and H4 read double-, single- and unquoted values, and the builder's sanitizer
uses the same patterns); H5 the ws1 block, the lightbox opt-out and live scripts that match a root; H6 one same-id
start/end marker pair per root and a relative `src` (a lone, misspelled, nested or mismatched marker fails here and
makes `build-hero` exit 1); H7 the stage role, label, tabindex and slider ARIA; H8 live scripts that never own a
loop. Advisories (`--strict` fails A4 below the part bar and A5 above the fail threshold): A1 heroes per document,
A2 camera parity, A3 one lit accent and one `data-focal`, A4 parts per tier, A5 budgets, A6 flow or pulse
animations. Thresholds: `checks-thresholds.json` → `figures`.

## 7. Verify checklist

- `--build-hero --audit`: audit passed (0 problems).
- `check-lines --theme both`: 0 floating ends in light and dark.
- `--check-figures --strict` clean.
- `check-runtime` clean, and the contact sheet reviewed at 1× and 4× in both themes. B18 runs first and fails a
  plate or drawing that the page's CSS collapsed; a page with no hero fails B0 heroes, and a step that throws fails
  B0 error instead of crashing the gate. B6 (no page or console errors) spans the reduced-motion page and both
  full-motion phases, so an error only the motion code raises still fails it. With an iso-kit figure on the page,
  `check-runtime` also runs B12 iso (the iso figure is grayscale apart from the one accent of `scripts/iso/accent.mjs`) and B2 mixed (the hero tours while the pointer
  sweeps each iso stage in turn: at most one outstanding rAF, both boards awake on the one `vpkFrameLoop`). B10
  runs once per theme on every page: a reduced-motion page, settled 1.5 s, makes 0 rAF calls over 2 s.
- A page with iso-kit figures and no hero skips the hero phases. `check-runtime` runs B6 (no page or console
  errors on the reduced-motion and the full-motion page, fonts loaded), B12 iso, B2 idle (0 rAF calls in 1 s once
  the figures settle, pointer parked) and B10. A page with no engine root still fails B0 heroes.
- Reduced motion is still; the figure still answers keys and pointer.
- Print shows the rest pose.

## 8. Re-vendoring and attribution

`scripts/anatomy/vendor/` holds verbatim upstream files from github.com/wheresryan22/anatomy (MIT License,
Copyright (c) 2026 Ryan), pinned in `scripts/anatomy/vendor/VENDOR.json`. Never edit them; replace the folder whole
with the `gh api` loop in VENDOR.json's `fetch` field (unsandboxed), update the hashes, then run
`OPENSSL_CONF=/dev/null node --test --test-name-pattern "T1" .agents/skills/vpk-html/scripts/anatomy/anatomy.test.mjs`.
The inlined runtime subset carries the MIT notice in a comment; the skill's `LICENSE` holds the attribution block.

## 9. Measured costs (dial indicator, 2026-10-13)

| Item | Value |
|---|---|
| Parts | 45 (45 solids), Figure tier |
| Audit | passed, about 0.5 s |
| Hero region | 97,282 B with the demo's `src` (SVG 92,529 B, live script 2,257 B, island 528 B) |
| CSS block / runtime block | 11,397 B / 28,939 B (40,336 B together); with flow and pulse 11,981 B (40,920 B, budget 40,960 B: 40 B left) |
| Demo page | 495,160 B |
| Line ends | 0 of 381 float, light and dark |

Both engines in one page (`assets/demos/demo-figure-engines.html`, iso rows re-measured 2026-10-22 after the iso kit became one style and took the accent, the motion at rest and the cast shadows; the page's own table prints these
figures, and `figures.test.mjs` F8b pins them):

| Item | Value |
|---|---|
| Iso figure (`figures/briefs/round-trip.json`, three plates on a tray) | region 29,653 B (SVG 28,173 B; the label chips and the accent marker add about 1.1 KB, the cast shadows about 3.2 KB) |
| Iso runtime block | 27,432 B (the one block, with the accent tokens and rules, the rest motion, the cast and received shadows and the entry hand-off; budget `ISO_BUDGET_BYTES` = 27,648 B in `scripts/iso/inline.mjs`) |
| Hero region, anatomy blocks | as above: 97,282 B; 40,332 B |
| Demo page | 554,405 B |

## 10. The hairline engine (`hairline`)

`scripts/hairline/` renders hairline's figures (Lucas Marques, MIT, `github.com/lucasmarkes/hairline`) from the
vendored upstream source. `vendor/` is verbatim: the 0.5.1 package source (33 figures) and the site's three Marks
pages (Vercel, Mastra, Notion), pinned with sha256s in `vendor/VENDOR.json`. Attribution: `scripts/hairline/NOTICE.md`.
Never edit `vendor/`; re-vendor with the `fetch` loop in VENDOR.json and rebuild. It is skipped by the repo's file-size
budget (`scripts/verify-file-size-budget.js` `VENDORED_DIRECTORIES`) and by the root `tsconfig.json`.

**Markup.** One plate per figure (`hairlinePlate()` in `scripts/hairline/inline.mjs`):

```html
<figure class="vpk-hairline-plate" data-vpk-engine="hairline" data-vpk-figure="hl-<id>" data-vpk-camera="45 30" data-vpk-block data-vpkh-no-lightbox>
	<div class="vpk-hairline-stage" data-vpk-review-ignore><div data-vpk-hairline="<id>" role="img" aria-label="…"></div></div>
	<p class="vpk-hairline-read" data-vpk-hairline-read data-vpk-review-ignore>rest</p>
	<figcaption>…</figcaption>
</figure>
```

The host's `aria-label` is upstream's label (riffle is a focusable `group`, the rest `img`); the figure keeps it,
because upstream's mount never overwrites an attribute the host already has. The figure's `onRead` caption goes to
the mono readout under the stage.

**Blocks.** `<style data-vpk-hairline-css>` in `<head>` is upstream's stylesheet (`core/styles.ts` `css()`), every
selector still inside `:where()`, with the raw-hex palette fallbacks removed and the five colours set from tokens.
`<!-- vpk-hairline:start --><script data-vpk-hairline-runtime>…<!-- vpk-hairline:end -->` before `</body>` is the
inlined `runtime/frame-loop.mjs` around one esbuild bundle of only the figures that page shows (tree-shaken;
13.9 KB for one figure, 35.4 KB for the eight on the Empty shelf, 134 KB for all 36). esbuild is pinned by the
lockfile, so `build-illustrations.mjs --check` is stable. The gallery builder (`renderHairlinePage`) writes both blocks.

**Theme.** Hairline's five colours map onto vpk tokens on `[data-vpk-engine="hairline"]`, so a figure follows the
page's `data-theme`:

| hairline | light (upstream) | light (vpk) | dark (upstream) | dark (vpk) |
|---|---|---|---|---|
| `plate` (face fill) | `#ffffff` | `--paper` | `#08090a` | `--paper` |
| `hi` (active stroke, dots) | `#232327` | `--ink` | `#d0d6e0` | `--ink` |
| `edge` (silhouettes) | `#a4a4ac` | `--ill-tone3` 85% + `--ill-ink50` | `#5b5d64` | `--ill-hatch` |
| `mid` (default stroke) | `#c3c3c9` | `--ill-tone3` 70% + `--ill-tone2` | `#3e3e44` | `--ill-tone3` |
| `lo` (creases, off dots) | `#e0e0e4` | `--ill-tone2` | `#29292d` | `--ill-tone2` |

The active part (`.hi`) takes the iso accent faces (`scripts/hairline/inline.mjs` TONE_CSS) with the neutral edge at rest;
its darker-accent outline is drawn only while the figure is hovered or focused, as on a hovered iso part. A faceless `.hi`
stroke (`.nf`) keeps the accent at rest, having no face to carry it.

**Motion.** Every figure ticks on `window.vpkFrameLoop`: `runtime/stage.mjs` re-exports `core/stage.ts` with
`register` replaced (`runtime/loop.mjs`), so upstream's own rAF loop, IntersectionObserver and reduced-motion query
are tree-shaken out. Reduced motion is upstream's module flag, written from the loop's query; springs and tweens
then land at once and the figure still answers the pointer. Upstream's `play` tour is not offered (`tour` is a stub).
Phosphor keeps upstream's idle loop while on screen with motion allowed, as on the site.

**check-html exemption.** `fade()` in `core/stage.ts` writes white `stop-color` gradient stops for the reflection
masks of riffle and phosphor. A mask is luminance, not paint, so the theme has nothing to map; `collectColorTokenIssues`
ignores exactly `"stop-color":"#fff"` inside `<script data-vpk-hairline-runtime>`. The SVG grammar check does not see
those gradients (they are created at run time, not in markup).

**Checks.** check-figures L1 (one stylesheet in `<head>` and one runtime block with a hairline root; none without),
L2 (each plate has a host with an `aria-label`, a readout, and `data-vpkh-no-lightbox`), E1–E3 with meta `hairline`,
and advisory A7 (`figures.hairline.runtimeWarnBytes`, `pageWarnBytes`).

**Gallery.** `GALLERY_PAGES` entries with `engine: "hairline"` render a shelf from `scripts/hairline/figures.mjs`
(site order; titles and summaries are the site's). Rebuild with `node .agents/skills/vpk-html/scripts/build-illustrations.mjs`
then `build.mjs --refresh-library` (both unsandboxed).

## 11. The anatomy WebGL engine (`anatomy-gl`)

The anatomy collection's ten WebGL machines (afterburner, glory hole, tokamak, plasma cutter, forge, turbofan, power
station, process pump, pouring steel, pool reactor) draw their flame, plasma, arcs, sparks, molten steel and Cherenkov
light with fragment shaders ray-marched against each figure's geometry every frame. No SVG kit can reproduce that, so these
ten figures are not iso-kit briefs: the page runs the original figures, vendored unmodified from `anatomy-figures@0.1.0`
(MIT, `scripts/anatomy-gl/vendor/`, pinned with sha256 in `VENDOR.json`; notice in `scripts/anatomy-gl/NOTICE.md`).

- **Style.** The vpk look comes in through upstream's own token API: the boot calls `render(host, { theme, tokens })` with
  `ANATOMY_GL_TOKENS` (`scripts/anatomy-gl/inline.mjs`), which points every `--anatomy-*` colour at the vpk ramp (paper,
  raised surface, tone 1 and 2 sides, hairlines at 60/38/20%, mono text) and makes the lit part the iso kit's orange accent.
  A lit solid's edge is neutral at rest and takes the accent only while the plate is hovered or focused (`ANATOMY_GL_LIT_CSS`,
  adopted into each figure's shadow root); faceless lit lines and wires keep the accent at rest.
  The shaders keep upstream's colours: the fire, plasma and light are the effect itself. The figure follows the page theme
  (`data-theme` on `<html>`) and remounts on a change; upstream's teardown releases its WebGL contexts.
- **Lifecycle.** A figure costs one or two WebGL contexts, and a browser keeps about sixteen per renderer process, shared by
  every tab of that process; past that it evicts the oldest, and upstream never recovers an evicted context. So the boot
  mounts a figure only when it is within `ANATOMY_GL_MOUNT_MARGIN` (one viewport) and tears it down, releasing its contexts,
  once it is beyond `ANATOMY_GL_UNMOUNT_MARGIN` (two viewports). A focused figure is never torn down, and an evicted figure
  that is still near is remounted (at most `ANATOMY_GL_MAX_RECOVERIES` times). Before the first mount, a light-DOM reserve at
  the figure's ratio (`ratio` in `figures.mjs`, equal to the vendored entry's export) holds the plate's height, and an
  emptied host keeps its last height, so mounting and unmounting never move the page. While a figure is mounted, upstream
  pauses its own frame loop off screen and rests under reduced motion.
- **Markup.** `figure[data-vpk-engine="anatomy-gl"]` with one host `[data-vpk-anatomy-gl="<slug>"]` (aria-label = the
  summary) inside the iso kit's ruled frame, and the house caption below; `data-vpkh-no-lightbox`. The figure draws its own
  corners (figure number, title, hint, live readout) and its own interaction (throttle, drag, keys) as upstream does.
- **Blocks.** `<style data-vpk-anatomy-gl-css>` in `<head>` (the accent pair and the plate CSS) and one
  `<!-- vpk-anatomy-gl:start -->…<!-- vpk-anatomy-gl:end -->` runtime block before `</body>`: an esbuild bundle of only the
  figures the page shows, offline. check-html skips upstream's built-in theme tables and run-time SVG inside that one script.
- **Meta.** `<meta name="vpk-figure-engine" content="anatomy-gl">`; `both` does not cover it.
- **Gallery.** The `GALLERY_PAGES` entry with `engine: "anatomy-gl"` ("Anatomy collection, WebGL") renders all ten from
  `scripts/anatomy-gl/figures.mjs`; their iso-kit briefs (`briefs/an-<slug>.json`) stay in the repo but are no longer shown.
