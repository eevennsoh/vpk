# Presentation mode

Owner of standalone slide decks for [SKILL.md](../SKILL.md). Load when you make a deck.

The Slides *mode* (Carousel) of a story explainer lives in [story modes](story-modes.md).

vpk-html decks and presentation-style documents keep the audience surface, print surface, and presenter surface separate.

## A deck is two or more slides with notes last

A deck is any HTML file with at least two `section.slide` elements. Print geometry stays fixed at the template’s `@page` size (`slides.html` uses `280mm x 158mm`). Screen mode is added by `scripts/presentation.mjs` and injected by the runtime pipeline: `build.mjs --refresh-library` for the skill library and `--inject-runtime` for artifacts.

```html
<section class="slide">
	<h2>Rollout at 50%</h2>
	…
	<aside class="speaker-notes" aria-hidden="true">Lead with the latency number.</aside>
</section>
```

`.speaker-notes` is hidden in the main window and in print. The presenter window reads the note text without exposing it to screen recordings of the main deck window.

## Controls

Decks and docnav documents use the same fixed round-button control cluster: previous button, Geist Mono `NN / NN` counter with `aria-live="polite"`, and next button with an SVG circular progress ring. The ring uses a `--rule` hairline track and an ink progress arc driven by `stroke-dasharray` / `stroke-dashoffset`. Offset changes ease with `--ease-out` over 180ms and jump without animation under `prefers-reduced-motion: reduce`.

| Key | Action |
|---|---|
| Left / Right | Previous / next whole slide |
| Home / End | First / last slide |
| `p` | Open presenter window |

Decks support `#slide-N` deep links. The runtime updates the URL hash as the speaker navigates.

## Press p for a presenter window

Press `p` in the main deck or docnav document window to open a second window:

| Pane | Shows |
|---|---|
| Header | Current slide or section number and title |
| Notes | Speaker notes for the current slide or section, editable |
| Preview | Next slide or next section |
| Timer | Elapsed time |

The notes pane is editable in the presenter window for delivery-time revisions; those edits are presenter-local and do not rewrite the source HTML. The normal theme toggle is hidden in the presenter window so it stays out of the speaker view.

The presenter window syncs by `BroadcastChannel("vpk-deck")`. If the channel is not available, it listens for `window.opener` messages; if that is unavailable, it can navigate independently.

## Documents opt into section navigation

| `<body>` attribute | Effect |
|---|---|
| `data-vpk-docnav="true"` | ArrowUp and ArrowDown jump between section headings; PageUp, PageDown, wheel and space stay native |
| `data-vpk-docnav="off"` | No section pager, arrow-key jumps or presenter key (the x-thread template uses it) |
| `data-vpk-enhancements="off"` | Omits the optional lightbox, scroll fades and token-override runtime; the shared theme and figure runtimes remain. Combine with `data-vpk-docnav="off"` when a minimal reading layout owns navigation |

Non-deck documents can opt into section navigation with `data-vpk-docnav="true"` on `<body>`. ArrowUp and ArrowDown jump between section headings; PageUp, PageDown, wheel, and space keep native browser behavior.

App-like pages opt out with `data-vpk-docnav="off"`: retrofit, `--inject-runtime` and the runtime pipeline then add no section pager, arrow-key jumps or presenter key (the x-thread template uses it).

Docnav speaker notes use the same source shape as decks: `<aside class="speaker-notes" aria-hidden="true">...</aside>` as the last child of each `main > section`. Notes are hidden from the audience window and print output. The presenter window shows the current section title, editable notes, next-section preview, and elapsed timer.

## check-html fails a deck without its runtime

| Missing | Caught by |
|---|---|
| Shared runtime, note-hiding CSS or print motion neutralizer | `scripts/check-html.mjs` |
| Motion tokens or reduced-motion overrides | `scripts/build.mjs --check-templates` |

## MP4 is a separate track from the presentation runtime

| Output | Track | Speaker notes |
|---|---|---|
| Live browser presentation | This runtime | Presenter window only |
| PDF | This runtime, print layer | Hidden |
| MP4 | Hyperframes conversion, [video export](video-export.md) | Narration input only; never in audience-window recordings |
