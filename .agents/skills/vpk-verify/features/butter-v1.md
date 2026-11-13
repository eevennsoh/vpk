# Project Butter v1

Project Butter v1 presents a Jira Design board with agent sessions and a list view of the Payments SDK migration work items.

## Sub-features

- `butter-v1-board` opens the Jira Design board and its Unlink sessions column.
- `butter-v1-list` switches between the board and the work-item list.

## How to get to it (user POV)

- Open `/butter-v1` directly or open the Project Butter v1 preview at `/preview/projects/butter-v1`.
- Use the `Board` and `List` tabs to change views.

## Driving it with control-vpk

Preconditions:

- `pnpm control-vpk doctor` reports `"ok": true` for this worktree.

- **Open the board.** Run `pnpm control-vpk open-target /butter-v1`. Confirm headings `Project Butter v1` and `Jira Design`, the selected `Board` tab, and the `Unlink sessions` region.
- **Switch to the list.** Run `pnpm control-vpk browser find role tab click --name List`, then `pnpm control-vpk browser snapshot -i --compact`. Confirm `List` is selected and the `Search list` textbox is present.
- **Return to the board.** Run `pnpm control-vpk browser find role tab click --name Board`, then `pnpm control-vpk browser snapshot -i --compact`. Confirm `Board` is selected and the `Search board` textbox is present.
- **Capture proof.** Run `pnpm control-vpk capture /butter-v1 --wait-text "Jira Design"` for the light-theme screenshot, accessibility snapshot, console, and accessibility results.
- **Cleanup.** Run `pnpm control-vpk cleanup` after verification.

## Gotchas

- The session count changes while the demo runs; check the `Unlink sessions` label rather than an exact count.
- Opening Rovo chat and sending a message require a healthy backend and are outside this recipe.
