import { WALL_CUE } from "../data/finale-cues";
import type { FinaleRect } from "../data/finale-stories";
import { projectLifted } from "./finale-camera";
import { blendPose, cameraDistance, flatPose, landingWaveAge, type FinaleCardPose, type FinalePoint, type FinaleViewport } from "./finale-card-motion";
import { EASE, clamp, lerp, progress, smoothstep as smooth } from "./finale-math";

/*
 * Act III's first placement: MCB, whose cursor dragged the keynote's cards
 * into Done, drags "Team ’26" into the mega bento. Its gap lies almost
 * straight under its box, so a card merely sent there only shrinks in place;
 * he carries it instead. As the black face comes up he reaches in from his
 * side of the frame and takes the card by its corner as its flip lands. It
 * gives a little toward him as he picks it up, then he strokes it up into
 * its gap, lowering it from near the lens to the wall as he goes: a held
 * drag preview, hanging off his grip, leaning the way he drags it. Over its
 * gap he rides the wall's glide, sets it down a beat after the last tile,
 * lets go and leaves; it lands as every card on the wall lands.
 *
 * Every beat is a pure function of the finale clock. The wall's own motion
 * (its gliding gap, the title's flip) comes in through `TitleCarry`, so this
 * module sits under `finale-wall-motion.ts` and `finale-wall-cursors.ts`.
 */

/** What MCB's carry needs to know of the wall, at a time. */
export interface TitleCarry {
	/** The title's box on the slide (viewport px), where its flip lands. */
	readonly from: FinaleRect;
	/** Its gap on screen at a time, gliding with the wall. */
	readonly gapAt: (time: number) => FinaleRect;
	/** Its flip at a time, in its box at the slide's depth (`titleFlipPose`): he takes it out of that. */
	readonly flipAt: (time: number) => FinaleCardPose;
	readonly viewport: FinaleViewport;
}

/** MCB's cursor: its tip on screen, larger while the card is near the lens, how far it is pressed (0 → 1), and its opacity. */
export interface TitleCarrier {
	readonly x: number;
	readonly y: number;
	readonly scale: number;
	readonly pressed: number;
	readonly opacity: number;
}

/**
 * The carry, in frame heights where it is a distance:
 * - `grip`: where he holds the card, a share of its width from its left and
 *   of its height from its top (by its lower right corner, clear of the type);
 * - `reachFrom`: where his cursor comes in from, off that grip (up and to the
 *   right, his side of the frame on the bento too);
 * - `give` and `giveS`: as he takes it, the card gives a little toward him,
 *   away from its gap, peaking and spent over `giveS` (the drag's wind-up);
 * - `strokeFrom`: when his stroke to the gap sets off, after the grab;
 * - `bow`: how far his stroke bows off the straight line, a share of its length;
 * - `near`: how near the lens he holds it, as its apparent scale there; the
 *   rest of its shrink to the gap is the sheet's own, as the thrown tiles';
 * - `tilt` and `lean`: a drag preview's turn as he takes it, and how far
 *   it leans into the drag (radians at `leanSpeed` frame heights a second);
 * - `pickupS`: how long it takes to give itself over from its flip to his hand;
 * - `overGapS`: how long he rides its gap, setting it down, before it is down;
 * - `pressS`: his press as he takes it and lets go;
 * - `leaveS` and `leave`: how he lifts off and leaves once it is down;
 * - `smear`: the field's chromatic smear on it while it is up in the air.
 */
const TITLE_CARRY = {
	grip: { u: 0.88, v: 0.76 },
	reachFrom: { x: 0.2, y: -0.15 },
	give: { x: 0.12, y: 0.07 },
	giveS: 0.95,
	strokeFrom: 0.22,
	bow: 0.12,
	near: 1.7,
	tilt: -0.04,
	lean: { turn: 0.12, tip: 0.14 },
	leanSpeed: 0.7,
	pickupS: 0.25,
	overGapS: 0.25,
	pressS: 0.1,
	leaveS: 0.55,
	leave: { x: 0.04, y: -0.05 },
	smear: 0.5,
} as const;

