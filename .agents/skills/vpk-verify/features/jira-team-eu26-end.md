# Jira Team EU26 End

Jira Team EU26 End is the Team ’26 EU keynote board at `/jira-team-eu26-end`: twenty-four announcement cards (`TEU-1` to `TEU-13`, except retired `TEU-6`, plus `TEU-101` to `TEU-112`) in Context, Collaboration and Confidence columns, an empty Done column, and a collapsed agent-session rail. When the last keynote card lands in Done, a full-screen recap takes over, tosses the Done cards into a 3D field and assembles six of them into a bento around a two-line “Team ’26 / Europe” title. The bento's tiles and its title are then thrown into gaps across an endless mega bento that glides left until Esc, new cards coming down out of the air at its right edge.

## Sub-features

- `eu26-end-route` opens the board directly and identifies heading `Team ’26 EU keynote`.
- `eu26-end-board` covers the four columns, the 24 covers, presenter filters and agent previews.
- `eu26-end-board-list` switches the Board and List tabs.
- `eu26-end-card-actions` covers Create, card More actions (Select, Archive, Delete) and the selection toolbar.
- `eu26-end-drag-done` covers dragging cards into Done, the completion trace and the Done scrollbar.
- `eu26-end-play-closing` covers Settings `Play closing` (bulk drop into Done, then the finale) and its replay on a complete board.
- `eu26-end-finale` covers the recap dialog, presenter keys, blank card backs, the final bento and the mega bento after it.
- `eu26-end-finale-seek` covers rehearsal links that open the finale at a cue, frozen or playing.
- `eu26-end-narrow-motion` covers theme, a 1024px viewport and reduced motion.

## How to get to it (user POV)

- Open `/jira-team-eu26-end` directly for board and finale interactions.
- Open `/components/projects/jira-team-eu26-end` only for the project's documentation.
- The embedded preview `/preview/projects/jira-team-eu26-end?embedded=1` has no top navigation, so Settings, `Play closing` and the theme control are absent there; report it separately if requested.
- A user reaches the finale by moving every keynote card into Done: drags, Auto arrange, or Settings, then `Play closing`.

### State entry

- `/jira-team-eu26-end?finale` arms the finale. The next primary-button press anywhere on the page opens it from 0 s and plays.
- `/jira-team-eu26-end?finale=<sec>&hold` arms it seeked to `<sec>` and frozen; `Space` plays from there. Without `&hold` it plays from `<sec>`. Invalid or non-positive values fall back to 0.
- Both arm once per page load and open over the current board without requiring Done; press the board heading so the arming press has no other effect.

Cue seconds from [finale-cues.ts](../../../../components/projects/jira-team-eu26-end/finale/data/finale-cues.ts) (`CUE`, then `WALL_CUE` for the mega bento). Every cue after the sweep is offset by its 0.62 s duration.

