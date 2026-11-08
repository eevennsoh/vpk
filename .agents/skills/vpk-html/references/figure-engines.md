# Figure engines: iso kit, anatomy hero and hairline

Owner of engine choice, the anatomy hero contract, engine mixing, the hairline and anatomy-gl engines, and frame-cost measurement for [SKILL.md](../SKILL.md). Load when you pick an engine, build or check a hero, mount a vendored figure, or measure what a figure costs per frame. Iso-kit grammar is [illustrations.md](illustrations.md); time-driven motion is [figure-motion.md](figure-motion.md); concept and pointer behaviour is [figure-craft.md](figure-craft.md).

Contents: [1 Choosing an engine](#1-choosing-an-engine) · [2 Anatomy hero workflow](#2-anatomy-hero-workflow) · [3 The hero module contract](#3-the-hero-module-contract) · [4 vpk deltas](#4-vpk-deltas-from-upstream-anatomy) · [5 Mixing rules](#5-mixing-rules) · [6 Files and commands](#6-files-and-commands) · [7 Verify checklist](#7-verify-checklist) · [8 Re-vendoring](#8-re-vendoring-and-attribution) · [9 Measured costs](#9-measured-costs-dial-indicator-2026-10-13) · [10 Hairline](#10-the-hairline-engine-hairline) · [11 Anatomy WebGL](#11-the-anatomy-webgl-engine-anatomy-gl) · [12 Measure frame cost, never cap detail](#12-measure-frame-cost-never-cap-detail)

Record the engine in one meta tag. The question that picks it lives in [contract.md](contract.md) § Figure engine.

```html
<meta name="vpk-figure-engine" content="none|iso-kit|anatomy-hero|both|hairline|anatomy-gl">
```

`both` means iso kit plus anatomy hero; it never covers `hairline` or `anatomy-gl` (`FIGURE_ENGINES` in `scripts/figures/check-figures.mjs`). Every engine is built into this skill from vendored or ported upstream code, so never install or load the upstream anatomy, hairline or 3d-assembly-manual skills.

## 1. Choosing an engine

| | iso kit (`iso-kit`) | anatomy hero (`anatomy-hero`) | both (`both`) | hairline (`hairline`) |
|---|---|---|---|---|
| Use for | flows, stacks, exploded assemblies, request paths: several light figures | the one physical mechanism that carries the story, which the reader can work | heroes plus supporting iso figures | one of hairline’s 36 ready figures, shown as upstream draws it (§ 10) |
| Authoring cost | a JSON brief, minutes | a hero module: Figure tier 30–90 min, Hero tier 2–4 h | the sum | none: pick an id from `scripts/hairline/figures.mjs` |
| Weight | no size advisory (`checks-thresholds.json` → `iso` byte keys are `null`); one shared runtime block | no size advisory (`figures.heroWarnBytes` is `null`) | no total cap | no size advisory (`figures.hairline` keys are `null`) |
| Interaction | select, explode, step or scrub, no tour | a slider (pointer, keys, idle tour) or live-owned input | per figure | each figure’s own pointer answer (riffle also takes arrow keys); no `play` tour |
| Labels | diagrams: short leaders ending in an ink dot (numbered gutter tags on narrow stages); product-UI scenes: no text ([figure-fidelity.md § 2](figure-fidelity.md)) | nothing inside the drawing; plate corners and legend only outside story explainers ([paper-system.md](paper-system.md)) | per engine | none in the drawing; a mono readout under it |

Part-count tiers (`figures.parts`): § 2 step 1. With nobody to ask, use the iso kit.

## 2. Anatomy hero workflow

1. **Size it.** The tiers calibrate an advisory, not a limit: Figure 40–80 parts, Hero 80–150. Add every part the reference shows (§ 12). A part is a recorder item with at least one solid.
2. **Truth model first.** Write `model(input, data)` (pure) and `present(state, data)` (readout and ARIA value text). The readout always comes from `present(model(x))`.
3. **The object is the explanation.** Pick a real machine whose moving part shows the idea.
4. **Parts list** in world units at the shared 45/30 camera.
5. **Build once at rest.** Draw moving parts at their rest position; live code moves them by delta.
6. **Record and settle.** Every solid goes through `R.put({ name, at, svg, shapes: [R.solid(A.slab(…))] })`; the builder runs the vendored `settle` for painter’s order from real geometry.
7. **Plate.** Corners, legend keys and caption come from `hero.plate`.
8. **`live(ctx)`** moves parts with `ctx.offset`, rebuilds lines with `ctx.kit`, and shows `ctx.show(state)`.
9. **Verify** with § 7.

```js
// From scripts/anatomy/fixtures/carriage.hero.mjs build(): one recorder item per part, solids from real geometry.
const R = A.recorder(P);
const put = (name, at, svg, shapes, extra = {}) => R.put({ name, at, svg, shapes: shapes.map(shape => R.solid(shape)), ...extra });
put("plate", [0, 0, -4], S(k.slabOf(PLATE, -8, 8, P, 6), { tone: "mid" }), [A.slab(PLATE, -8, 8, { name: "plate" }, 6)]);
```

## 3. The hero module contract

Put `_figures/<id>.hero.mjs` next to the artifact. Start from the 12-part fixture `scripts/anatomy/fixtures/carriage.hero.mjs` or the demo `scripts/anatomy/examples/dial-indicator.hero.mjs`.

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

| Field | Rule (the builder fails the build by name otherwise) |
|---|---|
| `id` | `^[a-z][a-z0-9-]{0,39}$`, unique across engines |
| `model`, `present`, `live` | serialized with `Function.prototype.toString`: use only arguments, `ctx`, built-ins and locals. The builder replays `model` and `present` from source at rest (a slider also at both ends, the tour stops and nine inputs between) and fails if either throws or disagrees. `live` is checked by parse and by `check-runtime` |
| `data` | plain objects, arrays, strings, finite numbers, booleans, null. Rejected by path: `NaN`, `Infinity`, `-0`, `undefined`, functions, symbols, `BigInt`, cycles, array holes, class instances (`Date`, `Map`) |
| `stage.role` | `slider` (mount-owned input, `tabindex="0"`, `aria-valuemin/max/now/text`), `group` (live owns input on `ctx.stage`), `img` (static, no tabindex, no script) |
| ARIA | `aria-valuenow` holds the input; `aria-valuetext` holds `present(model(target)).valueText` |
| `stage.tour` | optional (`null` for none); non-empty `stops` of finite inputs in `[min, max]`; `dwell` > 0, `delay` and `resume` ≥ 0, defaults 2.2, 1.4, 3.6 s |
| `input.bigStep` | optional, finite > 0, default 5 steps |
| `stage.pointer` | optional (`null` for keys and tour only); `axis` `"x"` or `"y"`; `from` ≠ `to`, both in `[0, 1]`; `from > to` reverses |

The kit (`createKit()`) gives `k`, `G`, `T`, `A` (vendored iso-kit, lathe, tube, audit), `camera.fit` (always 45/30), `S`/`L`/`D` (solids, lines, dots; halos forced off), `fadedSvg` (stroke-opacity) and `faceTextSvg` (once per hero).

`ctx` gives `id root stage svg readout P data kit`, `part(name)`, `model(input)`, `present(state)`, `input` (slider: `min max step rest target touring`), `show(state)` (change-only readout), `offset(el, delta3)` (print-safe transform from rest), `announce(text)` (group role, polite, never from tick), `wake()`, `calm()`, and the helpers `follow`, `spring`, `settle`, `smooth`, `burst`.
Under `calm` the shown value jumps to the target and the figure still answers input. Live code never calls `requestAnimationFrame`, `IntersectionObserver` or `setInterval`, and never listens on `document`.

The slider tour starts `delay` after load, visits `stops` every `dwell`, pauses on hover, focus, press and off screen, resumes `resume` after the last input, and never runs under reduced motion. Clearing reduced motion mid-page brings it back after `resume` (`check-runtime` B15). Print lands the rest pose.

## 4. vpk deltas from upstream anatomy

| Upstream | vpk |
|---|---|
| colour tones | grayscale: the 29 `--anatomy-*` properties map to vpk tokens (`scripts/anatomy/tokens.mjs`); red, green and blue fall back to the base grey |
| face tones | the iso kit’s map, tops lightest. Light: top `--surface-raised`, near `--ill-tone1`, far `--ill-tone2`, deeper far `--ill-tone3`. Dark: top `--ill-tone2`, near `--ill-tone1`, far and deeper `--surface-sunken`. B8 compares top and near fills in both themes and checks the order top, near, far, deeper |
| halos, blur, gradients, WebGL, 3D turn | none (`fadeLineSvg` throws) |
| transforms at rest | none: no `transform` or `opacity` attribute at rest; engraved face text and the hint corner hide in print |
| plate | `1px solid var(--rule)`, 6 px radius, Geist Mono corners on a grid, 0.6 px hairlines (`--vpk-figure-stroke`). The hint wraps beside a long readout and stacks above it at ≤ 560 px (B14 at 320, 390, 600 px). Corner, legend and caption text clears 4.5:1 (B16). The plate’s figure is `display:block !important` so a template’s `figure{display:flex !important}` cannot collapse it (B18) |
| drawing size | ≤ 920 px wide and `100vh - 300px` tall, never below 240 px on viewports ≥ 480 px tall; under 480 px the cap is `100vh - 240px`, at least 120 px. Keyboard focus scrolls the plate into view with an 80 px margin (60 px when short) (B17, ten viewports incl. 200% zoom and 844×390) |
| `ISO_CSS`, `kitScript()` | never pasted: the CSS and runtime blocks are generated and drop vendored declarations the overrides make dead (T11) |

## 5. Mixing rules

- One camera: both engine roots carry `data-vpk-camera="45 30"` (`scripts/figures/camera.mjs`); check-figures A2 warns on a mismatch.
- One frame loop: `window.vpkFrameLoop` (`scripts/runtime/frame-loop.mjs`), inlined by each runtime.
- One CSS and one runtime block per engine. Anatomy rules are scoped to `:where([data-vpk-engine="anatomy-hero"])`; bare `.iso-*` classes are anatomy’s, `vpk-iso-*` the iso kit’s.
- Each engine keeps its own label grammar and stroke weight (§ 1); tone parity makes one system.
- Interactive roots carry `data-vpkh-no-lightbox`; static iso figures stay zoomable.
- Each hero root is one atomic review block (`data-vpk-block`; the inner figure is `data-vpk-review-ignore`), and `build-hero` carries its `data-vpk-id`/`data-vpk-revision` over byte-exact.

| Wrong | Right |
|---|---|
| a figure script calls `requestAnimationFrame(step)` beside the hero | `window.vpkFrameLoop.register(stage, tick)`, so B2 mixed sees at most one outstanding rAF |
| the iso root carries `data-vpk-camera="45 35"` to fit a tall brief | both roots `"45 30"`; refit with `camera.fit`, never the angle |

The tell: B2 mixed counts two rAF callbacks, or check-figures A2 warns on the camera.

## 6. Files and commands

`build-hero` writes these region markers; `src` is relative to the document’s folder.

```html
<!-- vpk-anatomy-hero:start id="dial" src="_figures/dial.hero.mjs" -->
<!-- vpk-anatomy-hero:end id="dial" -->
```

The builder fills the region (root `div[data-vpk-engine="anatomy-hero"][data-vpk-figure][data-vpk-camera][data-vpk-anatomy-tier][data-vpk-anatomy-parts]`, plate, data island, live script), inserts the meta when absent, and refreshes `<style data-vpk-anatomy-css>` in `<head>` and `<script data-vpk-anatomy-runtime>` before `</body>`.

```bash
node .agents/skills/vpk-html/scripts/build.mjs --build-hero artifacts/vpk-html/<slug>/<slug>.html --audit
node .agents/skills/vpk-html/scripts/build.mjs --build-hero artifacts/vpk-html/<slug>/<slug>.html --check
node .agents/skills/vpk-html/scripts/anatomy/build-hero.mjs --audit-only artifacts/vpk-html/<slug>/_figures/<id>.hero.mjs
node .agents/skills/vpk-html/scripts/build.mjs --check-figures artifacts/vpk-html/<slug>/<slug>.html --strict
node .agents/skills/vpk-html/scripts/anatomy/check-lines.mjs artifacts/vpk-html/<slug>/<slug>.html --theme both
node .agents/skills/vpk-html/scripts/figures/check-runtime.mjs artifacts/vpk-html/<slug>/<slug>.html --out output/vpk-html/figures/<slug>
node .agents/skills/vpk-html/scripts/figures/build-engine-demo.mjs --page anatomy|engines|all   # then --check
node .agents/skills/vpk-html/scripts/build.mjs --check-iso artifacts/vpk-html/<slug>/<slug>.html --strict   # documents with both engines
```

- A failed `--build-hero --audit` writes nothing and exits 1 (“not written”), so no document keeps a hero that failed its audit.
- `check-lines`, `check-runtime` and `build-engine-demo` run Chromium: run them unsandboxed.
- `assets/demos/demo-figure-engines.html` is the worked example under meta `both`: the iso brief `scripts/figures/briefs/round-trip.json` and the dial hero. Rebuild it whenever the iso kit’s output changes; its table prints measured bytes.
- The check ids (E1–E3, H1–H8, A1–A7, L1–L2) and their thresholds live in [quality-gates.md](quality-gates.md); read it when a check fails.

## 7. Verify checklist

| Check | Passes when |
|---|---|
| `--build-hero --audit` | 0 problems |
| `check-lines --theme both` | 0 floating ends in light and dark |
| `--check-figures --strict` | Clean |
| `check-runtime` | Clean, and you reviewed its contact sheet at 1× and 4× in both themes. It runs B18 (collapsed plate) first; B0 fails a page with no engine root or a step that throws; B6 (no page or console errors) spans the reduced-motion page and both full-motion phases; B10 (reduced motion, settled 1.5 s, 0 rAF calls over 2 s) runs once per theme |
| `check-runtime`, iso figure on the page | B12 (grayscale apart from the `scripts/iso/accent.mjs` accent) and B2 mixed (the hero tours while the pointer sweeps each iso stage: at most one outstanding rAF, both on `vpkFrameLoop`). Iso only, no hero: B6, B12, B2 idle (0 rAF in 1 s once settled) and B10 |
| Reduced motion and print | The figure is still and still answers keys and pointer; print shows the rest pose |

## 8. Re-vendoring and attribution

`scripts/anatomy/vendor/` holds verbatim files from github.com/wheresryan22/anatomy (MIT License, Copyright (c) 2026 Ryan), pinned in `scripts/anatomy/vendor/VENDOR.json`. Never edit them. Replace the folder whole with the `gh api` loop in VENDOR.json’s `fetch` field (unsandboxed), update the hashes, then run:

```bash
OPENSSL_CONF=/dev/null node --test --test-name-pattern "T1" .agents/skills/vpk-html/scripts/anatomy/anatomy.test.mjs
```

The inlined runtime subset carries the MIT notice in a comment; the skill’s `LICENSE` holds the attribution block.

## 9. Measured costs (dial indicator, 2026-10-13)

The live source for the two-engine page is the “How they share the page” table in `assets/demos/demo-figure-engines.html`, which `figures.test.mjs` F8b pins to the builders’ output.

| Item | Value |
|---|---|
| Dial parts | 45 solids, Figure tier; audit passes in about 0.5 s |
| Dial line ends | 0 of 381 float, light and dark |
| Hero region (demo, 2026-11-07) | 95.0 KB: SVG 90.4 KB, live script 2.2 KB, data island 0.5 KB |
| Anatomy CSS and runtime blocks (2026-11-07) | 39.4 KB: CSS 11.1 KB, runtime 28.3 KB; budget `ANATOMY_BLOCKS_BUDGET_BYTES` 40,960 B (`scripts/anatomy/runtime.mjs`) |
| Iso figure region, round-trip tray (2026-11-07) | 30.7 KB: SVG 28.7 KB |
| Iso runtime block (2026-11-07) | 50.1 KB; budget `ISO_BUDGET_BYTES` 53,248 B (`scripts/iso/inline.mjs`, whose header comment logs each change) |
| Two-engine demo page (2026-11-07) | 570.2 KB |

## 10. The hairline engine (`hairline`)

`scripts/hairline/` renders hairline’s figures (Lucas Marques, MIT, `github.com/lucasmarkes/hairline`) from vendored upstream source. `vendor/` is verbatim: the 0.5.1 package source (33 figures) and the site’s three Marks pages (Vercel, Mastra, Notion), pinned with sha256 in `vendor/VENDOR.json`; attribution in `scripts/hairline/NOTICE.md`. Never edit `vendor/`; re-vendor with the `fetch` loop and rebuild.

**Markup.** One plate per figure, from `hairlinePlate()` in `scripts/hairline/inline.mjs`:

```html
<figure class="vpk-hairline-plate" data-vpk-engine="hairline" data-vpk-figure="hl-<id>" data-vpk-camera="45 30" data-vpk-block data-vpkh-no-lightbox>
	<div class="vpk-hairline-stage" data-vpk-review-ignore><div data-vpk-hairline="<id>" role="img" aria-label="…"></div></div>
	<p class="vpk-hairline-read" data-vpk-hairline-read data-vpk-review-ignore>rest</p>
	<figcaption>…</figcaption>
</figure>
```

The host’s `aria-label` is upstream’s label (riffle is a focusable `group`, the rest `img`); upstream’s mount never overwrites it. The figure’s `onRead` caption goes to the mono readout.

**Blocks.** `<style data-vpk-hairline-css>` in `<head>` is upstream’s stylesheet (`core/styles.ts` `css()`), every selector still inside `:where()`, raw-hex fallbacks removed and the five colours set from tokens. `<!-- vpk-hairline:start --><script data-vpk-hairline-runtime>…<!-- vpk-hairline:end -->` before `</body>` is `runtime/frame-loop.mjs` around one tree-shaken esbuild bundle of the page’s figures (13.9 KB for one, 35.4 KB for the eight on the Empty shelf, 134 KB for all 36). `renderHairlinePage` writes both blocks.

**Theme.** The five colours map onto vpk tokens on `[data-vpk-engine="hairline"]`, so a figure follows `data-theme`:

| hairline | light (upstream) | light (vpk) | dark (upstream) | dark (vpk) |
|---|---|---|---|---|
| `plate` (face fill) | `#ffffff` | `--paper` | `#08090a` | `--paper` |
| `hi` (active stroke, dots) | `#232327` | `--ink` | `#d0d6e0` | `--ink` |
| `edge` (silhouettes) | `#a4a4ac` | `--ill-tone3` 85% + `--ill-ink50` | `#5b5d64` | `--ill-hatch` |
| `mid` (default stroke) | `#c3c3c9` | `--ill-tone3` 70% + `--ill-tone2` | `#3e3e44` | `--ill-tone3` |
| `lo` (creases, off dots) | `#e0e0e4` | `--ill-tone2` | `#29292d` | `--ill-tone2` |

The active part (`.hi`) takes the iso accent faces (`TONE_CSS` in `scripts/hairline/inline.mjs`) with a neutral edge at rest; its darker-accent outline shows only while the figure is hovered or focused. A faceless `.hi` stroke (`.nf`) keeps the accent at rest.

**Motion.** Every figure ticks on `window.vpkFrameLoop`: `runtime/stage.mjs` re-exports `core/stage.ts` with `register` replaced (`runtime/loop.mjs`), so upstream’s rAF loop, IntersectionObserver and reduced-motion query tree-shake out. The loop’s query writes upstream’s reduced-motion flag; springs and tweens then land at once and the figure still answers the pointer. `tour` is a stub, so there is no `play` tour. Phosphor keeps upstream’s idle loop while on screen with motion allowed.

**check-html exemption.** `fade()` in `core/stage.ts` writes white `stop-color` stops for riffle’s and phosphor’s reflection masks. A mask is luminance, not paint, so `collectColorTokenIssues` ignores exactly `"stop-color":"#fff"` inside `<script data-vpk-hairline-runtime>`. The SVG grammar check never sees those run-time gradients.

**Checks.** check-figures L1 (one stylesheet and one runtime block with a hairline root, none without), L2 (each plate has a labelled host, a readout and `data-vpkh-no-lightbox`), E1–E3 with meta `hairline`, advisory A7.

**Gallery.** `GALLERY_PAGES` entries with `engine: "hairline"` render a shelf from `scripts/hairline/figures.mjs` in site order with the site’s titles. Rebuild with `node .agents/skills/vpk-html/scripts/build-illustrations.mjs`, then `build.mjs --refresh-library` (both unsandboxed).

## 11. The anatomy WebGL engine (`anatomy-gl`)

Ten anatomy machines (afterburner, glory hole, tokamak, plasma cutter, forge, turbofan, power station, process pump, pouring steel, pool reactor) ray-march flame, plasma, arcs, sparks, molten steel and Cherenkov light in fragment shaders every frame. The figures are vendored unmodified from `anatomy-figures@0.1.0` (MIT, `scripts/anatomy-gl/vendor/`, sha256 in `VENDOR.json`, notice in `scripts/anatomy-gl/NOTICE.md`).

- **Style.** The boot calls `render(host, { theme, tokens })` with `ANATOMY_GL_TOKENS` (`scripts/anatomy-gl/inline.mjs`): every `--anatomy-*` colour points at the vpk ramp (paper, raised surface, tone 1 and 2 sides, `--ill-line` at 100/60/38/20% into paper, mono text) and the lit part takes the iso orange accent. A lit solid’s edge is neutral at rest and accented only while hovered or focused (`ANATOMY_GL_LIT_CSS`, adopted into each shadow root); faceless lit lines keep the accent. Shaders keep upstream’s colours. The figure follows `data-theme` on `<html>` and remounts on a change.
- **Lifecycle.** A figure holds one or two WebGL contexts; a renderer process keeps about 16 across its tabs and evicts the oldest, which upstream never recovers. Never tear down a focused figure. A light-DOM reserve at the figure’s `ratio` (`figures.mjs`) holds the height before mount and an emptied host keeps its last height, so the page never moves.
- **Markup.** `figure[data-vpk-engine="anatomy-gl"]` with one host `[data-vpk-anatomy-gl="<slug>"]` (aria-label = the summary) inside the iso ruled frame, house caption below, `data-vpkh-no-lightbox`. The figure draws its own corners and interaction (throttle, drag, keys).
- **Blocks.** `<style data-vpk-anatomy-gl-css>` in `<head>` and one `<!-- vpk-anatomy-gl:start -->…<!-- vpk-anatomy-gl:end -->` block before `</body>`: an offline esbuild bundle of the page’s figures. check-html skips upstream’s theme tables and run-time SVG inside that script. Meta `content="anatomy-gl"`; `both` does not cover it.
- **Gallery.** The `GALLERY_PAGES` entry with `engine: "anatomy-gl"` renders all ten from `scripts/anatomy-gl/figures.mjs`.

| Lifecycle constant (`scripts/anatomy-gl/inline.mjs`) | Value | Effect |
|---|---|---|
| `ANATOMY_GL_MOUNT_MARGIN` | `100% 0px` | mount when within one viewport |
| `ANATOMY_GL_UNMOUNT_MARGIN` | `200% 0px` | tear down beyond two viewports, unless focused |
| `ANATOMY_GL_MAX_RECOVERIES` | 3 | remounts of an evicted near figure |

## 12. Measure frame cost, never cap detail

Keep every part, layer and byte the figure needs to match its reference, and a document may carry several heroes. The runtime byte budgets (§ 9) cover vendored kit code, never figure parts or layers. When motion stutters, measure where the frame goes and fix that path; the fix is never “draw less”. How to draw surface detail cheaply is [figure-fidelity.md](figure-fidelity.md); load it before you add per-surface line work.

| Measure | How | Budget |
|---|---|---|
| Presented frames | count `Display::DrawAndSwap` in a `viz` trace between `performance.mark()` phase marks; rAF counts mislead both ways | one swap per display refresh while motion runs: 120 per s at 120 Hz, 60 per s at 60 Hz |
| Main-thread work per frame | top-level `FunctionCall` + `UpdateLayoutTree` + `Layout` durations on the renderer main thread, summed per swap interval; p50 and p95 from the snippet below | p95 ≤ 8.3 ms at 120 Hz, ≤ 16.7 ms at 60 Hz; script, style and layout together, so a fast `render()` cannot hide a slow restyle |
| Restyle size | `UpdateLayoutTree` `elementCount` from the same trace | flat across a moving phase; a spike names the subtree you restyle |
| Idle | a settled reduced-motion page | 0 rAF over 2 s (B10) |

```js
// Headless Chromium on the real GPU (macOS flags); run unsandboxed. Keep motion running for the whole phase: a still hold draws no swaps.
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(fileUrl);
await browser.startTracing(page, { categories: ["viz", "blink.user_timing", "devtools.timeline"] });
await page.evaluate(() => performance.mark("phase:start"));
for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 150); await page.waitForTimeout(100); } // drive the real interaction: scroll, play or drag
await page.evaluate(() => performance.mark("phase:end"));
const { traceEvents } = JSON.parse(String(await browser.stopTracing()));
const mark = name => traceEvents.find(e => e.name === name).ts;
const inPhase = e => e.ts >= mark("phase:start") && e.ts <= mark("phase:end");
const swaps = traceEvents.filter(e => e.name === "Display::DrawAndSwap" && inPhase(e)).map(e => e.ts);
const spanS = (swaps.at(-1) - swaps[0]) / 1e6; // first to last swap, never the phase's wall time
const main = traceEvents.find(e => e.name === "Layout" && inPhase(e)).tid; // renderer main thread
const work = traceEvents.filter(e => e.tid === main && e.dur && inPhase(e) && ["FunctionCall", "UpdateLayoutTree", "Layout"].includes(e.name)).sort((a, b) => a.ts - b.ts);
const top = []; let end = -Infinity;
for (const e of work) if (e.ts >= end) { top.push(e); end = e.ts + e.dur; } // drop forced layout nested inside script, so nothing counts twice
const frameMs = swaps.slice(1).map((ts, i) => top.filter(e => e.ts >= swaps[i] && e.ts < ts).reduce((ms, e) => ms + e.dur / 1000, 0)).sort((a, b) => a - b);
const pct = q => frameMs[Math.min(frameMs.length - 1, Math.floor(q * frameMs.length))].toFixed(2);
console.log({ fps: ((swaps.length - 1) / spanS).toFixed(1), p50Ms: pct(0.5), p95Ms: pct(0.95) });
```

Too little: cut the wall to 40 tiles and drop inner outlines because the scroll felt heavy. Right: keep every tile; trace shows each depth re-sort re-appending all surfaces, which restyles each subtree with its face detail; move only out-of-place surfaces (`eu26-scene-live.mjs:428-446`) and re-measure the same phase. The tell: a commit that removes detail with no trace numbers before and after.