/** Where he holds the card in its sheet's own uv (u right, v up): its landing wave runs from there, the corner he sets it down by. */
export const TITLE_GRIP_UV: FinalePoint = { x: TITLE_CARRY.grip.u, y: 1 - TITLE_CARRY.grip.v };

/** How deep his cursor presses as he takes the card, as the presenters' cursors pressed to drop theirs. */
export const TITLE_CARRY_PRESS = 0.1;

/** When MCB's cursor appears, reaching in for the card. */
export function titleReachTime(): number {
	return WALL_CUE.start + WALL_CUE.carryReachAt;
}

/** When he takes it, his press bottoming out on its grip. */
export function titleGrabTime(): number {
	return WALL_CUE.start + WALL_CUE.carryGrabAt;
}

/** When the card is wholly his: out of its flip and in his hand. */
export function titleHeldTime(): number {
	return titleGrabTime() + TITLE_CARRY.pickupS;
}

/** When he sets it down in its gap: its touchdown, after the last tile's. */
export function titleTouchdownTime(): number {
	return WALL_CUE.start + WALL_CUE.carryDownAt;
}

/** When its set-down begins: the slide's swoop onto its gap, as every card lands. */
export function titleSetDownStart(): number {
	return titleTouchdownTime() - WALL_CUE.fallS;
}

/** When his cursor has left, the card down. */
export function titleCarrierGoneTime(): number {
	return titleTouchdownTime() + TITLE_CARRY.leaveS;
}

/** How far the card has given itself over from its flip to his hand (0 at the grab → 1). */
export function titlePickup(time: number): number {
	return smooth(titleGrabTime(), titleHeldTime(), time);
}

/** The field's smear on the held card: it swells in as he lifts it and clears as he sets it down. */
export function titleCarrySmear(time: number): number {
	const grab = titleGrabTime();
	return TITLE_CARRY.smear * smooth(grab, grab + 0.4, time) * (1 - smooth(titleSetDownStart(), titleTouchdownTime(), time));
}

/**
 * Where a point of a posed sheet lies (`dx` right, `dy` up from its centre,
 * in its own px), as `poseSheet` turns it: x, then y, then −z, in world axes
 * with y up. Returned off the pose's centre, x right, y down, z toward the lens.
 */
export function sheetPoint(pose: Pick<FinaleCardPose, "rotateX" | "rotateY" | "rotateZ">, dx: number, dy: number): { x: number; y: number; z: number } {
	const z = -pose.rotateZ;
	const x1 = dx * Math.cos(z) - dy * Math.sin(z);
	const y1 = dx * Math.sin(z) + dy * Math.cos(z);
	const x2 = x1 * Math.cos(pose.rotateY);
	const z2 = -x1 * Math.sin(pose.rotateY);
	const y3 = y1 * Math.cos(pose.rotateX) - z2 * Math.sin(pose.rotateX);
	const z3 = y1 * Math.sin(pose.rotateX) + z2 * Math.cos(pose.rotateX);
	return { x: x2, y: -y3, z: z3 };
}

/** His grip on a sheet posed `pose`, in its own px off its centre (x right, y up). */
function gripOffset(pose: Pick<FinaleCardPose, "width" | "height">): FinalePoint {
	return { x: (TITLE_CARRY.grip.u - 0.5) * pose.width, y: (0.5 - TITLE_CARRY.grip.v) * pose.height };
}

/** His grip on a card lying flat in `rect`, on screen. */
function gripOn(rect: FinaleRect): FinalePoint {
	return { x: rect.x + rect.width * TITLE_CARRY.grip.u, y: rect.y + rect.height * TITLE_CARRY.grip.v };
}

/** His grip on a posed card, where the camera sees it, and how much larger it looks there than on the wall. */
function titleGripOnScreen(pose: FinaleCardPose, viewport: FinaleViewport): { x: number; y: number; scale: number } {
	const grip = gripOffset(pose);
	const point = sheetPoint(pose, grip.x, grip.y);
	return projectLifted({ x: pose.x + point.x, y: pose.y + point.y, z: pose.z + point.z }, viewport);
}

/** A hand's stroke over `x` (0 → 1): it sets off and arrives with neither a jump in speed nor a kick (a smootherstep). */
function stroke(x: number): number {
	return x * x * x * (x * (6 * x - 15) + 10);
}

