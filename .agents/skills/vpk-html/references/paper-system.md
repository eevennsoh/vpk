# Paper system

The story explainer’s look and two-column layout; other templates keep [design](design.md). Load when you lay out a story page, its figure, rail, code or charts. Back to [SKILL.md](../SKILL.md).

Contents: [1 one look](#1-one-look-paper-ink-one-orange-accent-rings-instead-of-borders) · [2 ground grid](#2-the-ground-grid-is-the-only-plate-furniture) · [3 two columns](#3-two-columns-from-1024px-with-a-measured-reading-line) ·
[4 charts](#4-charts-sit-on-the-figure-page-or-in-the-code-card) · [5 rail](#5-reading-controls-live-in-the-rail-column) · [6 code](#6-code-blocks-quote-real-source-highlighted-at-build-time) · [7 type](#7-type-hierarchy-from-position-weight-and-space-never-a-new-size)

## 1. One look: paper, ink, one orange accent, rings instead of borders

Read values from `artifacts/vpk-html/eu26-animation-explained/` (`_layout/`, `_figures/`); never edit it. Never offer a style picker or a per-figure material switch; for emphasis, change the content or the camera.

| [design](design.md) says | The story explainer uses |
| --- | --- |
| § Borders And Elevation: 1px borders, radius up to 6px | the § 1 ring and § 1 and § 6 radii, no border |
| § Color Discipline: no hue accent | one `--ill-accent` (Accent row) |
| § Type Hierarchy and § Case: 17px body, 42rem measure, 12px weight 600 eyebrow | § 7 sizes and kicker, a 540px reading column |
| ink focus ring | the [accessibility](accessibility.md#focus-stays-visible-and-stays-put) ring |

| Part | Value |
| --- | --- |
| Page | `--paper-background`; prose `--body-text`, headings `--ink` |
| Figure page (from 1024px) | `--surface-raised`, radius 14px, padding 18px 22px |
| Ring (figure page, code card) | `box-shadow: 0 0 0 1px color-mix(in oklab, var(--ink) 7%, transparent)`; no border, no drop shadow |
| Accent | `--ill-accent` (ADS orange): in the figure on the subject only; outside it only the current-state marks, the code accent, Generate video and the scrollbar thumb. Inline `ACCENT_TOKENS_CSS` from `scripts/iso/accent.mjs` once unless an iso, hairline or anatomy-gl figure already injects `--ill-accent`; the anatomy hero does not |
| Faces, edges, ground shadows | [figure fidelity](figure-fidelity.md) § 3 |
| Dark theme | the same tokens resolve dark; never ship a second palette |
| Page scrollbar | thumb `--ill-accent`, track `--paper-background`, `scrollbar-width: thin` |

| Wrong | Right | The tell |
| --- | --- | --- |
| A figure number, title, hint or time readout | The drawing alone | the card repeats the reading column |
| A drop shadow, `border: 1px solid var(--rule)` or a 15% ring | The 7% ring | the card reads as a box lifted off the page |
| No ring | The 7% ring | the card edge vanishes into the paper in light theme |
| Orange on the ground, the rail chrome or a second object | Orange on the subject only | the eye lands on two things |
| A grey subject | The subject in `--ill-accent` | nothing says “this is the thing” |
| A footer | Nothing; the last chapter fills the viewport | the page outlasts its story |

## 2. The ground grid is the only plate furniture

Draw a faint grid on the ground plane, project it through the live camera and fade it radially. Source: `_figures/eu26-scene-live.mjs` (`GROUND`, `drawGround`), tokens in `_figures/explorer.css`. Make the figure stage fill the figure page’s height, or the grid is cut at the stage edges.

| Property | Value |
| --- | --- |
| Cell | 100 plan units; every 4th line is major; plane at z −12 |
| Minor stroke | `--eu26-ground: color-mix(in srgb, var(--ink) 8%, var(--paper))` |
| Major stroke | `--eu26-ground-major: color-mix(in srgb, var(--ink) 15%, var(--paper))` |
| Width | 0.6, `vector-effect: non-scaling-stroke` |
| Fade | radial gradient stops opacity 1 at 0, 0.8 at 0.32, 0 at 0.78, in a `maskContentUnits="objectBoundingBox"` mask |
| Order | first child after `<defs>`, behind the shadows and every part; `aria-hidden="true"`, `pointer-events="none"` |

The tell: the ground reads as graph paper behind the subject (strokes too dark), or the subject floats with no floor in dark theme (strokes too faint).

## 3. Two columns from 1024px, with a measured reading line

From 1024px the page has two columns: reading left, figure page pinned right. Below 1024px the figure pins above the text with no card. Copy the kit per [story modes](story-modes.md#copy-the-kit-then-rename-its-mode-ids).

```css
/* values only; the kit's selector is body[data-vpk-layout="story"] …; source story-layout.css:597-640 */
@media (min-width: 1024px) {
	body[data-vpk-layout="story"] { --story-figure-inset: 16px; --story-rail-room: 20px; }
	.story-layout { display: grid; grid-template-columns: minmax(380px, .74fr) minmax(0, 1.26fr); column-gap: clamp(32px, 4vw, 72px); padding-inline-end: var(--story-rail-room); }
	.story-stage { grid-column: 2; position: sticky; inset-block-start: calc(var(--story-top) + var(--story-figure-inset)); block-size: calc(100svh - var(--story-top) - 2 * var(--story-figure-inset)); }
	.story-reading { grid-column: 1; max-inline-size: 540px; margin-inline: auto 0; }
	.story-step { min-block-size: 78svh; padding-block: 56px 72px; } .story-step:last-child { min-block-size: calc(100svh - var(--story-top)); } /* room to scrub */
}
```

| Rule | Value |
| --- | --- |
| Reading column | kicker `03 / 12` and time, h2, one-line summary, body, then code or evidence |
| Shot framing | fixed aspect; when the figure page is narrower, widen the frame up to 1.3× instead of cropping the subject |
| Text and scroll | text never animates and changes at chapter boundaries while the figure scrubs; native scrolling is never intercepted |
| Poster frame | each chapter’s poster is the figure at that step’s `time`; under reduced motion and in X Threads the figure snaps to the nearer chapter’s poster, and thumbnails show the same frame |

Measure the reading line beside or above the stage; never assume it. Tests assert `story.getState().readingLine`.

```js
const beside = stageRect.left >= readingRect.right - 1 || stageRect.right <= readingRect.left + 1;
readingLine = beside ? stickyTop + (viewport - stickyTop) * 0.4 : Math.min(viewport - 24, stickyTop + stageRect.height + 32);
```

## 4. Charts sit on the figure page or in the code card

| Chart | Placement |
| --- | --- |
| Anchored to a chapter | the figure page (§ 1), nothing else on the card; grammar in [charts](charts.md) |
| Inline in the reading column | the code card (§ 6) without its header |

## 5. Reading controls live in the rail column

Above 760px the controls are a vertical stack of 44px buttons with 15px icons pinned above the chapter ticks: the four modes, a 1px rule, Sources, theme. The page has no header bar. At 760px and below they become one row at the top (52px bar).

| Part | Value |
| --- | --- |
| Button box | 44 × 44px, radius 6px, `--muted-text`; pressed or hover `--ink` on `--surface-sunken` |
| Icon | 15 × 15px, the same box as the rail’s Frames button |
| Stack | `position: fixed`, top 16px, right `calc(var(--eu26-dock-right) + 3px)` so every icon shares the tick centre line; gap 2px; tools group `margin-block-start: 6px; padding-block-start: 6px; border-block-start: 1px solid var(--rule)` |
| Rail | fixed, right 16px, 64px wide, 96px page reserve (0 in Slides and Video below 1024px); at 760px and below right 10px, 48px wide, 60px reserve, top `calc(var(--story-bar-height) + 12px)` |
| Rail top above 760px | `--eu26-dock-top: calc(16px + 6 * var(--story-tool-size) + 5 * 2px + 13px + 24px)`: 6 buttons, 5 gaps, 13px = 6px margin + 1px rule + 6px padding, 24px above the first tick; update it when the stack changes |
| Ticks | 1px strokes on one right anchor; 20px gap target; one tick per chapter; the current tick turns orange in place |
| Proximity wave | 20px engagement zone plus 26px approach; ticks grow to 32px at the peak; spring stiffness 260, damping 22, mass 0.55 |

Tooltips follow VPK’s Tooltip (`components/ui/tooltip.tsx`): `--accent` background, inverse text, 6px radius, 12/16 type, 6px 12px padding, no border.
They open 4px left of the rail (below it in the 760px row): 150ms ease-out-practical in with an 8px slide, 100ms ease-in out, no open delay. Name the trigger per [accessibility](accessibility.md#name-icon-buttons-with-aria-label-and-show-the-tooltip-from-data-tip).

```css
/* values only; the kit's selector is body[data-vpk-layout="story"] …; source footer-timeline.css:708-751, its 760px row at 741-747 */
body[data-vpk-layout="story"] { --vpk-tip-enter: 150ms cubic-bezier(0.4, 1, 0.6, 1); --vpk-tip-exit: 100ms cubic-bezier(0.6, 0, 0.8, 0.6); }
[data-tip] { position: relative; }
[data-tip]::after { content: attr(data-tip); position: absolute; inset-inline-end: calc(100% + 4px); inset-block-start: 50%; inline-size: max-content; max-inline-size: 320px; padding: 6px 12px; border-radius: 6px; background: var(--accent); color: var(--inverse-text); font: 400 12px/16px var(--font-body); pointer-events: none; opacity: 0; translate: 8px -50%; transition: opacity var(--vpk-tip-exit), translate var(--vpk-tip-exit); }
/* :has(:focus-visible) serves the wrapper case: the theme toggle's data-tip sits on a div around its button */
[data-tip]:is(:hover, :focus-visible, :has(:focus-visible))::after { opacity: 1; translate: 0 -50%; transition: opacity var(--vpk-tip-enter), translate var(--vpk-tip-enter); }
[data-expanded="true"] [data-tip]::after { display: none; } /* no tips over the open Frames tray */
@media print { [data-tip]::after { display: none; } }
```

| Wrong | Right | The tell |
| --- | --- | --- |
| An orange `--ill-accent` tooltip | Neutral-bold `--accent` | two oranges compete with the subject |

## 6. Code blocks quote real source, highlighted at build time

Use `scripts/code/highlight.mjs`: the vendored sugar-high tokenizer (v2.6.4) runs at build time and ships static spans, so a code block adds no runtime script. Read every excerpt from the source file at build time with its real line numbers.

```js
// artifacts/vpk-html/<slug>/_figures/build-page.mjs; run `SOURCE_ROOT=<quoted repo> node artifacts/vpk-html/<slug>/_figures/build-page.mjs`
import fs from 'node:fs';
import path from 'node:path';
import { codeBlock, excerpt, CODE_BLOCK_CSS } from '../../../../.agents/skills/vpk-html/scripts/code/highlight.mjs';
import { ACCENT_TOKENS_CSS } from '../../../../.agents/skills/vpk-html/scripts/iso/accent.mjs';

const file = 'lib/finale-confetti-target.ts';
const href = `https://github.com/<org>/<repo>/blob/main/${file}#L70-L81`; // the file’s blob URL with the excerpt’s lines
const source = fs.readFileSync(path.join(process.env.SOURCE_ROOT ?? process.cwd(), file), 'utf8'); // root of the repo you quote
const html = codeBlock({ code: excerpt(source, 70, 81), lang: 'ts', file: path.basename(file), href, start: 70, mark: [74], caption: 'Trims each landed card’s box to the visible Done list.' });
// inline ACCENT_TOKENS_CSS (unless a figure engine already does, § 1) and CODE_BLOCK_CSS once in <style>; html goes where the excerpt belongs
```

| Role | Token |
| --- | --- |
| Keywords, JSX literals | `--code-accent: color-mix(in srgb, var(--ill-accent) 50%, var(--ink))`, #926817 on the light sunken card `#f8f8f8` (4.69:1), #e5bb69 on the dark one `#18191a` (9.76:1) |
| Identifiers, classes, entities | `--ink` |
| Properties | `--body-text` |
| Strings | `--muted-text` |
| Signs, comments | `--subtlest-text`, comments italic |
| Card | `--surface-sunken`, radius 12px, the § 1 ring, 36px header with the linked file name and language |
| Lines | 12px/1.7 Geist Mono, numbers in subtlest text, marked lines `color-mix(in oklab, var(--ill-accent) 14%, transparent)` with a 2px accent inset |
| Caption | outside the card, one sentence, 12px muted, ending in a period |

| Wrong | Right |
| --- | --- |
| Code typed from memory into the page | `excerpt(fs.readFileSync(file, 'utf8'), from, to)` with `start: from` |
| A rainbow theme, or ADS’s red code keyword beside an orange figure | Ink, stepped neutrals and the one accent mixed with ink |
| Every token in ink, so keywords read as plain text | Keywords in `--code-accent`, the rest stepped down from ink |
| A wide excerpt that widens the reading column | Cap the card at the column width; long lines scroll inside |

## 7. Type: hierarchy from position, weight and space, never a new size

| Element | Value |
| --- | --- |
| Fonts | Geist for prose; Geist Mono with tabular numerals for numbers, labels, kickers and readouts |
| Kicker | mono 11px, weight 500, 0.12em tracking, uppercase, index in `--ink` |
| Intro h1 | `clamp(36px, 3.5vw, 52px)`, weight 400, line-height 1.04, tracking −0.055em |
| Step h2 | `clamp(27px, 2.6vw, 36px)`, weight 400, line-height 1.16, tracking −0.035em |
| Summary | 17px/1.75 in `--ink` |
| Body | 14px/1.8 in `--muted-text` |

| Wrong | Right | The tell |
| --- | --- | --- |
| An h3 or a 20px size | Weight, position or space | a third heading size |
