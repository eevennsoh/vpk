# Quality gates

Owner of the advisory content-quality gates for [SKILL.md](../SKILL.md). Load when you run a `--check-*` gate, read a gate finding, or tune `checks-thresholds.json`. Proving a figure against production is [verification](verification.md).

Contents: [Run gates on filled artifacts](#run-gates-on-filled-artifacts-never-raw-templates) · [Fix each finding in the page](#fix-each-finding-in-the-page-not-in-the-report) · [Story-explainer checks](#story-explainer-checks-in-check-html-and-the-three-left-by-hand) · [Audit engine figures](#audit-engine-figures-with---check-iso-and---check-figures) · [Check lab and film documents](#check-lab-and-film-documents-with-kitmjs---check) · [Tune thresholds](#tune-thresholds-for-a-document-class-never-for-one-page)

The gates are heuristics on the same headless-Chromium DOM that `--verify` opens (`scripts/gates.mjs`). They never modify the artifact and only warn; `--strict` makes a finding exit 1. Thresholds live in `references/checks-thresholds.json`.

## Run gates on filled artifacts, never raw templates

```bash
node .agents/skills/vpk-html/scripts/build.mjs --check-density        <file> [--strict]
node .agents/skills/vpk-html/scripts/build.mjs --check-resume-balance <file> [--strict]
node .agents/skills/vpk-html/scripts/build.mjs --check-rhythm         <file> [--strict]
node .agents/skills/vpk-html/scripts/build.mjs --check-orphans        <file> [--strict]
node .agents/skills/vpk-html/scripts/build.mjs --check-focal          <file> [--strict]
node .agents/skills/vpk-html/scripts/build.mjs --check-motion-budget  <file> [--strict]
node .agents/skills/vpk-html/scripts/build.mjs --check-caption-echo   <file> [--strict]
node .agents/skills/vpk-html/scripts/build.mjs --check-layout         <file> [--strict]
# several at once
node .agents/skills/vpk-html/scripts/gates.mjs <file> --check-density --check-orphans --check-focal
```

Run gates on filled demos and artifacts. Raw templates keep `{{...}}` placeholders by design; gate them with `build.mjs --check-templates`. `--verify` and `check-html.mjs` report page weight and the data-URL budget as advisories ([production § Size budget](production.md#size-budget)); never shrink a figure to clear them. `--verify` and `scripts/runtime/smil-starter.mjs --sweep` check SMIL behaviour.

## Fix each finding in the page, not in the report

| Gate | Flags | Threshold (`checks-thresholds.json`) | Fix |
| --- | --- | --- | --- |
| density | A non-final `section` taller than `minSectionHeightPx` whose trailing empty space exceeds `maxTrailingRatio` (25%) | `density` | Fill the section with content or shorten it |
| resume-balance | Paged content (`scrollHeight / pageHeightPx`, A4 1123px) that spills onto a last page under `minLastPageFill` (20%) full, once at least `onlyWhenPagesAtLeast` pages | `resumeBalance` | Tighten to fit the page |
| rhythm | `maxIdenticalConsecutive` (3) or more consecutive slides with one fingerprint (child count, heading count, child tag sequence) | `rhythm` | Vary the slide layouts |
| orphans | A multi-line block whose last line is under `minLastLineWidthRatio` of the widest line and under `minLastLineChars`; a heading of 3+ words whose last word sits alone on a line under `minHeadingLastLineWidthRatio` (0.5) | `orphans` | Rewrite the line; `text-wrap: balance` on headings |
| focal | More than `maxFocalElements` uses of `var(--focal)` in an ordinary SVG. `data-vpk-illustration` SVGs are exempt | `focal` | Keep one focal element per diagram |
| motion-budget | An authored CSS duration above `maxDurationMs` (300ms) in `<style>` or inline styles. The `vpk-shared`, `vpk-algebrica-v2` and trailing `vpk presentation mode` regions are skipped | `motionBudget` | Use `--vpk-dur-*` tokens for interface motion |
| caption-echo | A caption that repeats a nearby heading (`minSharedWords`) or an SVG title or `aria-label` (also `minCaptionCoverage`, 0.6, of the caption’s content words). Words count once; words of 2 characters or fewer never count | `captionEcho` | State what the reader learns, per the [writing](writing.md) “adds to its heading” box |
| layout | `page-horizontal-overflow`, `clipped-text`, `clipped-control`, `overlapping-text`, each as `- rule · target · amount at <width>`. Same audit as the review drawer’s Layout tab (`scripts/review/layout-audit.mjs`); skips intended truncation, scrollers, hidden and 1px elements, svg and the review UI | `layout` (`minOutsidePx`, `minOutsideRatio`, `minOcclusionRatio`, `minOcclusionSamples`, `maxFindings`) | Fix the overflowing or clipped element |

A figure camera move timed from the production reference can exceed 300ms and warn under motion-budget. Keep the reference timing and note the finding under Not verified.

| Wrong | Right |
| --- | --- |
| Dismiss a caption-echo finding as a false positive | Rewrite the caption until it adds to its heading |
| Shorten a reference-timed camera move to 300ms to clear motion-budget | Keep the reference duration and report the advisory |

The tell: a finding closed with no change to the page and no line under Not verified.

## Story-explainer checks in check-html, and the three left by hand

`check-html.mjs` runs four checks on any page whose `<body>` carries `data-vpk-layout="story"` (`scripts/check-html-story.mjs`, tests in `check-html-story.test.mjs`). Each is a failure, not a warning.

| Id | Fails on | Fix |
| --- | --- | --- |
| `rail-title` | A `button`, `a`, `summary`, `label`, `input` or `select` with a `title=` tooltip | `aria-label` plus `data-tip` ([accessibility](accessibility.md#name-icon-buttons-with-aria-label-and-show-the-tooltip-from-data-tip)) |
| `duplicate-id` | One id on two elements in the static markup (templates, scripts and comments excluded) | Prefix each copy’s ids with its scope |
| `straight-apostrophe` | `'` or `"` (or its entity) in a visible text node or a `data-tip`; `pre`, `code`, `kbd`, `samp` and `textarea` keep their quotes ([writing § Keep exactly](writing.md#keep-exactly)) | `’`, `“`, `”` |
| `inline-script-syntax` | A classic inline script that does not parse | Fix the script; a straight quote inside a quoted string is the usual cause |

A script cannot hold these three from the HTML file, so check them by hand and report each under Not verified:

| Check | Catches | Why no script holds it | Check by hand |
| --- | --- | --- | --- |
| `figure-text` | Text in a product-UI scene outside the named exceptions | Scenes are drawn at run time by figure modules (the EU26 page’s 12 `data-vpk-figure` hosts hold no static `<text>`), and the exceptions are selectors in the brief, so only the rendered DOM can be tested | Your behaviour test asserts it ([figure fidelity § 2](figure-fidelity.md#2-no-text-in-product-ui-scenes-except-named-exceptions)) |
| `figure-ink-fill` | A figure fill above 42% ink, or solid black | Fills resolve from tokens per theme at run time | The token probe in [verification § 4](verification.md#4-check-dark-theme-at-the-same-times) |
| `figure-copy-scope` | Thumbnails or snapshots outside the colour scope, and ids they repeat | The copies exist only after the runtime renders them | The dark page sheet ([figure fidelity § 4](figure-fidelity.md#4-copies-outside-the-root-share-the-colour-scope)), plus `document.querySelectorAll('[id]')` grouped by id |

A module script (`type="module"`) is not parsed by `inline-script-syntax`; the `pageerror` line of the [verification § 5](verification.md#5-filter-every-command-on-error) filter catches its syntax errors.

## Audit engine figures with --check-iso and --check-figures

### iso (static, always available)

```bash
node .agents/skills/vpk-html/scripts/build.mjs --check-iso <file> [--strict] [--json]
```

Audits every iso-kit plate (`scripts/iso/audit.mjs`): A1 grayscale paint (plus the one accent pair of `scripts/iso/accent.mjs`), A2 at most 5 face fills, A3 one focal on the accent faces, A4 stroke widths and the one style (`data-vpk-iso-style="manual"`), A5 painter order, A6 guides before plates, A7 labels outside, leaders on target and one numbered `data-vpk-iso-tag` per label for narrow stages (pose and slider-stop checks also run from the HTML), A8 label type, A9 ids, A10 camera, A11 static art, A12 SMIL assembly, A15 local patterns, A16 guide grammar, A17 weight and precision. Advisory unless `--strict`. `scripts/iso/build-figure.mjs` treats errors as fatal: `--inject` writes nothing while the audit has errors and warns when the engine meta does not cover `iso-kit`. Exit codes: 0 ok, 1 errors under `--strict`, 2 a missing file or usage. A13 and A14 (pointer, loop) run in `tests/vpk-html/iso-runtime*.spec.ts`.

### figures

```bash
node .agents/skills/vpk-html/scripts/build.mjs --check-figures <file> [--strict] [--json]   # or .agents/skills/vpk-html/scripts/figures/check-figures.mjs
```

Hard checks also run inside check-html: E1 roots without `<meta name="vpk-figure-engine">`; E2 an unknown meta value or a root the meta does not cover; E3 (warning) meta `both` with one kind of root, or an engine meta with no root; anatomy H1-H8 (blocks, ids and island, grayscale grammar, print-safe rest, ws1 block and lightbox opt-out, markers and relative `src`, stage role and ARIA, live scripts that never own a loop). Advisories: A1 heroes per document (off: `maxHeroes` null), A2 camera parity, A3 lit accent and one `data-focal`, A4 parts per tier, A5 budgets, A6 flow and pulse animations. `--strict` fails only A4 below the part bar; size advisories (A5, A7) never fail. Thresholds: `checks-thresholds.json` → `figures`.

Browser checks run unsandboxed: `scripts/anatomy/check-lines.mjs` and `scripts/figures/check-runtime.mjs` ([figure engines § 7](figure-engines.md#7-verify-checklist)). `check-runtime` records B6 (no page or console errors) across the reduced-motion page and both full-motion phases; with an iso-kit figure on the page it also records B12 iso (grayscale apart from the iso accent) and B2 mixed (one outstanding rAF, both boards on the one `vpkFrameLoop`). `--build-hero --audit` writes nothing when its audit fails.

## Check lab and film documents with kit.mjs --check

```bash
node .agents/skills/vpk-html/scripts/lab/kit.mjs --check <file>
node .agents/skills/vpk-html/scripts/lab/render-case-study.mjs <content.json> --into <file> --check
VPK_HTML_BROWSER=1 node --test .agents/skills/vpk-html/scripts/lab/kit.browser.test.mjs .agents/skills/vpk-html/scripts/media/pipeline.browser.test.mjs .agents/skills/vpk-html/scripts/lab/mixed.browser.test.mjs
```

| Check | Rule |
| --- | --- |
| Size | No check. A file is as large as its figures and media need. `scripts/media/size-budget.mjs` sizes only the optional lite copy for films |
| Grayscale | Lab canvases and the Gantt paint with grayscale tokens plus one `--focal`; hue only through `vpkLab.swatches()` ([lab kit § Decision 2](lab-kit.md)) |
| Dead cue sheet | `kit.mjs --check` warns when a cue or the Gantt follows a `data-clock` segment the embedded film lacks; `embed.mjs` refuses to write that film |
| Browser behaviour | Opt-in and unsandboxed; `mixed.browser.test.mjs` needs the iso and hero builders and checks one shared frame loop |

## Tune thresholds for a document class, never for one page

```bash
node -p 'require("./.agents/skills/vpk-html/references/checks-thresholds.json").density'
# { maxTrailingRatio: 0.25, minSectionHeightPx: 120 }
```

Keys are camelCase (`resumeBalance`, `motionBudget`, `captionEcho`). Change a value only when the same false positive recurs across documents, per [evaluation § Land each correction](evaluation.md#land-each-correction-in-the-narrowest-owner).

| Wrong | Right |
| --- | --- |
| Raise `density.maxTrailingRatio` to 0.4 so this brief’s short last section passes | Fill or shorten the section; keep 0.25 |

The tell: a thresholds edit in the same change as the page it unblocks.

A gate that does not apply to a document reports clean (`rhythm` on a one-pager with no slides). Content coverage (`--check-content`) and the environment doctor (`--doctor`) are correctness checks, not gates: they take no `--strict` and live in [contract](contract.md) and [production](production.md).
