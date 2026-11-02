# GUI motion editor integration

- Runtime: imported `dialkit`, using the cautious `~2.0.2` version policy.
- Source: <https://github.com/joshpuckett/dialkit>, published npm release
  `2.0.2`. The package's declarations, source maps, and graph CSS were inspected.
- License: MIT, copyright 2026 Josh Puckett. The notice below covers the
  adapted graph styles in `../gui-motion.css`.
- Ownership: DialKit owns the Bézier graph's geometry, pointer and keyboard
  editing, static spring sampling, and timeline authoring runtime. VPK owns the controlled value, numeric
  controls, presets, defaults/reset, disabled behavior, and mounted copy keys.
  The existing GUI controls have no motion graph, so the two public independent
  visualizations add that capability without changing existing controls.

## Imported surface

| DialKit export | VPK owner | Disposition |
| --- | --- | --- |
| `EasingVisualization` | `GUI.Easing` | Controlled four-coordinate Bézier graph with VPK presets from `lib/motion.ts` and numeric editing. The required upstream duration field is presentation metadata; the adapter only emits the tuple. |
| `SpringVisualization` | `GUI.Spring` | Static physics response graph with stiffness, damping, and mass controls. `isSimpleMode` is false so the graph uses the supplied physics values. |
| `EasingConfig`, `SpringConfig` | Public GUI value/prop types | Used to derive value shapes; DialKit discriminators are not emitted. |
| `createDialTimeline`, `createDialTimelineRoot`, `DialStore`, `TimelineStore` from `dialkit/vanilla` | `useGUITimeline`, `GUI.Timeline` | Imported timeline controller and actual inline authoring root; VPK adds React lifecycle, cached subscribed values, theme, numeric editing/reset, and reduced-motion playback guards. |
| React `DialTimeline`, `DialRoot`, unrelated editors | Existing GUI and application owners | Not adopted as separate GUI surfaces. The React timeline root cannot target an inline host. The vanilla timeline owns its internal clip editors. |

`2.1.0` was inside the repository's seven-day release maturity window when
evaluated. `2.0.2` satisfies that gate and provides the same independent graph
API; no release-age exception was added. Patch updates remain governed by the
lockfile and normal validation.

## Scoped presentation

The graph adapter imports no DialKit global stylesheet, root, theme variables, or
remote font. The stylesheet applies only below `.vpk-gui-motion-visualization` and adapts the
necessary upstream emitted classes to VPK semantic tokens. Spring SVG stroke
attributes use fixed white colors upstream, so the scoped selectors override
those strokes for both VPK themes. Handle focus outlines have outward clearance
because the graph host does not clip them. Re-check the class names and SVG
structure when upgrading; retire selectors when upstream provides a compatible
styling API or semantic defaults.

## Controlled editing compatibility

In `2.0.2`, the easing DOM helper writes an optimistic graph before invoking
`onChange`. With an unchanged parent prop, no React update follows a rejected
edit and the graph otherwise retains that optimistic value. `GUI.Easing`
requests a local rerender after the callback, causing the upstream update
effect to reassert the current controlled prop. Accepted owner updates batch
with it; the adapter does not keep a second value or register a store.
Remove this bridge when upstream reasserts its controlled input after a rejected
callback without needing a host rerender. Behavioral tests cover the rejected
graph-edit case.

Numeric X edits are constrained to 0–1 and numeric Y edits to −2–2. Upstream
graph gestures constrain Y to −1–2; externally supplied and numeric negative
overshoot below −1 still render. The graph help text describes its own gesture
range. Spring numeric ranges are stiffness 1–1000, damping 0–100, and mass
0.1–10. External controlled values remain owned by the caller.

Both graphs are static: the inspected easing helper uses a ResizeObserver and
direct pointer/keyboard updates, and the spring component returns sampled SVG.
Neither starts a timer, animation frame playback loop, or autoplay. Consequently
reduced motion keeps the same graph and controls without a separate motion
branch. Upstream destroys the easing DOM, disconnects its observer, and releases
pointer capture on unmount. The adapter omits its callback when disabled, which
makes the upstream handle buttons disabled; VPK numeric controls, reset, preset
reachability, and guarded emissions share that disabled state.
The preset selector remounts when disabled changes so a previously open portalled
menu closes with its editor. The value stays controlled above that temporary
menu lifetime. This local bridge can be removed if `GUI.Select` gains a disabled
prop that also closes an already open popup.

## Inline timeline ownership and lifecycle

