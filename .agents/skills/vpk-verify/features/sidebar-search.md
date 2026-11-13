# Search the sidebar

Search the sidebar lets a user filter the component browser by name, open a match, distinguish no matches, and clear the query.

## Sub-features

- `search-open` focuses the sidebar search field.
- `search-match` shows Accordion and hides unrelated sections for query `accordion`.
- `search-empty` shows no Accordion / Jira For You links for query `volcano`.
- `search-clear` restores the unfiltered section list.

## How to get to it (user POV)

- With the component browser open, type into `Search components` (`placeholder` `Search...`).
- Choose `Clear search` after a query.

## Driving it with control-vpk

Preconditions:

- `pnpm control-vpk doctor` reports `"ok": true` for this worktree.
- Sidebar is open (button name `Close sidebar`). If it is `Open sidebar`, click it first.
- Evidence directory `output/agent-browser/vpk-verify/sidebar-search/` exists.

- **Ensure sidebar open.** If the rail button is `Open sidebar`, run `pnpm control-vpk browser find role button click --name "Open sidebar"`. The complementary region `Component browser` is visible and contains searchbox `Search components`.
- **Match.** Fill the searchbox. Run `pnpm control-vpk browser find role searchbox fill accordion --name "Search components"`. The nav contains `Accordion` (`a[href='/components/ui/accordion']`) and does not list unfiltered section chrome the same way as idle (Projects / Arts headings may collapse to matches only).
- **Open match (optional).** Choose Accordion. Run `pnpm control-vpk browser click "a[href='/components/ui/accordion']"`. URL contains `/components/ui/accordion`. Return to `$ORIGIN/ui` before the next query.
- **Empty.** Fill `volcano`. Run `pnpm control-vpk browser find role searchbox fill volcano --name "Search components"`. There is no `Jira For You` link and no Accordion href.
- **Clear.** Choose clear. Run `pnpm control-vpk browser find role button click --name "Clear search"`. The searchbox is empty and section titles such as `Projects` are visible again.
- **Proof.** Capture the match state (re-type `accordion` if you already cleared). Run `pnpm control-vpk browser snapshot -i --compact --depth 8 > output/agent-browser/vpk-verify/sidebar-search/match.aria.txt` and `pnpm control-vpk browser screenshot output/agent-browser/vpk-verify/sidebar-search/match.png`. Artifacts show query `accordion` and the Accordion match.

## Gotchas

- If the sidebar is closed, the searchbox is off-screen. Open it first.
- Native search inputs may show a UA clear control; use `Clear search`, not a guessed `×` coordinate.
- Filling does not need a debounce wait for this client-side filter, but snapshot immediately after fill so the value is in the tree.
- Leave the searchbox empty when the recipe ends so the next feature does not start filtered.
