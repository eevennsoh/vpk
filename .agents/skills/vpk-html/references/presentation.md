# Presentation Mode

vpk-html decks and presentation-style documents keep the audience surface, print
surface, and presenter surface separate.

## Deck contract

- A deck is any HTML file with at least two `section.slide` elements.
- Print geometry stays fixed at the template's `@page` size (`slides.html` uses
  `280mm x 158mm`).
- Screen mode is added by `scripts/presentation.mjs` and injected by the
  runtime pipeline: `build.mjs --refresh-library` for the skill library and
  `--inject-runtime` for artifacts.
- Speaker notes live as the last child of a slide:
  `<aside class="speaker-notes" aria-hidden="true">...</aside>`.
- `.speaker-notes` is hidden in the main window and in print. The presenter
  window reads the note text without exposing it to screen recordings of the
  main deck window.

## Controls

Decks and docnav documents use the same fixed round-button control cluster:
previous button, Geist Mono `NN / NN` counter with `aria-live="polite"`, and
next button with an SVG circular progress ring. The ring uses a `--rule`
hairline track and an ink progress arc driven by `stroke-dasharray` /
`stroke-dashoffset`. Offset changes ease with `--ease-out` over 180ms and jump
without animation under `prefers-reduced-motion: reduce`.

| Key | Action |
|---|---|
| Left / Right | Previous / next whole slide |
| Home / End | First / last slide |
| `p` | Open presenter window |

Decks support `#slide-N` deep links. The runtime updates the URL hash as the
speaker navigates.

## Presenter Window

Press `p` in the main deck or docnav document window to open a second window.
It shows:

- current slide or section number and title
- speaker notes for the current slide or section
- next-slide or next-section preview
- elapsed timer

The notes pane is editable in the presenter window for delivery-time revisions;
those edits are presenter-local and do not rewrite the source HTML. The normal
theme toggle is hidden in the presenter window so it stays out of the speaker
view.

The presenter window syncs by `BroadcastChannel("vpk-deck")`. If the channel is
not available, it listens for `window.opener` messages; if that is unavailable,
it can navigate independently.

## Documents

Non-deck documents can opt into section navigation with
`data-vpk-docnav="true"` on `<body>`. ArrowUp and ArrowDown jump between section
headings; PageUp, PageDown, wheel, and space keep native browser behavior.

App-like pages opt out with `data-vpk-docnav="off"`: retrofit, `--inject-runtime`
and the runtime pipeline then add no section pager, arrow-key jumps or presenter
key (the x-thread template uses it).

Docnav speaker notes use the same source shape as decks:
`<aside class="speaker-notes" aria-hidden="true">...</aside>` as the last child
of each `main > section`. Notes are hidden from the audience window and print
output. The presenter window shows the current section title, editable notes,
next-section preview, and elapsed timer.

## Validation

`scripts/check-html.mjs` fails decks that are missing the shared runtime, note
hiding CSS, or print motion neutralizer. `scripts/build.mjs --check-templates`
also asserts the motion tokens and reduced-motion overrides are present.

## Video

The presentation runtime is for live browser presentation and PDF export. MP4
export is a separate Hyperframes conversion track; see `references/video-export.md`.
Speaker notes are excluded from audience-window recordings; video conversion may
consume them as narration input only.

Minimal reading layouts can set `data-vpk-enhancements="off"` on `<body>` to omit the optional lightbox, scroll fades and token-override runtime. Combine it with `data-vpk-docnav="off"` when the layout owns navigation; the shared theme and figure runtimes remain available.
