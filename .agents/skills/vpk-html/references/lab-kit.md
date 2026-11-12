# vpk-lab kit

Owner of the lab kit for [SKILL.md](../SKILL.md). Load when you build a case study, film or lab.

Contents: [Contract](#contract) · [Render the IR, then write prose outside the regions](#render-the-ir-then-write-prose-outside-the-regions) · [Markup contract](#markup-contract) · [Film data](#film-data) · [Labs](#labs) · [Every lab, iso figure and hero shares one frame loop](#every-lab-iso-figure-and-hero-shares-one-frame-loop) · [Decision 2: lab canvases paint with grayscale tokens only](#decision-2-lab-canvases-paint-with-grayscale-tokens-only) · [Decision 1: kit keys never fight the review UI](#decision-1-kit-keys-never-fight-the-review-ui) · [Decision 4: build the hero, then iso, then the kit](#decision-4-build-the-hero-then-iso-then-the-kit) · [Keyboard and accessibility](#keyboard-and-accessibility) · [Block, size and checks](#block-size-and-checks)

The lab kit turns a motion case study into something a reader can check: a captured film with a cue sheet and chapters, a Gantt that follows the film’s clock, and interactive labs that run the real maths behind the work. It ships as one inlined block, so a document stays a single offline HTML file.

Template: `assets/templates/motion-case-study.html`. Demo: `assets/demos/demo-motion-case-study.html`. Playbook: [motion-case-study](playbooks/motion-case-study.md). Film capture, encoding and embedding: [media pipeline](media-pipeline.md).

## Contract

Lock these before drafting ([SKILL.md § Phase A](../SKILL.md#phase-a-frame)). They extend the shared contract in [contract](contract.md):

| Item | What to record |
| --- | --- |
| Film source | A supplied MP4 path, or a capture: URL plus a hold hook (`window.__vpkRehearsal.hold(t)`) or a screencast driver; fps, viewport, segments, film width. |
| Budget | Full only, or full plus the automatic lite copy (default: automatic, written by `embed.mjs` when the file is over 1,572,846 B). |
| Labs | For each: an `id`, a `kind` (`time` or `simulation`), a title, and the **source file:lines of the maths it ports**. The source is required; it is shown in `[data-vpk-lab-source]`. |
| Figure engine | Asked once through the shared contract question; labs are not an engine. Recorded as `<meta name="vpk-figure-engine">` and `brief.figure_engine`. |
| Hue exception | None by default. Product colour needs an `explicit_deviations` entry and `data-vpk-lab-swatches="<reason>"` (Decision 2 below). |

The content IR is `<slug>.content.json` with `type: "motion-case-study"` (schema `references/schemas/motion-case-study.json`, example `references/schemas/examples/motion-case-study.content.json`).

## Render the IR, then write prose outside the regions

| Step | Do |
| --- | --- |
| 1 | Copy the template to `artifacts/vpk-html/<slug>/<slug>.html` and write `<slug>.content.json` |
| 2 | Render the structured parts from the IR (cue sheet, process timeline, Gantt, layer stack, discard deck, each lab’s title and source line, the content island and the authored film data): `node .agents/skills/vpk-html/scripts/lab/render-case-study.mjs <slug>.content.json --into <slug>.html` |
| 3 | Write the prose outside the regions, and each lab in the `<script data-vpk-lab-doc>` block (Labs below) |
| 4 | Capture or supply the film, encode it and embed it from `<slug>/_film/` ([media pipeline](media-pipeline.md)) |
| 5 | If you replaced the block or edited the kit, refresh it: `node .agents/skills/vpk-html/scripts/lab/kit.mjs --inject <slug>.html` |
| 6 | Run step 5's checks, then `kit.mjs --check` and `render-case-study.mjs … --check` |

Regions sit between `<!-- vpk-region <name> -->` and `<!-- /vpk-region <name> -->` (`process`, `gantt`, `cues`, `layers`, `discards`). Re-rendering replaces only regions, lab titles and source lines, the content island and the film data’s authored keys (fps, chapters, posterTime; clock segments until a film is embedded). Prose is never touched and no `data-vpk-id` is written. `--check` ignores `data-vpk-id`/`data-vpk-revision`, and prints the `--stamp` hint when a `<slug>.vpk-blocks.json` ledger exists. Cue, lab and timeline-kind ids must be unique: the renderer refuses a repeat and writes nothing, and `kit.mjs --check` warns about cue buttons that share a `data-vpk-cue`. `render-case-study.mjs` exports the rule as `caseStudyContentIssues` (sidecar) and `checkCaseStudyHtml` (island). `build.mjs --check-content` runs the same rule (`caseStudyContentIssues`) on the sidecar and `checkCaseStudyHtml` on the island, so a repeated id fails in every mode. `render-case-study.mjs <ir> --into <doc> --check` applies it as well (it exits 1 on a repeat).

## Markup contract

Every kit root carries a static `data-vpkh-no-lightbox` (the enhancer never zooms or lightboxes inside it, and mutations inside it never wake the enhancer). `kit.mjs --check` warns when one is missing.

| Root | Inside it |
| --- | --- |
| `div.vpk-film[data-vpk-film][id]` | `video[data-vpk-film-video]` (`muted playsinline preload="auto"`, never `autoplay`), `[data-vpk-film-bigplay]`, `[data-vpk-film-empty]`, `[data-vpk-film-play]`, `[data-vpk-film-step="±1"]`, `[data-vpk-film-rate]` buttons with `data-rate`, `[data-vpk-film-time]`, `input[data-vpk-film-scrub]`, `[data-vpk-film-ticks]`, `[data-vpk-film-chapters]`, the beat panel `[data-vpk-beat]` with `[data-vpk-beat-act|clock|title|body|nums]`, and the film-data island. `data-nudge` sets the arrow-key step (0.5 s). |
| `div.vpk-cues[data-vpk-cues]` | `button.vpk-cue[data-vpk-cue="<id>"]` with `data-act` and `data-film`, or `data-clock="<segment id>"` plus `data-t`; children `.vpk-cue-t` (left empty: the kit fills it), `.vpk-cue-name`, `.vpk-cue-nums`, `.vpk-cue-body` (often `hidden`; the beat panel shows it) and `canvas.vpk-cue-thumb`. `data-film-target` picks the film. |
| `div.vpk-gantt[data-vpk-gantt]` | Built by `scripts/lab/gantt.mjs`: `role="slider"`, `tabindex="0"`, mapping attributes `data-clock data-t0 data-t1 data-x0 data-x1`, an `aria-describedby` description and an `aria-hidden` SVG whose `line[data-vpk-gantt-head]` follows the clock. |
| `div.vpk-lab[data-vpk-lab="<id>"]` | `canvas[data-vpk-lab-canvas]`, `[data-vpk-param="<name>"]` inputs, `output[data-vpk-out="<name>"]` (`data-format` `fixed1 fixed2 fixed3 x s int pt`), `[data-vpk-lab-play]` (`data-pause-label`), `[data-vpk-lab-reset]`, `[data-vpk-lab-rate]`, `[data-vpk-readout]`, `[data-vpk-lab-note]` and the required `[data-vpk-lab-source]`. |
| `div.vpk-filters[data-vpk-filters="<scope>"]` | `button[data-vpk-filter="all\|<kind>"]`; filters `[data-vpk-filter-scope="<scope>"] [data-kind]` and empties `[data-vpk-filter-group]`. |
| `div.vpk-flip-deck[data-vpk-flip-deck]` | `button.vpk-flip[data-vpk-flip]` with `[data-face="front"]` and `[data-face="back"]`. |
| `div.vpk-layers[data-vpk-layers]` | `button[data-vpk-select="<name>"][data-index]` holding `.vpk-select-title` and `.vpk-select-body`, the `[data-vpk-select-target="<name>"]` SVG of `.vpk-layer-plane[data-index]`, and the `[data-vpk-select-detail="<name>"]` mirror. |

Runtime mirrors of authored text carry `data-vpk-review-ignore` in the markup: `[data-vpk-beat]`, `[data-vpk-film-time]`, `[data-vpk-readout]`, `[data-vpk-lab-note]`, `[data-vpk-select-detail]` and `[data-vpk-out]`. Everything the runtime creates (chapter buttons, ticks, cue-time spans, readout cells) carries `data-vpk-generated`. Build-time output inside a kit root, such as embed’s lite note, carries only `data-vpk-review-ignore`, because init removes `[data-vpk-generated]`.

## Film data

`<script type="application/json" data-vpk-film-data>` inside the film root, written with `serializeJsonIsland`:

```
{ version: 1, fps, duration, posterTime?,
  segments: [{ id, label, kind: "screencast" | "hold" | "virtual" | "real", film: [start, end],
               clock: { kind: "real" } | { kind: "linear", start, rate } | { kind: "samples", samples: [[filmLocal, value], …] } }],
  chapters: [{ label, film }],
  marks?: { name: film } }
```

It equals the `film` fields of `capture.json`, except that `duration` comes from ffprobe. The film readout and beat clock show the clock of the segment under the playhead; a cue with `data-clock` + `data-t` resolves through that segment (`vpkLab.filmFromClock`). If the data has no segment with that id, the cue or Gantt never seeks, so `embed.mjs` refuses such a film and `kit.mjs --check` warns about it (`collectFilmClockIssues`). The IR keeps unit-suffixed names (`film_s`, `t_s`, `clock_offset_s`); the runtime data does not. `render-case-study.mjs` is the only translation.

`posterTime` is the film time the poster shows. Embed writes it whenever it bakes a poster, and until the first play or seek the film readout, the beat panel, the Gantt head and the scrub’s thumb report it (a poster of film 3.30 s reads "film 3.30 s", never "film 0.00 s", and the thumb sits at 3.30 s of the bar). The authored scrub says `max="1"`, and a range input clamps its value to its max, so the kit sets the scrub’s max to the film length before its first render (from the film data, then from the video’s metadata with a re-render); without that the thumb stuck at 0.999. A lite copy that dropped the film for a chapter still strip ([media pipeline](media-pipeline.md), Size budget) has no video `src`, so the kit shows the empty state, and the film bar is `hidden`.

## Labs

Document code registers labs through the queue, so it may run before or after the kit block:

```js
(self.vpkLabQueue ??= []).push(["easing", {
	time: { param: "t", min: 0, max: 1.95, reducedMotion: 1.95 },   // a time lab; omit for a simulation lab
	setup(api) { api.state.geometry = { … }; },
	draw(api) { const { ctx, w, h, tokens: c } = api; ctx.fillStyle = c.raised; … },   // required
	readout(api) { return [["clock", `${vpkLab.fixed(api.t)} s`]]; },
	notes(api) { return { text: "…", warn: false }; },
}]);
```

- **Time labs** advance `t` (the `time.param` input) through the shared loop up to `max` (`loop: true` wraps). Moving the slider pauses and seeks. Under reduced motion, Play draws `time.reducedMotion ?? max` once.
- **Simulation labs** define `step(dt, api)`; returning `false` stops. Play reruns `setup`. Under reduced motion, Play draws `reducedMotionState(api)` once.
- `api` = `{ root, id, ctx, w, h, dpr, canvases, t, params, state, tokens, alpha, mix, rate, frame, scale, px(n), requestDraw(), play(), pause(), seek(t), reset(), running }`. Inputs and theme changes call `requestDraw()`, one draw per frame.
- **Narrow screens.** A ResizeObserver keeps `api.scale` (rendered CSS px per canvas unit) current and redraws on change. `api.px(n)` is `n` CSS px in canvas units, never below `n`, so ``ctx.font = `${api.px(12)}px …` `` and `lineWidth = api.px(1)` keep their size on a phone and change nothing on wide screens. Add `data-vpk-canvas-min-height="<css px>"` to a canvas to let its logical height (never its width) grow so it renders at least that tall; lay out from `api.h`. The template’s sample lab uses both (200 px).
- Readout cells are created once and then updated through `Text.data`; readout and note regions are `aria-live="polite"` while idle and `off` while running. On `beforeprint` a lab pauses on its current frame.
- Canvases keep their authored size in `data-vpk-canvas-size` and render at `min(2, devicePixelRatio)`. This attribute is a recorded deviation from WS0 C1 ("no persistent state attributes"; accepted at B2, decision 11): a DOM-serialised copy re-initialises, and without the stored authored size the kit would read the already doubled `width` and `height` as authored and double the canvas again on every reload. It is the only state attribute the kit leaves on a canvas, and `setupCanvas` writes it only when it is absent.

`window.vpkLab` (frozen): `version, ready, clamp, lerp, progress, smooth, cubicBezier, EASE, spring, springStats, mulberry32, hash01, keyframes, fixed, signed, tokens, resolveColor, alpha, mix, swatches, onTheme, loop, makeLoop, reducedMotion, setupCanvas, roundRect, lab, film, clockAt, filmFromClock, inspect`. `EASE` holds `vpkOut`, `vpkInOut` (the skill’s motion tokens) and the ADS curves `outBold`, `inOut`, `in`, `outPractical`, `unfold`, plus `linear`. `vpkLab.ready` resolves when init has run and runtime thumbnails are drawn, or after 4 s; `pdf.mjs` waits for it. Thumbnails start at the first idle moment after init (`requestIdleCallback`, at most 1 s later), or sooner when the cue list comes within 200 px of the viewport. Reading `vpkLab.ready` starts them at once, and so do `beforeprint` and print media (`film(…).drawThumbs()` is the per-film trigger). The idle start is what a reader’s own Cmd+P needs: the browser snapshots the page right after `beforeprint`, before any seek can finish, so a print started from that event alone would come too late. An unscrolled page therefore prints drawn thumbnails about a second after it opens, and `ready` settles in well under the cap: about 0.3 s for the demo’s seven cues. A canvas still waiting carries `.is-pending`, and print hides it, so it never prints as a grey box.

## Every lab, iso figure and hero shares one frame loop

| Wrong | → Right |
| --- | --- |
| A lab's own `requestAnimationFrame` chain | → `vpkLab.loop`, which is `window.vpkFrameLoop` |
| A loop started at init | → registered lazily, on first Play |
| A playing film driven by the loop | → `requestVideoFrameCallback`, the loop only as fallback |

The block inlines `scripts/runtime/frame-loop.mjs` first, so `window.vpkFrameLoop` exists whichever figure engines share the page. Labs register with it lazily, on first Play; the loop runs one animation-frame chain and one IntersectionObserver for every lab, iso figure and anatomy hero, pauses boards that are off screen, and clamps `dt` to 0.05 s. `vpkLab.loop` is that object; `vpkLab.makeLoop(element, step)` keeps EU26's semantics (`step(dt) === false` stops; `start()` never steps synchronously). The film follows `requestVideoFrameCallback` (the loop is its fallback), so a playing film costs no loop board.

## Decision 2: lab canvases paint with grayscale tokens only

| Wrong | → Right |
| --- | --- |
| `ctx.fillStyle = "#ffab00"` | → `ctx.fillStyle = api.tokens.focal` (or another `vpkLab.tokens` entry) |
| A status hue in canvas code | → kit chrome only, such as the `.is-warn` note |
| Product colour drawn straight onto the canvas | → `vpkLab.swatches()` from an opted-in external-asset SVG, plus an `explicit_deviations` entry |

Lab canvases, the Gantt and drawn thumbnail placeholders are figures. They paint with `vpkLab.tokens` only: `ink muted subtle rule ruleStrong paper raised sunken tone1 tone2 tone3 line guide guideDashed hatch ink50 focal inverse` (8-digit hex, re-read on every theme change) plus the fonts `mono sans numeric`. Status hues never reach canvas code; they appear only in kit chrome (the `.is-warn` note). Product-faithful colour is the declared exception: `vpkLab.swatches()` returns fills from `[data-vpk-swatch]` nodes only inside `svg[data-vpk-external-asset][data-vpk-lab-swatches="<reason, 12+ characters>"]`, with an `explicit_deviations` entry. Films and real thumbnails are footage, not illustration. `kit.browser.test.mjs` samples a 24 × 24 grid of every lab canvas and the Gantt in both themes: chroma stays within the tokens’ own (≤ max + 4).

## Decision 1: kit keys never fight the review UI

| Wrong | → Right |
| --- | --- |
| `document.addEventListener("keydown", …)` | → a handler on the kit root |
| `event.target.closest("[data-vpk-review-ui]")` | → scan `event.composedPath()` for the attribute (K26) |
| Init that appends a second set of chapter buttons on reload | → remove `[data-vpk-generated]` and re-derive state first |

Kit key handlers sit on kit roots, never on `document`, and ignore events from `[data-vpk-review-ui]`: the check scans `event.composedPath()` for the attribute (K26), because the review host keeps its UI in an open shadow root that `closest()` cannot climb out of. There are no document-level click listeners. Init is idempotent: it removes `[data-vpk-generated]` inside kit roots and re-derives state (current cue, filters, selection, flips) before building, so a DOM-serialised copy reloads without duplicates. The kit never re-creates an element that carries `data-vpk-id`. Embed and the lite copy keep the doc metas, ids and revision registry. With an enhancer older than `data-vpkh-no-lightbox`, a narrowed fallback stops only clicks on `img, svg, video, canvas` inside kit roots.

## Decision 4: build the hero, then iso, then the kit

```bash
node .agents/skills/vpk-html/scripts/build.mjs --build-hero <file> --audit
node .agents/skills/vpk-html/scripts/iso/build-figure.mjs --inject <file>
node .agents/skills/vpk-html/scripts/lab/kit.mjs --inject <file>
```

The `engineering` section has a figure slot comment. When the contract picks `iso-kit`, `anatomy-hero` or `both`, place the region markers there and build them with `node .agents/skills/vpk-html/scripts/iso/build-figure.mjs --inject <file>` or `node .agents/skills/vpk-html/scripts/build.mjs --build-hero <file> --audit` ([figure engines](figure-engines.md)). Every engine uses the same frame loop and the same lightbox opt-out; kit CSS is scoped under kit roots with `:where()` and has no element selectors.

Proof: `scripts/lab/mixed.browser.test.mjs` (opt-in, `VPK_HTML_BROWSER=1`, unsandboxed) builds one document with a lab, an iso-kit figure and an anatomy hero from the real builders and asserts the shared loop: `vpkLab.loop` is `vpkFrameLoop`, there is no separate figure-loop block, three boards are awake together with at most one outstanding loop rAF, none run off screen, and no click on the lab canvas, the hero stage or the iso stage opens a lightbox. Build order matters: run `build.mjs --build-hero`, then `iso/build-figure.mjs --inject`, then `lab/kit.mjs --inject`. Running the iso builder before the hero builder leaves the document one pipeline run from its fixed point, so the iso `--check` reports it stale.

## Keyboard and accessibility

| Where | Keys |
| --- | --- |
| Film (focus inside the root, not in another field) | Space or `k` play/pause · ← → ± `data-nudge` · `,` `.` one frame · Home/End · `1`–`9` chapters. ↑/↓ are left to the document nav. On the scrub, Space, `k`, `,` `.` and `1`–`9` still work; its arrows and Home/End stay native. |
| Gantt (APG slider) | ← ↓ −0.1 s · → ↑ +0.1 s · PageDown/PageUp ∓1 s · Home/End · Space or `k` play/pause the film. Every handled key calls `preventDefault()`, so docnav never moves and Space never scrolls the page. |

When the big play hides while it has focus, focus moves to the bar’s Play button (`preventScroll`), so the film keys keep working. The Gantt reports `aria-valuenow`/`aria-valuetext` at most 4 times a second while playing. A Gantt click within 6 CSS px of a cue’s time or of a mark (`path[data-vpk-gantt-mark="<clock s>"]`, written by `gantt.mjs`) seeks to that exact time, so a click on a scene’s start names that scene, not the one before it. After a click or key seek the Gantt keeps its own clock time (the film lands 1 ms past it), so 80 key presses read exactly 8.00 s later. The beat panel is `aria-live="polite"` while paused and `off` while playing. Muted kit text uses `--vpk-muted` (muted text mixed 25% toward ink), which keeps 4.5:1 on paper, raised and selected surfaces in both themes; the template and demo have no axe WCAG 2.1 A/AA violations in either theme, at the top of the page or with any section in view. That needs the sections opaque at rest: the case-study page sets `animation-timeline: auto` on its sections, because the shell’s scroll-linked entrance (`styles.css`, `entry 0%–40%`) holds a section near the fold part-faded. Other documents that use the kit should do the same. Under `prefers-reduced-motion: reduce` the shell no longer applies that entrance at all (B2 decision 14), so reduced-motion readers get opaque sections without the override. Below 760 px the Gantt scrolls sideways at a 900 px minimum width (labels ≥ 9 px; taps still seek). In the docnav presenter popup, which swaps the body for its notes, a lab with no root stays quiet. Controls are hidden in print. The shell’s print rule drops every transform, so in print each discard card stacks its two faces, the idea above why it lost, whichever way it is turned.

## Block, size and checks

`<!-- vpk-lab:start -->` · `<style data-vpk-lab>` · `<script data-vpk-lab-runtime>` · `<!-- vpk-lab:end -->`. It is replaced in place, or inserted before the last `</body>`; the registry step `lab` (`scripts/runtime/lab.mjs`) only refreshes blocks that exist, so `--refresh-library` and `--inject-runtime` keep it current.

The `lab` step’s budget (integration K2) is this measured block: measured 2026-10-17: 71,815 B (script 58,630 B including the 4,399 B frame loop, style 13,070 B; 19,840 B gzipped). The template is 459,446 B and the demo 535,889 B (a 42,846 B film). `kit.test.mjs` re-measures on every run: the block, script, style and frame-loop figures must match exactly, gzip within 1 %, and template and demo within 1 %. A kit change therefore updates this record in the same edit.

The built block is test-guarded against text the validators would misread: no `#` before a hex digit, no colour functions, no tags or comment markers, no bare `ease-in`, no `{{`, no `.repeat(`, no replacement patterns, and exactly one hex template literal (`bytesToHex`).

```bash
node .agents/skills/vpk-html/scripts/lab/kit.mjs --check <file.html>…           # exit 1 when stale or missing; warns on markup
node .agents/skills/vpk-html/scripts/lab/kit.mjs --inject <file.html>…          # add or refresh (unsandboxed under .agents/)
node .agents/skills/vpk-html/scripts/lab/render-case-study.mjs <content.json> --into <file.html> [--check]
node .agents/skills/vpk-html/scripts/lab/gantt.mjs <spec.json> [--film-target <id>] > gantt.html
node .agents/skills/vpk-html/scripts/lab/build-template.mjs [--check]           # regenerate the template (unsandboxed)
node .agents/skills/vpk-html/scripts/lab/build-demo.mjs [--check]               # rebuild the demo end to end (unsandboxed)
```
