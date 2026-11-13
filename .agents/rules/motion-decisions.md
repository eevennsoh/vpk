---
description: Deciding which motion token to pick for a UI role (duration, easing, property)
paths:
  - "components/**/*.tsx"
  - "app/**/*.tsx"
  - "**/*.css"
  - "lib/motion.ts"
---

# Motion decisions

The **decision layer**: which `--duration-*` / `--ease-*` token to pick for a given UI role, and why. This is *judgment*, not catalog or API.

- Token table + Tailwind aliases: `token-priority.md`
- Animating Base UI surfaces (popups, menus, dialogs) on exit: `motion-base-ui.md`
- Reference-video UI recreation and sequence proof: [Recreate reference motion](../docs/playbooks/recreate-reference-motion.md)
- Why each choice holds, spatial anchoring, the full reduced-motion contract, and the five pre-ship quality lenses: [Motion decisions reference](../docs/motion-decisions-reference.md)

## Should-I-animate gate

Animate only when removing the motion would lose information or context: attention to a new element, feedback from an action, or a brand moment.

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

Exits are shorter than entrances (about 50–100ms below the matching entrance) and use `ease-in`.

## Per-role recipes (vpk tokens)

Reuse the same recipe for components that play the same role — one mental model, less cognitive load. Source all timing from tokens per [Consuming tokens](#consuming-tokens-css-vs-motion-for-react) below — never invent a duration or curve. In Motion for React, the popup, modal, blanket, flag, and avatar rows are `motionRecipe.<role>` in `@/lib/motion`.

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

**Motion for React JS props** (`transition={{…}}`, variants) — Motion **cannot read `var()`**, so import the JS mirror from `@/lib/motion` (`lib/motion.test.js` keeps it equal to `app/tailwind-theme.css`):

```tsx
import { motionDuration, motionEase, motionRecipe } from "@/lib/motion";

<motion.div
	initial={{ opacity: 0, y: 8 }}
	animate={{ opacity: 1, y: 0, transition: motionRecipe.popup.enter }}
	exit={{ opacity: 0, y: 8, transition: motionRecipe.popup.exit }}
/>
transition={{ duration: motionDuration.medium, ease: motionEase.inOut }}
```

Lint rejects inline cubic-bezier arrays, hand-written `cubic-bezier()` strings, and numeric `duration-NNN` classes. Older copies are baselined in `eslint-suppressions.json`; migrate them when you touch the file.

**Sanctioned exception — `referenceEase`.** A recreation tuned against a reference motion may use a curve with no ADS token only through `referenceEase` in `@/lib/motion`, one named entry per curve with its source. It is not for general UI; `lib/motion.test.js` pins these entries and keeps them distinct from every `motionEase` token:

| Entry | Curve | Source and use |
| --- | --- | --- |
| `generationDraw` | `[0.16, 1, 0.3, 1]` | transitions.dev UI generation: every stroke of the `UIGeneration` drawing |
| `smoothOut` | `[0.22, 1, 0.36, 1]` | transitions.dev `--ease-smooth-out`: the `UIGeneration` reveal |
| `agentInvocationHandoff` | `[0.4, 0, 0.2, 1]` | Vohmann `6627c513` `AgentInvocationPreviewHandoff`: preview-to-working status-label roll |

Add a row here and to the test when you add an entry.

**Two Motion idioms agents miss:**

- Animating `transform` / `opacity` / `filter` / `clipPath` → set `willChange` for exactly those properties on the element.
- **Asymmetric exit:** put the faster exit timing in the **`exit` variant's own `transition`**, not a single shared `transition` prop — a lone `transition` prop applies to enter *and* exit, silently making the exit run at the enter timing. Wrap with `AnimatePresence`.

## Reduced motion

The CSS reset in `app/globals.css` and `<MotionConfig reducedMotion="user">` in `app/providers.tsx` already collapse most motion, and `app/reduced-motion-contract.test.js` locks both. Do not add `motion-reduce:transition-none` or per-component `useReducedMotion()` branches for motion they cover. Gate only what they cannot see (`requestAnimationFrame` loops, canvas/WebGL, GSAP, timers, scroll-driven effects, autoplaying media) with `useReducedMotion()`, and keep the reduced path's end state and callbacks the same.

