# Figure craft: concept, rules and review

This page covers what makes a technical figure good, for both figure engines. It covers how to find the object, how it should behave, how to build a step guide, and how to review the result. It folds in the authoring guidance from three MIT-licensed projects that the kits already build on:
- hairline's `hairline-create` skill (Lucas Marques);
- the anatomy skill (wheresryan22);
- the `design/3d-assembly-manual` skill (SkylarKitchen).

Their code is already vendored or ported inside this skill (`scripts/anatomy/vendor/`, `scripts/iso/`, `scripts/iso/accent.mjs`), and their credits are in `LICENSE`. **Do not install or load those skills:** vpk-html is self-contained, and their rules below are restated for the vpk kits and override the upstream wording.

For engine choice and the hero contract, read [figure engines](figure-engines.md). For iso-kit brief fields and audit codes, read [illustrations](illustrations.md).

## 1. From an idea to a concept

A concept has three parts: **an object**, **what the pointer or the step does to it**, and **what the readout says**. It fits on one line; if it doesn't, it isn't ready.

1. **Find the object.** Pick something you could put on a desk or build in an afternoon: a tray, a rack, a belt, a stack of drawers, a bed frame. Don't pick a diagram. A deploy pipeline is not boxes and arrows; it might be a flight of canal locks.
2. **Find what gives it away.** For each kind of part, name two or three features the real thing has, such as a cabin narrower than its body or a lantern on a tower. A part with none of them is a rounded block, and a row of blocks reads as nothing. Check the small render against this list.
3. **Find the variable.** Name the one number or choice that matters (how far, which one, how fast). That is what the pointer, the Gap slider or the step tour controls.
4. **Design the rest pose.** The still frame is the thumbnail and the print, so it must already be a composition. Make it uneven, give it one accent that says where to look, and never make it a flat regular grid.
5. **Write the readout words.** A few characters naming what is under the pointer (`card 4 of 23`, `gap 0.60`), and `rest` when nothing is.

**Drop or fix the concept when:**
- it is dead at rest;
- it needs words to be understood;
- it holds two ideas;
- the pointer has no reason to touch it;
- it is a diagram or an icon;
- it depends on colour beyond the one accent;
- it won't read at 240 px wide.

**Proven interaction shapes.** Borrow one rather than inventing a new one:

| Shape | The pointer | The clock |
| --- | --- | --- |
| field | sets a position; parts rise with falloff by distance | a spring per part |
| one of many | picks an item; its neighbours part, staggered outward | tweens |
| scrub and pick | x scrubs the gap, y picks a layer | a spring for the gap |
| step tour | Next/Back moves through steps; the camera eases to each step's parts | 600–900 ms ease-in-out |

## 2. Behaviour rules

These apply to both kits. Each rule names the check that enforces it, where one exists.

1. **Hit areas don't move.** Test the pointer against the rest pose or the target pose, never the pose on screen. Otherwise the part lifts away from the pointer, the hover drops, the part falls back, and the hover returns: a flicker loop. To pick by moving values, read the target, not the current value. (iso R12)
2. **Stagger by distance.** Use `delay = |i - a| × step` with a step of 30–60 ms, so motion spreads out from the pointer instead of running down a list. (iso R12: 40 ms)
3. **Clamp the reach.** Every lift, gap and lean has a far end, and the figure is still composed there. Fit the frame to the most extreme pose. (iso A7 at every slider stop)
4. **One accent, used to mean something.** At rest one accented part says where to start. When the pointer chooses, the accent moves to the chosen part and the rest mark gives it up. Labels stay ink. (iso R4, A3)
5. **Construction stays honest.** Faces are opaque and painted back to front. A guide is painted before the plate it belongs to, and no far edge shows through a near solid. (iso R2, A5/A6; anatomy `settle`)
6. **Two clocks.** A discrete change (which part) gets a 700 ms ease-out. A continuous input (where the pointer is) gets a spring (k 100, c 18, m 1). Never use a timed ease to chase a moving target, and nothing is linear. (iso R12)
7. **Loops sleep.** All interactive motion runs on the shared `vpkFrameLoop` and stops when settled, off screen or in a hidden tab. Under reduced motion it lands in one step. Motion at rest is CSS only, after 3 s idle. (iso R14, § 8 of illustrations)
8. **Round corners, then draw less.** Each solid gets its silhouette plus one dim crease. No vertical corner lines and no sharp corners: bright outside, dim inside.
9. **Lines land on something.** Every line ends on a face, another line or a terminal dot; nothing stops mid-air. A texture ends on a real edge or fades out. (anatomy `check-lines.mjs`)
10. **Ease, never snap.** Pointer and keys set targets, and parts ease toward them. Clamp the frame delta to 1/30 s so a returning tab doesn't jump.
11. **Truth.** The readout comes from the model and from the same instant as the motion. Never put a phase word next to a lagging number.

