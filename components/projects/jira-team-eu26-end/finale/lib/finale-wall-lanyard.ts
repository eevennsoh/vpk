import { WALL_CUE } from "../data/finale-cues";
import { EASE, hash01, lerp, progress } from "./finale-math";
import type { WallGeometry, WallSlot } from "./finale-wall-layout";
import { wallSlotRevealTime, wallTimeAt } from "./finale-wall-motion";

/*
 * The mega bento's lanyard tiles: the 3D Lanyard block, played on the finale
 * clock. Each tile hangs from the top of the frame (the strap is cut straight
 * at the tile's top, so that cut is always the frame's edge) and glides in
 * with the wall rather than flying in. It drops a presenter's lanyard in from
 * the top edge once it is in the frame, lets it
 * catch and swing out, holds it still a beat, reels it back up out of the top,
 * and drops the next. Every drop is dealt afresh (who wears it, which agent
 * hangs behind, how hard it swings and how far its cards fan open) from
 * shuffles seeded by the tile and its copy of the period, so nothing repeats
 * back to back, each pass of the loop differs, and a scrubbed or held clock
 * shows the same drop every time.
 */

export const WALL_LANYARD = {
	/** Held still once its swing has died, before it is reeled up. */
	holdS: 1,
	/** Reeled up out of the tile's top, as an exit. */
	liftS: 0.7,
	/** The tile stands empty this long before the next drops. */
	restS: 0.45,
	/** A tile drops its first once this share of its width has glided into the frame (each its own, in this range)… */
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

export interface WallLanyardFrame {
	/** Which drop of the tile this is, from 0. */
	readonly drop: number;
	/** The lanyard renderer's time: through its drop and swing, then held on its still end. */
	readonly time: number;
	/** 0 hanging → 1 reeled up out of the tile. */
	readonly lift: number;
}

export interface WallLanyardDrop {
	/** Index into the presenters. */
	readonly person: number;
	/** Index into the agents. */
	readonly agent: number;
	/** One of `WALL_LANYARD.swings`. */
	readonly swing: number;
	/** Degrees, in `WALL_LANYARD.reveal`. */
	readonly revealAngle: number;
}

/** Seconds from one drop to the next, for a renderer whose drop and swing last `duration`. */
export function wallLanyardCycle(duration: number): number {
	return duration + WALL_LANYARD.holdS + WALL_LANYARD.liftS + WALL_LANYARD.restS;
}

/**
 * When a lanyard tile drops its first: once most of it has glided into the
 * frame from the right, so every pass of the loop opens on a fresh drop. One
 * in the frame as the wall appears waits until it has faded up and MCB has
 * set the title down, so it never competes with the throw.
 */
export function wallLanyardFirstDrop(slot: WallSlot, geometry: WallGeometry): number {
	const settled = WALL_CUE.start + WALL_CUE.carryDownAt + WALL_LANYARD.afterCarryS;
	const [least, most] = WALL_LANYARD.enterShown;
	const shown = lerp(least, most, hash01(slot.seed * 0.53 + 0.2));
	const entered = wallTimeAt(slot.rect.x + geometry.originX + slot.rect.width * shown - geometry.viewport.width, geometry);
	if (entered > settled) return entered;
	return Math.max(wallSlotRevealTime(slot, geometry), settled) + hash01(slot.seed * 0.71 + 0.6) * WALL_LANYARD.scatterS;
}

/** A lanyard tile at `time`: the drop it shows and how far through it, or null while the tile stands empty. */
export function wallLanyardFrame(time: number, firstDrop: number, duration: number): WallLanyardFrame | null {
	const since = time - firstDrop;
	if (since < 0) return null;
	const cycle = wallLanyardCycle(duration);
	const drop = Math.floor(since / cycle);
	const into = since - drop * cycle;
	const liftAt = duration + WALL_LANYARD.holdS;
	if (into >= liftAt + WALL_LANYARD.liftS) return null;
	return { drop, time: Math.min(into, duration), lift: EASE.in(progress(into, liftAt, liftAt + WALL_LANYARD.liftS)) };
}

/** `count` indices in an order fixed by `seed` (Fisher–Yates on `hash01`). */
function shuffled(seed: number, count: number): readonly number[] {
	const order = Array.from({ length: count }, (_, index) => index);
	for (let index = count - 1; index > 0; index -= 1) {
		const swap = Math.floor(hash01(seed * 3.17 + index * 0.71) * (index + 1));
		[order[index], order[swap]] = [order[swap], order[index]];
	}
	return order;
}

/**
 * A tile's drop `drop`. Who wears it, which agent hangs behind and which swing
 * it falls with each walk a shuffle of their own, seeded by the tile and its
 * copy of the period (`bucket`): none repeats back to back, and every pass of
 * the loop deals afresh. Its cards fan open by an angle of its own.
 */
export function wallLanyardDrop(slot: Pick<WallSlot, "seed" | "bucket">, drop: number, people: number, agents: number): WallLanyardDrop {
	const seed = slot.seed * 0.137 + slot.bucket * 1.618;
	const { swings, reveal } = WALL_LANYARD;
	return {
		person: shuffled(seed, people)[drop % people],
		agent: shuffled(seed + 0.5, agents)[drop % agents],
		swing: swings[shuffled(seed + 0.25, swings.length)[drop % swings.length]],
		revealAngle: lerp(reveal[0], reveal[1], hash01(seed * 1.91 + drop * 0.83 + 0.4)),
	};
}
