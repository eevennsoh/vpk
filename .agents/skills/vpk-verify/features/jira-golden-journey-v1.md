# Jira Golden Journey v1

Jira Golden Journey v1 lets a user walk through Carl's local session or Sarah's global session with named screen controls and route-local terminal theming.

## Sub-features

- `jira-v1-route` opens `/jira-golden-journey-v1` and shows the named gallery.
- `jira-v1-local` steps Carl's Terminal-to-Kanban walkthrough with previous, next, and section-jump controls.
- `jira-v1-global` selects Sarah's global session and reaches its Kanban, Rovo, For you, and Kanban & List screens.
- `jira-v1-keyboard-narrow-a11y` covers keyboard selection, compact screen controls, reduced motion, and route-scoped accessibility.

## How to get to it (user POV)

- Open `/jira-golden-journey-v1` directly.
- Choose `Carl's local session` or `Sarah's global session` from the gallery strip.
- Use `Previous screen`, `Next screen`, or `Jump to section` to move through the selected session.

## Driving it with control-vpk

Preconditions:

- `pnpm control-vpk doctor` reports `"ok": true` for this worktree and `ORIGIN` came from `pnpm control-vpk url`.
- Set `EVIDENCE="$(pnpm control-vpk evidence-dir)/jira-golden-journey-v1"` and create it before capture.

- **Open the local session.** Run `pnpm control-vpk browser open --headed "$ORIGIN/jira-golden-journey-v1"`, wait for text `Jira Golden Journey v1`, set viewport `390 844` plus reduced motion, and wait for `button[aria-label='Jump to section']` before the first interactive snapshot. `Select Carl's local session` is pressed and compact `Next screen` is enabled; keep that fresh Next ref.
- **Prove screen navigation and theme.** Run `pnpm control-vpk browser focus @eN` with the fresh `Next screen` ref, press Enter, wait for the snapshot's Terminal progress label to change, and re-snapshot before another ref action. While a Terminal screen is active, use the same nearest-`[data-color-mode]` IIFE from the v0 recipe to record the `Cycle theme, current theme: …` name, route-local mode, and ADS tokens. Click the exact current name, prove the IIFE changes, then restore the original name through the same control in at most two clicks.
- **Switch session by keyboard.** From a new snapshot, focus the ref for `Select Sarah's global session` and press Enter. Re-snapshot and confirm Sarah's tile is pressed plus heading `Jira Design`; do not wait for a terminal prompt because Sarah's saved position opens on the Jira board.
- **Cover narrow reduced motion.** Run `pnpm control-vpk browser set viewport 390 844`, `pnpm control-vpk browser set media light reduced-motion`, and `pnpm control-vpk browser wait "button[aria-label='Jump to section']"`. Snapshot, focus the fresh `Jump to section` ref, press Enter, wait `"[role='menu']"`, then press Escape. Re-snapshot, focus the fresh `Next screen` ref, press Enter, and confirm the Rovo surface through `Back to Rovo` plus its clarification-question region. `Previous screen`, `Jump to section`, and `Next screen` remain available.
- **Proof and accessibility.** Run `pnpm control-vpk browser snapshot -i --compact --depth 8 > "$EVIDENCE/global-narrow.aria.txt"`, `pnpm control-vpk browser screenshot "$EVIDENCE/global-narrow.png"`, and `pnpm control-vpk browser a11y --selector body > "$EVIDENCE/a11y.txt"`.
- **Cleanup.** Reopen the gallery if necessary, reselect Carl's local session, return it to the first Terminal screen with Previous, then run `pnpm control-vpk cleanup`. Evidence remains under the feature directory.

## Gotchas

- Carl and Sarah keep independent screen positions. Switching cards does not reset the other card.
- Window-level ArrowLeft/ArrowRight deliberately does not steal keys from focused controls. Use named buttons while verifying keyboard behavior.
- Theme cycling is only terminal-local while a Terminal screen is active.
- On narrow viewports, use `Jump to section`; the full desktop run controls are intentionally replaced.
- Sarah's first screen is the Kanban board. Heading `Jira Design` is the board chrome, not the later Kanban & List workspace.
- `wait --text "Back to Rovo"` can time out. Assert `button[aria-label='Back to Rovo']` (or a snapshot) and region `Clarification questions — answer or skip to continue chatting`.
