# Jira Golden Journeys v2

Jira Golden Journeys v2 lets a user move a guest-checkout work item through Intake, Plan, Build, Review, Fix, Approve, and Release while inspecting details, activity, and guided pull-request context.

## Sub-features

- `jira-v2-chapters` selects all seven delivery-story chapters through the named chapter group.
- `jira-v2-details-activity` switches the metadata rail between Details and Activity without changing work-item context.
- `jira-v2-pull-request` opens the guided PR #1847 detail in Review.
- `jira-v2-keyboard-narrow-theme-a11y` covers focus order, a 390×844 reduced-motion viewport, user-facing theme cycling, and route-scoped accessibility.

## How to get to it (user POV)

- Open `/jira-golden-journeys-v2` directly; its single Work Item gallery card is selected.
- Choose a chapter from `Open a software delivery story chapter`.
- Use `Details` and `Activity` in the metadata rail; Review exposes pull request #1847 in the same work-item surface.

## Driving it with control-vpk

Preconditions:

- `control-vpk doctor` reports `"ok": true` for this worktree and `ORIGIN` came from `control-vpk url`.
- Set `EVIDENCE="$(control-vpk evidence-dir)/jira-golden-journeys-v2"` and create it before capture.

- **Open and identify.** Start directly with `control-vpk open-target /jira-golden-journeys-v2 --headed` and wait for text `Jira Golden Journeys v2` before taking an interactive snapshot. Find the chapter control and region `Add guest checkout to the storefront` by role and name.
- **Prove keyboard chapters.** Focus `Intake`, press Tab, and confirm focus reaches `Plan`; press Enter and confirm Plan is pressed. This proves chapter focus order and activation without pointer coordinates.
- **Prove Details and Activity.** Run `control-vpk browser find role button click --name Activity`, then snapshot and confirm activity actions are present. Click `Details`, snapshot again, and confirm the `Work item details` region. Reopen Activity for the next step. Do not use a text wait as the proof; browser text waits can miss content that the accessibility snapshot exposes.
- **Prove guided PR detail.** Choose `Review`. The in-app region `Pull request #1847: Implement guest checkout without account creation` becomes visible. Capture it; do not follow an external GitHub link as substitute proof.
- **Cover narrow reduced motion and theme.** Run `control-vpk browser set viewport 390 844` and `control-vpk browser set media light reduced-motion`. The same `Open a software delivery story chapter` group stays visible (v2 has no compact replacement). Cycle the current theme once through the named gallery theme button, capture the resulting button name and `data-color-mode`, then restore the original button name through that same UI control. Do not write storage or theme attributes.
- **Proof and accessibility.** Run `control-vpk browser snapshot -i --compact --depth 9 > "$EVIDENCE/review-narrow.aria.txt"`, `control-vpk browser screenshot "$EVIDENCE/review-narrow.png"`, and `control-vpk browser a11y --selector body > "$EVIDENCE/a11y.txt"`.
- **Reset and cleanup.** Run `control-vpk browser find role button click --name Reset`. Reset re-runs the *current* chapter (Review stays Review). Run `control-vpk cleanup` and keep all proof files.

## Gotchas

- V2 uses `Details` and `Activity` buttons; it does not use v3's section links or Insights surface.
- Review and Fix jump to stable destinations under reduced motion. Build still runs its timed sequence — do not treat reduced motion as a Build shortcut.
- Pull-request proof is the in-app region `Pull request #1847: Implement guest checkout without account creation`. A browser tab on GitHub does not prove the VPK detail state.
- Narrow viewports keep the same chapter group. Do not look for `Jump to chapter` on v2.
