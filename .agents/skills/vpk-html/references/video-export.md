# Video Export

Two different things are called video here. A **captured film** goes the other
way: a running page is held one frame at a time (or screencast), encoded to
H.264 and embedded *into* an HTML document, as in `motion-case-study.html`. That
pipeline is `scripts/media/{capture,encode,embed}.mjs`; see
[media pipeline](media-pipeline.md). This page covers the second thing: turning
a **deck into an MP4** deliverable.

vpk-html's browser presentation mode does not render MP4. Video export is a
conversion contract: re-author the deck into a HyperFrames general-video
composition.

## Contract

| vpk-html deck | Hyperframes composition |
|---|---|
| `section.slide` | scene `<div data-composition-id data-start data-duration>` |
| slide content groups | `.clip` children with entrance timing |
| `.speaker-notes` | narration script |
| `--font-*` / color tokens | copied into composition CSS |
| slide order | one continuous timeline |

Do not use slideshow mode for MP4; it is for browser playback, not rendered
video.

Use `assets/video/landing-demo-separation/` as the first worked example of this
contract.

## Timing

1. Extract each slide's speaker notes.
2. Generate narration with the best available TTS provider; use local Kokoro as
   the fallback.
3. Set slide dwell to narration duration plus padding.
4. Use a minimum dwell for slides without notes.
5. Accumulate `data-start` values across one continuous timeline.

## Animation

Mirror vpk-html's motion semantics:

- entrance clips use the same order as the deck's visual reading path
- use the vpk entrance duration/easing unless the scene needs slower narration
  alignment
- build paused GSAP timelines on `window.__timelines` so Hyperframes can seek
  deterministically

## Audio

Use narration as the primary track. Add subtle background music only when it
does not compete with speech. Duck BGM under narration.

## Render

Load the Hyperframes skills for the selected environment, then render only after
the user approves a video export:

```bash
npx hyperframes render --quality high
```

The rendered MP4 is derived output; the source of truth remains the vpk-html
deck and the generated Hyperframes composition.

## Worked Example: Landing Demo Separation

Example directory:
`assets/video/landing-demo-separation/`

Source deck:
`assets/demos/demo-slides.html`

This example re-authors the five-slide "Landing Demo Separation" deck into a
narrated HyperFrames composition. The speaker notes become the narration script;
the scene DOM contains only visible slide content.

### Scene Mapping

| Scene | Source slide | Visual content | Start | Duration | Narration |
|---|---|---|---:|---:|---|
| 1 | Cover | title, subtitle, metadata, source/browse/check stack | 0.0 | 20.3 | `audio/s1.mp3` |
| 2 | `01` | before/after catalog contract panels | 20.3 | 16.1 | `audio/s2.mp3` |
| 3 | `02` | document mocks, diagram mocks, regression guard cells | 36.4 | 21.4 | `audio/s3.mp3` |
| 4 | `03` | placeholder rule plus pinned callout | 57.8 | 12.7 | `audio/s4.mp3` |
| 5 | `04` | closing counts and future-addition rule | 70.5 | 11.5 | `audio/s5.mp3` |

Scene dwell is narration duration plus 1.2 seconds of lead-in and 0.8 seconds
of tail, rounded to one decimal. The example root duration is 82 seconds.

### Narration Generation

The checked-in narration was generated from `audio/audio_request.json` using
Kokoro TTS voice `am_michael`; provenance is recorded in `audio/audio_meta.json`.
The committed MP3 files are `audio/s1.mp3` through `audio/s5.mp3`.

Provider order for new examples:

1. Use HeyGen or ElevenLabs when the orchestrator has an approved voice/provider
   slot and the user wants that provider.
2. Fall back to local Kokoro when external credentials are absent, rate-limited,
   or not needed.

Orchestrator-side audio generation should keep the request file with the
composition. A typical helper invocation is:

```bash
HYPERFRAMES_PYTHON=/path/to/hyperframes/.venv/bin/python \
node /path/to/hyperframes/scripts/audio.mjs \
  --request .agents/skills/vpk-html/assets/video/landing-demo-separation/audio/audio_request.json \
  --out .agents/skills/vpk-html/assets/video/landing-demo-separation/audio
```

`HYPERFRAMES_PYTHON` should point at the HyperFrames Python virtualenv that has
Kokoro dependencies installed. The `audio.mjs` helper is orchestrator-owned; the
vpk-html skill commits the request, metadata, and resulting audio assets needed
for deterministic composition playback.

### Composition Anatomy

`index.html` mirrors the checked-in HyperFrames reference shape:

- the root `div data-composition-id="landing-demo-separation"` is a direct child
  of `body`
- five scene divs use `class="clip"`, explicit `data-start`, `data-duration`,
  and `data-track-index="0"`
- five voiceover `<audio>` elements are direct children of the root, starting
  1.2 seconds after their scene begins
- the optional user-provided music slot is a commented root child targeting
  `audio/bgm.mp3`
- one synchronous `gsap.timeline({ paused: true })` is registered at
  `window.__timelines["landing-demo-separation"]`
- CSS resolves vpk-html identity values into standalone literal colors and
  font stacks; the composition does not load `styles.css` or webfonts

The composition must stay deterministic: no random values, no wall-clock time,
no autoplaying media, no display/visibility animation, and no network beyond the
GSAP CDN script.

### Verify

Run structural checks from the example directory:

```bash
cd .agents/skills/vpk-html/assets/video/landing-demo-separation
npx --yes hyperframes@0.7.45 lint
npx --yes hyperframes@0.7.45 validate
npx --yes hyperframes@0.7.45 snapshot . --at 12,29,50,65,77
```

Then preview for human scrubbing:

```bash
npx --yes hyperframes@0.7.45 preview
```

Render is user-gated and orchestrator-owned:

```bash
npx --yes hyperframes@0.7.45 render --quality high
```
