# Quality gates

Optional, **advisory** content-quality checks for finished artifacts. They are
heuristics, not correctness checks — they catch the kinds of layout/typography
weaknesses that make a generated document look unfinished. By default they only
**warn**; pass `--strict` to make findings fail the process (exit 1).

kami's equivalents are PDF/pixel-based. vpk-html is HTML-first, so these are
re-grounded on the same headless-Chromium DOM that `--verify` opens
(`scripts/gates.mjs`). They never modify the artifact. Thresholds live in
`references/checks-thresholds.json`.

## Running

```bash
node scripts/build.mjs --check-density        <file> [--strict]
node scripts/build.mjs --check-resume-balance <file> [--strict]
node scripts/build.mjs --check-rhythm         <file> [--strict]
node scripts/build.mjs --check-orphans        <file> [--strict]
node scripts/build.mjs --check-focal          <file> [--strict]
node scripts/build.mjs --check-motion-budget  <file> [--strict]
node scripts/build.mjs --check-caption-echo   <file> [--strict]
node scripts/build.mjs --check-layout         <file> [--strict]
# or run several directly:
node scripts/gates.mjs <file> --check-density --check-orphans --check-focal
```

Page weight and the data-URL budget are reported by `--verify` and
`check-html.mjs` (advisory; see production.md § Size budget). SMIL behaviour is
checked by `--verify` and `scripts/runtime/smil-starter.mjs --sweep`.

Raw templates keep their `{{...}}` placeholders by design, so `check-html.mjs` and the gates above apply to filled
demos and artifacts. Gate a template with `build.mjs --check-templates` (B2 decision 4).

## The gates

### density
Flags a `section` (taller than `minSectionHeightPx`) whose **trailing empty
space** exceeds `maxTrailingRatio` (default 25%) of its height, when it is not
the last section. Symptom: a section padded with whitespace instead of content —
often the "emptiness" anti-pattern wearing a full-height box.

### resume-balance
For paged content, estimates pages as `scrollHeight / pageHeightPx` (default A4
1123px). If the document spills just past a page boundary and the final page is
less than `minLastPageFill` full (default 20%), it warns to tighten the content
to fit. Only runs once the document is at least `onlyWhenPagesAtLeast` pages.

### rhythm
For slide decks, fingerprints each slide by its child structure (count, heading
count, child tag sequence) and warns when `maxIdenticalConsecutive` (default 3)
or more **consecutive** slides share an identical fingerprint — a monotonous deck
that needs layout variety.

### orphans
Measures each paragraph/list-item with `Range.getClientRects()`. A block longer
than one line whose **last line** is both narrow (< `minLastLineWidthRatio` of
the widest line) and a short word (< `minLastLineChars`) is flagged as a widow.
Symptom: a lone short word dangling on its own line.

Headings (h1-h3) are too short for that test, so they get their own. A heading
of three or more words is widowed ("one / clock") when its last word sits alone
on the last line. That line must also be narrower than
`minHeadingLastLineWidthRatio` (0.5) of the widest line. Fix:
`text-wrap: balance` on the heading rule.

### focal
Counts uses of `var(--focal)` inside ordinary SVGs. More than
`maxFocalElements` warns because diagrams should keep one darkest-ink focal
element. SVGs marked `data-vpk-illustration` are exempt from this advisory
count, but they still need to follow the grayscale `--ill-*` figure grammar.

### motion-budget
Scans authored CSS motion durations in `<style>` blocks and inline styles. Any
resolved numeric duration above `maxDurationMs` (default 300ms) warns. This is a
polish gate for slow-feeling artifacts; use shared `--vpk-dur-*` tokens when
possible. The shared house style (the `vpk-shared` and `vpk-algebrica-v2` CSS
regions and the trailing `vpk presentation mode` CSS) is skipped, so a clean
template stays clean and findings are the author's own motion.

### caption-echo
Compares figure captions with nearby headings, SVG titles, and `aria-label`
text. A caption that repeats the title without adding an insight warns. Fix by
stating what the reader should learn from the figure, not what the figure is.
Words count once and words of 2 characters or fewer never count. A heading
echo needs `minSharedWords` shared words. An SVG title or `aria-label` is a long
sentence, so there the shared words must also be `minCaptionCoverage` (0.6) of
the caption's own content words. Check each finding against the
[writing](writing.md) "adds to its heading" box. Do not dismiss it.

