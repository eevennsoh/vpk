# Media pipeline

Capture → encode → embed puts a film of a running page into a vpk-html document as an H.264 data URL, with film
data the [lab kit](lab-kit.md) reads, a provenance line and, when the file is too big for data-URL viewers, an
automatic `<slug>.lite.html`. Only node, Playwright, ffmpeg (5 or later) and cwebp are needed; without cwebp, stills
fall back to MJPEG. Every command that launches Chromium or writes under `.agents/skills/` runs unsandboxed.

For an artifact, keep the capture spec and records in `artifacts/vpk-html/<slug>/_film/` and run from there:

```bash
node .agents/skills/vpk-html/scripts/media/capture.mjs capture.spec.mjs
node .agents/skills/vpk-html/scripts/media/encode.mjs <frames dir> --out film.mp4 --contact-sheet sheet.jpg
node .agents/skills/vpk-html/scripts/media/embed.mjs ../<slug>.html --film film.mp4 --manifest capture.json
```

Then re-run the source checks (SKILL.md step 5): embed rewrites the artifact.

## Capture (`scripts/media/capture.mjs`)

```
capture.mjs <spec.mjs|spec.json> [--frames-dir <dir>] [--manifest-dir <dir>] [--only <id,…>] [--headed] [--dry-run]
capture.mjs --url <url> [--hold "<expr with t>" | --virtual] [--start 0] --end <s> [--fps 30] [--viewport 1920x1080] [--dpr 1]
            [--ready-selector <css>] [--settle-ms 50] [--wait-ms 2000] [--live <s> | --drive <module.mjs>]
            [--segment-id clock] [--cursor]
```

The `--url` form makes one segment: a `hold`, a `virtual` one (`--virtual`), or a `screencast` with `--live`/`--drive`.
`--cursor` turns the cursor overlay on for any capture. Its id and label are
`clock`, the IR's default `film.clock_id`, so cues timed with `t_s` and the Gantt (`data-clock="clock"`) resolve after
embed. If the IR sets another `clock_id`, pass `--segment-id <that id>`. A spec file names its own segments, and
capture refuses `--segment-id` with one.

A `.mjs` spec is a default export and may hold functions; a `.json` spec allows expression strings only. Fields:
`url` (relative to the spec), `viewport`, `deviceScaleFactor`, `fps`, `jpegQuality`, `colorScheme`, `reducedMotion`,
`launch.args`, `ignoreHTTPSErrors`, `ready: { selector, timeoutMs, settleMs }` (or a function), and `segments`:

