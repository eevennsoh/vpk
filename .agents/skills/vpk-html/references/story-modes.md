# Story modes

The four reading modes of the story explainer. Load when you build, change or test a mode. Back to [SKILL.md](../SKILL.md).

Contents: [modes](#one-figure-one-clock-four-ways-to-read-it) · [kit](#copy-the-kit-then-rename-its-mode-ids) · [Carousel](#carousel-slides-page-above-a-centred-thumbnail-strip) · [Lifeline](#lifeline-x-threads-a-vertical-timeline-of-every-step) · [Theater](#theater-video-the-player-fits-one-viewport)

## One figure, one clock, four ways to read it

| UI label | `data-story-mode` | Layout | Timeline |
| --- | --- | --- | --- |
| Page | `page` | [paper system](paper-system.md) § 3; scroll scrubs the figure | vertical rail, one tick per chapter |
| Slides | `carousel` | Page shrunk to one viewport, one chapter at a time, text centred from 1024px | centred bottom Carousel of chapter thumbnails |
| X Threads | `lifeline` | Lifeline vertical timeline of every step; figure pinned right from 1024px, stacked above the timeline below (the kit does not hide it) | vertical rail |
| Video | `theater` | one viewport, no scrollbars; Page’s columns from 1024px, figure and timeline only below | horizontal ruler centred at the bottom |

From 1024px every mode shares the columns of [paper system](paper-system.md) § 3; all share its rail and tooltips (§ 5). Switching modes keeps the exact player time. Slides, X Threads and wide Video hide the intro header.

| Use exactly | Avoid |
| --- | --- |
| Page, Slides, X Threads, Video (labels); `page`, `carousel`, `lifeline`, `theater` (ids) | Story mode, Deck, Twitter, Thread view, Player; the label as an id; a fifth mode |
| A mode, when the user asks for a mode | a [presentation](presentation.md) deck, an [x-thread](x-thread.md) post or a [video-export](video-export.md) MP4 |

## Copy the kit, then rename its mode ids

Two rules hold throughout: never edit the originals in `eu26-animation-explained/`, and never run a blanket `sed s/story/page/`, which rewrites `data-vpk-layout="story"`, `layout === 'story'`, class names and APIs. The script below touches only quoted mode ids on lines that name a mode; the kit predates the ids above and still says `story`, `slides`, `twitter`, `video`.

1. Copy the seven code files (`*.mjs`, `*.js`, `*.css`) in `artifacts/vpk-html/eu26-animation-explained/_layout/` into your artifact’s `_layout/`, and `_figures/build-explorer.mjs` and `_figures/story-content.mjs` into its `_figures/`.
2. Point the build at your hero module and steps.
3. From `artifacts/vpk-html/<slug>/`, run the rename script below once.
4. Add any figure script that reads `dataset.storyMode` or `detail.mode` outside `_figures/`.
5. Run `node artifacts/vpk-html/<slug>/_figures/build-explorer.mjs` after every edit; it inlines `_layout/*`, the hero region, the accent and code CSS into `<slug>.html`.
6. Run the [accessibility](accessibility.md#hidden-chrome-is-hidden-and-inert) checks in every mode.

```sh
find _layout _figures -maxdepth 1 -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.css' \) -print0 | xargs -0 node -e '
const fs = require("fs"), ids = { story: "page", slides: "carousel", twitter: "lifeline", video: "theater" };
const ctx = /\bmodes?\b|[sS]toryMode|setMode|timelineView|data-story-mode|data-timeline-view/;
for (const f of process.argv.slice(1)) {
	const src = fs.readFileSync(f, "utf8"), out = src.split("\n").map(l => ctx.test(l) ? l.replace(/(?<!data-vpk-layout=)(["\x27])(story|slides|twitter|video)\1/g, (m, q, id) => q + ids[id] + q) : l).join("\n");
	if (out !== src) { fs.writeFileSync(f, out); console.log("renamed", f); }
}'
find _layout _figures -maxdepth 1 -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.css' \) -print0 | xargs -0 grep -nE "['\"](story|slides|twitter|video)['\"]" | grep -v 'data-vpk-layout="story"'
# check: a second run prints no "renamed" line; the grep lists only non-mode strings (layout === 'story', piece kinds, as="video")
# find skips a missing folder or extension with a warning instead of failing on an unmatched glob in zsh or bash
# proof on a scratch EU26 copy, from the repo root: both suites pass after the rename
#   cp -R artifacts/vpk-html/eu26-animation-explained output/vpk-html/eu26-renamed && cd output/vpk-html/eu26-renamed  # then run the rename
#   node _figures/build-explorer.mjs && node --test --test-concurrency=1 _figures/story-layout.behavior.test.mjs _figures/slides-timeline.behavior.test.mjs
```

```js
// <body data-vpk-layout="story" data-vpk-docnav="off" data-vpk-enhancements="off">
renderStoryShell({ title, description, eyebrow, hero, controls, appearance, sourcesHref, icons, steps });
// step: { id, title, description, body, time, seconds?, href?, source?, code? }; time is the renderer’s authored position
root.addEventListener('vpk:story-frame', ({ detail: { index, time, reason, mode } }) => figure.seek(time)); // scroll seeks an exact pose
root.story.follow();                                                    // once the renderer is ready
root.story.reflect(index, time, { scroll, previewIndex, playing });     // the figure reports its chapter back
root.story.getState(); // { mode, index, time, displayIndex, progress, following, reducedMotion, readingLine, stepCount, stepId, suspendedReason }
```

## Carousel (Slides): Page above a centred thumbnail strip

The Carousel replaces the tick ruler and the Frames button.
From 1024px, centre the chapter against the figure page; a chapter taller than the figure scrolls inside its column.
Below 1024px, top-align the chapter under the stacked figure: `padding-block: 32px` (28px 40px at 760px and below).

CSS blocks here and in [paper system](paper-system.md) hold values only: diff them against the kit lines they cite. Never paste them; they drop the kit’s specificity and `!important` flags.

```css
/* values only; the kit's selector is body[data-vpk-layout="story"] [data-vpk-story][data-story-mode=…]; source story-layout.css:691-708 */
@media (min-width: 1024px) {
	body[data-vpk-layout="story"] { --story-slides-reserve: calc(16px + 128px + 12px); }
	[data-story-mode="carousel"] .story-layout { box-sizing: border-box; block-size: 100svh; min-block-size: 0; padding-block: calc(var(--story-top) + var(--story-figure-inset)) var(--story-slides-reserve); }
	[data-story-mode="carousel"] .story-stage { position: relative; inset-block-start: auto; block-size: 100%; }
	[data-story-mode="carousel"] .story-reading { display: flex; flex-direction: column; block-size: 100%; overflow-y: auto; scrollbar-width: thin; }
	[data-story-mode="carousel"] .story-step { min-block-size: 0; margin-block: auto; padding-block: 24px; } /* auto margins centre; a tall chapter scrolls from the top */
	:is([data-story-mode="carousel"], [data-story-mode="theater"]) .story-step-play { display: none; } /* the figure already shows the moment */
}
```

| Part (source footer-timeline.css:555-641) | Value |
| --- | --- |
| Strip | fixed and centred, bottom `max(16px, env(safe-area-inset-bottom))`, `inline-size: min(var(--story-stage-width), calc(100dvw - 32px))`, `scroll-snap-type: x proximity`, 24px edge fade mask, gap 10px |
| Item | 120px wide (96px at 760px and below), thumbnail `aspect-ratio: 8 / 5`, radius 5px inside an 8px button |
| Idle thumbnail | opacity 0.64, `0 0 0 1px` ring at 9% ink; full opacity on hover |
| Current | 2px `--ill-accent` ring, background 7% accent into paper, `aria-current="step"` |
| Caption | 11px/16px, mono number in subtlest text, ellipsis |
| Input | hover previews, click or Enter selects, arrows step; the current slide stays centred; a swipe scrolls, never selects |

| Wrong | Right | The tell |
| --- | --- | --- |
| The strip overlaps the figure page | The 156px `--story-slides-reserve` | the figure’s bottom edge hides under the thumbnails |
| A thumbnail drawn from its own frame | The chapter poster ([paper system](paper-system.md) § 3) | selecting a thumbnail jumps the figure to a different pose |

## Lifeline (X Threads): a vertical timeline of every step

Follow Lifeline’s vertical timeline (github.com/evilrabbit/lifeline, `lifeline-vertical.tsx`): a `2.5rem | 1rem | 1fr` grid, one dashed rail, a tick per step, a mono step number, and non-current steps muted. The timeline starts at step 01 with no cover title.
A mono 11px uppercase `Step | Time` row heads the grid. Each step’s time is its 15px/20px label in column 3, ink when current.
h2 22px, summary 15px/1.6 muted; “How it works” starts closed.

```css
/* values only; the kit's selector is body[data-vpk-layout="story"] [data-story-mode=…]; source story-layout.css:384-476 */
[data-story-mode="lifeline"] { --thread-grid: 2.5rem 1rem minmax(0, 1fr); --thread-rail-x: calc(2.5rem + 12px + .5rem); }
[data-story-mode="lifeline"] .story-step { display: grid; grid-template-columns: var(--thread-grid); column-gap: 12px; min-block-size: 0; padding-block: 0 40px; border: 0; opacity: .38; transition: opacity var(--vpk-tip-enter, 150ms ease-out); } /* kit reuses the tooltip enter timing (150ms ease-out-practical) */
[data-story-mode="lifeline"] .story-step:is([aria-current="step"], :hover, :focus-within) { opacity: 1; }
[data-story-mode="lifeline"] .story-step::before { content: ""; position: absolute; inset-block: 0; inset-inline-start: var(--thread-rail-x); border-inline-start: 1px dashed var(--rule-strong); pointer-events: none; }
[data-story-mode="lifeline"] .story-step-kicker { display: contents; font-size: 0; } /* drops the "/ 12" counter */
[data-story-mode="lifeline"] .story-step-index { grid-column: 1; grid-row: 1; align-self: center; text-align: end; color: var(--muted-text); font: 500 11px/16px var(--font-mono); font-variant-numeric: tabular-nums; }
[data-story-mode="lifeline"] .story-step-kicker::after { content: ""; position: relative; z-index: 1; grid-column: 2; grid-row: 1; place-self: center; inline-size: 10px; block-size: 1px; background: var(--rule-strong); }
[data-story-mode="lifeline"] .story-step[aria-current="step"] .story-step-kicker::after { inline-size: 14px; background: var(--ink); }
```

| Wrong | Right | The tell |
| --- | --- | --- |
| Every step at full ink | Non-current steps at .38 | the current step hides in the list |
| Non-current steps below .3 | .38, full on hover and focus | the next title needs a hover to read |

## Theater (Video): the player fits one viewport

Entering, playing and seeking never render or load an MP4; only Generate video calls the local exporter.
The page never scrolls. From 1024px the chapter centres beside the figure; the timeline row centres under both columns, shifted right by half the rail reserves.
Below 1024px the reading column hides and the figure fills the viewport above the timeline.

```css
/* values only; the kit's selector is body[data-vpk-layout="story"] [data-story-mode=…]; source story-layout.css:667-685 and 710-746 */
[data-story-mode="theater"] .story-layout { box-sizing: border-box; block-size: 100svh; padding-block: 16px 12px; display: flex; flex-direction: column; }
[data-story-mode="theater"] .story-stage { flex: 1 1 0; min-block-size: 220px; }
@media (min-width: 1024px) {
	[data-story-mode="theater"] .story-layout { display: grid; grid-template-columns: minmax(380px, .74fr) minmax(0, 1.26fr); grid-template-rows: minmax(0, 1fr) auto; padding-block: var(--story-figure-inset) 12px; --story-video-centre-shift: calc((var(--eu26-dock-reserve, 0px) + var(--story-rail-room, 0px)) / 2); }
	[data-story-mode="theater"] .story-reading { grid-column: 1; grid-row: 1; align-self: safe center; max-block-size: 100%; overflow-y: auto; scrollbar-width: thin; }
	[data-story-mode="theater"] .story-stage { grid-column: 2; grid-row: 1; min-block-size: 0; }
	[data-story-mode="theater"] .story-video-timeline { grid-column: 1 / -1; grid-row: 2; justify-self: center; box-sizing: border-box; inline-size: min(960px, calc(100% - 2 * var(--story-video-centre-shift))); translate: var(--story-video-centre-shift) 0; }
}
```

| Part | Value |
| --- | --- |
| Ruler | 84px tall; ticks 14px, intermediate ticks 8px (every 4th is full); mono 10px stamps every 5 seconds; elapsed/total mono 11px, `aria-hidden` |
| Generate video | inside the timeline row after Fullscreen; `--ill-accent` fill, `--ill-accent-ink` text, 44px tall, 14px inline padding, its own progress label |
| Removed | title bar, chapter line, visible status line; `aria-valuetext` names time and chapter, `role="status"` is visually hidden |
| Below 880px height | step padding 12px, h2 28px, summary 15px/1.55, body 13px/1.65, code 11px/1.55, code caption hidden; every chapter fits beside the figure from 1280 × 720 |

| Wrong | Right | The tell |
| --- | --- | --- |
| A scrolling page, a title above the player, a render on Play | One viewport, no title, Generate renders | a scrollbar, a title line, network traffic on Play |
| Type shrunk until the chapter fits at 1440 × 900 | Tighten only below 880px height | body text under 13px |