### layout
`build.mjs --check-layout <file> [--strict]` loads the file in headless Chromium at the gate viewport and runs
`scripts/review/layout-audit.mjs` `measureLayout`, the same audit as the review drawer's Layout tab. It reports
`page-horizontal-overflow` (the page scrolls sideways), `clipped-text` and `clipped-control` (cut off by a clipping
ancestor), and `overlapping-text` (text under an opaque surface), each as `- rule · target · amount at <width>`.
Intended truncation (ellipsis, line clamp), scrollers, hidden and 1px elements, svg and the review UI are skipped.
Advisory; `--strict` exits 1 on findings. Thresholds: `checks-thresholds.json` → `layout`
(`minOutsidePx`, `minOutsideRatio`, `minOcclusionRatio`, `minOcclusionSamples`, `maxFindings`).

### iso (static, always available)
`node scripts/build.mjs --check-iso <file> [--strict] [--json]` audits every iso-kit plate
(`scripts/iso/audit.mjs`): A1 grayscale paint (plus the one accent pair of `scripts/iso/accent.mjs`), A2 ≤ 5 face fills, A3 one focal on the accent faces, A4 stroke widths
and the one style (`data-vpk-iso-style="manual"`), A5 painter order, A6 guides before plates, A7 labels outside, leaders on target and one numbered
`data-vpk-iso-tag` per label for narrow stages (the pose and slider-stop checks also run from the HTML), A8 label
type, A9 ids, A10 camera, A11 static art, A12 SMIL assembly, A15 local patterns, A16 guide grammar,
A17 weight and precision. Advisory unless `--strict`; `scripts/iso/build-figure.mjs` treats errors
as fatal: `--inject` writes nothing while the audit has errors and warns when the document's engine meta does not
cover `iso-kit`. Exit codes: 0 ok, 1 errors under `--strict`, 2 a missing file or usage. A13/A14 (pointer, loop)
run in `tests/vpk-html/iso-runtime*.spec.ts`.

### figures

`build.mjs --check-figures <file> [--strict] [--json]` (also `scripts/figures/check-figures.mjs`). Hard checks run inside check-html too: E1 roots without `<meta name="vpk-figure-engine">`; E2 an unknown meta value or a root the meta does not cover; E3 (warning) meta `both` with one kind of root, or an engine meta with no root; anatomy H1–H8 (blocks, ids and island, grayscale grammar, print-safe rest, ws1 block and lightbox opt-out, markers and relative `src`, stage role and ARIA, live scripts that never own a loop). Advisories A1 heroes per document, A2 camera parity, A3 lit accent and one `data-focal`, A4 parts per tier, A5 budgets, A6 flow/pulse animations; `--strict` fails only A4 below the part bar and A5 above `heroFailBytes`. Thresholds: `checks-thresholds.json` → `figures`. Browser checks (unsandboxed): `scripts/anatomy/check-lines.mjs` and `scripts/figures/check-runtime.mjs`; see `references/figure-engines.md`. `check-runtime` records B6 (no page or console errors) across the reduced-motion page and both full-motion phases, and on a page with an iso-kit figure also B12 iso (grayscale apart from the iso accent) and B2 mixed (one outstanding rAF, both boards on the one `vpkFrameLoop`); `--build-hero --audit` writes nothing when its audit fails.

## Lab and film documents

- Size: `check-html.mjs` warns on stderr (exit code unchanged) when a file exceeds 1,572,846 B, with a remedy picked by what makes it heavy (≥ 40% of bytes): video → ship `<slug>.lite.html` (embed.mjs writes it); fonts → `build.mjs --inject-runtime <file>` (or `--refresh-library` for skill assets); images → re-encode or link them; otherwise split the document.
- Grayscale: lab canvases and the Gantt paint with grayscale tokens plus one `--focal`; hue only through the declared `vpkLab.swatches()` exception (references/lab-kit.md § Decision 2).
- Kit and regions: `node scripts/lab/kit.mjs --check <file>` and `node scripts/lab/render-case-study.mjs <content.json> --into <file> --check`. `kit.mjs --check` also warns when a cue or the Gantt follows a `data-clock` segment the embedded film data lacks (a dead cue sheet); `embed.mjs` refuses to write such a film.
- Browser behaviour (opt-in, unsandboxed): `VPK_HTML_BROWSER=1 node --test scripts/lab/kit.browser.test.mjs scripts/media/pipeline.browser.test.mjs scripts/lab/mixed.browser.test.mjs` (the last needs the iso and hero builders and checks one shared frame loop).

## Tuning

Edit `references/checks-thresholds.json`. All gates degrade gracefully: a
template type a gate doesn't apply to (e.g. `rhythm` on a one-pager with no
slides) simply reports clean.

Content coverage (`--check-content`) and the environment doctor (`--doctor`) are
correctness and environment checks, not advisory gates: they do not take
`--strict` and are documented in `contract.md` and `production.md`.