## 3. Anti-patterns reviewers reject

- **Abstract stacks.** Floating slabs standing in for "layers". Make them drawers, trays in a rack, or plates on guide pillars.
- **One big plain slab.** Break it into a base, a carriage and parts, with screws, a ruler and a label plate.
- **Blueprint clutter in a hero.** Balloons, hatching, dashed hidden edges and floating labels. The iso kit's short leaders and boxed dimensions are its one allowed label language; the anatomy hero keeps labels in the plate corners.
- **Hatching on side faces.** Side faces are plain flat faces (iso R5).
- **Wireframes.** See-through boxes where back edges show.
- **Colour everywhere.** One accent and pale shadows only. A fluid is a tint of the figure's own inks, not a new hue.
- **Stand-in shapes.** Record the true shape of what you draw; never use overlapping copies to quiet an audit.
- **Tuning one screenshot by eye.** Measure (audits, line ends, painter's order), then look.

## 4. Step guides (assembly manuals)

A step guide shows a physical task as numbered steps on one model. Each step changes what is built and what is in colour.

**Look**
- A white model with ink hairline edges, near-flat light and one pale soft shadow.
- Parts already built go back to near-white. Only the current step's new or removed parts take the accent, and so do their motion arrows and their chips in the parts tray.
- The page chrome stays neutral (white paper, ink buttons, Geist and Geist Mono, sentence case); colour lives only in the picture.
- No people in the scene by default. Scale comes from the dimension tags and a live scale bar.

**Per step**
- A title and a one-line summary.
- 2–4 numbered actions.
- A mono meta line with time and quantities, plus one tip.
- A "Parts for this step" tray; tapping a part finds it and flashes its outline.
- Numbered marks on the active part.
- An optional round detail bubble at about 3× magnification, joined by a hairline to the point it magnifies.
- A small top-down plan inset.
- Back and Next step buttons. Next is primary; the last step says Finish.

**Motion**
- The camera eases to each step's framing (600–900 ms ease-in-out, interruptible by a drag).
- Each part drops in, in the accent, over 700 ms ease-out, with no arrow and no ghost outline: the drop shows the direction. Starts are spaced evenly (`ENTRY.STAGGER_MS`, 180 ms), so each drop overlaps the end of the previous one. An accelerating stagger reads as slow, then rushed.
- Each tween's clock starts on its first rendered frame, so a slow first frame can't eat the opening motion.
- Reduced motion jumps to each step's final state, and print shows it.

**Process**
1. Measure or estimate the real space. Mark any guessed numbers "verify".
2. List the parts, grouped by where they come from.
3. Write the step copy before building.
4. Port any calculation (plank rows, rips) instead of retyping its results.
5. Verify at 390 px in a real browser before calling the render done.

**What the kits ship today**
- The iso kit covers the look, the accent, the shadows, the ghosts and the assembly entrance, inside one figure.
- A multi-page step-guide engine is not part of the skill yet. Build a step guide as a sequence of iso-kit figures, one per step, sharing a brief and changing `focal` and `state`. Don't load an external 3D engine or a CDN script: documents stay offline.

## 5. Review checklist

Answer each item yes or no, and fix every no before handing over.

1. **It is an object.** At a glance it reads as one real thing you can name, and its mechanism maps to the concept in one sentence.
2. **It reads at 240 px.** In the small render you can point to the features named for each kind of part.
3. **The rest pose is a composition.** It isn't flat, empty or a regular grid, and one accent says where to start.
4. **Nothing flickers.** With the pointer held on a moving part, the drawing settles.
5. **Bright outside, dim inside.** Each solid has a silhouette and one crease, with no vertical corner lines.
6. **Nothing shows through.** Painter's order is right; no guide crosses its own plate.
7. **One accent.** One place is in colour at a time; labels stay ink.
8. **Readout.** It names what is under the pointer in a few characters, and says `rest` at rest.
9. **Nothing leaves the frame**, at either end of the slider or the reach.
10. **Both themes.** Nothing vanishes or keeps the wrong colour in light or dark.
11. **Lines land.** Line ends are zero for the anatomy hero; every iso leader ends on visible ink (A20).
12. **Motion and access.**
    - Motion is eased and calm.
    - It stops off screen and is still under reduced motion.
    - The keyboard works and shows a focus ring.
    - The live region speaks only on a discrete change.
13. **Console clean.** No console errors in either theme.

Without a browser, answer from the code and cite the line that makes each answer true. Then say at hand-over that the figure was **not looked at in a browser**.