/** How far along his stroke to the gap he is (0 → 1): over it, riding the wall's glide, a moment before he sets it down. */
function carryAlong(time: number): number {
	return stroke(progress(time, titleGrabTime() + TITLE_CARRY.strokeFrom, titleTouchdownTime() - TITLE_CARRY.overGapS));
}

/** How far the card has given toward him as he takes it (0 → 1 → 0, easing out of rest and back into it). */
function carryGive(time: number): number {
	return Math.sin(Math.PI * progress(time, titleGrabTime(), titleGrabTime() + TITLE_CARRY.giveS)) ** 2;
}

/**
 * How far he has lowered it (0 at the grab, by its box → 1 down on its gap,
 * at touchdown): as he carries it, most of the way down by the time he is
 * over its gap, so it is set down from just above, not sunk into place.
 */
function carryLowered(time: number): number {
	return smooth(titleGrabTime(), titleTouchdownTime(), time);
}

/**
 * His cursor's tip on screen through the drag (held where he took it before
 * the grab): from his grip on the card's box, giving a little toward him as
 * he takes it, then one stroke, gently bowed, to his grip on its gap, which
 * he rides once over it as the wall carries it.
 */
function dragTip(carry: TitleCarry, time: number): FinalePoint {
	const at = clamp(time, titleGrabTime(), titleTouchdownTime());
	const h = carry.viewport.height;
	const start = gripOn(carry.from);
	const end = gripOn(carry.gapAt(at));
	const along = carryAlong(at);
	const give = carryGive(at);
	const bow = Math.sin(Math.PI * along) * TITLE_CARRY.bow;
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	return {
		x: start.x + dx * along - dy * bow + TITLE_CARRY.give.x * h * give,
		y: start.y + dy * along + dx * bow + TITLE_CARRY.give.y * h * give,
	};
}

/** The drag's speed on screen at `time` (frame heights a second), still before the grab and once it is down. */
function dragVelocity(carry: TitleCarry, time: number): FinalePoint {
	const step = 1 / 240;
	const ahead = dragTip(carry, time + step);
	const behind = dragTip(carry, time - step);
	const h = carry.viewport.height;
	return { x: (ahead.x - behind.x) / (2 * step * h), y: (ahead.y - behind.y) / (2 * step * h) };
}

/**
 * How the held card turns in his hand: a drag preview's tilt, and its lean
 * into the drag, saturating softly: its top leaning the way it travels, its
 * leading edge dipping away from the lens. It shifts its weight as the drag
 * turns, and settles square as he slows over its gap.
 */
function heldTurn(carry: TitleCarry, time: number): Pick<FinaleCardPose, "rotateX" | "rotateY" | "rotateZ"> {
	const v = dragVelocity(carry, time);
	const { lean, leanSpeed } = TITLE_CARRY;
	return {
		rotateX: lean.tip * Math.tanh(v.y / leanSpeed),
		rotateY: lean.tip * Math.tanh(v.x / leanSpeed),
		rotateZ: TITLE_CARRY.tilt + lean.turn * Math.tanh(v.x / leanSpeed),
	};
}

/**
 * The card in his hand, in the wall's world: from his grip on its box at the
 * grab (held there before it) to lying flat in its gap at touchdown. Its grip
 * is always under his cursor's tip, wherever its turn puts the rest of it.
 * Like a thrown tile it starts near the lens, exactly the size of its box,
 * and is lowered to the wall, perspective shrinking it into its gap, with
 * the rest of the shrink the sheet's own; it never comes toward the lens.
 * Its last stretch is the slide's swoop (`EASE.inOut` over `fallS`), so it
 * lands as every card does, Peel's wave gathering as it comes down.
 */