| Segment | Fields | How frames are made |
| --- | --- | --- |
| `hold` | `id, label, start, end, hold?, arm?, release?, timeMap?, settleMs?` | For `i = 0 … round((end − start) · fps)`: `t = timeMap ? timeMap(i / fps) : start + i / fps`; call `hold(t)` (default `await window.__vpkRehearsal.hold(t)`), wait two animation frames and `settleMs` (50), take a JPEG. Exact: `film[1] − film[0] = frames / fps`. |
| `virtual` | `id, label, start?, end, arm?, release?, settleMs?` | For a page with no rehearsal hook. A virtual clock (`capture-clock.mjs`, installed as an init script) replaces `requestAnimationFrame`, `setTimeout`/`setInterval`, `performance.now` and `Date.now`; CSS and Web Animations are paused and set to their elapsed time. The segment arms the clock, then runs your `arm` hook (start the page's animations there), steps `start` seconds without recording, and then, for each frame, steps `1/fps` (the rAF batch, then the timers due, in order), waits `settleMs` of real time and takes a JPEG. Positions do not depend on wall time. The manifest records a `linear` clock and `film[1] − film[0] = frames / fps`, exactly like a hold. |
| `screencast` | `id, label, drive \| live, trimStartFrames?, cursor?` | CDP `Page.startScreencast` while `drive({ page, mark, spec, segment, glide })` runs (or for `live` seconds). Frame durations are timestamp differences, clamped to [0.001, 1.0] s; the last frame lasts until the screencast stopped (at least 1/fps), so a page that settles keeps its still tail. `mark(name)` records the film time of the next frame. |

Limits of `virtual`: a timer or rAF registered before `arm()` stays on the real clock until it re-registers, `new Date()`
without arguments is not wrapped, and worker and iframe clocks are not virtual. CSS animations already running when
the clock arms continue from where they were; one created later starts at 0 when the clock first sees it.

**Cursor and glide.** CDP screencasts never include the system cursor. With `cursor: true` (or `{ size, start }`) on the
spec, or `--cursor`, a grayscale arrow and a press ring follow the mouse, and a screencast `drive` receives
`glide(x, y, ms)`, which moves the real mouse along an eased path so the arrow travels instead of jumping. The overlay is
drawn in the page, so it also appears in `hold` and `virtual` frames when the page moves the mouse.

The rehearsal hook a page exposes is `window.__vpkRehearsal = { hold(t), release?(), time?(), duration? }`.
`assets/lab/fixtures/rehearsal-target.html` is a worked, deterministic example. A hold on the default hook checks
for it first: on a page without `window.__vpkRehearsal.hold`, capture stops before any frame (exit 1) and says to
pass `--hold "<expr with t>"` for the page's own clock, or `--live <s>`/`--drive` to record it in real time.

Outputs: frames in `<frames dir>/<segment id>/f00000.jpg…`, `<frames dir>/frames.ffconcat`, and `capture.json` in the
manifest dir (film data plus `version, tool, viewport, frames, marks, errors, source`; relative paths only).
Frames default to `<repo>/output/vpk-html-capture/<name>/` whatever the cwd (outside the VPK repo:
`<tmpdir>/vpk-html-capture/<name>/`), and a frames dir under any `artifacts/` folder is refused: frames are
disposable. The manifest defaults to the spec's folder, so an artifact's records stay in `<slug>/_film/`.
`capture.spec.mjs` takes the slug's name. Up to 20 page errors are recorded.

The frame list writes `option framerate <fps>` after each file (FFmpeg 5+). Without it, image2 gives each JPEG
1/25 s and constant-rate output duplicates an early frame: 88 of 91 held frames landed one slot late (FFmpeg 8.1.1).

## Encode (`scripts/media/encode.mjs`, presets in `presets.mjs`)

```
encode.mjs <capture-dir|frames.ffconcat|film.mp4> [--preset film|lite|hq] [--out film.mp4] [--width N] [--crf N] [--fps 30]
           [--gop N] [--target-bytes N] [--contact-sheet sheet.jpg] [--record <encode.json>] [--dry-run]
```

Every preset: `-fps_mode cfr -r <fps> -an -movflags +faststart -pix_fmt yuv420p`, bt709 tags, TV range, and
`scale=<w>:-2:flags=lanczos:out_range=tv`. Audio is always dropped (put narration in the cue text).

| Preset | Settings | Measured (FFmpeg 8.1.1) |
| --- | --- | --- |
| `film` (default) | 1280 wide, x264 `slow`, CRF 27 | EU26 frame list: **2,605,952 B, 1288 frames, 42.933 s** (original 1286 frames, 42.866 s; within 3 frames and 0.1 s). Landing film (82.03 s, supplied MP4): 739,547 B. Demo fixture (181 held frames): 42,846 B, 181 frames, 6.033 s, exactly the manifest. |
| `lite` | 640 wide; with `--target-bytes`, two-pass at `⌊target · 8 · 0.96 / duration⌋` b/s and one retry at 0.85 × target; otherwise CRF 32 | EU26 two-pass to 600,000 B: 612,139 B; CRF 32: 602,213 B. |
| `hq` | 1920 wide, x264 `slow`, CRF 22 | A derived MP4 deliverable (to share or archive), never embedded. It writes `film.hq.mp4` and `encode.hq.json` by default, so it cannot replace the film, and `embed.mjs` refuses a `*.hq.mp4`. Demo fixture frames: 84,710 B at 1920 × 1080, against the film's 42,846 B. |

`--gop 60` costs about 22% and only helps scrub-heavy films. `--contact-sheet` tiles 8 × 6 cells and prints their
film times: reviewing it is the privacy check before anything is embedded. A `.mp4/.mov/.m4v` input is the
supplied-film path (`-i`, duration from ffprobe, no manifest). `encode.json` (beside `--out` by default) records
`argv, ffmpegVersion, input, output, bytes, sha256_12, duration, frames, preset, width, retried`.

## Embed (`scripts/media/embed.mjs`)

```
embed.mjs <file.html> --film <film.mp4> [--manifest <capture.json>] [--film-id film-player] [--poster-time <s> | --poster <image>]
          [--no-poster] [--bake-thumbs] [--lite auto|always|never] [--lite-keep-review] [--budget-bytes N] [--root <dir>…] [--dry-run]
```

1. **Fence.** Inputs must resolve under the HTML's folder, `<cwd>/output/`, the temp dir or a `--root`; secret-looking
   names (`.env*`, `.ssh/`, `id_*`, `*.pem`, `*.key`, credentials…) and files over 50 MB are refused. Each input is
   printed as `embedded: <relative path> <bytes> sha256:<12>`; no absolute path reaches the HTML.
2. **Video.** `src="data:video/mp4;base64,…"` on `[data-vpk-film-video]` inside `#<film-id>`, keyed by the attribute.
3. **Film data.** The manifest's `fps`, `segments` and `marks` merged into the authored chapters and `posterTime`;
   `duration` from ffprobe, with the last segment ending there. `source`, `errors` and frame counts are not copied.
   A clock segment that starts more than a frame away from the authored one warns (check `clock_offset_s`).
   A cue or Gantt whose `data-clock` names a segment missing from the merged data would never seek, so embed stops
   with exit 1, names those cues and the segments it has, and writes nothing. Fix the id: `--segment-id`, the spec's
   segment id, or `film.clock_id`. `kit.mjs --check` warns about the same break in an embedded document.
4. **Poster.** A WebP still (1280 wide, q72) at the poster time, unless `--no-poster` (the kit then seeks to
   `posterTime` at runtime) or `--poster <image>`. Whenever embed bakes a poster it writes that frame's film time into
   the film data as `posterTime`, so the readout shows what the poster shows ("film 3.30 s" under a poster of film
   3.30 s) until the first play or seek, and the poster and the readout can no longer disagree.
5. **Thumbnails.** Drawn at runtime by default, with one detached video and sequential seeks. They start lazily, when
   the cue list nears the viewport, or at once when a reader asks for `vpkLab.ready` (so `pdf.mjs` gets drawn
   thumbnails) or the page goes to print. A thumbnail still drawing when printing starts prints as empty space, not
   as a grey box. `--bake-thumbs` inserts 360-wide WebP stills before each cue canvas.
6. **Provenance.** `[data-vpk-film-provenance]` gets the viewport, segments with frames and durations, fps, encoding
   and size, and, for held frames, the note that worker and iframe clocks are not held.
7. **Weight report** every run, plus the advisory size warning.

Embed edits only those parts. Doc ids, revision metas, `data-vpk-id` stamps, `script[data-vpk-revisions]` and
`script[data-vpk-review]` are untouched, and re-running embed is byte-stable.

## Size budget and the lite copy

Viewers that open HTML as a base64 `data:` URL render it blank above **1,572,846 B**
(`scripts/media/size-budget.mjs`, mirrored in `checks-thresholds.json`). Full browsers are fine. `check-html`
warns on stderr without changing the exit code, and names a remedy by what makes the file heavy:

| ≥ 40% of the bytes are | Remedy in the warning |
| --- | --- |
| video | Ship `<slug>.lite.html` (`embed.mjs` writes it automatically). |
| fonts | Run `build.mjs --inject-runtime <file>` (drops invalid `@font-face` payload) or `--refresh-library`. |
| images | Re-encode them (encode stills, WebP q60–72) or link them. |
| otherwise | Split the document or move media out of the HTML. |

With `--lite auto` (default) a film document over budget also gets `<slug>.lite.html`: the film re-encoded at 640
wide to `liteFilmTargetBytes = ⌊(budget − (html − filmDataUrlChars) − 16,384) · 3/4⌋` (EU26: 543,371 B) with one
retry, a 640 poster, `<html data-vpk-variant="lite">`, a lite note in the film panel (static `data-vpk-review-ignore`, not
`data-vpk-generated`, which kit init removes), no baked thumbnails, and no review-data block unless `--lite-keep-review`. Doc ids and
`data-vpk-id` stamps stay, so comments on the lite copy merge with the full file. Embed asserts the lite copy is
under budget and passes check-html, or exits 1 naming the bytes left for the film. `--lite always` writes it
regardless; `never` skips it. The lite copy records `data-vpk-lite-source="sha256:<12>"` on `<html>`: a hash of the
full copy without what `review sync-lite` keeps current (doc metas, `data-vpk-id`/`data-vpk-revision` stamps, review
and revisions blocks). When a run writes no lite copy but a `<slug>.lite.html` exists whose recorded source is not this
full copy (another film, or the same film with edited prose or figures), embed warns `stale lite copy: …` and leaves
the file in place: delete it, or refresh it with `--lite always`.

**Chapter still strip.** When the document's own bytes leave a lite film target under 120,000 B (a 640-wide film that
small is unwatchable), the lite copy drops the film instead of failing: no `src` on the video, a strip of chapter stills
(up to nine chapters, else five evenly spaced frames; 320 px WebP q50, each with a figure caption of its film time) after
the lite note, the film controls hidden, and the empty-state text saying why. The strip's CSS is a `<style
data-vpk-lite-strip>` in the head, and the strip carries `data-vpk-review-ignore`. The result line reads `chapter still
strip, film target N KB is below 120 KB`. If the page is still over budget even without the film, embed exits 1 and says
to move other media out of the HTML or pass a larger `--budget-bytes`.

## Enhancer cost

Kit roots carry `data-vpkh-no-lightbox`, so the enhancer ignores attribute changes inside them. Measured on a
template copy with a 6 s film, Chromium, 2 s of playback without scrolling: **0** `getBoundingClientRect` calls
with the current enhancer, against **4,800** with the enhancer block from before the opt-out (2026-10-13).

## Codecs and limits

- H.264 in MP4 plays in Chrome, Edge, Safari and Firefox. Some open-source Chromium and Electron builds lack it: the
  baked poster and the empty-state message cover them. Safari 17+ is a manual check, **pending (user-gated, B2
  decision 22)**: Playwright here has Chromium only, so WebKit is untested. Steps below.
- One film per colour scheme: dark-mode readers see the light film. The film panel frames it with `--rule`, so it
  reads as footage.
- No audio track: AAC would add about 0.5 MB per 80 s and conflicts with muted, inline playback.
- `alpha()`/`mix()` read back premultiplied canvas bytes, so translucent inputs are approximate.

### Safari 17+ manual check (pending, user-gated)

Run it once on macOS with Safari 17 or later, then replace "pending" above with the date, Safari and macOS versions
and the result of each step.

1. Open `.agents/skills/vpk-html/assets/demos/demo-motion-case-study.html` by double-clicking it (a `file://` page),
   and again from any local web server. If you have made one, repeat with a `.lite.html` copy and one that uses the
   chapter still strip.
