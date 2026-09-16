---
description: Deciding which motion token to pick for a UI role (duration, easing, property)
---

# Motion decisions

The **decision layer**: which `--duration-*` / `--ease-*` token to pick for a given UI role, and why. This is *judgment*, not catalog or API.

- Token table + Tailwind aliases: `token-priority.md`
- Animating Base UI surfaces (popups, menus, dialogs) on exit: `motion-base-ui.md`
- Reference-video UI recreation and sequence proof: [Recreate reference motion](../docs/playbooks/recreate-reference-motion.md)

## Should-I-animate gate

Before adding any animation, ask: **if I remove it, does the user lose information or context?** If no, do not add it. Motion must direct attention to a new element, give feedback from an action, or reinforce a brand moment. If it only makes the UI feel slower without aiding understanding, shorten or remove it.

## Interaction vs transition

This single test drives every choice below.

| Trigger | Type | Profile |
| --- | --- | --- |
| Responds to hover / press / focus | **Interaction** | Instant acknowledgement, ≤150ms, always *practical* easing |
| Something appears, disappears, or repositions (layout changes) | **Transition** | Duration scales to size, *bold* on enter / *practical* on exit |

## Duration by element size

Larger elements need more time for the eye to track. **If triggered dozens of times a day, stay ≤150ms regardless of size.**

| Role | Duration token | ms |
| --- | --- | --- |
| Interaction — list-item hover | `duration-xxshort` | 50 |
| Interaction — list-item pressed | `duration-fast` | 100 |
| Interaction — input hover/pressed (upper limit) | `duration-normal` | 150 |
| Transition — small (tooltip, dropdown, inline validation) | `duration-fast`–`duration-normal` | 100–150 |
| Transition — medium (modal, flag) | `duration-medium`–`duration-slow` | 200–250 |
| Transition — large (page transition) | `duration-slower` | 400 |
| Transition — extra-large (onboarding, full-screen overlay) | `duration-slowest` | 600 |

## Easing — the bold vs practical fork (read this)

**vpk's `--ease-out` is the ADS _bold_ out curve.** vpk also ships a separate **`--ease-out-practical`**. They are NOT interchangeable — picking the wrong one is the most common motion mistake here.

- **`ease-out` = BOLD.** Use for transition *entrances* on prominent, infrequent surfaces (a flag sliding in, a blanket asserting lock). Fast start grabs attention, gentle landing feels controlled.
- **`ease-out-practical` = PRACTICAL.** Use for the **popup family — tooltip, dropdown, inline, popover, avatar** — and anything small + high-frequency. Restrained character because dramatic motion is noise at these durations.
- **`ease-in` = practical exit.** Every exit. Gradual start lets the user register the change before it disappears.
- **`ease-in-out` = bold in-place transform.** Reposition / scale-in-place (modal, spotlight scale, flag reposition). Gentle at both ends feels intentional.

| Direction / context | Easing utility |
| --- | --- |
| Transition ENTER — prominent surface | `ease-out` (bold) |
| Transition ENTER — popup family (tooltip/dropdown/inline/popover/avatar) | `ease-out-practical` |
| Transition EXIT — any | `ease-in` |
| Transition in-place (reposition, scale) — incl. modal/spotlight enter | `ease-in-out` (bold) |
| Interaction (hover/press) — always | `ease-out-practical` (never bold) |

> Exception worth memorizing: modal/spotlight *scale in place*, so they ENTER with `ease-in-out`, not `ease-out`. The popup family ENTERS with `ease-out-practical`, not `ease-out`. When a per-role recipe disagrees with the generic "entrances are bold" rule, follow the recipe.

## Property selection (≤2)

Choose the simplest property that communicates the change. A third property creates chaos — **never exceed two.**

- **Interaction** — pick ONE: `color` (state acknowledgement, most common), fade (show/hide, no movement), or scale (tactile feedback).
- **Transition** — pick ONE or TWO: fade (no spatial relationship), slide (clear origin direction), scale (grows from a point of emphasis), color (in-place state change).
- Natural pairs: **fade + slide** for directional enter/exit, **fade + scale** for modal-type entrances. Pick **one** pair — `fade + slide` OR `fade + scale`, never `fade + scale + slide`.
- When adding motion to a component that **already** animates something (e.g. a tooltip that already scales), count the existing property toward the limit — don't push it to three.

## Enter / exit asymmetry

**Exits are always shorter than entrances** — the user triggered the dismissal, so a faster exit clears the way without blocking. Drop the exit ~50–100ms below the matching entrance and switch the curve to practical (`ease-in`).

| Role | Enter | Exit |
| --- | --- | --- |
| Dropdown | 150 | 100 |
| Flag | 250 | 200 |
| Modal | 250 | 200 |

## Per-role recipes (vpk tokens)

