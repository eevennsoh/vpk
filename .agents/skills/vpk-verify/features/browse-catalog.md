# Browse the catalog

Browse the catalog lets a user see VPK project cards on home, switch category tabs, and return to projects from the sidebar logo.

## Sub-features

- `catalog-home` shows the Projects category tab selected and at least one project card on `/`.
- `catalog-tab-ui` switches the header tab to UI and shows the UI catalog, including Accordion.
- `catalog-logo` returns to `/projects` from the sidebar rail logo.

## How to get to it (user POV)

- Open the app origin in the browser (`/` is the projects catalog).
- Choose the `UI` category tab in the header.
- Choose the VPK logo in the left rail (`Go to projects`).

## Driving it with control-vpk

Preconditions:

- `control-vpk doctor` reports `"ok": true` for this worktree.
- `ORIGIN` is this worktree's URL from `control-vpk url`.
- Evidence directory `output/agent-browser/vpk-verify/browse-catalog/` exists.

- **Open home.** Open the origin. Run `control-vpk browser open "$ORIGIN/"`. Tab `#home-category-tab-projects` is selected (accessible name starts with `Projects`). At least one `a[href^='/components/projects/']` card title is present (first card follows `Sort: Last updated`, so the name is not stable). Link `VPK` is visible in the component browser.
- **Switch to UI.** Choose the UI tab by id, not by the name `UI`. Run `control-vpk browser click "#home-category-tab-ui"`. `control-vpk browser get url` is `$ORIGIN/ui`, tab `#home-category-tab-ui` is selected, and `a[href='/components/ui/accordion']` named `Accordion` is present.
- **Proof.** Capture the UI catalog while that tab is still selected. Run `control-vpk browser snapshot -i --compact --depth 8 > output/agent-browser/vpk-verify/browse-catalog/ui.aria.txt` and `control-vpk browser screenshot output/agent-browser/vpk-verify/browse-catalog/ui.png`. The artifacts show sidebar `VPK`, selected tab `UI`, and card `Accordion`.
- **Return via logo.** Choose the rail logo. Run `control-vpk browser click "a[aria-label='Go to projects']"`. `control-vpk browser get url` is `$ORIGIN/projects` and the Projects tab is selected again.

## Gotchas

- Home is `/` and the logo lands on `/projects`. Both show the projects catalog; assert the URL after the logo click.
- Category tab names include counts (`UI 80`) and `UI` is a substring of other UI category names. Always click `#home-category-tab-ui`.
- `find role link click --name "Go to projects"` can report success without navigating. Use `a[aria-label='Go to projects']`.
- Project cards embed preview iframes. Do not click inside the iframe to open docs; click the card title link.
- Default project sort is last-updated. Do not require a specific first-card title such as `Jira For You`.
- Capture the UI proof before the logo click. The logo lands on `/projects`, so a snapshot taken after that step cannot show the UI tab or Accordion.
- A screenshot of a loading skeleton is not proof. Wait until a selected category tab and at least one named card link exist.
