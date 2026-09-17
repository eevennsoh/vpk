# Recreate reference motion in a VPK interface

Use this when a video or live page is the reference for a browser interaction: a peel, drag/link sequence, avatar-to-dot morph, stacked scrolling cards, or a prompt-input transition. The deliverable is VPK interface behavior. Compose `video-to-superprompt` for source inspection/briefs, `motion` for implementation guidance, and `vpk-verify` plus `next-dev-loop` for runtime proof. Video production follows its own workflow.

## Inspect and bind the reference

1. Locate and inspect the actual video or live page before describing its motion. Use `video-to-superprompt` to identify frame rate, representative frames, source assets, and available HTML/CSS/JS. Record source URL/path, reference revision when available, viewport, playback speed, and frame timestamps. Label inaccessible source details as unknown.
2. Name the exact VPK route/state and public component owners to reuse. Search the referenced screen, `components/ui-custom/`, and `components/ui/` first. For example, a Jira linking demo uses the requested `AgentSession`, `JiraIssue`, and column variants rather than approximate card markup; inspect their current public APIs instead of copying internals.
3. Separate the requested reference behavior from adaptation decisions: product content, theme tokens, interaction targets, accessibility, and responsive behavior. Preserve exact copy/variants unless the user requested a change. Record any reference-versus-VPK difference before using it as acceptance evidence.

## Fill the acceptance contract before tuning

Choose observable states and tolerances from inspected evidence. Do not substitute adjectives such as "satisfying" or "exact" for testable behavior, or invent timings that the source cannot establish.

| Beat / state | Trigger and origin | Reference time / duration | Geometry and visible result | Existing VPK owner | Acceptance / motion-off result |
| --- | --- | --- | --- | --- | --- |
| Rest | Entry route, fixture, scroll | Frame/time | Bounds, surface, contact shadow, layer order | Public component/variant | Measured bounds and stable hit target |
| Engage | Hover, press, click, grab, or scroll | Input acknowledgement and start | Anchor, reveal, capture, shape | Existing event/state owner | Explicit offset/color/visibility tolerance |
| Move / transition | Recorded pointer/scroll path or state change | Intermediate beat timestamps | Position, scale, opacity, clipping, paired elements | Existing motion owner | Frames to compare; immediate state under motion off |
| Commit / land | Release, drop, second click, or completion | Completion and settling | Destination state, callback, focus, final geometry | Existing commit owner | Exactly one intended commit; no blank/flash frame |
| Reverse / cancel | Reverse input, Escape, blur, lost capture, route change | Before/within/after transition | Return state and effect cleanup | Existing cancellation owner | No stale overlay, callback, or captured pointer |

Alongside the table, record the fixture/data size, selected entities, theme, viewport/device scale, initial scroll/focus, reference cropping, and reset mechanism. Define which geometry is in CSS pixels and which is in video pixels. Separate continuous pointer tracking from an autonomous transition; the same duration rule does not describe both.

For continuity, specify which element persists and which changes: an avatar's rest dot must already exist while its face fades; a dragged card must preserve its grab point; a modal and its content must remain coherent through exit. Define z-order, clipping, shadow, and stable hit-target bounds at intermediate frames. A matching resting screenshot is insufficient.

## Implement through the existing motion owner

Follow [motion decisions](../../rules/motion-decisions.md), token guidance, the relevant `motion` guidance, and Base UI exit/lifetime rules. Keep route orchestration shallow and the state machine/geometry at its canonical owner. Reuse shared duration/easing choices rather than inventing demo-only recipes.

Preserve state identity, pointer capture, callbacks, focus, and scroll through the sequence. Coalesce continuous pointer work to animation frames, read geometry before writes, and define invalidation/disposal. If introducing a shared effect, migrate the compatible old copies in the same change. Use [Improve UI performance](improve-ui-performance.md) when responsiveness is part of the requirement; fewer renders alone do not prove a faster interaction.

Implement interruption deliberately: reverse mid-transition, grab/release again, leave and reenter the target, cancel/drop outside, lose capture/blur, resize or scroll during drag, and change the entity/filter/route while effects run. Prevent a late completion from committing the old interaction. Avoid changing the actual hit target when decorative content changes.

Give reduced motion and any exposed effect-off control a defined immediate or restrained result that communicates the same state. Preserve usability and state transitions, stop decorative loops/effects, and avoid flashes. Do not infer accessibility from upstream behavior alone.

## Replay the same sequence and compare evidence

1. Use [Browser Verify Worktree](browser-verify-worktree.md) to launch/doctor the exact worktree origin. Follow `next-dev-loop` after editing served Next.js code. Navigate directly to the requested component, block, or project route, then verify its marker and variants before inspecting or driving it; use the homepage for catalog tasks.
2. Reset to the recorded fixture, selection, theme, viewport, scroll, and focus. Replay the same input order, pointer path, scroll distances, and pauses as the reference. Record action timestamps separately from video timestamps; align recordings at the observable trigger rather than arbitrary file start. Distinguish a slowed reference from native playback.
3. Capture start, intermediate beats, commit, settled state, and reversal/cancellation. Save a recording when static frames cannot prove continuity. Compare matching frames/crops at the same scale and note timing/geometry tolerances, observed differences, and any intentional adaptation. Verify no transient blank frame, stale color, detached shadow, clipping, or layout jump.
4. Repeat first-use and repeated-use sequences, relevant narrow/theme states, keyboard/touch alternatives, reduced motion, and effect-off settings. Inspect accessible names, focus order/visibility, stable hit targets, and console/hydration errors. Fetch relevant ADS accessibility guidance and run available rendered-route accessibility analysis; record unavailable checks explicitly.

Keep disposable frames, screenshots, recordings, input sequences, and condition notes under `output/agent-browser/`. A stale origin, paused compilation, inaccessible reference, or failed browser command is an evidence boundary, not a successful comparison.

## Close the acceptance loop

Run relevant behavioral/regression tests, `pnpm run lint`, and `pnpm run typecheck`. Register new component node:test suites in the unit manifest and verify unfiltered discovery; run affected repository guards and the delivery gate. Prefer deterministic state/geometry/cancellation tests over source-text assertions of animation values.

Report the real route and owners, accepted beats, reference-versus-result evidence, normal and motion-off outcomes, interruption results, and remaining differences. Re-tune only a named failed criterion, then replay the same sequence. Do not claim a one-to-one recreation from source inspection, typecheck, or a single resting screenshot.
