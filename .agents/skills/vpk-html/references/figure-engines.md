# Figure engines: iso kit and anatomy hero

vpk-html draws technical figures with two engines that share one camera, one frame loop and one face-tone map,
so one document may use either or both. This file owns the anatomy hero and the mixing rules; the iso kit's
own grammar lives in `references/illustrations.md`. SKILL.md step 2 asks the engine question and records the
answer in `<meta name="vpk-figure-engine" content="none|iso-kit|anatomy-hero|both">`.

Both engines are built into this skill. The upstream anatomy, hairline and 3d-assembly-manual code is vendored or ported
here, and their authoring guidance is in [figure craft](figure-craft.md); never install or load those skills.

## 1. Choosing an engine

| | iso kit (`iso-kit`) | anatomy hero (`anatomy-hero`) | both (`both`) |
|---|---|---|---|
| Use for | flows, stacks, exploded assemblies, request paths: several light figures | the one physical mechanism that carries the story, which the reader can work | one hero plus supporting iso figures |
| Authoring cost | a JSON brief, minutes | a hero module: Figure tier 30–90 min, Hero tier 2–4 h | the sum |
| Weight | ≤ 60 KB SVG per figure (≤ 120 KB dense), one runtime block within `ISO_BUDGET_BYTES` (`scripts/iso/inline.mjs`) | hero region warn > 300 KB, blocks ≤ 40 KB together | all figure regions warn > 600 KB |
| Interaction | select or explode behaviour, no tour | a slider (pointer, keys, idle tour) or live-owned input | per figure |
| Labels | short leaders ending in an ink dot, near the part (numbered gutter tags on narrow stages); the kit has one style, `manual` | plate corners (`Fig n`, title, hint, live readout) and a legend; no leaders or balloons inside the drawing | per engine |

Rules: never start an Epic tier; at most one anatomy hero per document; the Hero tier (80–150 parts) only on an
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
