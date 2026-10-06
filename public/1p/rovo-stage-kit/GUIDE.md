# Rovo Stage Kit 1.3.0: guide for the agent integrating it

You are integrating the **Rovo Stage Kit** into this codebase. Read this whole guide before you change anything.

The kit draws the **Rovo stage**: a wall of small animated product pieces (chat, search, agents, Loom, Jira…) that glides past the camera. It can optionally open on a keynote curtain. The stage is designed in the **Rovo stage lab** (Rovo Desktop's Storybook) and its composer, and it is described by one JSON file, `rovo-stage.json`. Given that file, the kit's code draws **exactly the frames the lab draws**: the same pieces, motion, timing, fonts and colours. Your job is to **host** the stage, not to rebuild it.

## Ground rules

1. **Never re-implement, restyle or port a piece.** Every piece's look and motion lives inside `dist/`. A hand-made copy will drift from the design. Draw pieces only through the kit (`<rovo-stage>`, `<rovo-piece>`, `RovoStage`, `RovoPiece`).
2. **Treat `rovo-stage.json` as data you load, not code you edit.** The stage is changed in the lab and exported again. If you must generate or edit one, follow `stage.schema.json` and [The stage file](#the-stage-file-rovo-stagejson).
3. **Don't edit, minify again or split `dist/`.** To update, replace the whole kit folder (see [Updating](#updating)).
4. **One appearance per page.** The kit writes Atlassian design tokens onto `<html>`. If this page has its own Atlassian (Atlaskit) theme, or global CSS you can't keep off the kit, use the iframe player (integration A).
5. **Check your work against `reference/`** before calling it done (see [Check your work](#check-your-work)).

## What's in the kit

| Path | What it is |
| --- | --- |
| `rovo-stage.json` | **The stage**: the lab's export, which the kit draws. |
| `stages/` | More stages, when the kit ships some: the same file format, for other views or walls. |
| `CHANGELOG.md` | What this kit adds since the last one. |
| `UPDATE.md` | The prompt for updating from the last kit. |
| `stage.schema.json` | JSON Schema (2020-12) of the stage file. |
| `pieces.json` | Every piece the kit draws: its id, name, group, size in points, moment, and whether it has a card. |
| `dist/rovo-stage.js` | **Self-contained build** (ES module, React 18 inside). Defines `<rovo-stage>` and `<rovo-piece>`, and exports `mountStage`, `mountPiece`, `stageInfo`, `PIECES`. 4.8 MB, 2.4 MB gzipped. |
| `dist/react/index.js` | **React 18 build** (ES module; `react` and `react-dom` come from your app). Exports `RovoStage`, `RovoPiece`, `stageInfo`, `PIECES`. 4.6 MB, 2.4 MB gzipped. |
| `types/` | TypeScript declarations for both builds and for the stage file. |
| `stage.html` | A ready player page: the stage file fitted to the window. Use it in an iframe or for headless capture. |
| `pieces.html` | Every piece, playing: a browsable catalogue. |
| `examples/` | `vanilla.html` (web component), `react.tsx` (React), `capture.mjs` (frame-exact PNG capture with Playwright). |
| `reference/` | Frames of this stage drawn by the lab itself, and `reference.json` saying how. These are your parity targets. |
| `package.json` | Lets the folder be a local npm package named `rovo-stage-kit`. |

Fonts (Atlassian Sans and Mono), images and styles are **inside the JS**, so there is nothing else to host. At runtime the kit fetches nothing except the stage file you point it at.

## The stage this kit ships

- **Board:** 1600 × 900 points (16:9 · one screen), light.
- **Loop:** 89.72 s, one seamless cycle.
- **Wall:** packed by the stage itself (no hand-composed wall).
- **Piece styles:** every piece plays its own way.
- **Curtain:** it can open on the keynote curtain.
- **Poster:** second 6.
- **Exported:** 2026-10-05T21:22:47.000Z, by kit 1.3.0.

## Choose an integration

| Situation | Use |
| --- | --- |
| The page already uses Atlaskit / Atlassian design tokens, or has global CSS that styles bare elements (`p`, `img`, `svg`, `*`) | **A. iframe** |
| Any framework (React 19, Vue, Svelte, Angular, plain HTML), same page | **B. Web component** |
| A React 18 app, and you want props and refs | **C. React** |
| Producing video files or stills | **D. Headless capture** |

If you're unsure, choose **A**: it's fully isolated and can't be affected by the host page.

### A. iframe player

Serve the kit folder as static files (any static host, or your app's public/static folder), then:

```html
<iframe
  src="/rovo-stage-kit/stage.html"
  title="Rovo stage"
  aria-hidden="true"
  tabindex="-1"
  style="border: 0; width: 100%; aspect-ratio: 1600 / 900; display: block"
></iframe>
```

`stage.html` takes query parameters:

- `t=<seconds>`: hold on that frame.
- `curtain=<seconds>`: open on the keynote's curtain.
- `appearance=light|dark`.
- `fit=none`: draw the board at its own size.
- `paused`: start paused.
- `bg=<css colour>`: the page around the board.
- `src=<url>`: another stage file.

From the parent page you can drive it with `iframe.contentWindow.rovo.stage` (the element; same origin only).

### B. Web component

```html
<script type="module" src="/rovo-stage-kit/dist/rovo-stage.js"></script>
<rovo-stage src="/rovo-stage-kit/rovo-stage.json"></rovo-stage>
<rovo-piece piece="mentions" scale="0.75"></rovo-piece>
```

Or, with a bundler:

```js
import 'rovo-stage-kit';
```

The import registers both elements. Named exports are also available:

```js
import { mountStage, stageInfo, PIECES } from 'rovo-stage-kit';
```

`<rovo-stage>`:

| Attribute | Meaning |
| --- | --- |
| `src` | URL of a stage file. Or set the `stage` property to the parsed object (or its text). |
| `time` | Seconds into the film. The stage holds that frame. Remove it to play on the stage's own clock. |
| `paused` | Present: its own clock is stopped. |
| `curtain` | Seconds the keynote curtain stays down before it rises into the stage. |
| `appearance` | `light` or `dark`, over the file's. |
| `fit` | `contain` (default): fitted and letterboxed. `none`: the board at its own size in points. |

- **Methods:** `play()`, `pause()`, `seek(seconds)`, `redraw()`.
- **Property:** `currentTime`.
- **Events:**
    - `ready` fires once the stage has drawn; `event.detail` is its `StageInfo`.
    - `stageerror` fires when the file couldn't be fetched or read.

`<rovo-piece>`:

| Attribute | Meaning |
| --- | --- |
| `piece` | The piece's id. |
| `time`, `paused` | As on `<rovo-stage>`. |
| `scale` | Size against the piece's own box. |
| `appearance` | `light` or `dark`. |
| `surface="off"` | Draw it without its card. |
| `play`, `rest`, `length` | Its moment. |

Set the `pieceStyles` property to a stage file's `pieceStyles` so the piece looks and plays as it does on that stage.

Without the elements, use `mountStage(element, { stage, time, curtain, … })` or `mountPiece(element, { id, … })`. Both return `{ update(options), unmount(), play(), pause(), seek(), redraw(), time() }`.

### C. React 18

```tsx
import { RovoStage, RovoPiece, stageInfo, type StageHandle } from 'rovo-stage-kit/react';
import stage from 'rovo-stage-kit/rovo-stage.json';

<RovoStage stage={stage} />                       // plays; as wide as its parent, the board's ratio
<RovoStage stage={stage} time={seconds} />        // held on the host's time (scroll, video, slides)
<RovoStage stage={stage} curtain={2} />           // opens on the keynote curtain
<RovoStage ref={handle} stage={stage} playing={false} />  // handle.current.play() / seek() / redraw()
<RovoPiece id="mentions" pieceStyles={stage.pieceStyles} scale={0.75} />
```

`RovoStage` props:

- `stage`
- `time?`
- `playing?` (default `true`)
- `curtain?`
- `appearance?`
- `fit?` (`'contain'` | `'none'`)
- `className?`
- `style?`
- `onStage?(info)`

`RovoPiece` props:

- `id`
- `time?`
- `playing?`
- `pieceStyles?`
- `moment?`
- `surface?`
- `scale?`
- `appearance?`
- `className?`
- `style?`

Both forward a `StageHandle` ref.

- **React version:** the build needs React and React DOM 18 (tested with 18.3.1). On React 19, or if you see "Invalid hook call", use integration B: it brings its own React.
- **SSR:** the kit draws only in the browser. On Next.js and similar, load it client-side only, for example `dynamic(() => import(…), { ssr: false })` or a `'use client'` component mounted after hydration. Don't render it on the server.

### D. Headless capture (video and stills)

`examples/capture.mjs` captures frames with Playwright exactly as the lab's own exporter does:

```sh
npm i -D playwright && npx playwright install chromium
node examples/capture.mjs --fps 30 --scale 2 --out frames   # one loop of the stage
ffmpeg -framerate 30 -i frames/frame-%05d.png -pix_fmt yuv420p stage.mp4
```

The recipe, if you write your own:

1. Open `stage.html?t=0` in a page whose viewport is the board's size in points (1600 × 900).
2. Set the device scale factor to the resolution you want. For example, 2.4 gives 3840 × 2160.
3. Launch Chromium with `--run-all-compositor-stages-before-draw --disable-checker-imaging`, and with a GPU (`--use-gl=angle --enable-gpu --ignore-gpu-blocklist`).
4. `await window.rovo.ready`.
5. For each frame `n`, `await window.rovo.frame(n / fps)`, then screenshot. `frame()` seeks, waits for fonts and waits two animation frames.

## Sizing

- **Design size:** the board has a design size in **points** (CSS pixels at scale 1). This stage's is **1600 × 900** (16:9). The kit scales it uniformly to fit its element and **never stretches it**.
- **Width only:** give the element only a width and it takes the board's ratio.
- **Width and height:** the board is fitted inside and letterboxed. Style the gap with the page or the element's background.
- **Sharper output:** raise the **device pixel ratio**, not the CSS size. The board is laid out in points.
- **Board sizes by aspect:**

| Aspect | Board (points) | Screens |
| --- | --- | --- |
| `16:9` 16:9 · one screen | 1600 × 900 | 1 |
| `21:9` 21:9 · an ultrawide | 2100 × 900 | 1 |
| `32:9` 32:9 · two screens side by side | 3200 × 900 | 2 |
| `48:9` 48:9 · three screens side by side | 4800 × 900 | 3 |
| `9:16` 9:16 · a portrait screen | 900 × 1600 | 1 |

- **Pieces:** each piece (`RovoPiece`, `<rovo-piece>`) has its own box. `w` and `h` are in `pieces.json`, times `scale`. A piece may draw past its box (shadows, things that fly in), so leave it about 40 px of room and don't clip it.

## Time

- **The film clock:** time is in **seconds of film**, and `t = 0` is the start.
    - **Playing:** without `time`, the stage plays on its own clock (`requestAnimationFrame`).
    - **Held:** with `time`, it holds that frame. Drive it from your own clock (a video's time, a scroll position) by updating `time`.
- **Loop:** this stage's loop is **89.72 s**. The frame at `t + 89.72` is the frame at `t`, so one loop is a seamless cycle for a looping video.
- **Curtain:** `curtain = s` holds the keynote's curtain down for `s` seconds, then raises it into the stage. The stage's own clock starts at the raise: film `t` is stage `t − s`. The curtain plays once, so a film with a curtain is not a loop from 0. It only fits boards 16:9 or wider.
- **Pace:** the stage's `pace` option (in the file) sets how fast the wall travels. Don't speed it up or slow it down by scaling `time`; change it in the lab.
- **Stills:** for a still (a poster, or reduced motion), hold `time` on `stageInfo(stage).poster`, the frame the lab chose. A file whose `still` is true holds that frame whatever the time.
- **Step through time in order.** A frame's content depends only on its time. Its **sharpness** can depend on what Chrome drew before it, though: after a long jump, cards first drawn far away and small can stay slightly soft, exactly as in the lab. Stepping frame by frame keeps every frame crisp, and so does opening a page on the frame. After a jump, call `redraw()` to draw it afresh. For captures, step frames in order, as `capture.mjs` does.
- **Reduced motion:** respect `prefers-reduced-motion: reduce` by holding the poster frame (see `examples/`).
- **Off screen:** pause the stage while it is off screen (an `IntersectionObserver` toggling `paused`).

## The stage file (`rovo-stage.json`)

```jsonc
{
  "format": "rovo-stage",          // always
  "version": 1,                    // the format; a newer one is refused, not guessed at
  "kit": "1.3.0",               // the kit that wrote it
  "exportedAt": "…",               // ISO date
  "board": { … },                  // the canvas and the stage's options
  "composition": { … } | null,     // the hand-composed wall; null = the stage packs its own
  "pieceStyles": { … }             // how each kind of piece looks and plays
}
```

**Units:** positions and sizes in points, times in seconds, `scale` as a multiplier.

**Reading:** the kit reads a file the way the lab does.

- Values out of range are brought into range.
- Unknown pieces and options are dropped.
- A newer `version` is refused: `stageInfo()` returns `null` and `<rovo-stage>` fires `stageerror`.
- `stageInfo(file) !== null` is the check that a file is usable.

### `board`

- **Canvas:** `canvas` is the background tone, `aspect` the board shape, `bleed: true` takes the stage to the edges with no margin or rounded corners, and `appearance` is `light` or `dark`.
- **The stage's card:** `cells.a` is the stage's card.
    - `module` is always `"stage"`.
    - `motion: "static"` holds the poster.
    - `frame`: a chosen still, as a share of the loop.
    - `zoom` and `panX` / `panY`: the framing.
    - `options`: the stage's options.

The stage's options (`board.cells.a.options`; numbers are kept as text):

| Option | Key | Values | Default |
| --- | --- | --- | --- |
| View | `view` | `stage` Stage: a wall gliding past · `masonry` Masonry: packed edge to edge, even gaps · `mosaic` Mosaic: cells taking turns · `scatter` Scatter: the frame full, at many heights · `grid` Grid: a piece in each cell · `gravity` Gravity: they fall and pile up · `orbit` Orbit: two rings round the greeting · `scroll` Scrolling background: columns | `stage` |
| Horizontal gap | `masonryGapX` | 0 to 160 | `28` |
| Vertical gap | `masonryGapY` | 0 to 160 | `28` |
| Camera | `camera` | `glide` Glide: square on · `angle` Angle: along the shelf · `low` Low: looking up the wall · `close` Close: pieces large | `close` |
| Speed | `pace` | `slow` Slow: 60 pt a second · `calm` Calm: 95 pt a second · `brisk` Brisk: 140 pt a second · `quick` Quick: 200 pt a second | `slow` |
| Density | `density` | `gallery` Gallery: a few pieces, room round each · `balanced` Balanced · `dense` Dense: close together | `balanced` |
| Headline | `text` | `still` Still: pieces pass in front and behind · `wall` On the wall: it travels with them · `none` None | `still` |
| Greeting | `greeting` | text | `Hey there, ready to get  to work?` |
| Greeting size | `textSize` | 0.4 to 2 | `0.9` |
| Greeting across | `textX` | 0 to 0.9 | `0.065` |
| Greeting down | `textY` | 0 to 0.9 | `0.08` |
| Show Search | `showSearch` | `true` / `false` | `true` |
| Show Chat | `showChat` | `true` / `false` | `true` |
| Show Reasoning and sources | `showReasoning` | `true` / `false` | `true` |
| Show Voice | `showVoice` | `true` / `false` | `true` |
| Show Agents | `showAgents` | `true` / `false` | `true` |
| Show Click and hold, Compact | `showHold` | `true` / `false` | `true` |
| Show Rovo’s icons | `showIcons` | `true` / `false` | `true` |
| Show App logos | `showApps` | `true` / `false` | `false` |
| Show Onboarding: mosaic and Facets Zoom | `showOnboarding` | `true` / `false` | `true` |
| Show Artifacts | `showArtifacts` | `true` / `false` | `true` |
| Show Rovo Dev and code | `showDev` | `true` / `false` | `true` |
| Show Working together | `showCollab` | `true` / `false` | `true` |
| Show Loom | `showLoom` | `true` / `false` | `true` |
| Show Trust and numbers | `showTrust` | `true` / `false` | `true` |
| Show Confidence: control, cost and risk | `showConfidence` | `true` / `false` | `true` |
| Show Mosaic tiles | `showMosaic` | `true` / `false` | `true` |
| Tilt at the start (entrance) | `entryTilt` | 0 to 70 | `20` |
| Tilt curve (entrance) | `entryTiltCurve` | `settle` Settle: it straightens as it lands · `hold` Hold: it keeps its tilt, then rights itself · `wobble` Wobble: it overshoots flat and settles · `even` Even: it rights itself steadily | `settle` |
| Material (entrance) | `entryMaterial` | `solid` Solid: a rigid layer · `card` Card: it flexes a little · `paper` Paper: it bends as it flies · `sticker` Sticker: it curls, then lays down from one edge · `silk` Silk: it ripples, very soft | `solid` |
| Softness (entrance) | `entrySoftness` | 0 to 1 | `0.5` |
| Entrance speed (entrance) | `entrySpeed` | 0.4 to 2.5 | `1` |
| Into the wall (entrance) | `entryDepth` | `swoop` Swoop: fast past the lens, long and soft onto the wall · `steady` Steady: it eases in and out · `dive` Dive: it gathers speed and lands softly · `bounce` Bounce: it presses into the wall and springs back | `swoop` |
| How the curtain goes (curtain) | `curtainExit` | `rise` Rise: the slide lifts away · `theater` Theater: it parts at the middle and draws aside · `pageTurn` Page turn: it peels over from the right · `fold` Fold: it folds itself up like a letter · `blinds` Blinds: its slats turn away, top to bottom · `tiles` Tiles: it breaks into tiles that fall away · `flythrough` Fly through: the camera passes through it · `fall` Fall: it tips back and falls away · `dissolve` Dissolve: it parts into bands that melt away · `unfold` Unfold: it holds still and blurs into the stage, as a foldable opens | `rise` |
| Where the slide sits (curtain) | `curtainPlace` | `across` Across the canvas · `right` On the right screen, the left dark · `left` On the left screen, the right dark | `across` |
| Curtain speed (curtain) | `curtainSpeed` | 0.4 to 2.5 | `1` |
| Curtain softness (curtain) | `curtainSoftness` | 0 to 1 | `0.5` |
| Curtain stagger (curtain) | `curtainStagger` | 0 to 1 | `0.5` |

### `composition` (when the wall was composed by hand)

- **`period`:** the wall repeats every `period` points, and the camera travels one period a loop.
- **`speed`:** points a second at the calm pace.
- **`frame`, `band`:** the frame it was composed in, and the band of that frame the camera sees whole.
- **`pieces[]`:** each placed piece has:
    - `key`: unique.
    - `id`: a piece id.
    - `x`, `y`: its top left corner within one period.
    - `scale`.
    - `z`: its height off the wall. Past 60 it passes in front of the greeting.
    - Optionally its own `play` / `rest` / `length`.
- **`keynote`:** where the curtain's cards land, as `{ "<card id>": "<piece key>" }`. The cards: `teu-1` Desktop Search & Chat, `teu-10` Jira Agent Sessions, `teu-3` Rovo for Work & Mobile, `teu-6` Whiteboard → Figma → Loom, `teu-2` Code Context, `teu-5` Loom Desktop Recording.

### `pieceStyles` (the lab's Library settings, by piece id)

- `surface: false`: draws the piece without its card. Only for pieces with `card: true`.
- `play`:
    - `once` plays its moment and holds its last frame.
    - `loop` plays, rests `rest` seconds on its last frame, then plays again, with a 0.5 s crossfade.
    - `live` never stops.
- `length`: seconds its moment runs.

**Precedence** for how a piece plays: a composed piece's own setting, then `pieceStyles[id]`, then the piece's default (`holds` in `pieces.json`; `null` means it never stops).

## Pieces

`pieces.json` and `PIECES` list every piece; `pieces.html` shows each one playing.

| Piece | id | Group | Box (points) | Moment | Holds after | Card |
| --- | --- | --- | --- | --- | --- | --- |
| Search field | `search` | Search | 750 × 54 | A query types itself in. | 3 s | — |
| Search as you type | `searchDrop` | Search | 750 × 366 | The dropdown opens under the field, its pills and rows rising in. | 4 s | — |
| Search filters | `filters` | Search | 612 × 32 | All apps gives way to Confluence, and back. | 6 s | — |
| A short exchange | `bubbles` | Chat | 460 × 250 | The question, Rovo typing and then answering, a follow-up. | 6 s | — |
| Composer | `composer` | Chat | 650 × 110 | A question types itself in, and the send button arrives. | 4 s | — |
| Starters | `starters` | Chat | 330 × 37 | New chat’s starters, staggering in. | 2 s | — |
| Skills | `skills` | Chat | 650 × 256 | The dropdown opens, its rows rise a beat apart, and the first lights up. | 4 s | — |
| Teamwork Graph | `twg` | Reasoning and sources | 430 × 206 | Rovo works through its phases, each source it reads ticking off. | 9 s | — |
| Reasoning menu | `reasoning` | Reasoning and sources | 358 × 144 | The highlight steps down to Work, and Work is picked. | 4 s | — |
| Reasoning pill | `workPill` | Reasoning and sources | 128 × 36 | Auto, then Work once picked. | 3 s | — |
| Sources | `sources` | Reasoning and sources | 300 × 340 | Include web results switches on, then the highlight moves to Slack. | 4 s | — |
| An answer’s sources | `sourcesPopover` | Reasoning and sources | 360 × 300 | The button pressed, then open on its list, the eye walking down it. | 7 s | — |
| Dictation | `voice` | Voice | 360 × 56 | The mic lit, the waveform live, the time counting. | never stops | — |
| Agent picker | `picker` | Agents | 248 × 360 | The highlight steps down the list, the caret blinking. | 4 s | — |
| Agents | `avatars` | Agents | 300 × 128 | Their hexagons set down one after another. | 2 s | — |
| Rovo’s badge | `badgeRovo` | Agents | 229 × 282 | It swings on its lanyard, and settles. | 4 s | — |
| Click and hold | `hold` | Click and hold, Compact | 600 × 172 | The pointer holds, the loader fills, the ask bar rises and a question types in. | 6 s | — |
| Compact | `compact` | Click and hold, Compact | 690 × 627 | In a conversation: the answer streams in. | 8 s | — |
| Search · Chat switch | `switch` | Click and hold, Compact | 170 × 46 | The sidebar’s switch flips to Chat and back. | 5 s | — |
| Working… row | `bloom` | Click and hold, Compact | 255 × 60 | It shimmers while its orb turns, then the orb gathers into the unread dot. | 4 s | — |
| Search | `glyphSearch` | Rovo’s icons | 132 × 132 | Rovo’s glyph, still. | 0 s | — |
| Chat | `glyphChat` | Rovo’s icons | 132 × 132 | Rovo’s glyph, still. | 0 s | — |
| For you | `glyphForYou` | Rovo’s icons | 132 × 132 | Rovo’s glyph, still. | 0 s | — |
| Auto | `glyphAuto` | Rovo’s icons | 132 × 132 | Rovo’s glyph, still. | 0 s | — |
| Confluence | `appConfluence` | App logos | 96 × 96 | An app Rovo reads, still. | 0 s | — |
| Jira | `appJira` | App logos | 96 × 96 | An app Rovo reads, still. | 0 s | — |
| Slack | `appSlack` | App logos | 96 × 96 | An app Rovo reads, still. | 0 s | — |
| Figma | `appFigma` | App logos | 96 × 96 | An app Rovo reads, still. | 0 s | — |
| GitHub | `appGithub` | App logos | 96 × 96 | An app Rovo reads, still. | 0 s | — |
| Google Drive | `appDrive` | App logos | 96 × 96 | An app Rovo reads, still. | 0 s | — |
| Loom | `appLoom` | App logos | 96 × 96 | An app Rovo reads, still. | 0 s | — |
| Onboarding mosaic | `mosaic` | Onboarding: mosaic and Facets Zoom | 560 × 350 | Its five tiles bloom in a beat apart, then their loops play on. | never stops | — |
| Facets Zoom | `filmFacets` | Onboarding: mosaic and Facets Zoom | 360 × 300 | The line draws the tile’s rim, and the facets pop in. | 7 s | — |
| Rovo on mobile | `mobileChat` | Chat | 430.24 × 935.4 | The question lands, the answer streams in, then what Rovo can do next. | 5.8 s | — |
| Scheduled task | `scheduledTask` | Agents | 455.73 × 588.46 | Its name and prompt type in, Daily at 09:00 AM is set, and Create is pressed. | 5.4 s | yes |
| A quiz, built as an artifact | `quizArtifact` | Artifacts | 800 × 450 | The question rises in, the answers follow, and the middle one is picked: green. | 6 s | yes |
| A dashboard, built as an artifact | `dashboardArtifact` | Artifacts | 567 × 420 | Its numbers count up, the line draws across, the ring sweeps round. | 5 s | yes |
| Artifacts | `artifactsLogo` | Artifacts | 459 × 137 | The tile springs in, and its name slides out from behind it. | 1.6 s | — |
| Rovo Dev in the terminal | `rovoDevCli` | Rovo Dev and code | 616 × 302 | The mark resolves out of noise, cell by cell, and the welcome types in. | 5 s | — |
| Rovo on a pull request | `codeCard` | Rovo Dev and code | 276 × 143 | Rovo writes its lines, and the file it read lands under them. | 4 s | yes |
| Code Search | `codeSearchLogo` | Rovo Dev and code | 550 × 143 | The tile springs in, and its name slides out from behind it. | 1.6 s | — |
| Linked rings | `ringsTile` | Rovo’s icons | 120 × 120 | The rings pop in, and the link draws between them. | 2 s | yes |
| Agents, present | `agentPresence` | Working together | 604 × 471 | Rovo, Claude and teammates move about the page, each with their name tag. | never stops | yes |
| Mentions | `mentions` | Working together | 603 × 414 | @ then J is typed, the menu opens, and the highlight lands on Jira. | 4.4 s | yes |
| Attribution | `attribution` | Working together | 366 × 220 | The version comes in, then each credit: the mark lands, its person tucks in. | 2.6 s | yes |
| Share a chat snapshot | `shareSnapshot` | Working together | 516 × 294 | The first option is chosen, and Generate link is pressed. | 5 s | yes |
| Loom: record for an agent | `loomRecordBar` | Loom | 1178 × 249 | The bar rises, its capture mode settles, and Record for agent glows and presses. | 4 s | — |
| Loom: the teleprompter | `loomTeleprompter` | Loom | 606 × 694 | The script scrolls up line by line while the recording’s time counts. | never stops | — |
| Loom: the camera bubble | `loomCameraBubble` | Loom | 358 × 458 | Each shape is pressed in turn and the bubble takes it: circle, wide, tall, back. | 7 s | — |
| Loom: overlays | `loomOverlays` | Loom | 1193 × 594 | The tiles pop in, their numbers count up, and the video plays on to 0:32. | 6 s | yes |
| Loom: Record for agent | `recordForAgent` | Loom | 413 × 207 | Its glow breathes in and turns into place, the sparkle twinkles, and it presses. | 4 s | — |
| Governance | `governance` | Trust and numbers | 396 × 302 | The shield comes up, its check is cut through it, and a sheen passes. | 3 s | yes |
| ISO 42001 | `iso42001` | Trust and numbers | 573 × 293 | Rovo is now authorized: ISO 42001 lands a character at a time. | 3 s | yes |
| 48% fewer tokens | `statTokens` | Trust and numbers | 520 × 320 | The number rolls up to 48%, and Fewer tokens rises in. | 3 s | — |
| Typing | `stampTyping` | Mosaic tiles | 90.8 × 96.31 | New chat’s back balloon, its three dots typing on and on. | never stops | yes |
| Photo carousel | `stampPhotos` | Mosaic tiles | 226.32 × 241.69 | The identity’s circle photography snaps along a coin every 2.4 s. | never stops | yes |
| Shapes | `stampShapes` | Mosaic tiles | 129.52 × 96.31 | A bold white shape morphs through the identity’s star, shield and arch. | never stops | yes |
| Shield | `stampShield` | Mosaic tiles | 226.32 × 241.69 | The identity’s shield, a mountain photograph inside it, breathing. | never stops | yes |
| Rovo mark | `stampRovoMark` | Mosaic tiles | 226.32 × 241.69 | The mark on its app tile, its four facets turning. | never stops | yes |
| Scribble tangle | `stampTangle` | Mosaic tiles | 90.8 × 96.31 | The Dialect’s gestural line writes a tangle and lifts off again. | never stops | yes |
| Scribble loops | `stampLoops` | Mosaic tiles | 90.8 × 96.31 | A run of loops written on like a pen, then taken off. | never stops | yes |
| Ribbon | `stampRibbon` | Mosaic tiles | 321.68 × 112.46 | The dynamic motif: four colours folding along the strip. | never stops | yes |
| Signal | `stampSignal` | Mosaic tiles | 129.52 × 96.31 | A signal hops across a quiet field of dots. | never stops | yes |
| Angled grid | `stampGrid` | Mosaic tiles | 321.68 × 112.46 | The collage’s angled grid, drifting. | never stops | yes |
| Sparkle | `stampSparkle` | Mosaic tiles | 90.8 × 96.31 | The Dialect’s sparkle twinkles. | never stops | yes |
| Colour fields | `stampFields` | Mosaic tiles | 321.68 × 225.54 | Two colour fields slide over each other, a third where they cross. | never stops | yes |
| The first squiggle | `stampSquiggle` | Mosaic tiles | 90.8 × 96.31 | The welcome’s original curling line drifting through its tile. | never stops | yes |
| The first smile | `stampSmile` | Mosaic tiles | 129.52 × 96.31 | The welcome’s original smile, bobbing and tipping. | never stops | yes |
| Agent identities | `agentIdentities` | Confidence: control, cost and risk | 564 × 377 | Its counts tick up, each agent’s row rises in, and its status lands Active. | 2.95 s | yes |
| Atlassian MCP | `atlassianMcp` | Confidence: control, cost and risk | 583 × 230 | Its eyebrow types in, the line under it rises, and the four tools land one after another, each settling into its tilt. | 3 s | yes |
| Redacted by your organization | `redactedPrompt` | Confidence: control, cost and risk | 539 × 354 | The question types in, a marker swipes over its product code, and the organization’s note comes up. | 4.4 s | yes |
| Needs input | `needsInput` | Confidence: control, cost and risk | 539 × 412.1 | The work item comes in, then the tray grows out from under it with Claude’s Needs input, and the blue dot pops. | 3 s | yes |
| Unlinked agent sessions | `agentSessions` | Confidence: control, cost and risk | 523 × 560 | Refresh turns, Canva’s new session lands on top, lit, the count ticks to 7, and every orb keeps working. | never stops | yes |
| Request Resolver’s steps | `requestResolver` | Confidence: control, cost and risk | 946.5 × 402 | Each step ticks in turn, its line running down to the next, @Victoria is called on the last, and the sources land. | 3.6 s | yes |
| Onboarding work items | `jiraList` | Confidence: control, cost and risk | 1000.14 × 294 | The rows fill in, Request Resolver takes the licences, and the desk turns from In progress to Done. | 3.2 s | yes |
| Risk, by kind | `riskStack` | Confidence: control, cost and risk | 674 × 593 | The cards are dealt down the diagonal, their statuses pulse, and Business flags its high risks. | 3 s | yes |
| Cost by provider and model | `costByModel` | Confidence: control, cost and risk | 495 × 683 | The ring sweeps round as its total counts up to $5.6M, each provider joining the key, then the models’ bar fills. | 4 s | yes |
| Spend this month | `spendCard` | Confidence: control, cost and risk | 450 × 476 | The line draws across as the total counts up, turning orange past the budget, on to $786K. | 3 s | yes |
| Dimensions | `dimensions` | Confidence: control, cost and risk | 634 × 362 | Each bar fills segment by segment as its score counts up, the rows a beat apart. | 3 s | yes |
| Potential savings | `potentialSavings` | Confidence: control, cost and risk | 742 × 162 | The lozenge pops with a glint, and the finding streams in a few words at a time. | 3 s | yes |
| An agent session, working | `sessionCard` | Confidence: control, cost and risk | 1594.71 × 136.13 | Claude’s mark lands, the title streams in, and Working shimmers beside the turning orb. | never stops | yes |
| Readiness | `readiness` | Working together | 432 × 385 | The toolbar’s ring fills to Medium, its menu opens to say why, and the highlight settles on Annie’s comments. | 3.3 s | yes |
| High readiness | `highReadiness` | Working together | 294 × 85 | The ring sweeps round its dotted track to three quarters, and High readiness lands with a beat. | 3.05 s | yes |
| Cursor activity | `cursorActivity` | Working together | 873 × 325 | The timeline draws out as the activity lands, and the pointer comes to rest on it, the session’s time lifting above. | 3.7 s | yes |
| Who’s here | `presenceFacepile` | Working together | 590 × 241 | Teammates and agents pop in apart, then gather into one facepile. | 2.4 s | yes |
| Rovo, with a teammate | `rovoWithYou` | Working together | 396 × 302 | Rovo’s tile lands, its four facets come together, and Aoife tucks in. | 2.3 s | yes |
| Agent takes the card | `workflowCard` | Working together | 603 × 433 | The card is set down in In Progress, and the agent’s row slides out from under it, Working shimmering as the orb turns. | never stops | yes |
| Planner, in the thread | `conversation` | Working together | 603 × 348 | Liam mentions Planner and types his ask, a reaction lands, and Planner starts thinking. | 4.8 s | yes |
| Claude’s agent card | `agentCard` | Agents | 544 × 610 | The card drops onto its slot and swings, its spark turns in, and its description writes itself in. | 3.2 s | yes |
| Code search, by its syntax | `codeSearchQuery` | Rovo Dev and code | 982 × 63 | searchMode, repo and branch type in, each key turning blue as its colon lands, then the query itself. | 3.84 s | — |
| Code search in the terminal | `twgSearchCli` | Rovo Dev and code | 615 × 167 | The twg command types in at the prompt, and the search starts, its half-moon turning as its dots count up. | 3.7 s | — |

## Isolation: what the kit does to the page

- **Styles:** it injects `<style>` elements into `<head>`.
    - Its own CSS uses hashed class names.
    - A copy of Atlaskit's CSS reset is scoped to `[data-rovo-kit]` elements.
    - Atlaskit's component CSS uses atomic class names.
    - It adds `@font-face` rules for `Atlassian Sans` and `Atlassian Mono`.
- **Theme:** it sets Atlassian design tokens on `<html>`: `data-color-mode` and `data-theme` attributes, and `--ds-*` custom properties, including brand colours. That's why one appearance per page applies, and why a page with its own Atlaskit theme should use the iframe.
- **Atlaskit flags:** it registers Atlaskit's feature-flag resolver (`@atlaskit/platform-feature-flags`). That may change how the host's own Atlaskit components render, which is another reason to use the iframe.
- **Elements:** the self-contained build defines the custom elements `rovo-stage` and `rovo-piece`.
- **Host CSS:** host CSS that targets bare elements or `*` can reach inside the kit and change how pieces look, for example `img { max-width: 100% }`, `svg { display: block }`, `* { box-sizing: … }`, `p { margin … }` or `button { … }`. Either keep such rules off `[data-rovo-kit]`, or use the iframe.
- **Content Security Policy:** under a CSP the kit needs:
    - `style-src 'unsafe-inline'`, because styles are injected.
    - `font-src data:` and `img-src data:`, because assets are inline.
    - `script-src` for the module.
    - `connect-src` for the stage file's URL.

## Performance

- **One stage per page:** each stage is a few hundred composited layers. Pause it when it is off screen or the tab is hidden.
- **Download:** the JS is 4.8 MB, 2.4 MB gzipped uncompressed, fonts and images included. Serve it compressed (gzip or brotli) with long-lived caching, and preload it on pages that open on the stage: `<link rel="modulepreload" href="…/dist/rovo-stage.js">`.
- **Many pieces:** each `RovoPiece` / `<rovo-piece>` runs its own clock. A page of many pieces is fine, but don't expect a hundred to stay at 60 fps on a low-end machine.

## Updating

- **The stage changed** (composition, styles, options): export it again from the lab and replace `rovo-stage.json`. There are two export buttons:
    - Lab panel → **Stage kit → Export stage JSON**.
    - The composer's **Export stage**.
- **The pieces changed** (new pieces, new looks): get a newer kit and replace the whole folder. A stage file may name pieces an older kit doesn't know; those are dropped.
- **Versions:** the file's `kit` field says which kit wrote it, and `KIT_VERSION` is the kit you have.

## Check your work

1. **Pixel parity.** `reference/reference.json` lists frames the lab drew of this stage: their file, film second, curtain, size and scale. Render each frame with your integration at the same size and scale:
    - The same viewport in points.
    - `deviceScaleFactor` 1.
    - A fresh page per frame, opened on that second.

   Compare pixels. Expect under 0.1 % of pixels to differ by more than 8/255; that's GPU raster noise. More than that means one of these:
    - Host CSS is reaching in.
    - The wrong size or scale.
    - Fonts that didn't load (CSP).
    - A different time base: `time` must be film seconds.
2. **Visual checks:**
    - The board fills its element without distortion.
    - Text is in Atlassian Sans.
    - Pieces move.
    - The loop is seamless at `t = 89.72`.
    - Light and dark don't mix on one page.
3. **Behaviour:**
    - It pauses off screen.
    - Reduced motion shows the poster.
    - No console errors.
    - The page's own styles and theme are unchanged around it.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Nothing draws | A console error; `stageerror` (bad JSON, a newer format); `.js` served with the wrong MIME type (must be `text/javascript`); opened from `file://` (serve it over HTTP). |
| Wrong font | CSP blocking `data:` fonts, or host CSS forcing `font-family` on descendants. |
| Pieces look different from the lab | Host global CSS reaching in (see Isolation), or a host Atlaskit theme. Use the iframe. |
| Colours flip between light and dark | Two appearances on one page. |
| Soft text after a seek | Call `redraw()`, or step through time in order (see Time). |
| "Invalid hook call" with the React build | Two Reacts or React 19. Use the self-contained build. |

## Reference

| File | Film second | Curtain | Drawn by | Kit vs lab |
| --- | --- | --- | --- | --- |
| `reference/stage-0s.png` | 0 | — | the lab | 0.001 % of pixels over 8/255 |
| `reference/stage-4s.png` | 4 | — | the lab | 0.000 % of pixels over 8/255 |
| `reference/stage-12s.png` | 12 | — | the lab | 0.017 % of pixels over 8/255 |
| `reference/curtain-2s-at-1s.png` | 1 | 2 s | the lab | 0.000 % of pixels over 8/255 |
| `reference/curtain-2s-at-3.5s.png` | 3.5 | 2 s | the lab | 0.000 % of pixels over 8/255 |

Kit 1.3.0 · stage format 1 · built 2026-10-05 from Rovo Desktop's stage lab (`libs/features/welcome/src/renderer/bento`, `scripts/stage-kit.mjs`).
