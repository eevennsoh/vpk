# distortion-waves Integration Notes

- Upstream package: `distortion-waves@0.1.0` (pinned exactly in `package.json`)
- Source: `https://github.com/Jakubantalik/Libraries.dev` (`packages/distortion-waves`)
- Demo: `https://libraries.dev/waves`
- License: `MIT` (see `LICENSE`)
- Status: **imported, not forked.** `index.tsx` is a thin alias; `data.ts`
  holds VPK-only demo/GUI metadata. No upstream source lives here.

## Release-age exclusion

`0.1.0` was published on 2026-11-18, inside the repo's seven-day
`minimumReleaseAge` gate. It was added at the user's explicit request with a
version-pinned `minimumReleaseAgeExclude` entry in `pnpm-workspace.yaml`.
The tarball was reviewed first: no dependencies, no install scripts, and its
only `fetch` calls inline same-page stylesheets and images for the DOM
snapshot. Delete the exclusion once `0.1.0` is older than the gate.

## How it renders

The wave pictures the element's DOM (SVG `foreignObject` snapshot) and bends
that picture in a WebGL2 canvas. Consequences for consumers:

- Views need an opaque background, or one behind the whole element.
- `overlay` is skipped by the snapshot and stays live above the canvas.
- Without WebGL2 or under reduced motion (`reducedMotion: "system"`) the
  wave becomes a crossfade, so callers need no extra reduced-motion gate.

## The Tailwind border fix lives in `capture.ts`

Upstream's snapshot writes only styles that differ from a blank-iframe
baseline. Tailwind's preflight sets `border: 0 solid` on every element, so the
picture kept `border-style: solid`, dropped the `0px` width, and drew a 3px
grey box around every element inside the lens. VPK's `DistortionWave` passes
`captureWithTailwindBorders` as the default `capture`: upstream's built-in
capture, copied, plus a `force` hook that writes the zero widths back. Delete
it and the wrapper's `capture` default once upstream compares border widths
together with their styles; until then, re-copy upstream's capture overrides
on every upgrade.

## On upgrading

`data.test.js` checks that every GUI knob still exists on upstream's
`WaveStyle` and that each range brackets the per-type defaults. Verify
rendered pixels too, not just typecheck and tests.
