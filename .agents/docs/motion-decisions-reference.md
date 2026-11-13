# Motion Decisions Reference

The rationale and review detail behind `.agents/rules/motion-decisions.md`, moved out of the rule so it stays short when it loads. The rule keeps the token tables and per-role recipes.

## Should-I-animate gate

Before adding any animation, ask: **if I remove it, does the user lose information or context?** If no, do not add it. Motion must direct attention to a new element, give feedback from an action, or reinforce a brand moment. If it only makes the UI feel slower without aiding understanding, shorten or remove it.

## Easing — why bold and practical differ

- **`ease-out` = BOLD.** Use for transition *entrances* on prominent, infrequent surfaces (a flag sliding in, a blanket asserting lock). Fast start grabs attention, gentle landing feels controlled.
- **`ease-out-practical` = PRACTICAL.** Use for the **popup family — tooltip, dropdown, inline, popover, avatar** — and anything small + high-frequency. Restrained character because dramatic motion is noise at these durations.
- **`ease-in` = practical exit.** Every exit. Gradual start lets the user register the change before it disappears.
- **`ease-in-out` = bold in-place transform.** Reposition / scale-in-place (modal, spotlight scale, flag reposition). Gentle at both ends feels intentional.

## Enter / exit asymmetry

**Exits are always shorter than entrances** — the user triggered the dismissal, so a faster exit clears the way without blocking. Drop the exit ~50–100ms below the matching entrance and switch the curve to practical (`ease-in`).

| Role | Enter | Exit |
| --- | --- | --- |
| Dropdown | 150 | 100 |
| Flag | 250 | 200 |
| Modal | 250 | 200 |

## Spatial anchoring + consistency

- Open and exit elements from **where they belong**: a dropdown opens from its trigger; a dismissed flag exits the way it entered. Never appear/disappear from disconnected locations — it breaks the sense of origin.
- Same role → same recipe (enter and exit). Different motion for same-role components increases load.

## Reduced motion

Two global owners already collapse most motion under `prefers-reduced-motion: reduce`, and `app/reduced-motion-contract.test.js` locks both:

- **CSS** — the reset in `app/globals.css` forces every transition and keyframe animation to ~0ms, covering Tailwind `duration-*`/`ease-*` utilities, `transition` strings, and Base UI `data-starting-style`/`data-ending-style`.
- **Motion for React** — `<MotionConfig reducedMotion="user">` in `app/providers.tsx` disables transform and layout animations.

Don't add `motion-reduce:transition-none` or per-component `useReducedMotion()` branches for motion those owners cover; duplicate branches have shipped bugs, such as a reduced path that never expanded a drop zone. You still own:

- **Motion the reset cannot see** — `requestAnimationFrame` loops, canvas/WebGL/shaders, GSAP, timers that step visual state, scroll-driven effects, autoplaying media. Gate these with `useReducedMotion()`.
- **End-state parity** — a reduced path reaches the same final state and fires the same callbacks as the animated one; only the travel is removed.
- Never flash, rapidly oscillate, or sweep large areas. Confirm the UI is fully usable with all motion disabled.

## Five quality lenses (verify before shipping)

1. **Element** — match motion to function and size; small/frequent stays fast and understated, large gets more time and expression.
2. **Experience** — walk the whole flow, lead with ONE focal point, no competing simultaneous animations, never make users wait without meaning.
3. **Accessibility** — reduced-motion honored, no flash/oscillate/sweep, usable with motion off.
4. **State coverage** — every applicable state (enter, exit, hover, press, reposition) is implemented or explicitly skipped with a one-line reason; check paired roles (modal+blanket, popup+anchor).
5. **Expression** — warm, confident, purposeful; reserve characterful motion for low-frequency brand moments (onboarding); everyday UI shows personality through restraint, not spectacle.
