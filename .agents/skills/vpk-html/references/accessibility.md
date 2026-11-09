# Accessibility

Accessibility rules for every vpk-html document, then the story explainer’s cases. Load when you add a control, hide or show chrome, or touch motion. Back to [SKILL.md](../SKILL.md).

Every template ships this baseline: `<main>` and `<nav>`; one `<h1>`, then one `<h2>` per chapter; meaningful images and SVG carry alt text or an accessible name, decorative ones `aria-hidden="true"`; text 4.5:1, large text and UI marks 3:1 in both themes; readable down to 320px; print never clips content.

## Name icon buttons with aria-label and show the tooltip from data-tip

```html
<!-- BAD -->  <button type="button" title="Slides"><svg>…</svg></button>
<!-- GOOD --> <button type="button" aria-label="Slides" data-tip="Slides" aria-pressed="false"><svg aria-hidden="true">…</svg></button>
<!-- GOOD, wrapper --> <div data-tip="Theme"><button type="button" aria-label="Theme: System. Activate for Light.">…</button></div>
```

Set `aria-label` on every element that carries `data-tip`, or screen readers read the tip as content. Never use `title`. When the tip sits on a wrapper (the theme toggle), the inner button carries the matching `aria-label` and the wrapper only `data-tip`.
The tell: a native tooltip appears late in the system font, and screen readers announce the name twice. Tooltip look: [paper system](paper-system.md#5-reading-controls-live-in-the-rail-column).

## Hit targets are at least 44 × 44px

Size every button, standalone link, summary and range input to at least 44 × 44px, even when the glyph is 15px. Inline links keep their line box. A thin mark keeps a 44px input on top of it.

```css
button, summary, input[type="range"] { min-inline-size: 44px; min-block-size: 44px; }
a:not(p a, li a, dd a) { display: inline-flex; align-items: center; min-block-size: 44px; }
input[type="range"][aria-orientation="vertical"] { writing-mode: vertical-lr; inline-size: 44px; block-size: 100%; } /* 1px ticks sit behind it */
input[type="range"][aria-orientation="horizontal"] { writing-mode: horizontal-tb; inline-size: 100%; block-size: 44px; }
```

## Hidden chrome is hidden and inert

Set both flags whenever a mode or panel hides controls, so no tab stop lands on something unseen. Escape returns focus to the trigger before the panel turns inert.

```js
const show = (el, shown) => { el.hidden = el.inert = !shown; };
// after copying the story kit, both log 0 in every mode (a hidden leaf control needs no inert; a hidden container does):
console.log([...document.querySelectorAll('[data-vpk-story] [hidden]')].filter(el => !el.inert && el.querySelector('a, button, input, summary, [tabindex]')).length);
console.log(document.querySelectorAll('[data-tip]:not([aria-label]):not(:has([aria-label]))').length);
```

| Story explainer ([story modes](story-modes.md)) | Hidden and inert |
| --- | --- |
| Page, X Threads | the Carousel and the Video panel |
| Slides | the tick ruler and the Frames button |
| Slides at every width, Video from 1024px | every chapter except the current one |
| Video below 1024px | the reading column |
| Closed Frames tray, closed preview | `inert` only; cards stay painted for the slide-out |

## Focus stays visible and stays put

| Case | Rule |
| --- | --- |
| Focus ring | `outline: 2px solid var(--focus-ring); outline-offset: 3px` (2px offset on thumbnails), light and dark |
| Mode switch, scrolling | focus the pressed mode button with `{ preventScroll: true }`; programmatic scrolling keeps focus; links clear the pinned figure with `scroll-margin-block-start` |

## Reduced motion keeps every state and drops the movement

| Element | Under `prefers-reduced-motion: reduce` |
| --- | --- |
| Figure | snaps to the chapter poster per [paper system](paper-system.md) § 3 |
| Tooltips, buttons, thumbnails, thread steps | `transition: none`; progress bar hidden; `scroll-behavior: auto` |
| Rail ticks | rest lengths and the active colour; no wave, no magnetic lean |