export function titleHeldPose(carry: TitleCarry, time: number): FinaleCardPose {
	const { from, viewport } = carry;
	const grab = titleGrabTime();
	const touchdown = titleTouchdownTime();
	const at = clamp(time, grab, touchdown);
	const gap = carry.gapAt(at);
	const distance = cameraDistance(viewport);
	const x = progress(at, grab, touchdown);
	// Its apparent size over its gap's, lowered from its box's down to 1 as he carries it, eased in log space.
	const start = Math.max(1, Math.sqrt((from.width * from.height) / (gap.width * gap.height)));
	const apparent = start ** (1 - carryLowered(at));
	// Depth carries the same share of that shrink throughout; the sheet itself the rest.
	const share = start > 1 ? Math.log(Math.min(start, TITLE_CARRY.near)) / Math.log(start) : 1;
	const near = apparent ** share;
	const own = apparent / near;
	const shape = smooth(0.05, 0.7, x);
	const width = lerp(from.width / start, gap.width, shape) * own;
	const height = lerp(from.height / start, gap.height, shape) * own;
	const turn = heldTurn(carry, at);
	const z = distance * (1 - 1 / near);
	// Hang it off his grip: the grip's point where his tip is seen, at the grip's own depth.
	const grip = gripOffset({ width, height });
	const offset = sheetPoint(turn, grip.x, grip.y);
	const tip = dragTip(carry, at);
	const scale = distance / Math.max(1, distance - (z + offset.z));
	const centre = { x: viewport.width / 2, y: viewport.height / 2 };
	const held: FinaleCardPose = {
		...flatPose(from, 0),
		x: centre.x + (tip.x - centre.x) / scale - offset.x,
		y: centre.y + (tip.y - centre.y) / scale - offset.y,
		z,
		width,
		height,
		...turn,
		lift: 1,
	};
	const fall = EASE.inOut(progress(at, titleSetDownStart(), touchdown));
	if (fall <= 0) return held;
	const pose = blendPose(held, flatPose(gap, 0), fall);
	return { ...pose, lift: 1 - fall, waveAge: landingWaveAge(time, touchdown) };
}

/**
 * The title as it is drawn from the grab to touchdown: out of its flip into
 * his hand over the pickup (the two seen alike, so it gives itself over
 * without a jump), then wholly held.
 */
export function titleCarriedPose(carry: TitleCarry, time: number): FinaleCardPose {
	const held = titleHeldPose(carry, time);
	const into = titlePickup(time);
	return into >= 1 ? held : blendPose(carry.flipAt(time), held, into);
}

/**
 * MCB's cursor, or null while it is off: it glides in from his side as the
 * black face comes up, fading in, and presses on the card's grip as he takes
 * it; rides that grip, pressed, through the drag; lets go as the card
 * touches down, and lifts off up and away, fading. Its perspective is the
 * held card's: larger near the lens, the wall's own once it is down.
 */
export function titleCarrierAt(carry: TitleCarry, time: number): TitleCarrier | null {
	const reach = titleReachTime();
	const grab = titleGrabTime();
	const touchdown = titleTouchdownTime();
	if (time < reach || time > titleCarrierGoneTime()) return null;
	const { pressS } = TITLE_CARRY;
	const pressed = smooth(grab - pressS, grab, time) * (1 - smooth(touchdown, touchdown + pressS, time));
	const h = carry.viewport.height;
	if (time < grab) {
		const target = titleGripOnScreen(carry.flipAt(time), carry.viewport);
		const home = gripOn(carry.from);
		const from = { x: home.x + TITLE_CARRY.reachFrom.x * h, y: home.y + TITLE_CARRY.reachFrom.y * h };
		// He arrives as he presses, slowing onto the grip, rather than waiting on it.
		const along = smooth(reach, grab, time);
		const scale = titleGripOnScreen(titleHeldPose(carry, grab), carry.viewport).scale;
		return { x: lerp(from.x, target.x, along), y: lerp(from.y, target.y, along), scale, pressed, opacity: smooth(reach, reach + 0.2, time) };
	}
	if (time <= touchdown) {
		const seen = titleGripOnScreen(titleCarriedPose(carry, time), carry.viewport);
		return { x: seen.x, y: seen.y, scale: titleGripOnScreen(titleHeldPose(carry, time), carry.viewport).scale, pressed, opacity: 1 };
	}
	const grip = gripOn(carry.gapAt(time));
	const away = smooth(touchdown + pressS * 0.5, titleCarrierGoneTime(), time);
	return { x: grip.x + TITLE_CARRY.leave.x * h * away, y: grip.y + TITLE_CARRY.leave.y * h * away, scale: 1, pressed, opacity: 1 - away };
}
