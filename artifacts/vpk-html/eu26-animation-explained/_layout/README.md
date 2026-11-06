# Anchored story layout

This is the reusable layout proposed for VPK HTML. The Jira animation is its first concrete document.

- `story-shell.mjs` renders one set of steps, an illustration slot, an appearance slot and a source appendix.
- `story-layout.css` supplies the anchored reading layout and responsive Page, Slides, X Threads and Video views.
- `story-layout.js` owns navigation and scroll progress. It has no Jira or renderer dependency.

Supply `{ id, title, description, body, time }` for each step. `time` is the renderer's authored position; it does not have to equal a clock second. The optional `seconds`, `href` and `source` fields add a display time and a source link. Supply the existing hero and controls through the `hero` slot, and appearance controls through `appearance`.

Inline the CSS and runtime into an existing VPK HTML document, preserve its embedded fonts, theme and figure runtime, and set these body attributes:

```html
<body data-vpk-layout="story" data-vpk-docnav="off" data-vpk-enhancements="off">
```

The generic layout emits `vpk:story-frame` with `{ index, time, reason, mode }`. Connect that event to the figure adapter: scrolling seeks an exact pose, while navigation can animate between states. Call `root.story.follow()` when the renderer is ready. The current adapter is in `../_figures/explorer.js`.

The figure calls `root.story.reflect(index, time, { scroll, previewIndex, playing })` to reflect its committed chapter and temporary preview. The illustration scrubs continuously, while text stays at a fixed reading position within each chapter and changes instantly at the next chapter boundary. Text has no scrolling, sliding or fading transition. Hover leave restores the prior reading position; dragging commits the selected chapter. Ordinary page scrolling remains native. Programmatic chapter alignment preserves focus and never feeds back into the player clock.

All views reuse the same hero. Page interpolates between heading anchors below the pinned stage at every viewport; Slides exposes one step; X Threads uses short summaries with expandable detail. Video plays the coded diagram with a finite duration and scrubbable progress. Reduced motion selects discrete still states. Native scrolling is never intercepted, and the optional CSS reading indicator progressively enhances supported browsers. The native page scrollbar uses the yellow-orange accent.

Build this document with:

```sh
node artifacts/vpk-html/eu26-animation-explained/_figures/build-explorer.mjs
```

This kit is a reviewable candidate for a future single-layout VPK HTML. The current template catalog has not been consolidated into it.

## Vertical timeline

All views share distance-based tick-length scaling. The active mark starts at the normal size; it and neighboring marks grow toward a 32px peak as the pointer approaches, then return to normal on leave. Slides ticks share a bottom baseline and grow upward. Reduced motion retains normal lengths and active color.

The `controls` shell slot sits outside the sticky illustration. `footer-timeline.js` owns one fixed right-edge rail; `footer-timeline.css` is its only visual owner. The legacy filename is retained by this artifact builder. Normal marks use a uniform grid independent of chapter timing, with no faint intermediate subdivisions. Pixel-aligned spacing is equal across the entire rail and stays equal during vertical hover expansion. The orange indicator colors an existing tick instead of floating between rows. All strokes stay one pixel thick and share a fixed right anchor. Navigation exposes chapter names without timestamps or counters.

Slides replaces the tick ruler and Frames button with a left-to-right carousel of chapter thumbnails, centred under the figure page: hover previews a slide, click or Enter selects it, the arrow keys step the deck (story-layout.js owns the page-level arrows) and the strip keeps the current slide centred. The unused control set is `hidden` and `inert`. Page renders one tick per chapter with a continuous native range. Fractional positions interpolate between adjacent authored chapter times; rail hover previews use that same continuous mapping. Removing intermediate marks never removes intermediate animation frames. Arrow keys still navigate whole chapters. Tick gaps share a 20px target in both orientations and shrink together on constrained viewports. Rail dimensions derive from the tick count and shared gap, while opposing fixed insets and automatic margins keep vertical rails centered below navigation. Video adapts its mark density to fit the same gap. The Frames gallery stays within the available height.