Reuse the same recipe for components that play the same role — one mental model, less cognitive load. Source all timing from tokens per [Consuming tokens](#consuming-tokens-css-vs-motion-for-react) below — never invent a duration or curve.

| Role | Enter | Exit | Property |
| --- | --- | --- | --- |
| **Modal** (pairs w/ blanket) | `duration-slow` `ease-in-out` | `duration-medium` `ease-in` | scale 95→100 in / 100→95 out |
| **Blanket** (modal underlay) | `duration-slow` `ease-out` | `duration-medium` `ease-in` | opacity (fade) only |
| **Flag** | `duration-slow` `ease-out` | `duration-medium` `ease-in` | fade + slide (50% in from left, 15% out); reposition `duration-slow` `ease-in-out` |
| **Popup / Tooltip / Dropdown** | `duration-normal` `ease-out-practical` | `duration-fast` `ease-in` | fade + 8px slide (direction = origin) |
| **Avatar** | `duration-normal` `ease-out-practical` | `duration-fast` `ease-in` | scale + opacity; hover = `ease-spring` ~250ms (the ONLY spring use in the system) |
| **List-item** | hover `duration-xxshort` `ease-out-practical` | pressed `duration-fast` `ease-out-practical` | background-color |
| **Input** | hover/pressed `duration-normal` `ease-out-practical` | — | background-color |

## Consuming tokens: CSS vs Motion for React

vpk has two motion surfaces and the token-consumption rule differs by surface. Getting this wrong is the #1 adherence failure.

**CSS transitions** (a `transition` string in `style`, or Tailwind utilities) — **always** reference tokens, never hardcode ms/curves:

```tsx
style={{ transition: "left var(--duration-medium) var(--ease-in-out)" }}
className="transition-colors duration-xxshort ease-out-practical"
```

**Motion for React JS props** (`transition={{…}}`, variants) — Motion **cannot read `var()`**. Use the *resolved* token value as a cubic-bezier array (duration in **seconds**), annotate it with the token name, and hoist shared curves to a module/`const` so the value lives in one place (this is the established vpk pattern — see `agent-2.tsx`, `agent-bento/`):

```tsx
const ENTER = { duration: 0.15, ease: [0.4, 1, 0.6, 1] }; // duration-normal + ease-out-practical
const EXIT  = { duration: 0.1,  ease: [0.6, 0, 0.8, 0.6] }; // duration-fast  + ease-in
```

Never invent a curve that is not a token. Pick the resolved array from this map:

| Token utility | cubic-bezier array |
| --- | --- |
| `ease-out` (bold) | `[0, 0.4, 0, 1]` |
| `ease-in-out` (bold) | `[0.4, 0, 0, 1]` |
| `ease-in` (practical exit) | `[0.6, 0, 0.8, 0.6]` |
| `ease-out-practical` | `[0.4, 1, 0.6, 1]` |

Durations (seconds): `xxshort` .05 · `fast` .1 · `normal` .15 · `medium` .2 · `slow` .25 · `slower` .4 · `slowest` .6

**Two Motion idioms agents miss:**

- Animating `transform` / `opacity` / `filter` / `clipPath` → set `willChange` for exactly those properties on the element.
- **Asymmetric exit:** put the faster exit timing in the **`exit` variant's own `transition`**, not a single shared `transition` prop — a lone `transition` prop applies to enter *and* exit, silently making the exit run at the enter timing. Wrap with `AnimatePresence`, and zero motion via `useReducedMotion()`.

## Spatial anchoring + consistency

- Open and exit elements from **where they belong**: a dropdown opens from its trigger; a dismissed flag exits the way it entered. Never appear/disappear from disconnected locations — it breaks the sense of origin.
- Same role → same recipe (enter and exit). Different motion for same-role components increases load.

## Reduced-motion mandate (always your job)

**vpk's `--duration-*` / `--ease-*` tokens do NOT honor reduced motion** — they resolve to literal ms/curves and play regardless of the user's setting. There are no motion *semantic* tokens here that auto-collapse. So **every** motion you add needs an explicit guard — a Tailwind `duration-*`/`ease-*` transition, a CSS `transition` string, Base UI `data-starting-style`/`data-ending-style`, or Motion props alike. No exceptions, **including when you edit an existing component** (e.g. `components/ui/tooltip.tsx`).

- CSS / Tailwind: add `motion-reduce:transition-none` (or `motion-reduce:duration-0`), or an `@media (prefers-reduced-motion: reduce)` rule collapsing duration to ~1ms.
- Motion for React: gate with `useReducedMotion()` and zero the duration/offset.
- Never flash, rapidly oscillate, or sweep large areas. Confirm the UI is fully usable with all motion disabled.

## Five quality lenses (verify before shipping)

1. **Element** — match motion to function and size; small/frequent stays fast and understated, large gets more time and expression.
2. **Experience** — walk the whole flow, lead with ONE focal point, no competing simultaneous animations, never make users wait without meaning.
3. **Accessibility** — reduced-motion honored, no flash/oscillate/sweep, usable with motion off.
4. **State coverage** — every applicable state (enter, exit, hover, press, reposition) is implemented or explicitly skipped with a one-line reason; check paired roles (modal+blanket, popup+anchor).
5. **Expression** — warm, confident, purposeful; reserve characterful motion for low-frequency brand moments (onboarding); everyday UI shows personality through restraint, not spectacle.
