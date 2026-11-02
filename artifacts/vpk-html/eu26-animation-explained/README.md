# From Done to an endless wall

An offline, interactive explanation of the Jira Team '26 Europe finale, from a
card drop to the scrolling mega wall. Open `eu26-animation-explained.html` for
the Page, Slides, X Threads and coded Video views.

The illustration and player live in `_figures/`; the reading layout and timeline
live in `_layout/`. After editing them, rebuild the HTML from the repository root:

```sh
node artifacts/vpk-html/eu26-animation-explained/_figures/build-explorer.mjs
```

Run the tracked browser and model tests serially to avoid contention during the
real-time playback check:

```sh
git ls-files -z 'artifacts/vpk-html/eu26-animation-explained/_figures/*.test.mjs' 'artifacts/vpk-html/eu26-animation-explained/_video/*.test.mjs' | xargs -0 node --test --test-concurrency=1
```

For the optional local video exporter, build the composition and start its server:

```sh
node artifacts/vpk-html/eu26-animation-explained/_video/prepare-project.mjs
node artifacts/vpk-html/eu26-animation-explained/_video/render-server.mjs
```

Open the printed preview URL and click Generate video to render. Opening, playing
or rebuilding the preview does not render a video. See `_layout/README.md` for
the layout, timeline and export details.
