# Third-party notice: the vpk-html hairline engine

`scripts/hairline/vendor/` holds verbatim files from hairline, `github.com/lucasmarkes/hairline` (the
`@lucasmarkes/hairline` package, version 0.5.1), MIT License, Copyright (c) 2026 Lucas Marques. The pin, the
fetch command and the sha256 of every file are in `vendor/VENDOR.json`; the licence text is `vendor/LICENSE`.
Nothing in `vendor/` is edited here: re-vendor by replacing the folder whole.

- `vendor/packages/hairline/src/`: the package source, the 33 figures and their core. It matches the sources
  in the published package's sourcemap byte for byte.
- `vendor/apps/site/public/skill/hairline-{vercel,mastra,notion}.html`: the site's Marks shelf. These are
  hairline-create pages that are not in the package; the gallery bundles only their `hl-figure` module. The marks
  are tributes: they belong to their owners, and neither hairline nor vpk-html is affiliated with them.

The vpk adaptation lives beside the vendor folder and never patches it:

- `inline.mjs` bundles the figures a page shows with esbuild (tree-shaken), writes upstream's stylesheet with
  its raw-hex palette fallbacks swapped for vpk tokens, and builds the plate markup.
- `runtime/stage.mjs` re-exports `core/stage.ts` with `register` taken from the shared `window.vpkFrameLoop`
  (`runtime/loop.mjs`) and `tour` (the `play` option) stubbed out; `runtime/styles.mjs` stands in for the
  stylesheet injection; `runtime/kernel.mjs` and `runtime/marks.mjs` give the Marks figures the `HL` object and
  the mount the hairline-create bench gives them; `runtime/boot.mjs` mounts each host and wires `onRead` to the
  plate's readout.
- `figures.mjs` lists the 36 figures by shelf, with the site's names and summaries.

In shipped HTML the runtime block (`<script data-vpk-hairline-runtime>`) starts with a one-line notice naming
hairline, its licence and copyright, and this file. `SKILL/LICENSE` carries the project-level entry.

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
