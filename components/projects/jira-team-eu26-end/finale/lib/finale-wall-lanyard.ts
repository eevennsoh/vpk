import { WALL_CUE } from "../data/finale-cues";
import { hash01, lerp } from "./finale-math";
import type { WallGeometry, WallSlot } from "./finale-wall-layout";
import { wallSlotRevealTime, wallTimeAt } from "./finale-wall-motion";

/*
 * The mega bento's lanyard tiles: the 3D Lanyard block, played on the finale
 * clock. Each tile hangs from the top of the frame (the strap is cut straight
 * at the tile's top, so that cut is always the frame's edge) and glides in
 * with the wall rather than flying in. Once it is in the frame its lanyard
 * drops in from the top edge, catches and swings out, then hangs still until
 * the wall carries it off: one drop per tile. The next lanyard is the next
 * tile along, dealt from the wall's endless run of them (`order`), so each new
 * one differs from the last in presenter, agent, swing and reveal, every pass
 * of the loop deals afresh, and a scrubbed or held clock shows the same drop.
 */

export const WALL_LANYARD = {
	/** A tile drops once this share of its width has glided into the frame (each its own, in this range)… */
	enterShown: [0.6, 0.95],
	/** …but one already in the frame as the wall appears waits for MCB to set the title down… */
	afterCarryS: 0.6,
	/** …and a little more, its own share of this, so no two drop together. */
	scatterS: 1.6,
	/**
	 * The block's Swing for a drop: one of these, from a gentle drop to a
	 * lively one. Each needs its physics simulated (a long task), so there are
	 * three, as many as the renderer keeps, all simulated off the main thread
	 * before a tile draws (`primeLanyardPhysics`).
	 */
	swings: [1, 1.3, 1.55],
	/** The block's Initial reveal, in degrees: anywhere in this range (it needs no physics of its own). */
	reveal: [10, 26],
	/**
	 * The renderer's supersampling (2 by default). Measured on the wall: at 2
	 * the tile's GL fill kept the glide ~15% under its rate without a lanyard;
	 * 1.5 matches that rate and is indistinguishable at a tile's size.
	 */
	supersampling: 1.5,
} as const;

/** The stage is framed for the liveliest swing, so the card keeps one size whichever a drop has. */
export const WALL_LANYARD_FRAMING_SWING = Math.max(...WALL_LANYARD.swings);

export interface WallLanyardDeal {
	/** Index into the presenters. */
	readonly person: number;
	/** Index into the agents. */
	readonly agent: number;
	/** One of `WALL_LANYARD.swings`. */
	readonly swing: number;
	/** Degrees, in `WALL_LANYARD.reveal`. */
	readonly revealAngle: number;
}

/**
 * When a lanyard tile drops: once most of it has glided into the frame from
 * the right, so every tile opens on its drop. One in the frame as the wall
 * appears waits until it has faded up and MCB has set the title down, so it
 * never competes with the throw.
 */
export function wallLanyardDropTime(slot: WallSlot, geometry: WallGeometry): number {
	const settled = WALL_CUE.start + WALL_CUE.carryDownAt + WALL_LANYARD.afterCarryS;
	const [least, most] = WALL_LANYARD.enterShown;
	const shown = lerp(least, most, hash01(slot.seed * 0.53 + 0.2));
	const entered = wallTimeAt(slot.rect.x + geometry.originX + slot.rect.width * shown - geometry.viewport.width, geometry);
	if (entered > settled) return entered;
	return Math.max(wallSlotRevealTime(slot, geometry), settled) + hash01(slot.seed * 0.71 + 0.6) * WALL_LANYARD.scatterS;
}

/** The lanyard renderer's time at `time`: through its one drop and swing, then held on its still end; null before it drops. */
export function wallLanyardTime(time: number, dropTime: number, duration: number): number | null {
	const since = time - dropTime;
	return since < 0 ? null : Math.min(since, duration);
}

/** `count` indices in an order fixed by `seed` (Fisher–Yates on `hash01`). */
function shuffled(seed: number, count: number): number[] {
	const order = Array.from({ length: count }, (_, index) => index);
	for (let index = count - 1; index > 0; index -= 1) {
		const swap = Math.floor(hash01(seed * 3.17 + index * 0.71) * (index + 1));
		[order[index], order[swap]] = [order[swap], order[index]];
	}
	return order;
}

/**
 * Choice `order` (any integer) of a run through `count` choices, at least
 * three, in shuffled rounds: each round uses every choice once, and a round
 * never opens on the choice the one before closed on, so no choice repeats
 * back to back. (Only a round's first two ever swap, so its last stays the
 * shuffle's own.)
 */
function dealt(order: number, count: number, seed: number): number {
	const round = Math.floor(order / count);
	const choices = shuffled(seed + round * 7.31, count);
	if (choices[0] === shuffled(seed + (round - 1) * 7.31, count)[count - 1]) [choices[0], choices[1]] = [choices[1], choices[0]];
	return choices[order - round * count];
}

/**
 * The lanyard tile `order` along the wall: who wears it, which agent hangs
 * behind and which swing it falls with, each a run of its own, so the next
 * tile never repeats any of them; and how far its cards fan open.
 */
export function wallLanyardDeal(order: number, people: number, agents: number): WallLanyardDeal {
	const { swings, reveal } = WALL_LANYARD;
	return {
		person: dealt(order, people, 0.137),
		agent: dealt(order, agents, 0.641),
		swing: swings[dealt(order, swings.length, 0.389)],
		revealAngle: lerp(reveal[0], reveal[1], hash01(order * 0.83 + 0.4)),
	};
}