`timeline-motion.mjs` owns the chapter grid, nearest visual tick, proximity wave and bounded spring. Only the full-length normal ruler marks are rendered in vertical views. The builder inlines its factory with the canonical shared VPK magnetic normalization function. A 20px engagement zone and 26px approach range follow the inspected reference; the existing Awake spring response supplies settling. Only decorative transforms and opacity move. The native input stays stationary. Every view retains continuous scrubbing, and switching modes preserves exact player time. Pointer leave, blur, visibility changes, touch and reduced motion return the field to rest. See `marks-reference.md` for the source and acceptance contract.

The renderer adapter supplies states, duration, playback rate, pre-rendered SVG snapshots, compiled VPK icon markup and callbacks. The native vertical range keeps exact authored progress. Hover and focus reveal one chapter thumbnail and name, clamped within the viewport and following the active chapter vertically as progress changes. Ordinary reading keeps thumbnails hidden. Tick count is bounded for longer sequences.

Play and Frames stay on the rail. Only Frames opens the full vertical chapter gallery, with Previous, Replay and Next controls. Closed previews are inert and have no card tab stops. Escape restores focus before making the panel inert; touch scrolling never commits a swiped card.

Preview cards size to their actual image and caption, with non-scaling diagram strokes. Native snap alignment and keyboard centering both use the card center. These behaviors are guarded by `../_figures/vertical-timeline.behavior.test.mjs`.

From 1024px the page has two columns: the reading page on the left (up to 540px) and a sticky figure page on the right, a paper card holding only the drawing and its ground grid (no corner labels). There is no Follow scroll button; a native scroll resumes following. The reading line sits 40% down the viewport below the bar. Narrower viewports keep the stacked layout: the figure pins above the text and headings land just below it. Each step can carry a real source excerpt rendered by `.agents/skills/vpk-html/scripts/code/highlight.mjs`. The shared contract is `.agents/skills/vpk-html/references/paper-system.md`.

Cursor sizing accounts for both viewport dimensions when the SVG is letterboxed. Reading-link scroll margins clear the pinned diagram. Its opaque backdrop reaches through the page gutters. Right-side placement, stroke geometry, viewport containment and chapter behavior are covered by the browser suite.

## Coded Video preview and explicit export

Video has a separate time-based playhead outside the magnetic tick field. It follows exact committed playback time over the finite video duration, including fractional positions between marks, and stays within the native track bounds. Hover previews do not move it. Play, pause, scrub and resize use the existing player clock; no additional animation loop is introduced. Other views keep only their chapter tick indicator.

Video moves the existing timeline into its own panel and changes it to a horizontal ruler. The native range, transport, chapter previews and Frames gallery share the same DOM nodes. Video adds responsive intermediate marks, independent five-second timestamp labels and an elapsed/total readout. Page and X Threads use vertical rails; Slides keeps its horizontal footer. There is one progress input and no separate player progress bar.

`video-view.js` controls the existing HTML/SVG player. Entering Video, playing and seeking never request a render and never load an MP4. Only clicking Generate video sends a render request. The local Hyperframes composition in `../_video/project/` seeks the same animation model frame by frame.

Build the HTML and composition, then start the local exporter:

```sh
node artifacts/vpk-html/eu26-animation-explained/_figures/build-explorer.mjs
node artifacts/vpk-html/eu26-animation-explained/_video/prepare-project.mjs
node artifacts/vpk-html/eu26-animation-explained/_video/render-server.mjs
```

Open the local URL printed by the exporter for same-origin generation. The exporter adds its temporary capability to the served page; the checked-in HTML contains no export credential. The single HTML file remains usable offline for preview. Generating an MP4 requires the local exporter and Hyperframes 0.7.62, which `npx` installs on the first render if needed. Export setup and tests do not generate a video. Each user-requested export writes a separate folder under `../_video/exports/`.
