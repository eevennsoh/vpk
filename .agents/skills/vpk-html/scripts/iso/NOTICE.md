# Third-party notice: the vpk-html iso kit

`scripts/iso/` builds on two MIT-licensed projects. Nothing here is copied wholesale; the pieces
below were ported or adapted, and each ported function carries a header comment pointing here.

## hairline

- Upstream: `github.com/lucasmarkes/hairline` (the `@lucasmarkes/hairline` package), MIT,
  Copyright (c) 2026 Lucas Marques. Port frozen 2026-10-12 against the locally installed
  `hairline-create` kernel (`kernel.js`, sha256 `3a19aa26…74991c`), which bundles the package's
  `src/core` unchanged.
- Ported or adapted:
  - `packages/hairline/src/core/motion.ts`: the spring (`spring`, `stepS`, k 100, c 18, m 1,
    sub-stepped at 240 Hz) and the 700 ms tween on `cubic-bezier(.32, .72, 0, 1)` (`tween`, `tset`,
    `tval`, `tdone`, `bezier`, `EASE_LIFT`) in `runtime.mjs`. Adaptation: reduced motion is an
    explicit argument read from `window.vpkFrameLoop`, not module state, and `bezier` solves by
    bisection only.
  - `packages/hairline/src/core/iso.ts`: the convex `hull()` in `core.mjs`.
  - Behaviour semantics: the `select` lift (rules 01 rest-silhouette hit tests, 02 distance
    stagger, 04 tween for discrete choices and spring for continuous input, 08 the active state is
    a stroke) and the `exploded.ts` pointer-x gap preview, in `runtime.mjs`.
  - Rule 07 (loops sleep) through the shared `window.vpkFrameLoop` (`runtime/frame-loop.mjs`).
  - The zero-specificity `:where()` CSS approach, in `runtime-css.mjs`.
- Not ported: the camera (`Cam`, `proj`, `unproj`), `fade`/`reflect`/`ghost` (they use raw-colour
  gradient masks), `field`, `tour`, and the raw-hex palettes. Projection comes from the vendored
  anatomy kit instead.
- Separately, the `hairline` figure engine vendors hairline 0.5.1 whole and unmodified in
  `../hairline/vendor/`; its notice is `../hairline/NOTICE.md`.

```
MIT License

Copyright (c) 2026 Lucas Marques

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## anatomy

- The iso kit imports its geometry (`iso`, `depthOf`, `pathOf`, `fitProjection`, `extrude`,
  `slabOf`, `cylinder`, `ring`, `planOutline`, `lineOnTop`) from the vendored anatomy kit,
  `../anatomy/vendor/kit/iso-kit.mjs` (MIT, Copyright (c) 2026 Ryan, commit `dbf697a`). Its licence
  is `../anatomy/vendor/LICENSE`; the pin and hashes are in `../anatomy/vendor/VENDOR.json`.

## 3d-assembly-manual

- The kit's one style, `manual` (`palette.mjs`, `scene.mjs`, `emit.mjs`, `motion.mjs`, `layout.mjs`) restates, in
  grayscale SVG, the drawing language of the `design/3d-assembly-manual` skill in
  `github.com/SkylarKitchen/skills` (MIT): ink hairlines at about 0.72 opacity on a white model, 20 px
  numbered ink discs with a paper ring, boxed dimension labels, a scale bar and 700 ms ease-out landings. The
  kit has since replaced the upstream's accelerating stagger and destination ghost with an even, overlapping
  stagger and no ghost (`accent.mjs` ENTRY). No code is copied; the
  upstream is Three.js. Project-level entry: `SKILL/LICENSE`.

## In shipped HTML

The inlined runtime block (`<script data-vpk-iso-runtime>`) starts with a one-line notice naming
hairline, its MIT licence and copyright, and this file. `SKILL/LICENSE` carries the project-level
entries for both upstreams.
