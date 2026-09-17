# Jira Team EU26

Jira Team EU26 shows the Payments SDK migration in Jira chrome at `/jira-team-eu26`, with Board/List views and a configurable Unlinked agent sessions column.

## Sub-features

- `eu26-route` opens the project directly and identifies heading `Jira Design`.
- `eu26-board-list` switches Board/List while preserving the single session column.
- `eu26-settings` records current Settings choices and restores any changed choices.
- `eu26-filter-column` covers Needs input, genuine empty/populated states, and collapse/expand.
- `eu26-pin` covers pin/unpin only with Advanced timeline enabled.
- `eu26-drag` covers session drop, outside-target cancellation, and Peel on/off.
- `eu26-narrow-motion` covers narrow viewport, light/dark theme, and reduced motion.

## How to get to it (user POV)

- Open `/jira-team-eu26` directly for project interactions.
- Open `/components/projects/jira-team-eu26` only for the project's documentation.
- The embedded preview `/preview/projects/jira-team-eu26?embedded=1` is a separate entry path; report it separately if the task requests it.

## Driving it with control-vpk

Preconditions:

- `control-vpk doctor` reports `"ok": true` for this worktree; `ORIGIN` came from `control-vpk url`.
- Set `EVIDENCE="$(control-vpk evidence-dir)/jira-team-eu26"` and create it before capture.
- Record theme, Settings and filter choices before changing them. Stored preferences can override defaults; do not overwrite storage to reset them.

- **Open and identify.** Run `control-vpk open-target /jira-team-eu26 --headed`, then `control-vpk browser wait --text "Jira Design"`. Confirm `control-vpk browser get url` is the project route on `ORIGIN`; snapshot with `control-vpk browser snapshot -i --compact --depth 8`. The visible session header is `Unlinked agent sessions`, while the region and controls retain `Unlink sessions`.
- **Board/List.** Run `control-vpk browser find role tab click --name List`; region `Payments SDK v2 migration work items list` appears. Return with `control-vpk browser find role tab click --name Board`. Preserve the session column and selection; do not look for v3's chapter gallery or Reset.
- **Settings.** Run `control-vpk browser find role button click --name Settings`, then snapshot. Unmodified defaults are Advanced timeline, Dragging and Manual link off, Card glow and Peel visual on; sidebar starts collapsed and the session panel expanded. Inspect checked states before clicking a menuitemcheckbox, and close menus with `control-vpk browser press Escape`. Dragging enables column width resizing; it is not proof that card dragging is disabled.
- **Needs input.** Run `control-vpk browser click "button[aria-label^='Needs input:']"`, snapshot, and record the actual session count and filter state. Counts change with the finite arrival/lifecycle queue; do not hardcode an early count after it settles. Click the same control again to restore the prior filter.
- **Empty then populated.** When a real user filter produces region `Unlink sessions, 0 sessions`, capture the automatic collapsed pill with vertical `0` / `Unlink sessions`. Run `control-vpk browser find role button click --name "Expand Unlink sessions column"`; `No sessions to unlink` appears. Clear the filter with its visible control to restore sessions, then run `control-vpk browser find role button click --name "Collapse Unlink sessions column"` and capture the populated rail. Expand again before continuing. If the current fixture cannot produce zero through its controls, report this path as unexercised; do not fabricate data or use a nonzero count as empty proof.
- **Pin/unpin (Advanced timeline).** In Settings, enable `Advanced timeline` only if unchecked. After closing Settings, if the column is expanded run `control-vpk browser find role button click --name "Collapse Unlink sessions column"` first. For a hidden gutter, reveal its hit area with `control-vpk browser hover "[data-agent-session-column-hit-area]"`. Then run `control-vpk browser find role button click --name "Unlink sessions column options"`, snapshot, and choose the currently offered `Pin` or `Unpin` menuitem with `control-vpk browser find role menuitem click --name Pin` (or `Unpin`). Reopen options to reverse the action. Confirm column placement and focus; the default panel does not expose the advanced gutter's pin behavior. Restore Advanced timeline afterward.
- **Drop and outside-target cancel.** In Board with visible sessions, snapshot and choose fresh source/issue refs. Set `SOURCE_REF` and `TARGET_REF` from that snapshot, then run `control-vpk browser drag "$SOURCE_REF" "$TARGET_REF"`. Verify the source membership and destination by another snapshot. On a separate fresh entry, use the heading's fresh ref as a neutral outside-target destination and repeat the drag; membership must remain unchanged and the preview must retire. Test Peel visual enabled/disabled through Settings when relevant and restore it; do not send a chat message as drag proof.
- **Theme/narrow/motion off.** Cycle the visible theme control to light and dark, recording its accessible name plus `control-vpk browser eval 'document.documentElement.getAttribute("data-color-mode")'`. Run `control-vpk browser set viewport 390 844` and `control-vpk browser set media light reduced-motion`, then repeat relevant switching/collapse/drag actions. Capture `control-vpk browser screenshot "$EVIDENCE/narrow.png"` and `control-vpk browser a11y --selector body > "$EVIDENCE/a11y.txt"`; preserve incomplete findings and existing violations in the report.
- **Proof and restore.** Save `control-vpk browser snapshot -i --compact --depth 8 > "$EVIDENCE/state.aria.txt"`, screenshot and URL for each exercised state. Restore changed Settings, filter and theme through their controls, then run `control-vpk cleanup`. Record skipped states rather than substituting another entry path.

## Gotchas

- The live heading is `Jira Design`; documentation and the project route are different surfaces.
- Visible header copy and action/region names differ deliberately. Do not rename or search controls by `Unlinked agent sessions`.
- Old tests may assume Advanced timeline on, a collapsed session column, or a fixed early Needs input count. Inspect the current state first.
- Empty-pill proof requires zero sessions; populated rail proof requires restoring sessions before collapsing. Preserve that order.
- Dismiss Settings/options menus before tab or drag actions. Refresh refs after every state change.
- The initial fixture and settled fixture differ. A short browser smoke is not a production benchmark or complete state-matrix proof.
