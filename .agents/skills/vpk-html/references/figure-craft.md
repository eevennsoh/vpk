# Figure craft: concept, interaction and step guides

Owner of figure concepts, pointer behaviour, step guides and the figure review for [SKILL.md](../SKILL.md). Load when you choose what a figure shows, wire its pointer or step tour, or review it.

Never install or load hairline’s `hairline-create`, anatomy or `design/3d-assembly-manual` skills; their code is vendored here. Load [figure engines](figure-engines.md) to pick an engine, [illustrations](illustrations.md) for iso brief fields, [figure fidelity](figure-fidelity.md) for how product UI looks, [figure motion](figure-motion.md) for time-based motion.

## 1. A concept is an object, an action and a readout

Write the concept on one line before you draw; two lines means two ideas.

| Step | Do | Example |
| --- | --- | --- |
| Object | A thing you could put on a desk, never a diagram | a deploy pipeline drawn as canal locks |
| Giveaways | 2-3 real features per part kind | a cabin narrower than its body |
| Variable | The one number or choice the pointer controls | gap, which layer, how fast |
| Rest pose | Compose the still frame unevenly with one accent, never a flat grid | it is the thumbnail and the print |
| Readout | Mono characters naming what is under the pointer | `card 4 of 23`, `gap 0.60`, `rest` |

Story-explainer figures and product-UI scenes carry no readout: the reading column states the moment ([paper system § 1](paper-system.md#1-one-look-paper-ink-one-orange-accent-rings-instead-of-borders), [figure fidelity § 2](figure-fidelity.md#2-no-text-in-product-ui-scenes-except-named-exceptions)). Readouts belong to iso-kit and anatomy figures in other templates.

Drop the concept when it is dead at rest, needs words, gives the pointer no reason to touch it, or fails at 240px.

## 2. Borrow a proven interaction shape

| Shape | The pointer | The clock |
| --- | --- | --- |
| field | sets a position; parts rise with falloff by distance | a spring per part |
| one of many | picks an item; its neighbours part, staggered outward | tweens |
| scrub and pick | x scrubs the gap, y picks a layer | a spring for the gap |
| step tour | Next and Back move through steps; the camera eases to each step’s parts | 600-900ms ease-in-out |

## 3. Behaviour rules

| Rule | Value | Check |
| --- | --- | --- |
| Hit areas hold still | test the pointer against the rest or target pose, never the pose on screen | iso R12 |
| Stagger by pointer distance | `delay = abs(i - a) * step`; iso uses 10ms (`selectDelay`, runtime.mjs) | iso R12 |
| Clamp the reach | fit the frame to the most extreme pose | iso A7 at every slider stop |
| One accent means “here” | at rest one part; on choice the accent moves; labels stay ink | iso R4, A3 |
| Opaque, back to front | no far edge shows through a near solid; a guide paints before its plate | iso R2, A5, A6 |
| Two clocks | a discrete change gets a 700ms ease-out; a continuous input gets a spring (k 100, c 18, m 1) | iso R12 |
| Loops sleep | the shared `vpkFrameLoop` stops when settled, off screen or hidden; reduced motion lands in one step | iso R14 |
| Silhouette plus one crease | rounded corners, no vertical corner lines | |
| Lines land | every line ends on a face, a line or a terminal dot | anatomy `check-lines.mjs`, iso A20 |
| Ease toward targets | clamp the frame delta to 1/30s | |
| Truth | the readout comes from the model at the motion’s instant | |

## 4. Shapes reviewers reject

| Wrong | Right |
| --- | --- |
| Floating slabs standing in for “layers” | drawers, trays in a rack, plates on guide pillars |
| One big plain slab | a base, a carriage and parts, with screws and a ruler |
| Balloons or dashed hidden edges in a hero | the iso kit’s short leaders and boxed dimensions are the one label language |
| Hatching on side faces | plain flat side faces (iso R5) |
| Bare edges with back edges showing through | opaque surfaces carrying container outlines ([figure fidelity § 1](figure-fidelity.md#1-container-outlines-on-opaque-surfaces)) |
| A new hue for a fluid or a state | a tint of the figure’s own inks |
| Overlapping copies to quiet an audit | the true shape of the part |
| One screenshot tuned by eye | production crops first, see [figure fidelity § 6](figure-fidelity.md#6-match-production-frames-not-your-own-render) |

The tell: the shape needs a caption to say what it is, or a back edge shows through a near face.

## 5. Step guides

Build a step guide as a sequence of iso-kit figures, one per step, sharing one brief and changing `focal` and `state`. Keep it offline: no external 3D engine or CDN script.

| Part | Spec |
| --- | --- |
| Model | white with ink hairlines, near-flat light, one pale shadow; built parts return to near-white |
| Accent | only the current step’s new or removed parts, their arrows and their tray chips |
| Per step | title, one-line summary, 2-4 numbered actions, mono meta line (time, quantities), one tip |
| Extras | a “Parts for this step” tray (tap flashes the outline), numbered marks, an optional 3x detail bubble, a plan inset |
| Buttons | Back and Next; Next is primary; the last step says Finish |
| Camera | eases to each step’s framing over 600-900ms ease-in-out; a drag interrupts it |
| Entry | each part drops in, in the accent, over 700ms ease-out, starts 180ms apart (`ENTRY.STAGGER_MS`), clock from its first rendered frame; no arrow, no ghost |
| Reduced motion and print | the step’s final state |

Measure the real space and mark guessed numbers “verify”. Port calculations instead of retyping results. Write step copy before building.

## 6. Review every row against frames

Check each row of § 1, § 3, § 4 and below against captured frames; fix every miss. Capture and reference comparison follow [verification](verification.md).

| Check | Pass when |
| --- | --- |
| Concept | the object is nameable at a glance and its mechanism fits one sentence |
| Pointer hold | with the pointer parked on a moving part, the drawing settles |
| Keyboard | every control works by key with a visible focus ring |
| Live region | it speaks only on a discrete change |

Without a browser, answer from the code, cite the line behind each, and report NOT VERIFIED.
