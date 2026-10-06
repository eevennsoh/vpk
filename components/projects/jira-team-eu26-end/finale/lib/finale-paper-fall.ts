import { hash01, lerp, smoothstep as smooth } from "./finale-math";

/*
 * How a sheet of paper falls through air, as a pure function of how far
 * through its fall it is (0 → 1): the mega bento's thrown cards and the
 * arrivals that come down at its leading edge (`finale-wall-motion.ts`).
 *
 * Air pushes back hardest on a sheet broadside on, so a falling sheet only
 * ever turns about an axis lying in its own plane: end over end, or side over
 * side as a page turns. It is never spun flat like a dial. It sails at first,
 * leaning a little into the way it will turn, until the air gets under its
 * leading edge and it goes over: a whole turn, quickest as it passes its
 * back, so its blank side only flashes by. Then the air catches it nearly
 * flat and it rocks, as a falling leaf does: each swing smaller, gliding
 * toward its low edge and pitching up as it stalls at the end of each, until
 * it lies flat, at rest, as it lands. Off its turn's axis it only wobbles.
 */

const TAU = Math.PI * 2;

/** Its own axis a sheet turns about: x end over end, y side over side. */
export type PaperAxis = "x" | "y";

export interface PaperFall {
	readonly axis: PaperAxis;
	/** Whole turns it goes over through, at least one; the sign is the way it turns, as `rotateX` / `rotateY` count it. */
	readonly turns: number;
	/** When it goes over, in shares of the fall: from the first, caught flat again by the second; it sails before and rocks after. */
	readonly over: readonly [number, number];
	/** How far it leans into its turn as it sails, radians (0: it goes over from rest). */
	readonly lean: number;
	/** How far its first swing carries it past flat, radians. */
	readonly rock: number;
	/** The swings it rocks through, one each way, before it lands. */
	readonly swings: number;
	/** How far it wobbles about its other axis at most, radians, and where in its wobble it starts. */
	readonly wobble: number;
	readonly phase: number;
}

export interface PaperAttitude {
	readonly rotateX: number;
	readonly rotateY: number;
	/** Its falling-leaf glide toward its low edge, as shares of its own width and height (screen x right, y down). */
	readonly glideX: number;
	readonly glideY: number;
}

/** How far each swing's glide carries it, in shares of its size per radian of the swing. */
const GLIDE = 0.3;
/** How quickly the air takes the swings out of it. */
const ROCK_DAMPING = 1.1;
/** Where in its rocking the air starts to lay it flat for good, so it lands at rest. */
const SETTLE_FROM = 0.5;
/** How fast its lean is growing as it starts to go over, over the lean's average pace. */
const LEAN_INTO = 2;

/** An angle as the turn it shows, in (−π, π]: a whole turn on lies the same way. */
function shown(angle: number): number {
	return angle - TAU * Math.round(angle / TAU);
}

/**
 * A cubic from 0 to 1 over `s` (0 → 1) that leaves at `from` times its
 * average pace and arrives at `to` times it. Monotonic while from² + to² ≤ 9.
 */
function hermite(s: number, from: number, to: number): number {
	const s2 = s * s;
	const s3 = s2 * s;
	return (s3 - 2 * s2 + s) * from + (3 * s2 - 2 * s3) + (s3 - s2) * to;
}

/** Its rock by `r` of its rocking (0 → 1): each swing smaller, laid flat and still by the end. */
function rocked(fall: PaperFall, r: number): number {
	const fade = Math.exp(-ROCK_DAMPING * r) * (1 - smooth(SETTLE_FROM, 1, r));
	return fall.rock * fade * Math.sin(Math.PI * fall.swings * r);
}

/**
 * A falling sheet's attitude `u` of the way down. It leaves exactly flat and
 * lands exactly flat, still turning neither way; each stretch hands over at
 * the pace the next starts at, so it never jerks; and every turn is shown as
 * the sheet lies (in (−π, π]), so a pose blend never unwinds it.
 */
export function paperAttitude(fall: PaperFall, u: number): PaperAttitude {
	const way = Math.sign(fall.turns);
	const [overFrom, overTo] = fall.over;
	const sweep = TAU * Math.abs(fall.turns) - fall.lean;
	const overSpan = overTo - overFrom;
	const rocking = 1 - overTo;
	// Paces in turn per share of the fall: leaning into it as it starts to go over, and its rock's first as it is caught.
	const leaning = overFrom > 0 ? (fall.lean * LEAN_INTO) / overFrom : 0;
	const caught = (fall.rock * Math.PI * fall.swings) / rocking;
	let turn: number;
	let swing = 0;
	if (u < overFrom) {
		turn = fall.lean * hermite(u / overFrom, 0, LEAN_INTO);
	} else if (u <= overTo) {
		turn = fall.lean + sweep * hermite((u - overFrom) / overSpan, (leaning * overSpan) / sweep, (caught * overSpan) / sweep);
	} else {
		const r = Math.min(1, (u - overTo) / rocking);
		swing = rocked(fall, r);
		turn = fall.lean + sweep + swing;
		// It glides only once it rocks, easing in so its path never kinks as it is caught.
		swing *= smooth(0, 0.3, r);
	}
	const across = fall.wobble * Math.sin(Math.PI * u) ** 2 * Math.sin(TAU * 1.5 * u + fall.phase);
	const main = shown(way * turn);
	// At each swing's end its leading edge pitches up as it stalls: it has glided the other way from its tilt.
	const glide = -GLIDE * way * swing;
	return fall.axis === "x"
		? { rotateX: main, rotateY: across, glideX: 0, glideY: glide }
		: { rotateX: across, rotateY: main, glideX: glide, glideY: 0 };
}

/**
 * When a thrown card goes over, in seconds from its launch: the first soon
 * after leaving the hand, each of the others `apartS` after the one before,
 * in landing order, each taking `spanS`. Its blank back faces the lens for
 * about the middle third of that, so no more than two show at once, and the
 * last is face up again with time to rock before it comes down.
 */
const THROWN_OVER = { firstS: 0.05, apartS: 0.1, spanS: 0.36 } as const;

export interface PaperThrow {
	readonly seed: number;
	/** From where it leaves the hand to where it lands, screen px. */
	readonly travel: { readonly x: number; readonly y: number };
	/** Seconds from leaving the hand to touching down. */
	readonly flight: number;
	/** Its place in the landing order, first down first. */
	readonly rank: number;
}

/**
 * How a thrown card falls: about whichever of its own axes lies across its
 * travel, end over end when it is thrown up or down the frame and side over
 * side when across it, going over once, the way its leading edge lifts toward
 * the lens, at its own moment (`THROWN_OVER`).
 */
export function thrownPaperFall({ seed, travel, flight, rank }: PaperThrow): PaperFall {
	const across = Math.abs(travel.x) >= Math.abs(travel.y);
	const from = (THROWN_OVER.firstS + rank * THROWN_OVER.apartS) / flight;
	return {
		axis: across ? "y" : "x",
		// Leading edge up: a y turn lifts the right edge as it goes negative, an x turn the top edge as it goes positive.
		turns: -Math.sign((across ? travel.x : travel.y) || 1),
		over: [from, from + THROWN_OVER.spanS / flight],
		lean: lerp(0.25, 0.4, hash01(seed * 3.7)),
		rock: lerp(0.32, 0.5, hash01(seed * 4.9)),
		swings: lerp(2, 2.6, hash01(seed * 6.1)),
		wobble: lerp(0.1, 0.2, hash01(seed * 9.7)),
		phase: hash01(seed * 8.3) * TAU,
	};
}
