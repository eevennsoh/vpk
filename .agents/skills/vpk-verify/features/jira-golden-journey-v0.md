# Jira Golden Journey v0

Jira Golden Journey v0 lets a user browse the original Jira pattern gallery, select a pattern, step its prepared states, and inspect its local terminal theme.

## Sub-features

- `jira-v0-route` opens the real `/jira-golden-journey-v0` route and shows the named gallery.
- `jira-v0-patterns` selects Terminal and Work item from the gallery using their accessible tile names.
- `jira-v0-keyboard` selects a gallery tile and uses the prepared-state controls without pointer coordinates.
- `jira-v0-narrow-theme-a11y` covers a 390×844 viewport, reduced motion, the terminal-local theme control, and a route-scoped accessibility scan.

## How to get to it (user POV)

- Open `/jira-golden-journey-v0` directly.
- Use the gallery strip to choose `Terminal` or `Work item`; use `Open gallery` first if the strip is closed.
- Use `Previous section step` / `Next section step` or `Jump to section` for prepared Work item states.

## Driving it with control-vpk

Preconditions:

- `control-vpk doctor` reports `"ok": true` for this worktree and `ORIGIN` came from `control-vpk url`.
- Set `EVIDENCE="$(control-vpk evidence-dir)/jira-golden-journey-v0"` and create it before capture.

- **Open and identify.** Run `control-vpk browser open --headed "$ORIGIN/jira-golden-journey-v0"`, then `control-vpk browser wait --text "Jira Golden Journey v0"` and `control-vpk browser snapshot -i --compact --depth 8`. The heading and `Select Terminal` tile are present; keep the fresh `@eN` ref for `Select Work item`.
- **Prove keyboard selection.** Run `control-vpk browser focus @eN` with that fresh Work item ref, `control-vpk browser press Enter`, `control-vpk browser wait --fn "document.querySelector('[aria-label=\"Select Work item\"]')?.getAttribute('aria-pressed') === 'true'"`, then take a new snapshot. Do not reuse the pre-activation ref.
- **Cover terminal theme through the UI.** Reselect Terminal, wait for the current `Cycle theme, current theme: …` button, then capture this route-local proof with `control-vpk browser eval --stdin`:

  ```js
  (() => {
    const control = document.querySelector("button[aria-label^='Cycle theme, current theme:']");
    if (!(control instanceof HTMLButtonElement)) throw new Error("Missing gallery theme control");
    const owner = control.closest("[data-color-mode]");
    if (!(owner instanceof HTMLElement)) throw new Error("Missing route-local color-mode owner");
    const style = getComputedStyle(owner);
    return {
      controlName: control.getAttribute("aria-label"),
      colorMode: owner.getAttribute("data-color-mode"),
      surfaceToken: style.getPropertyValue("--ds-surface").trim(),
      textToken: style.getPropertyValue("--ds-text").trim(),
    };
  })()
  ```

  Click that exact accessible name, repeat the IIFE, and require its local mode and control name to change. Restore by clicking the same UI control until the original name returns (at most two clicks); do not write storage or theme attributes.
- **Cover narrow reduced motion.** Run `control-vpk browser set viewport 390 844`, `control-vpk browser set media light reduced-motion`, reselect Work item from a fresh snapshot, and `control-vpk browser wait "button[aria-label='Jump to section']"`. Snapshot again, focus the fresh `Jump to section` ref, press Enter, wait `"[role='menu']"`, then press Escape. The compact path is keyboard operable without horizontal page overflow.
- **Proof and accessibility.** Run `control-vpk browser snapshot -i --compact --depth 8 > "$EVIDENCE/narrow.aria.txt"`, `control-vpk browser screenshot "$EVIDENCE/narrow.png"`, and `control-vpk browser a11y --selector body > "$EVIDENCE/a11y.txt"`. The route is the feature boundary, so the body scan is route-scoped.
- **Reset and cleanup.** Run `control-vpk browser find role button click --name Reset`, then `control-vpk cleanup`. Reset remounts the current pattern; it does not rewind a Work item preset to Empty. Cleanup retains the browser session and evidence for later checks.

## Gotchas

- Terminal owns a local light/dark subtree; do not infer it from the global `ui-theme` value.
- `Select Work item` is the gallery tile. Compact prepared-state controls are named `Jump to section`, `Previous section step`, and `Next section step`.
- Reset remounts the selected pattern. It does not rewind Work item from Suggestions/Running/Done back to Empty.
- The dock may be closed from a prior action. Use `Open gallery`; do not click where a tile used to be.
- Reduced motion and viewport emulation persist in this browser session. Set the required viewport and motion state before each proof.