| `<sec>` | On screen |
| --- | --- |
| `0` | The board exactly as it was (the flash adds nothing on frame 0); light then floods up the Done column from its foot until 0.62. |
| `0.62` | Burst: the Done cards are tossed into a 3D field within 0.12 s, tumbling for 1.25 s with blank light-grey backs; the board fades under the white slide. |
| `1.52`, `2.32`, `3.02` | Camera recoil, wide reveal of the field, close sweep. |
| `3.57` to `4.27` | The camera rushes in to the hero (Agent Session Tracking's card, which always takes the first slot) and arrives face-on. |
| `4.92` | Back on the slide: the hero lands as the first bento tile; five tiles follow 0.22 s apart. Each sheet turns from its Done card into its tile's face as it comes down and lands in full: never an empty tile, nothing builds in after. The faces are printed ahead (`useFinaleFacePrints`); a capture held past a landing before they finish shows that sheet blank. |
| `6.27` | The `Team` title starts building in the bento centre. |
| `6.72` to `7.57` | The year's last digit rolls up to `26`. |
| `9.57` | The bento's final frame, as the Founder Keynote Figma "Bento" (node `10774:6028`): around “Team ’26 / Europe”, Agent Sessions and AI Capital Management on the left, Rovo Work Mode and Record for Agent above and below the title, Artifacts and Agent Effectiveness on the right, each a grey tile with a mono label over its product slice. This is also the reduced-motion frame. Nothing of the mega bento shows yet. |
| `9.62` to `10.42` | A card in the tiles' own grey rises under “Team ’26 / Europe” and turns over (edge-on near `9.98`), lifting and tipping like paper, to its black back with the type in white. Every tile keeps its face. |
| `10.47` | All seven cards (the six tiles, content and all, and the black title card) become WebGL sheets in place and are thrown at once, tumbling and bending like paper with a chromatic smear. They fall away from the lens onto the wall, shrinking toward their gaps, and are never seen larger than their tiles. The mega bento fades in around them from the centre out (until about `12.8`). |
| `12.47` to `13.67` | They come down one after another, 0.2 s apart (the shortest flight first), into seven gaps across the wall, the title card into the middle one, each landing as on the slide: paper wave, shadow, border glow, dot pulse. |
| `14.12` on | The wall starts to glide (full pace from `17.12`, looping continuously). |
| about `15.50`, then at irregular times (0–2 s apart) | Cards wait in the air beyond the right edge, each tilted its own way and smeared like the 3D field, then come down one at a time into their slots (about 1 s each) with the same wave, glow and dot pulse. Now and then a presenter's cursor takes one by its corner and sets it down. |
| about `13.69`, then every ~49 s (three a loop) | A 3:4 lanyard tile glides in hanging from the top edge (never from the air), its strap running straight off the frame. Once most of it is in, a presenter's 3D lanyard (the `3d-lanyard` block) drops in from that edge once, catches and swings, then hangs still until the wall carries it off (about 25 s later); it is never reeled up or swapped. The next lanyard is the next tile along, and each differs from the last in presenter, agent, swing (1, 1.3 or 1.55) and reveal (10–26°): Taroon Mandhana with Cursor, then Mike Cannon-Brookes with Rovo at about `62.9`, then Tamar Yehoshua with Claude at about `112.5`. Times are for 1920×1080. |

## Driving it with control-vpk

Preconditions:

- `control-vpk doctor` reports `"ok": true` for this worktree; `ORIGIN` came from `control-vpk url`.
- Set `EVIDENCE="$(control-vpk evidence-dir)/jira-team-eu26-end"` and create it before capture.
- Record theme and Settings choices before changing them. Settings properties and Auto arrange are stored preferences shared with `/jira-team-eu26`; board changes are not persisted, so reloading restores the 24-card fixture.

- **Open and identify.** Run `control-vpk open-target /jira-team-eu26-end --headed`, then `control-vpk browser wait --text "EU keynote"`. Confirm `control-vpk browser get url` is the project route on `ORIGIN`, run `control-vpk browser find role heading text --name "EU keynote"`, and snapshot with `control-vpk browser snapshot -i --compact --depth 8`. Regions `Context work items`, `Collaboration work items`, `Confidence work items` and `Done work items` hold 8, 6, 10 and 0 cards.
- **Board header and covers.** Each card cover shows a two-line heading and its app logos as named images. Run `control-vpk browser find role button click --name "Filter board by MCB"` and confirm `aria-pressed="true"` in a snapshot; click it again to restore. Run `control-vpk browser find role button hover --name "Preview Claude"`; a hover card with heading `Claude` appears. Close it by hovering away with `control-vpk browser find role heading hover --name "EU keynote"`.
- **Board/List.** Run `control-vpk browser find role tab click --name List`; region `Team ’26 EU keynote work items list` appears. Return with `control-vpk browser find role tab click --name Board`.
- **Create and card actions.** Run `control-vpk browser find role button click --name "Create in Context"`, `control-vpk browser find role textbox fill "Keynote check" --name "Name this work item"` and `control-vpk browser press Enter`; the card appears in Context. Card triggers stay hidden until hover or focus, so run `control-vpk browser focus "[aria-label='More actions for TEU-1']"` and `control-vpk browser press Enter`. The menu lists `Select`, `Archive` and `Delete`, plus agent and skill rows that open floating chat and are not proof here. Choose `control-vpk browser find role menuitem click --name Select`; the toolbar shows the count and cards in that column expose `Select TEU-n` checkboxes. Finish with `control-vpk browser find role button click --name "Clear selection"`. `Archive` or `Delete` removes a card; reload to restore it.
- **Drag into Done.** Snapshot, set `SOURCE_REF` to a card and `TARGET_REF` to region `Done work items`, then run `control-vpk browser drag "$SOURCE_REF" "$TARGET_REF"`. Confirm with a fresh snapshot that the card is in Done and has left its column. With motion on, a drop of one or more cards that leaves the board incomplete fires a small confetti burst from the lower corners on the drop itself; a quick second drop adds its burst over the first rather than clearing it, and the layer `[data-finale-confetti]` returns to `idle` once the last has faded. The drop that completes the board traces the visible Done cards before the finale opens. Unconfirmed: whether agent-browser `drag` drives this board's pointer pickup. If membership is unchanged, record the command as unexercised; the handoff is `pnpm exec playwright test tests/projects/jira-team-eu26-end.spec.ts -g "drag moves work items into Done"`. With cards in Done, `control-vpk browser hover "[data-jira-kanban-column='Done'] [data-jira-kanban-card-list]"` reveals the overlay scrollbar once Done overflows.
- **Play closing.** With the Board tab shown, run `control-vpk browser find role button click --name Settings`, then `control-vpk browser find role menuitem click --name "Play closing"`. The remaining keynote cards drop into Done as one cohort, then the finale opens. Run `control-vpk browser wait "[data-jira-team-eu26-end-finale]"`; card prints can take up to 8 s. Escape the finale and choose `Play closing` again on the complete board; it replays the finale without moving cards.
- **Finale.** The dialog `Team ’26 Europe keynote recap` holds a live summary containing `All 24 work items are done. Featured:` followed by the six bento headings. Capture `control-vpk browser screenshot "$EVIDENCE/finale-burst.png"` in the first 2 s, `"$EVIDENCE/finale-rest.png"` at about 9.5 s (or from `?finale=9.57&hold`), and `"$EVIDENCE/finale-wall.png"` after about 15 s. The wall never ends on its own; Escape closes it. Presenter keys: `control-vpk browser press Space` pauses or resumes, `press ArrowLeft` or `ArrowRight` nudges 0.5 s, `press r` replays from 0 and `press Escape` fades back to the board with every keynote card in Done.
- **Rehearsal seek.** Run `control-vpk open-target '/jira-team-eu26-end?finale=4.92&hold' --headed` and `control-vpk browser wait --text "EU keynote"`, then `control-vpk browser find role heading click --name "EU keynote"` to arm it. Run `control-vpk browser wait "[data-jira-team-eu26-end-finale]"` and screenshot the frozen cue against the table. Then `control-vpk browser press Space` plays from that frame and `press Escape` exits. The board is unchanged. Undragged cards top the bento up in board order, so a fresh board features TEU-10, TEU-1, TEU-101, TEU-2, TEU-102 and TEU-3.
- **Theme/narrow/motion off.** Cycle the visible theme control, recording its accessible name plus `control-vpk browser eval 'document.documentElement.getAttribute("data-color-mode")'`; covers follow the theme without moving. Run `control-vpk browser set viewport 1024 768` and `control-vpk browser set media light reduced-motion`, then repeat a drag into Done or Play closing. Drops skip the completion trace, and the finale opens on its final frame for any `<sec>`. Capture `control-vpk browser screenshot "$EVIDENCE/narrow.png"` and `control-vpk browser a11y --selector body > "$EVIDENCE/a11y.txt"`.
- **Proof and restore.** Save `control-vpk browser snapshot -i --compact --depth 8 > "$EVIDENCE/state.aria.txt"`, a screenshot and the URL for each exercised state. Restore changed filters, Settings and theme through their controls, reload to restore the board, then run `control-vpk cleanup`.

## Gotchas

- Names use the typographic apostrophe (`Team ’26`). Match with substrings such as `EU keynote` or `keynote recap` instead of typing `'`.
- The finale fires only on the change to all 24 keynote cards in Done, never on load. Created cards neither block nor trigger it. Once the board is complete, only `Play closing` or `r` in the finale replays it.
- The recap scene is `aria-hidden`: snapshots show only the dialog and its summary, so cue proof needs screenshots. The summary says all 24 items are done even when a rehearsal link opened it.
- If the dialog never appears, the Done-column print failed and the finale cancelled silently. Reload and retry; do not report it as verified. It was not confirmed whether it renders after `Play closing` from List, so run it from Board.
- The wall is `aria-hidden`, so role queries cannot find its tiles. Lanyard tiles carry `[data-finale-wall-lanyard]` (their slot key) for crops; their canvas is `visibility: hidden` until the tile's one drop and visible from then on. Their renderer, art and physics load in a worker when the finale opens, so a held link straight into the wall may show an empty tile for its first second or two.
- Reduced motion pins the finale to the 9.57 s bento frame, so seeks look identical and the wall never mounts. Sound is off in the cue sheet; there is nothing to verify by ear.
- In a rehearsal opened before every card was printed, a wall slot shows its card's story tile until the print lands, then swaps it in. The bento's faces print when the scene mounts on a frame past `8.50`, so a link seeked into the throw (`10.47` to `13.67`) may show its first frames of flight blank (unconfirmed); seek to `9.57` or earlier for proof of the throw.
- Auto arrange is not in this route's Settings. It follows the shared stored preference set in `/jira-team-eu26` Settings, acts on selected cards (shortcut `a`) and sends every card, including created ones, to Done.
- `window.__jiraTeamEu26Finale` is a development console hook for rehearsal; it is not a user path and not proof.
- The year strip's start is inconsistent in source: the cue comment says 19 and the title component rolls 20 to 26. Report what is on screen.
