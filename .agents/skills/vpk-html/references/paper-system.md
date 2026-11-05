# Paper system

vpk-html has one look: **paper**. Thin opaque paper figures, ink type, one orange accent, quiet rings instead of borders.
There are no alternative styles (no outline, no sculpted). When a document needs emphasis, change the content or the
camera, not the material. This file is the opinionated summary; tokens and lint rules stay in [design](design.md),
[SVG style](svg-style.md), [charts](charts.md) and [illustrations](illustrations.md).

Sources studied (5 November 2026): atlasclass.app subjects (layout, figure furniture, ink-on-paper figures),
raphaelsalaja.com/work/motion-blur (figure framing, captions, segmented controls), sugar-high (code tokens) and the
stageshow skill (demo staging). The first concrete document is
`artifacts/vpk-html/eu26-animation-explained/`.

## 1. Story layout: text left, figure right

Explainers with one anchored figure use two columns from 1024px.

| Part | Spec |
| --- | --- |
| Grid | `minmax(380px, .74fr) minmax(0, 1.26fr)`, gap `clamp(32px, 4vw, 72px)` |
| Reading page | left, max 540px; mono kicker `03 / 12` + time, h2, one-line summary in ink, body in muted text, then code or evidence |
| Figure page | right, `position: sticky`, top = bar height + 16px, height = viewport − bar − 32px |
| Chapter length | each step at least 78svh so scrolling has room to scrub; the last step fills the viewport |
| Reading line | side by side: 40% down the area below the bar; stacked: just below the pinned figure |
| Below 1024px | the figure pins above the text (the stacked layout); no card, no corner furniture |

The reading line is measured, not assumed: `story-layout.js` checks whether the stage sits beside or above the text and
picks the line accordingly. Tests assert against `story.getState().readingLine`, so one contract covers both layouts.

Scrolling scrubs the figure continuously between chapter anchors. Text never animates; it changes at chapter
boundaries. Native scrolling is never intercepted.

## 2. The figure page

On wide screens the figure sits on a paper card:

- background `--surface-raised`, radius 14px, padding 18px 22px;
- no border and no drop shadow: only a 1px ring `color-mix(in oklab, var(--ink) 7%, transparent)`;
- four corners of furniture, all Geist Mono 11px with tabular numerals except the title:
  - top left `Fig. 07` (subtlest text);
  - top right the chapter title (Geist 15px, ink);
  - bottom left one hint line (`Scroll to scrub · hover the rail to preview`);
  - bottom right a live readout (`t 7.6 s · 07 / 12`), updated from the layout runtime, never from a second clock.
- No Follow scroll toggle: scrolling the page always takes control back from manual playback.

Shots are framed at a fixed aspect. When the figure page is narrower than that aspect, widen the frame (up to 1.3×)
rather than cropping the subject (`eu26-scene-live.mjs` shows the pattern).

## 3. Figures and diagrams

The paper plate keeps one addition from atlasclass: a **ground grid** under the subject (EU26:
`_figures/eu26-scene-live.mjs`, tokens in `_figures/explorer.css`). It is projected through the live camera so it moves
with every shot; cells are 100 units with every fourth line stronger (`--eu26-ground` = ink 8% into paper, major 15%),
0.6px non-scaling, faded radially (opaque to 32%, gone by 78%) by an `objectBoundingBox` mask. The figure stage must
fill the figure page's height, or the grid is cut at the stage edges. Tried and rejected (6 November 2026): an ink ramp
by part, dashed strobe ghosts on carried cards, and a warm page under white cards; edges stay one even grey.

- Material: paper only. Tops are the lightest face, sides step down the neutral scale, edges one grey at 0.55px.
- Colour: grayscale plus the one accent `--ill-accent` (ADS orange) on the subject. Colour means "this is the thing";
  never decorate with it.
- Labels live outside the drawing (corner furniture, captions, the reading page) unless a label names a part.
- Dark mode routes through tokens; never ship a second palette.
- Staging (stageshow): one focal object and one action per chapter; 3–5 beats to a payoff; hold the payoff about 2s;
  the poster frame (reduced motion, thumbnails, screenshots) is the moment after the change lands, never mid-change.
  Camera push-ins only when the payoff is unreadable at the shown size, and back out once.

## 4. Charts

Charts join the same system instead of looking like a separate dashboard kit:

- Put a chart in the same figure page (card, ring, corner furniture) when it is the anchored figure; inline charts in
  the reading column use the code-block card treatment below without the header.
- Ink and neutrals for every series; the single argued value or series takes `--focal` today. Converging the focal
  mark on `--ill-accent` (to match the iso figures) is the next migration: it needs the chart lint in
  `check-html.mjs` to allow `--ill-accent` on a `data-vpk-chart` focal mark, and the 30 catalog charts regenerated.
- Mono 10.5–11px tick and axis text, tabular numerals; grid 0.6px dashed `2 3`; focal line 1.6–2px; frame 1px rule.
- Direct labels beat legends. A live readout in the corner beats a tooltip for the primary value.

## 5. Code blocks

Use `scripts/code/highlight.mjs`. It runs the vendored sugar-high tokenizer at build time and ships static spans only.

```js
import { codeBlock, excerpt, CODE_BLOCK_CSS } from '.agents/skills/vpk-html/scripts/code/highlight.mjs';
const html = codeBlock({ code: excerpt(source, 70, 81), lang: 'ts', file: 'finale-confetti-target.ts', href, start: 70, mark: [74], caption: 'One plain sentence.' });
// inline CODE_BLOCK_CSS once in the document's <style>
```

- Quote real source. Read excerpts from the file at build time with real line numbers; never retype code into prose.
- Palette: identifiers ink, keywords `--code-accent` (the figure accent mixed 50/50 with ink, so code shares the
  figures' one hue and stays AA; ADS's red code keyword token would compete), strings and properties stepped
  neutrals, comments subtlest italic. No raw colours, no rainbow themes.
- Frame: sunken card, radius 12px, the same 1px ring, a header row with the file name (linked to source) and language,
  line numbers in subtlest text, marked lines tinted with the figure accent.
- Captions sit outside the card: one sentence, 12px muted, ending in a period.
- The figure is `display: block` and caps its card at the column width; long lines scroll inside the card. Template
  `figure`, `pre` and `code` rules (centring, inline-code chips) are reset inside `.vpk-code`.

## 6. Type

- Geist for prose, Geist Mono for every number, label, kicker and readout.
- Kickers: mono 11px, weight 500, 0.12em tracking, uppercase, tabular numerals.
- Step h2 27–36px weight 400, tracking −0.035em; the summary line in ink at 17px; body 14px muted at 1.8.
- Hierarchy comes from position, weight and space, not from extra sizes (a lesson from Salaja's single-size page).

## 7. Checklist

1. One style only: no style picker, no per-figure material switch.
2. Wide screens: text left, figure page right, sticky, with all four corners filled.
3. Every step's code is a real excerpt with its file and line numbers.
4. No element overflows its column at 1440, 1100, 390 and 320px; long code scrolls inside its card.
5. Light and dark captures at the contract viewport, looked at, before calling it done.
