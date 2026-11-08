# Figure motion: time-pure scenes that scrub, loop and match production

Owner of time-driven figure motion for [SKILL.md](../SKILL.md). Load when a figure plays, scrubs with scroll, loops without end, or ports a production animation.

Contents: [video first](#match-the-production-video-first) · [pure time](#pose-is-a-pure-function-of-time) · [golden seeds](#stagger-with-golden-ratio-seeds) ·
[reduced motion](#reduced-motion-holds-settled-states) · [seamless loops](#endless-loops-recycle-with-no-seam) ·
[idle clock](#an-idle-clock-runs-on-top-of-scrolled-time) · [carried arrivals](#a-named-cursor-carries-every-arrival) · [cursors](#every-cursor-is-one-rounded-arrowhead) · [tile stories](#tiles-play-one-story-then-hold) · [lens bloom](#camera-moves-bloom-the-lens) · [held poses](#snap-between-camera-poses-then-hold-them) · [handoffs](#handoffs-cross-fade-and-interpolate) · [collections](#collections-reflow-like-the-product)

## Match the production video first

**Delete every source state no frame shows, and copy every number from the source.** The source holds states the final video cut. Capture and the reference-first order live in [verification.md § 2](verification.md#2-extract-reference-frames-before-you-draw); load it before you port a move.

```js
export const motionConfig = {
	wall: { start: 27, velocity: [-32, 0] }, // from finale-wall-motion.ts:wallOffset (sideways only)
	hand: { enter: 0.6, ride: 0.2, leave: 0.4, fade: 0.2, margin: 8 }, // from finale-wall-cursors.ts:ENTER_S, RIDE_S, LEAVE_S, CURSOR_MARGIN
	names: ["Venn", "Eduardo", "Jason", "Vohmann", "Charlie", "Carola", "Harry", "Sofia", "Jannis"], // from FINALE_WALL_CURSOR_NAMES; carriers repeat in this order
	// dropped: the card parked in the air above its slot (finale-wall-motion.ts); no frame shows a card without a hand
};
```

The tell: a number with no source constant beside it, or a pose you cannot point to in a reference frame.

## Pose is a pure function of time

**`model({ time }, data, options)` returns the whole scene: camera, poses, colours, cursors.** Nothing carries between frames, so a seek, a reverse scrub and a replay draw one frame per time.

```js
// GOOD: computed from time alone. i = element index; since = seconds since this element's event (time - event.at).
const ease = u => { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); };
const z = (1 - ease((time - 23) / 1.3)) * (170 + (i % 4) * 45);
const swing = since > 0.55 ? 8 * Math.exp(-1.5 * (since - 0.55)) * Math.sin(5.4 * (since - 0.55)) : 0; // degrees; swing starts 0.55 s into the 0.85 s drop
card.z -= card.vz * dt; // BAD: integrates per frame, so seeking or scrubbing back lands somewhere else
```

Draw randomness from a seeded hash of the index (`Math.sin((i + 1) * 127.1 + channel * 311.7 + seed * 0.013) * 43758.5453`, fractional part), never `Math.random()`. Figure-craft’s 1/30 s delta clamp is for pointer-driven parts, never scrubbed time. The tell: scrubbing one second back and forth shows two different frames.

## Stagger with golden-ratio seeds

**Give each repeating element the phase seed `index × 0.6180339 mod 1`.** Consecutive seeds sit far apart, so channels that genuinely repeat (a waiting hand’s breath, an ambient drift) never pulse in unison. Keep one period per channel and vary only the phase. Tile micro-interactions never repeat: [§ Tile stories](#tiles-play-one-story-then-hold).

```js
surface.seed = (index * 0.6180339) % 1;
const phase = period => (((time + surface.seed * period) % period) + period) % period;
const barAt = phase(8) - row * 0.16; // bar rows 0.16 s apart inside one tile
```

Too little: `delay = i * 0.1` sends a wave down the grid every period. Too much: a fresh period per tile reads as noise.

## Reduced motion holds settled states

**The host decides once and the model reads only `options.reduced`.** A reduced capture in a full-motion browser then draws the same frame.

```js
render(model({ time }, data, { reduced: loop.reducedMotion() || player.printing })); // host
// model: every channel returns its settled value (bar full, typing done, lanyard hung, card landed)
const since = options.reduced ? Infinity : time - event.at;
```

The idle clock never starts under reduce. Too little: a frame caught mid-pose, or cards left blank because `since` stayed 0. Too much: reduced motion also freezes the chapter change on scroll. The tell: a 0.05 s sweep under reduce shows any channel between its endpoints, or `matchMedia` appears inside `model()`.

## Endless loops recycle with no seam

**Wrap each position into a band one period wide centred on the camera.** A recycled element then re-enters off frame.

```js
const wrap = (value, centre, period) => value - Math.floor((value - centre + period / 2) / period) * period;
const x = wrap(origin[0] + velocityX * (time - wallStart), camera.at[0], periodX); // periodX = packed width + one gutter
const carrier = names[(pass * lanes + rank) % names.length]; // each pass repeats the same pairings
```

- Take the period from the layout’s own repeat (EU26: packed wall width plus a 17.1-unit gutter, scrolling −32 units/s from 27 s), and end each channel’s loop on its opening value (bar 0.4 → 1 → 0.4 over 8 s).
- Schedule events for two periods and render the second, so lane and cursor state are already warm when the loop wraps.

Too little: something pops once per period in a 0.1 s strip across the boundary. Too much: a period so long the warm-up never ends, or a band narrower than the frame, so elements recycle in view.

## An idle clock runs on top of scrolled time

**Add an idle clock from the final act’s start.** Scrolled time clamps at the last chapter, which freezes every endless act and in-tile loop; the timeline keeps showing the last chapter while the drawing runs on.

```js
// From _figures/explorer.js:24-55, 190-218, 268-330. Host owns player { time, idle, visible, wantsPlay, tween, printing },
// states[], duration, previewIndex(), mode, capturePose(), render(time), renderBlend(fromPose, time, progress).
const VIDEO = "theater"; // "video" in the unrenamed EU26 kit
const loop = window.vpkFrameLoop, finalStart = 27; // EU26 wallStart, s
const playbackRate = 1.7; // timeline s per wall-clock s; explorer.js defaults to 1.7
const free = () => player.visible && !document.hidden && !player.printing && previewIndex() === null;
const running = () => player.wantsPlay && !player.tween && free();
const idling = () => mode !== VIDEO && !player.wantsPlay && !player.tween
	&& player.time >= finalStart && free() && !loop.reducedMotion();
const shownTime = () => player.time + (player.time >= finalStart && mode !== VIDEO ? player.idle : 0);
const smoother = p => p * p * p * (p * (p * 6 - 15) + 10);
let last = null;
const board = loop.register(stage, (dt, now) => {
	if (!free()) { last = null; return false; } // else a 20 s absence lands as one 34 s jump
	const elapsed = last === null ? 0 : Math.max(0, (now - last) / 1000), t = player.tween;
	last = now;
	if (t) {
		t.elapsed = Math.min(t.duration, t.elapsed + elapsed);
		renderBlend(t.fromPose, player.time, smoother(t.elapsed / t.duration));
		if (t.elapsed >= t.duration) player.tween = null;
	} else if (running()) {
		player.time = Math.max(0, player.time + elapsed * playbackRate);
		if (mode === VIDEO && player.time >= duration) { player.time = duration; player.wantsPlay = false; }
		render(shownTime());
	} else if (idling()) { player.idle += elapsed * playbackRate; render(shownTime()); }
	return Boolean(player.tween) || running() || idling();
});
const wake = () => { last = performance.now(); board.wake(); }; // every restart goes through here
function seek(time) {
	player.tween = null; player.wantsPlay = false; player.time = Math.max(0, time);
	if (player.time < finalStart) player.idle = 0; // a scrub back out of the final act resets the idle clock
	render(shownTime()); wake();
}
function select(index) {
	const from = shownTime(), fromPose = capturePose();
	player.wantsPlay = false; player.time = states[index].time; player.idle = 0;
	const span = Math.min(0.42, Math.max(0.24, 0.28 + Math.abs(from - player.time) / duration * 0.14)); // 0.28 = 2 × --vpk-dur-fast
	player.tween = loop.reducedMotion() ? null : { fromPose, elapsed: 0, duration: span };
	if (!player.tween) render(player.time);
	wake();
}
function play() {
	if (mode === VIDEO && player.time >= duration) player.time = 0;
	if (player.time >= finalStart) { player.time = shownTime(); player.idle = 0; } // fold idle into time, so play resumes where the wall is
	player.wantsPlay = true; wake();
}
```

Too little: the wall freezes at the end. Too much: the clock idles in Video mode, which plays to `duration` and stops, or before the final act, or `idle` survives a scrub back above 27 s. The tell: the timeline label advances while idling, or the figure stops 2 s after the wheel reaches the end ([verification.md § 6](verification.md#6-scroll-to-the-end-with-the-wheel-not-seek)).

## A named cursor carries every arrival

**A new card never moves on its own.** A named teammate’s cursor brings it in from wholly off the frame at its own size and nearly flat, sets it in its slot, lets go and leaves. A card no hand can bring in is already in place before it becomes visible. `refinement-model.test.mjs` asserts each bound.

| Channel | EU26 config (`motionConfig.hand`, `.arrival`) | Asserted bound |
|---|---|---|
| enter, ride, leave, fade | 0.6, 0.2, 0.4, 0.2 s; cursor 8 px inside the frame while it sets the card down | every visible unlanded card held by a teammate cursor (alpha > 0.5) |
| carried card | `grow` 0.03, `tilt` 0.03 rad, `lift` 8 units | scale ≤ 1.04, tilt ≤ 0.04 rad, lift ≤ 10 |
| landing | blank sheet; face up 0.6 s after touchdown over 0.072 s | face 0 at −0.05 s; flat, face < 1 at +0.2 s; face 1 at +1.2 s |
| ring | from 0.1 s before touchdown, grows 16 units, peak opacity 0.9, gone by 1 s | playing at +0.2 s, gone at +1.2 s |
| stack deal | top first, 0.09 s × 0.7–1.3 apart | each card lands 0.04–0.2 s after the one above |

The lanyard drops over 0.85 s and swings per the `swing` line in [§ Pose](#pose-is-a-pure-function-of-time). Too little: the card floats in alone or hangs above its slot. Too much: the carried card balloons past 1.04× or tilts past 0.04 rad. The tell: a 0.05 s sweep ([verification.md § 7](verification.md#7-sweep-time-for-invariants)) finds a moving card with no cursor attached.

## Every cursor is one rounded arrowhead

**Draw every cursor as stageshow’s solid arrowhead (`M4 3 18.5 9.6 11.8 11.8 9.6 18.5Z`, hotspot 4,3) with a paper halo, never a macOS pointer with a tail.** A teammate is one tone everywhere: arrow and name flag share it, and the flag rides 11 px right and 15 px below the tip. It is never turned over, whichever edge the hand came from. Source: stageshow `kit/cursor.tsx` and `examples/presence`.

| Part | Value |
|---|---|
| arrow | fill and 1.8 px stroke in the person’s tone, `stroke-linejoin: round`, `vector-effect: non-scaling-stroke` |
| halo | the same path behind it, 4 px paper stroke; it replaces a drop shadow on paper |
| flag | radius 6 px, 11 px weight-600 name, 3 px × 7 px padding; paper text on dark tones, ink on the lightest |
| tones | the main cursor in text ink; teammates at 80%, 58% and 38% ink in paper |
| press | scale 0.9 about the tip; one accent ripple (radius 4 → 18 px, opacity `4p(1 − p)`) while the press goes in or lets go |
| held | no ring stays under a grip |

Too little: a bare arrow with no name reads as a second pointer. Too much: a coloured arrow beside a grey flag, or a flag turned over above the tip. The tell: the cursor is the darkest, heaviest mark in a paper frame.

## Tiles play one story, then hold

**Each tile does one small thing once, then holds the result.** A carried card starts its story when its face is up (touchdown + 0.72 s). A card already in place starts as its centre enters the frame. Parts stagger 0.09 s in reading order, and every story ends within 2.5 s. Nothing rewinds in view, so the eye goes to the edge where cards arrive (stageshow `references/bento.md` rule 11).

| Part | Story |
|---|---|
| bar | grows from 15% to its value over 0.9 s with a light overshoot |
| input | types in 18 steps over 1.6 s and keeps the text |
| list highlight | steps to its row, 0.45 s a step, and stays |
| ring | sweeps once to 72% over 1.4 s |
| bubble | arrives whole from 4 units above, 0.6 s after the one before |
| named cursor in a tile | travels once to its target over 1.1 s and rests |

Too little: a wall that never moves inside its tiles. Too much: every tile on its own loop, values dipping and retyping in view. The tell: freeze-frame two moments 3 s apart and a tile that entered more than 3 s ago has changed (`explorer.behavior.test.mjs` asserts this).

## Camera moves bloom the lens

**Add a lens bloom to the camera’s perspective during a move: it peaks mid-move and settles flat.** A parallel view reads as a slide; the bloom gives the move depth without leaving the paper look at rest.

```js
// From eu26-motion-model.mjs:32-42, 66-68 and eu26-scene-live.mjs:96-101, 461. a, b = camera keys; s = smootherstep progress;
// mix(a, b, s) = a + (b - a) * s; scale = the projection scale.
const lensBloom = (a, b, s) => {
	const turn = Math.abs(((b.azimuth - a.azimuth + 540) % 360) - 180) / 45, tilt = Math.abs(b.elevation - a.elevation) / 30;
	const zoom = Math.abs(Math.log(b.width / a.width)) / 0.7, travel = Math.hypot(...b.at.map((v, i) => v - a.at[i])) / 300;
	const size = turn + tilt + zoom + travel;
	return size < 0.05 ? 0 : Math.sin(Math.PI * s) * Math.min(0.55, b.lens ?? 1, 0.2 + size * 0.25);
};
camera.width = Math.exp(mix(Math.log(a.width), Math.log(b.width), s)); // log space: zoom reads even
camera.persp = mix(a.persp ?? 0, b.persp ?? 0, s) + lensBloom(a, b, s);
const k = camera.persp * scale * Math.sqrt(1.6) / camera.height;
// rel = depth relative to the camera target: depthOf(point) - depthOf(camera.at). centre = iso(camera.at).
const spread = rel => 1 / Math.max(0.35, 1 - rel * k);
const project = (flat, rel) => centre.map((c, i) => c + (flat[i] - c) * spread(rel));
```

Sort depth in un-perspective space: undo the spread, iterating to a fixed point because the spread depends on the depth you solve (`eu26-scene-live.mjs:308-322`).

```js
let d = depth; // flatDepth(screen) inverts the parallel projection onto this surface’s plane
for (let i = 0; i < 4; i++) {
	const s = spread(d - lensDepth); // lensDepth = depthOf(camera.at)
	d = flatDepth([centre[0] + (sx - centre[0]) / s, centre[1] + (sy - centre[1]) / s]);
}
```

Cap a move with the key’s `lens` where tilted fans would overlap in a cycle. Too little: the camera slides flat. Too much: bloom past 0.55, so fans overlap and faces swap order mid-move. The tell: the depth-cycle count (`dataset.heroDepthCycles`, `eu26-scene-live.mjs:448`) rises above 0; [verification.md § 7](verification.md#7-sweep-time-for-invariants) owns the assertion.

## Snap between camera poses, then hold them

**Treat the camera as a short list of held poses joined by fast eased moves; hold each pose at least twice as long as the move into it.** The four camera references (`~/Desktop/camera.mp4`, `camera2.mp4`, `camera3.mp4`, `camera4.mp4`, measured from 0.1 s strips, 2026-11-08) never drift continuously: they hold, snap and hold again. A pose is a destination, so a key may carry its own `persp` (the term `lensBloom` adds to above) and hold a deep perspective as deliberately as a flat one.

| Reference | Held poses | Move into the next pose | What carries the change |
| --- | --- | --- | --- |
| camera (street, 7 s) | Flat frontal, then a low wide one-point view with lines converging on one vanishing point | 0.3-0.4 s, ease in and out; holds 0.5-0.8 s with a slow drift | Focal length opens while the camera drops; the cone row stays at the bottom centre of the frame |
| camera2 (rooms, 5.7 s) | A room box in one-point perspective, then the next room flat and frontal | 0.4 s quarter turn about the vertical axis, like a cube face turning | The box edge is the hinge; the landing pose is flat |
| camera3 (subway, 9.4 s) | The same path as a full-colour pass, then a flat two-tone pass | Camera path unchanged across the swap | Fills and palette swap while geometry and camera stay continuous |
| camera4 (gym, 15 s) | A deep symmetric one-point view | 0.5 s; the frame rectangle shrinks and skews while a foreground ball crosses the near plane | The frame shape and a near object move; the room holds still |

```js
// A held deep pose and a held flat pose, joined by short moves (model seconds; divide by playbackRate for wall time).
cameraKeys: [
	{ time: 0, ...flatFront },                           // hold flat
	{ time: 0.8, ...flatFront },
	{ time: 1.2, ...lowWide, persp: 0.45 },              // 0.4 s snap into a held perspective pose
	{ time: 2.4, ...lowWide, persp: 0.45 },              // hold 1.2 s, three times the move
	{ time: 2.8, ...nextFront },                         // 0.4 s snap back to flat; lensBloom still peaks mid-move
],
```

- **Keep one anchor fixed across a move.** Choose the subject (the cone row, the room’s back wall, the dragged card) and keep its screen position within a few percent while the lens and dolly change around it. Too little: the subject slides with the camera and the move reads as a pan. Too much: a frozen subject over a lurching background reads as a glitch.
- **Change one thing per move.** Each reference move changes focal length, or turns the box, or reshapes the frame, never all three. The tell: you cannot name the one thing a move changes.
- **Swap the illustration style as a layer, never with a cut.** A palette or fill change (camera3) runs on the same camera time; fills cross-fade, line work stays put.
- **Let the frame join the choreography only when the reference does.** Reshaping or skewing the figure container and letting a near object break its edge (camera4) are strong moves; use them once, at the act they mark, and only with a reference frame that shows them.
- **Land on flat.** Every reference ends a sequence on a flat frontal pose, and the EU26 wall is flat by the user’s call. A held deep pose belongs in the middle of a sequence.

Calibrate against the EU26 figure: its camera moves run 1.2-2.6 model seconds, 0.7-1.5 s at `playbackRate` 1.7, against the references’ 0.3-0.5 s; every perspective there is transient lens bloom with no held deep pose. The line weight and fills these references share (one even hairline, flat fills, no gradients) are owned by [figure-fidelity.md](figure-fidelity.md); this section owns only how the camera moves.

GOOD: hold flat 0.8 s, snap 0.4 s into a low wide pose, hold it 1.2 s, snap back to flat. BAD: a 2.5 s move that eases continuously from one pose to the next. The tell: no two consecutive 0.1 s frames are identical, so the viewer never gets a still picture to read.

## Handoffs cross-fade and interpolate

**Blend both properties over one curve when a role passes between elements.** A jump reads as two objects swapping instead of one role moving.

| Wrong | Right |
|---|---|
| the hero tile turns grey and the title turns orange on one frame | the orange passes over 0.3 s on one smoothstep: `color-mix(in oklab, active X%, neutral)`, exact endpoints below 0.0001 and above 0.9999 |
| a 0.8 s blend, so two tiles read orange at once | 0.3 s: one orange tile per frame |
| the title snaps from the bento’s 9-unit corners to the slot’s radius | `radius = mix(9, slot.r, ease(p)) / scaleX`, so the corner holds its on-screen size under the morphing scale |
| a story chapter click replays every effect in between | blend the endpoint poses over 0.24–0.42 s (`select` above); figure-craft’s 600–900 ms is the step-guide camera |

## Collections reflow like the product

**A collection reflow closes the gap a leaving card opens; a multi-select drag moves every selected card; a clipped list fills to its window edge.** Viewers know these rules from the product, so any break reads as a bug.

```js
// From eu26-motion-model.mjs:75-78, 94-95, 103-134 (EU26: leave = 0.7 s, grab = 4.3 s).
// Inputs: t scene time; leave, grab event times; home, ownRow slot centres [x, y, z]; pitch row spacing;
// leader dragged card centre at t; deckIndex order in the selection; inWindow row inside the clip window;
// win clip window { x, top, width, bottom }; mix lerps arrays; ease as above.
const reflow = ease((t - leave) / 0.7);
const slot = [home[0], home[1] - pitch * reflow, home[2]]; // cards below the leaver slide up one pitch
const hiddenRowAlpha = reflow; // the next hidden row scrolls in on the same ease
const delay = inWindow ? 0 : Math.min(0.3, 0.025 * deckIndex);
const deck = leader.map((v, axis) => v + [-3, 4, -1.2][axis] * Math.min(deckIndex, 6)); // under the dragged card
const gather = ease((t - grab - delay) / 0.55), settle = ease((t - grab - 1) / 0.5);
const at = mix(mix(slot, deck, gather), ownRow, settle); // selected cards inside the window settle into their own rows
const sink = ease((t - grab - 0.9 - delay * 0.25) / 0.5); // extras sink into the stack below the window
const alpha = 1 - ease((t - grab - 1.15 - delay * 0.25) / 0.35); // then fade
const shown = rows.filter(row => row.top < win.bottom); // every row whose top is inside; the last crosses the edge
Object.assign(clipRect, { x: win.x, y: win.top, width: win.width, height: win.bottom - win.top });
```

Too little: a gap stays open, one card moves while its selection waits, or the clipped list ends on a whole card. Too much: the whole column reflows when one card leaves, non-selected cards join the drag, or rows shrink so none is clipped.