`useGUITimeline(name, config, options)` and `GUI.Timeline` use only the public
`dialkit/vanilla` entry, including both stores. Different adapter entries bundle
different store singletons, so React-entry hooks or roots do not share these
registrations. The vanilla root's public `target` option mounts its actual
editor inside a React-owned empty host. React does not relocate an upstream
portal or render children into the imperative subtree.

Mount one `GUI.Timeline` per page. It displays every timeline registered in the
vanilla entry; it does not filter by a panel ID and does not provide per-instance
registry isolation. Multiple hook registrations receive unique upstream IDs,
even when their names match. The hook exposes no stable ID or persistence
option, avoiding retained authoring snapshots after unmount. Every cleanup
unsubscribes and destroys its controller; root cleanup destroys its sections,
open clip popovers, pointer listeners, and visibility controller. Strict Mode
cleanup followed by setup creates a fresh registration.

The hook returns `null` before effect registration and during server rendering.
After registration, `useSyncExternalStore` reads a cached snapshot that changes
only on upstream notifications. There is no polling. Config changes call the
upstream `updateConfig` method, preserving compatible authored values and
updating schema/defaults. Equivalent inline config objects do not cause repeated
updates. Changing the name, autoplay option, or loop option creates a fresh
registration; keep those registration options stable while authoring.

The returned values retain upstream `play`, `pause`, `replay`, `seek`, and all
clip/group outputs, and add `id`, `reset()`, and `setValue(path, number)`.
`setValue("Title.at", next)` supplies a numerical keyboard alternative for
timeline timing edits without substituting a graph implementation.
`reset()` restores the latest schema defaults, pauses playback, and returns to
time zero (or the end under reduced motion). Source config changes update
defaults; use `setValue` to change an already authored numerical value.

Autoplay defaults to false. Under reduced motion, new hook registrations settle
at the end without starting playback, a preference change pauses and settles
existing playback, and hook play/replay actions settle immediately. A store
subscription also catches native toolbar playback requests before the next clock
tick and pauses/settles them. The root disables its native play/replay buttons
while the preference applies, including sections added after mount. Manual seek
remains available for authoring. A previously queued upstream clock frame may
finish empty after pause/unmount; no continuing playback is scheduled. These
guards belong to hook registrations; unrelated vanilla controllers must own
their own playback policy.

The timeline uses the existing `useMediaQuery` subscription for this imperative
playback boundary. Motion `13.5.1`'s `useReducedMotion` initializes React state
from its shared preference value but does not update that state on a later media
change; an actual Chrome preference change left playback controls enabled until
reload. Reusing the shared media-query hook makes hook state, native toolbar
availability, and demo behavior respond to the live preference. This integration
does not alter the application's global Motion configuration.

The root follows `ThemeWrapper.actualTheme` and requires that existing provider.
`gui-timeline.css` supplies scoped editor styles without the full upstream
stylesheet or remote font. Clip editors are upstream body popovers, closed by
upstream root/section cleanup; their class structure must be checked on upgrade.
Hiding/collapsing the authoring surface does not dispose a mounted hook; callers
remain responsible for pausing playback when hiding its animated consumer.

The native clipboard action intentionally retains DialKit's authoring instruction
named `createDialTimeline`. It exports vanilla runtime parameters and is not a
VPK `GUI.Panel` JSON snapshot or a `useGUITimeline` hook snippet. VPK panel copy
continues to follow its existing mounted-value-key contract.

In `2.0.2`, dismissing a clip editor with Escape or its close button removes
the focused popup without returning focus to its clip. A small delegated focus
adapter remembers the opener and restores focus after dismissal only when focus
fell to the document body. It resolves a current clip within its original
section after upstream redraws, associates each open popup with its own clip,
and never steals focus from another control or
restores into an unmounted root. Restoration runs in a cancellable task after
native event dispatch: a capture-listener microtask can run before the native
target's close handler in Chrome. Cleanup cancels outstanding restoration tasks.
Remove this adapter when upstream restores
focus to its opener on keyboard dismissal. Behavioral tests cover the defect.

The same release duplicates a normal clip's `From` folder: its editor tests
`stepKey === clip.stepKeys?.[0]`, which is true when both are undefined, then
inserts a `from` control that is already present. A metadata-aware DOM adapter
repairs only popups opened from this root when the selected clip has no steps or
property tracks, is unambiguous within its registered section, and has a real
`<clip path>.from` folder in the vanilla store. It removes the second of exactly
two matching direct folders and repeats the check after top-level editor
rebuilds. Sequence editors retain their required first-step source values;
nested same-label folders and unrelated popups are untouched. Root cleanup
disconnects both popup and body observers. Remove this adapter when upstream
requires a defined step key before prepending the initial source folder.

## MIT notice for adapted graph CSS

Copyright (c) 2026 Josh Puckett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
