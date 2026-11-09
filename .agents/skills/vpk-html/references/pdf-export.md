# Optional PDF export

Owner of PDF export for [SKILL.md](../SKILL.md). Load when you derive a PDF.

vpk-html is **HTML-first**: the single-file HTML artifact is always the source of truth. PDF is an **optional, derived** output for when a recipient needs a fixed-page document (print, attachment, archival).

## The PDF is a Chromium snapshot of the HTML

| Rule | Detail |
| --- | --- |
| Node-only, no Python | Headless Chromium via Playwright (`page.pdf()`), the same engine `--verify` drives; no WeasyPrint |
| Derived, never authoritative | Export never modifies the HTML or relaxes an offline invariant; `scripts/check-html.mjs` still governs the HTML |
| Offline in, offline out | Fonts are base64-inlined in the HTML, so Chromium embeds them; no network fetch at export or view time |

## Usage

```bash
node scripts/build.mjs --pdf artifacts/vpk-html/q2-status/q2-status.html
node scripts/build.mjs --pdf artifacts/vpk-html/q2-status/q2-status.html --out artifacts/vpk-html/q2-status/q2-status.pdf
```

Programmatic:

```js
import { exportPdf } from "./scripts/pdf.mjs";
await exportPdf("artifacts/vpk-html/q2-status/q2-status.html", "artifacts/vpk-html/q2-status/q2-status.pdf"); // → { ok, out, bytes }
```

## The template’s @page size wins, else A4

`page.pdf()` is called with `preferCSSPageSize: true` and `printBackground: true`:

| Template declares | PDF page |
| --- | --- |
| `@page { size: 280mm 158mm; }` (slides) | Landscape slide geometry |
| `@page { size: letter; }` (letters) | Letter |
| No `@page` size | **A4** |

## The PDF renders the print layer, so keep it self-sufficient

| Wrong | → Right |
| --- | --- |
| Drop caps, dotted dividers or masthead sizing only inside `@media screen` | → the same treatment in `@media print` or unscoped CSS |
| Checking PDF quality against the on-screen HTML only | → open the PDF; print-CSS parity is part of "done" for an exportable template |

Chromium emulates **print media** when generating a PDF, so the export renders a template’s `@media print` / unscoped CSS, *not* its screen-only override block (`@media screen`: drop caps, dotted dividers, masthead sizing, etc.). This is by design: the print layer is the one that paginates cleanly. When adding or editing a template, keep its **print layer self-sufficient** so the PDF is not visually degraded relative to the on-screen HTML.

Because PDF is optional, a weak print layer never blocks the core HTML path, but it does reduce PDF quality, so treat print-CSS parity as part of "done" for any template likely to be exported.
