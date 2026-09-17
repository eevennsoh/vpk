# Jira Golden Journeys v3

Jira Golden Journeys v3 lets a user walk Track, Learn, Build, and Terminal: a Payments SDK board, a PAY-101 work item with scroll-linked sections, and a terminal-local theme.

## Sub-features

- `jira-v3-chapters` selects Track, Learn, Build, and Terminal through `Open a software delivery story chapter` (or `Jump to chapter` on a narrow viewport).
- `jira-v3-sections` activates Description and Activity links and verifies `aria-current="location"` after scroll settlement.
- `jira-v3-insights-pr` opens the Insights section (heading only on this route) and proves PR #1839 plus the `Pull requests. 1` combobox.
- `jira-v3-focus-narrow-theme-a11y` covers combobox focus restoration, a 390×844 reduced-motion viewport, terminal-local theme, and route-scoped accessibility.

## How to get to it (user POV)

- Open `/jira-golden-journeys-v3` directly. Track is selected and shows the Payments SDK board (`h1` `Jira Design`).
- Choose Build from `Open a software delivery story chapter` (or `Jump to chapter` on narrow screens).
- Use the Work item sections navigation for Description, Activity, and Insights. Pull requests is a combobox, not a section link.

## Driving it with control-vpk

Preconditions:

- `control-vpk doctor` reports `"ok": true` for this worktree and `ORIGIN` came from `control-vpk url`.
- Set `EVIDENCE="$(control-vpk evidence-dir)/jira-golden-journeys-v3"` and create it before capture.

- **Open and identify.** Start directly with `control-vpk open-target /jira-golden-journeys-v3 --headed` and wait for text `Jira Golden Journeys v3` before taking an interactive snapshot. Group `Open a software delivery story chapter` is visible and `Track` is pressed.
- **Prove local theme through the UI.** Choose Terminal first. Use the nearest-`[data-color-mode]` IIFE from the v0 recipe to record the gallery theme control name, route-local mode, and resolved ADS tokens. Click that exact accessible name, rerun the IIFE, and require its local mode and name to change. Restore the original name through the same UI control in at most two clicks; do not inspect or write global storage as substitute proof.
- **Open Build and navigate sections.** Choose Build and wait for PAY-101. Focus link `Activity` (the accessible name may include a count such as `Activity 7`), press Enter, and wait for its `aria-current` state; the nearest scroll owner moves while the document does not gain horizontal overflow. Activate `Description`, then Activity again.
- **Prove Insights.** Activate link `Insights` (name may be `Insights 2`). Take a fresh interactive snapshot and confirm region `Insights` plus heading `Insights`. Do not require `Decision timeline` or `Sources` on this route — Build does not mount that briefing. Return to Activity through its link; do not reload the route or rely on a text wait as substitute proof.
- **Prove PR identity and combobox focus.** Confirm button or link `#1839: Call-site inventory across four services`. Focus combobox `Pull requests. 1`, press Enter, and confirm listbox option `Pull request #1839: Call-site inventory across four services`. Press Escape. The listbox closes and focus returns to the combobox.
- **Cover narrow reduced motion.** Run `control-vpk browser set viewport 390 844` and `control-vpk browser set media light reduced-motion`. Desktop chapter buttons are replaced by `Jump to chapter`. Description, Activity, Insights, and Pull requests remain keyboard operable without horizontal page overflow.
- **Proof and accessibility.** Run `control-vpk browser snapshot -i --compact --depth 9 > "$EVIDENCE/build-narrow.aria.txt"`, `control-vpk browser screenshot "$EVIDENCE/build-narrow.png"`, and `control-vpk browser a11y --selector body > "$EVIDENCE/a11y.txt"`.
- **Reset and cleanup.** Run `control-vpk browser find role button click --name Reset`; Track is pressed again. Run `control-vpk cleanup`; retained files are the only accepted proof from this run.

## Gotchas

- Chapters are Track, Learn, Build, and Terminal. Do not look for Review, Fix, Approve, or Release.
- Default selection and Reset both return to Track, not Terminal.
- The in-app PR on Build is `#1839: Call-site inventory across four services`. `#1847` is next-step copy, not this work item's pull request.
- V3 section navigation is scroll-linked. Assert `aria-current` after scroll settlement; a successful click alone is insufficient.
- Insights can show a count badge while the section body is only the Insights heading. That is not the v2-style Decision timeline.
- Pull requests is a combobox that can open on hover. Pressing Escape must close its listbox and restore focus before another keyboard assertion.
- Terminal theme is local to the story surface; global storage alone does not prove ADS token mode.
