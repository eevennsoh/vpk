---
description: React and CSS gotchas — state updates, derived state, CSS gap transitions
paths:
  - "**/*.tsx"
---

# React / CSS Gotchas

- Use functional state updates for toggles (`setX(prev => !prev)`).
- Keep render paths and functional state updater callbacks pure. Updaters should only compute and return the next state: do not write refs, other state, DOM, or globals inside them, and do not mirror props or state into refs during render. Sync refs from an event handler or committed effect, or close over stable inputs instead. (Lint: `react-hooks/refs`, `react-hooks/purity`, `react-hooks/immutability`.)
- Derive render-only values inline; do not sync derived state via effects. (Lint: `react-hooks/set-state-in-effect`.)
- CSS `gap` doesn't transition away when a flex child collapses to `w-0`. Replace parent `gap-*` with transitioning `mr-*`/`ml-*` on the collapsible element (e.g., `mr-3` → `mr-0` alongside `w-0 opacity-0`).
