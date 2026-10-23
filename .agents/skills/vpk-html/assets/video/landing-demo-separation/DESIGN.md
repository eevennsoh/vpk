# Landing Demo Separation Video

## Source

- Source deck: `.agents/skills/vpk-html/assets/demos/demo-slides.html`
- Video composition: `.agents/skills/vpk-html/assets/video/landing-demo-separation/index.html`
- Source structure: five slides, with speaker note text converted into narration and excluded from the scene DOM.

## Conversion Decisions

- Format: HyperFrames `general-video`, 1920x1080, 82 seconds.
- Scene timing: each scene dwell equals narration duration plus 1.2 seconds of lead-in and 0.8 seconds of tail, rounded to one decimal.
- Visual identity: Algebrica editorial video treatment using literal ADS token values from vpk-html (`references/tokens.json`): pure white surface `#ffffff`, ink `#292a2e`, muted text `#505258`, and hairline rules `#dddedd`.
- Typography: `"Geist", -apple-system, "Helvetica Neue", sans-serif` for display/body and `"Geist Mono", "SFMono-Regular", Menlo, Consolas, monospace` for labels, paths, and numbers. No webfont or base64 font dependency.
- Motion: a single paused GSAP timeline registered at `window.__timelines["landing-demo-separation"]`, with restrained opacity and 8-16px transform entrances. No autoplay, loops, randomness, visibility animation, or display animation.

## Audio Provenance

- Narration provider: Kokoro TTS.
- Voice: `am_michael`.
- Request file: `audio/audio_request.json`.
- Metadata file: `audio/audio_meta.json`.
- Rendered narration files: `audio/s1.mp3` through `audio/s5.mp3`.
- Scene audio starts at scene start plus 1.2 seconds, so the visual lead-in completes before narration begins.

## User-Provided Track Slot

The composition includes a commented `audio/bgm.mp3` slot. To use it, drop a user-provided file at that path, or register/copy it through `media-use resolve --from` before rendering. Keep `data-volume` low, around `0.18`, unless the track is pre-ducked. For speech-forward videos, run the `audio-duck.mjs` helper against the music bed so narration stays primary.
