# VPK verification map

This directory is the maintained source for verifying the user-facing behavior of VPK. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch from this worktree with `.agents/skills/vpk-verify/scripts/control-vpk launch`.
- Set `ORIGIN` from `.agents/skills/vpk-verify/scripts/control-vpk url` (Portless `https://…localhost` when present).
- Run `.agents/skills/vpk-verify/scripts/control-vpk doctor` and require `"ok": true` for this worktree path.
- Open named objects through `.agents/skills/vpk-verify/scripts/control-vpk open-target <route>`, then drive through `control-vpk browser`.
- Never open another worktree's Portless URL from `pnpm ports`.
- Never drive an instance whose frontend port is not this checkout's `.dev-frontend-port`.

## Driving conventions

- For component, block or project debugging, resolve the exact route before opening the browser and first navigate directly there with `control-vpk open-target <route>`. Preserve requested query/hash; confirm URL and route marker.
- Start at home or a category only when explicitly verifying that catalog/entry path. A direct URL does not prove a title link works. If the object has no recipe, resolve its route from current metadata instead of browsing the landing page.
- Prefer `#home-category-tab-*`, `href`, and ARIA names listed in the skill. Do not click a tab by the substring `UI`.
- Treat every command as literal. Keep quoted names and flags unchanged.
- Restore theme through the same user-facing control until its original accessible name returns; never write storage or theme attributes directly.
- Restore sidebar search (clear the searchbox) after a search recipe.
- Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with VPK identity visible (sidebar `VPK` and the page heading or doc `h1`).
- Record the feature ID and entry point used with every artifact under `output/agent-browser/vpk-verify/<feature-id>/`.
- Report an unreachable path with the attempted command and the unmet precondition.
- Preserve `control-vpk browser`'s failure classification and exact command when handing off to Playwright; never count the failed command as proof.
- Do not report a skipped entry point as verified through a different path.
- Studio chat send is not covered here. A loaded composer is not proof that Rovo answered.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with control-vpk` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

After changing this index or a feature file, run `pnpm run verify:vpk-feature-map`. The verifier checks index parity, the required section order, unique sub-feature IDs, and user-entry routes against the generated repo map.

## Features

- [Browse the catalog](./browse-catalog.md) covers home projects, category tabs, and returning via the VPK logo.
- [Open a component doc](./open-component-doc.md) covers direct Accordion docs, explicit catalog-title entry checks, and the breadcrumb.
- [Switch theme](./switch-theme.md) covers cycling light, dark, and system from the header.
- [Search the sidebar](./sidebar-search.md) covers filtering the component browser and clearing the query.
- [Open Studio](./studio-shell.md) covers loading the Studio shell without sending a chat message.
- [Jira Golden Journeys v0](./jira-golden-journeys-v0.md) covers the original pattern gallery, keyboard selection, local terminal theme, and narrow layout.
- [Jira Golden Journeys v1](./jira-golden-journeys-v1.md) covers local/global session walkthroughs, screen navigation, keyboard selection, and narrow layout.
- [Jira Golden Journeys v2](./jira-golden-journeys-v2.md) covers story chapters, Details/Activity, guided pull-request detail, keyboard focus, and narrow layout.
- [Jira Golden Journeys v3](./jira-golden-journeys-v3.md) covers Track/Learn/Build/Terminal, PAY-101 sections, PR #1839, and narrow `Jump to chapter`.
- [Jira Golden Journeys v4](./jira-golden-journeys-v4.md) covers the Payments SDK board/list in Jira chrome, Unlink sessions, and view controls.
- [Jira Team EU26](./jira-team-eu26.md) covers direct project entry, Board/List, current settings, session filters and column states, drag/drop/cancel, and narrow motion-off proof.