2. Open Develop > Show Web Inspector > Console before the page loads. Expected: no errors or warnings.
3. The film panel shows the baked poster (the frame the readout names, "film 3.30 s" for the demo), not a black box.
4. Press the big play button. The film plays muted and inline, the readout counts up from 0.00, the beat panel and the
   current cue follow it, and the Gantt head moves.
5. Space and k pause and play; ← and → move half a second; `,` and `.` step one frame; `1` to `3` jump to chapters;
   dragging the scrub seeks and the picture follows.
6. Click each cue and each chapter button: the film seeks to its time (within about a frame) and the beat panel names
   the cue. Look at the picture too. At a cut it shows the new scene, not the last frame of the previous one. It
   matches the cue's thumbnail when one is drawn. Click the Gantt: the film seeks there. Press ↑ and ↓ on the Gantt: the film moves 0.1 s and the page does
   not jump to another section.
7. Scroll to the run of show: the cue thumbnails fill in within a second or two. (WebKit may refuse to draw a data-URL
   video into a canvas; the kit then paints the sunken tone, which is acceptable.)
8. Switch the theme (the page's theme control) and reload: the canvases of the labs redraw in the new theme.
9. If the film does not play at all, the poster and the empty-state message must still show with no console errors.
   Record that as the result: it is the documented fallback, not a kit failure.

Record, per step, pass or fail, any console message verbatim, and one screenshot of the film panel.

## Tests

```bash
OPENSSL_CONF=/dev/null node --test .agents/skills/vpk-html/scripts/media/{ffconcat,presets,embed,capture,capture-clock,size-budget}.test.mjs
VPK_HTML_BROWSER=1 node --test .agents/skills/vpk-html/scripts/media/pipeline.browser.test.mjs   # unsandboxed; Playwright + ffmpeg
```

The browser test captures the fixture (hold 0–6 s, then a screencast of its live throw), checks the film against
the manifest (hold: exactly 181/181 frames; with the screencast: within 3 frames), finds the card in frame
`f00030` where the fixture's maths puts it (957 px against 956.38 px), embeds into a rendered template copy, and
writes a lite copy at the non-film bytes plus 200,000 B. It also writes a still-strip lite copy at the non-film bytes
plus 60,000 B and opens it in light and dark; captures a page animated by rAF, a CSS animation and a timer chain on the
virtual clock (frame 30: 200, 200 and 150 px, the same at a 0 ms and a 150 ms settle); checks the cursor overlay in
screencast frames (83 dark pixels beside the glide's end point, none without `cursor`); and encodes the `hq` preset.

The modules: `capture.mjs` (spec normalisation, manifest, CLI), `capture-run.mjs` (the browser half: hold, virtual and
screencast drivers, `runCapture`) and `capture-clock.mjs` (the virtual clock, the cursor overlay and the `glide` path).
The page-side scripts are unit-tested in a `vm` and in happy-dom (`capture-clock.test.mjs`); a run needs the browser.
