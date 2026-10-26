# Third-party notice: the vpk-html anatomy-gl engine

`scripts/anatomy-gl/vendor/` holds verbatim files from anatomy-figures, `github.com/wheresryan22/anatomy-figures` (the
`anatomy-figures` npm package, version 0.1.0), MIT License, Copyright (c) 2026 Ryan. The pin, the fetch command and the
sha256 of every file are in `vendor/VENDOR.json`; the licence text is `vendor/LICENSE`. Nothing in `vendor/` is edited here:
re-vendor by replacing the folder whole.

- `vendor/dist/element/<slug>.js`: the custom-element entry of each of the anatomy collection's ten WebGL figures
  (afterburner, glass-furnace, tokamak, plasma-cutter, forge, turbofan, power-station, process-pump, foundry, reactor).
- `vendor/dist/chunks/`: only the chunks those ten entries import: each figure's drawing, live code and fragment shaders,
  plus the package's shared plate, camera, WebGL helper and theme table.

Why vendor rather than rebuild: the flame, plasma, arcs, sparks, molten steel and Cherenkov light are fragment shaders
ray-marched against each figure's geometry every frame. An SVG figure cannot reproduce them, and a port would drift from
the original. The page runs the vendored figures themselves.

The vpk adaptation lives beside the vendor folder and never patches it:

- `inline.mjs` bundles only the figures a page shows with esbuild into one inline script (offline, single file), writes
  the plate CSS, and boots each figure with upstream's own token API: `render(host, { theme, tokens })` sets every
  `--anatomy-*` colour from vpk-html's ramp (plates, hairlines, mono text) and makes the lit part the iso kit's orange
  accent. The boot follows the page theme and remounts on a theme change (upstream's teardown releases the WebGL contexts).
- `figures.mjs` lists the ten figures with titles and summaries from their pages on skills.wheresryan.sh.

In shipped HTML the runtime block (`<script data-vpk-anatomy-gl-runtime>`) starts with a one-line notice naming
anatomy-figures, its licence and copyright, and this file.

```
MIT License

Copyright (c) 2026 Ryan

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
