# Jira Golden Journeys v4

Jira Golden Journeys v4 lets a user inspect the Payments SDK v2 migration board in full Jira chrome, switch Board and List, and review Unlink sessions without a Golden Journeys gallery.

## Sub-features

- `jira-v4-route` opens `/jira-golden-journeys-v4` and shows heading `Jira Design` (there is no on-page `Jira Golden Journeys v4` heading, chapter group, or Reset).
- `jira-v4-board-list` switches `Work items view` tabs `Board` and `List` and shows PAY-101 plus pull-request badges.
- `jira-v4-untracked-view` keeps the `Unlink sessions` column visible and opens `Configure board view`.
- `jira-v4-narrow-a11y` covers a 390×844 reduced-motion viewport and a route-scoped accessibility scan.

## How to get to it (user POV)

- Open `/jira-golden-journeys-v4` directly, or choose the `Jira Golden Journeys v4` catalog card and use the live app route.
- Stay on `Work items`. Use `Board` or `List`, `Configure board view`, and the Summary tab.
- Do not expect v3's chapter strip, Reset, or route-local gallery theme.

## Driving it with control-vpk

Preconditions:

- `control-vpk doctor` reports `"ok": true` for this worktree and `ORIGIN` came from `control-vpk url`.
- Set `EVIDENCE="$(control-vpk evidence-dir)/jira-golden-journeys-v4"` and create it before capture.

- **Open and identify.** Start directly with `control-vpk open-target /jira-golden-journeys-v4 --headed` and wait for heading `Jira Design`. Confirm there is no chapter group and no `Reset` button. Region `Track the Payments SDK v2 migration. Scroll horizontally to review all delivery statuses.` is present.
- **Prove Board markers.** Snapshot and confirm tab `Board` selected, region `Unlink sessions, N sessions`, card `PAY-101`, and a pull-request control whose name includes `#1839`.
- **Prove List.** Run `control-vpk browser find role tab click --name List`. Region `Payments SDK v2 migration work items list` is present. Return with `control-vpk browser find role tab click --name Board`.
- **Prove view chrome.** Run `control-vpk browser find role button click --name "Configure board view"` and confirm menuitem `Agent`. Press Escape until the menu closes before another tab click — a leftover menu covers Summary / Work items.
- **Prove Summary.** Run `control-vpk browser find role tab click --name Summary`. Tab `Summary` is selected and tabpanel `Summary` is present. Return to `Work items`.
- **Proof and accessibility.** Run `control-vpk browser set viewport 390 844` and `control-vpk browser set media light reduced-motion`. Run `control-vpk browser snapshot -i --compact --depth 8 > "$EVIDENCE/narrow.aria.txt"`, `control-vpk browser screenshot "$EVIDENCE/narrow.png"`, and `control-vpk browser a11y --selector body > "$EVIDENCE/a11y.txt"`.
- **Cleanup.** Run `control-vpk cleanup`. There is no Reset control on this route. Evidence remains under the feature directory.

## Gotchas

- Catalog title is `Jira Golden Journeys v4`. The live page heading is `Jira Design`.
- This route is board/list-only. Do not require Track/Learn/Build/Terminal, gallery theme, or Reset.
- Dismiss `Configure board view` before clicking Summary or Work items. A leftover menu covers those tabs and `find` reports `assertion_failure`.
- Agent Unlink / Rovo chat rows are visible on the board. Opening chat is out of scope unless a later feature file says to and `doctor --require-backend` passes.
- `#1847` appears as a badge on other cards. PAY-101's merged inventory PR is `#1839`.
