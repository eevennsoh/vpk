import { lerp } from "@/lib/utils";

// The choreography: one repeating cycle that assembles the teamwork graph,
// collapses it into the Rovo mark, settles the camera square-on, extrudes the
// mark's facets in turn, and fades out before repeating.
//
// This is the piece's director. It owns every channel that changes over the
// cycle — form, camera, per-facet extrude, opacity — and hands the sketch a
// plain snapshot for a given moment. Keeping it a pure function of elapsed
// seconds means the transport can play, pause, restart, and scrub by doing
// nothing more than choosing what to pass in, and the whole arrangement is
// testable without a canvas.
//
// Dependency-free so it runs under Node's strip-types test runner.

export type RovoP5StageId =
	| "assemble"
	| "orbit"
	| "whip"
	| "land"
	| "extrude"
	| "whole"
	| "fade";

export interface RovoP5Stage {
	readonly id: RovoP5StageId;
	readonly label: string;
	readonly seconds: number;
}

/**
 * Stage order and durations. The graph builds fast — it is the setup, not the
 * payoff — and the mark gets the longer, calmer beats. The whole loop is kept
 * tight enough to watch end to end without the scrubber.
 */
export const ROVO_P5_STAGES: readonly RovoP5Stage[] = [
	{ id: "assemble", label: "Building context", seconds: 3.4 },
	{ id: "orbit", label: "Teamwork graph", seconds: 1.8 },
	// One violent move rather than a gentle converge then a separate settle:
	// the graph is whipped around and lands square-on as the mark, straight
	// into the facet sequence.
	{ id: "whip", label: "Converging", seconds: 2.8 },
	// A beat on the finished mark before anything moves again, so the arrival
	// registers instead of being stepped on by the facet sequence.
	{ id: "land", label: "Rovo mark", seconds: 0.9 },
	{ id: "extrude", label: "Unfolding facets", seconds: 4.2 },
	{ id: "whole", label: "Rovo", seconds: 1.1 },
	{ id: "fade", label: "…", seconds: 1 },
];

export const ROVO_P5_CYCLE_SECONDS = ROVO_P5_STAGES.reduce(
	(total, stage) => total + stage.seconds,
	0,
);

/** Facet count the director staggers over; matches the mark's four faces. */
export const ROVO_P5_FACET_COUNT = 4;

/**
 * Facet indices in clockwise screen order, starting at the top: orange (top),
 * purple (right), green (bottom), blue (left). The sampler numbers them in
 * painter order, which is not the order they should unfold in.
 */
export const ROVO_P5_FACET_CLOCKWISE: readonly number[] = [0, 2, 3, 1];

/** Position of each facet in that clockwise sequence, keyed by facet index. */
const FACET_SLOT: readonly number[] = (() => {
	const slots = new Array<number>(ROVO_P5_FACET_COUNT).fill(0);
	ROVO_P5_FACET_CLOCKWISE.forEach((facet, slot) => {
		slots[facet] = slot;
	});
	return slots;
})();

/** Camera yaw accumulated per second while the graph is on screen. */
const SPIN_RATE = 0.34;

/** Extra turns the whip adds on its way to square-on. */
const WHIP_TURNS = 0.85;

/**
 * Peak tilt thrown during the whip, in radians. The throw is damped by both
 * `sin(pi * local)` and `(1 - local)`, and the drift it is unwinding from can
 * be pulling the other way, so the tilt actually reached is a little over half
 * this. It has to clear `TILT_AMPLITUDE` by a margin to read as a throw rather
 * than as more of the idle drift.
 */
const WHIP_TILT = 0.66;

/** How far a facet dims while another is the one being raised. */
const FACET_DIM = 0.28;

/** Peak tilt of the drifting camera, in radians. */
const TILT_AMPLITUDE = 0.34;

/** Tilt oscillations per second. */
const TILT_RATE = 0.17;

/** Perspective while orbiting the graph, and once square-on to the mark. */
const GRAPH_PERSPECTIVE = 1;
const MARK_PERSPECTIVE = 0.28;


/** Cube half-size while the graph shows, and when the mark lies flat. */
const GRAPH_EXTRUDE = 0.4;
const FLAT_EXTRUDE = 0.012;

/** How far a facet is raised at the top of its solo, 0..1. */
const FACET_LIFT_PEAK = 1;

/** Share of the extrude stage spent raising facets; the rest lowers them. */
const RISE_SHARE = 0.74;

/**
 * Facet timing, in rise-phase units. The rise is far longer than the gap
 * between starts, so two or three facets are always in motion — a facet that
 * finishes and then waits its turn is what made the sequence read as stepping.
 */
const FACET_RISE_SPACING = 0.18;
const FACET_RISE_DURATION = 0.44;

/** The settle is staggered in the same order, so it leaves as a wave too. */
const FACET_FALL_SPACING = 0.1;
const FACET_FALL_DURATION = 0.7;

/**
 * How lit a facet stays once it has finished rising. It is still nearer the
 * camera than the flat ones, so it should not drop all the way back — but it
 * has to give way to whichever facet is currently moving.
 */
const EMPHASIS_RAISED_HOLD = 0.55;

/** Rise-phase over which the dimming lets go, so it rejoins the settle cleanly. */
const EMPHASIS_RELEASE = 0.15;

/**
 * Rise-phase over which the dimming comes in. Without it the facets dropped
 * from full brightness to dimmed on the stage's first frame — a hard cut that
 * was the most visible part of the hand-off from the held mark.
 */
const EMPHASIS_ONSET = 0.3;

export interface RovoP5Direction {
	readonly stage: RovoP5StageId;
	readonly label: string;
	/** 0 = the Rovo mark, 1 = the teamwork graph. */
	readonly form: number;
	/** How much of the graph has accreted, 0..1. */
	readonly growth: number;
	/** Absolute camera yaw and pitch offsets, in radians. */
	readonly spin: number;
	readonly tilt: number;
	readonly perspective: number;
	/** Cube half-size. The mark lies flat; the graph inflates it into a solid. */
	readonly extrude: number;
	/**
	 * How far each facet is raised toward the viewer, 0..1, staggered during the
	 * extrude stage. Kept separate from `extrude` because raising a facet by
	 * growing the cube moves each face along its own normal, which is toward the
	 * camera for some faces and away for others.
	 */
	readonly lift: readonly number[];
	/**
	 * Brightness per facet, 0..1. The facet being raised is closest to the
	 * camera, so the others drop back rather than competing with it.
	 */
	readonly emphasis: readonly number[];
	/** Multiplier on the link lines, so they leave before the mark arrives. */
	readonly linkOpacity: number;
	/** Global fade, for the hand-off between cycles. */
	readonly opacity: number;
	/** 0..1 through the whole cycle, for the transport's scrubber. */
	readonly progress: number;
}

function clamp01(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Smoothstep. Every ramp here uses it so nothing starts or stops abruptly. */
function ease(value: number): number {
	const t = clamp01(value);
	return t * t * (3 - 2 * t);
}

/**
 * Smoothstep with a slight overshoot before it settles. A facet that eases
 * exactly to its peak and stops dead reads as mechanical; a touch of follow-
 * through reads as weight.
 *
 * The overshoot is weighted in by the smoothstep itself. A bare back-out curve
 * has a steep non-zero slope at t=0, so the first facet snapped into motion the
 * instant the stage began — the same stall-then-lurch class of seam as the
 * whip, just in the other direction. Weighting it leaves the start at rest and
 * keeps the follow-through where it belongs, at the end.
 */
function easeOvershoot(value: number): number {
	const t = clamp01(value);
	const smooth = ease(t);
	const back = 0.9;
	const p = t - 1;
	const overshot = 1 + (back + 1) * p * p * p + back * p * p;
	return smooth + (overshot - smooth) * smooth;
}

interface StageWindow {
	readonly index: number;
	readonly id: RovoP5StageId;
	readonly label: string;
	/** Progress through this stage, 0..1. */
	readonly local: number;
	/** Seconds from the start of the cycle to the start of this stage. */
	readonly startedAt: number;
}

function locate(elapsedSeconds: number): StageWindow {
	const cycle = ROVO_P5_CYCLE_SECONDS;
	const wrapped = ((elapsedSeconds % cycle) + cycle) % cycle;

	let startedAt = 0;
	for (let index = 0; index < ROVO_P5_STAGES.length; index++) {
		const stage = ROVO_P5_STAGES[index];
		if (wrapped < startedAt + stage.seconds || index === ROVO_P5_STAGES.length - 1) {
			return {
				index,
				id: stage.id,
				label: stage.label,
				local: clamp01((wrapped - startedAt) / stage.seconds),
				startedAt,
			};
		}
		startedAt += stage.seconds;
	}

	const last = ROVO_P5_STAGES[ROVO_P5_STAGES.length - 1];
	return { index: ROVO_P5_STAGES.length - 1, id: last.id, label: last.label, local: 1, startedAt };
}

/** Yaw banked by the end of the orbit, which the whip has to unwind. */
const SPIN_SECONDS = ROVO_P5_STAGES.filter(
	(stage) => stage.id === "assemble" || stage.id === "orbit",
).reduce((total, stage) => total + stage.seconds, 0);

function spinAt(window: StageWindow): number {
	if (window.id === "assemble" || window.id === "orbit") {
		const stage = ROVO_P5_STAGES[window.index];
		return SPIN_RATE * (window.startedAt + window.local * stage.seconds);
	}

	if (window.id === "whip") {
		// Land on an exact whole number of turns past square-on, so the mark
		// always faces the camera when it arrives.
		const banked = SPIN_RATE * SPIN_SECONDS;
		const target = Math.ceil(banked / (Math.PI * 2) + WHIP_TURNS) * Math.PI * 2;

		// Quintic Hermite. A cubic matches position and velocity, which stopped
		// the camera stalling at the seam, but it says nothing about
		// acceleration — the whip opened at 7.7 rad/s² against the orbit's zero,
		// and that instant onset is what still read as a burst of speed. The
		// quintic pins acceleration to zero at both ends as well, so the spin
		// builds out of the orbit and eases to rest.
		const seconds = ROVO_P5_STAGES[window.index].seconds;
		const t = window.local;
		const t3 = t * t * t;
		const t4 = t3 * t;
		const t5 = t4 * t;
		const startSlope = SPIN_RATE * seconds;
		return (
			banked * (1 - 10 * t3 + 15 * t4 - 6 * t5) +
			startSlope * (t - 6 * t3 + 8 * t4 - 3 * t5) +
			target * (10 * t3 - 15 * t4 + 6 * t5)
		);
	}

	return 0;
}

function tiltAt(window: StageWindow): number {
	const drift = (seconds: number) => TILT_AMPLITUDE * Math.sin(seconds * TILT_RATE * Math.PI * 2);

	if (window.id === "assemble" || window.id === "orbit") {
		const stage = ROVO_P5_STAGES[window.index];
		return drift(window.startedAt + window.local * stage.seconds);
	}

	if (window.id === "whip") {
		const seconds = ROVO_P5_STAGES[window.index].seconds;
		// Let the drift keep running and fade its influence out, rather than
		// freezing its value at the seam. Freezing stopped the tilt dead — the
		// orbit hands over at 0.27 rad/s and the frozen form went to zero — and
		// the throw then snapped in on top of that stop.
		const settling = drift(SPIN_SECONDS + window.local * seconds) * (1 - ease(window.local));
		// Squared, so the throw leaves the orbit at zero slope rather than at
		// full tilt-rate. It still returns to level exactly as the stage ends.
		const swing = Math.sin(window.local * Math.PI) ** 2;
		return settling + WHIP_TILT * swing;
	}

	return 0;
}

/**
 * Raw rise progress per facet, before easing: below 0 it has not started, above
 * 1 it has arrived.
 *
 * Both the lift and the brightness read from this. They used to keep separate
 * schedules — the lift stepping by slot, the brightness sweeping a kernel over
 * the same span — and the two drifted by up to three quarters of a second, so
 * a facet could be fully dimmed at the exact moment it was most raised and the
 * last one got no emphasis at all. That mismatch read as a pause before the
 * final facet, because nothing marked its arrival.
 */
function riseProgressAt(risePhase: number): number[] {
	return Array.from(
		{ length: ROVO_P5_FACET_COUNT },
		(_, facet) => (risePhase - FACET_SLOT[facet] * FACET_RISE_SPACING) / FACET_RISE_DURATION,
	);
}

/**
 * Brightness per facet. Only the extrude stage dims anything: the facet being
 * raised is nearest the camera, so pulling the others back is what makes the
 * depth read rather than four equally bright faces competing.
 *
 * Attention peaks mid-move and hands over to the next facet, while one that has
 * already arrived holds a middle brightness. The whole effect fades in and out
 * so neither seam steps.
 */
function emphasisAt(window: StageWindow): number[] {
	const full = new Array<number>(ROVO_P5_FACET_COUNT).fill(1);
	if (window.id !== "extrude" || window.local >= RISE_SHARE) return full;

	const risePhase = window.local / RISE_SHARE;
	// Fade the dimming in as well as out, so neither seam steps.
	const release =
		ease(clamp01(risePhase / EMPHASIS_ONSET)) *
		ease(clamp01((1 - risePhase) / EMPHASIS_RELEASE));
	const progress = riseProgressAt(risePhase);

	return full.map((_, facet) => {
		const raw = progress[facet];
		// A half-sine over the facet's own move: nothing before it starts, peak
		// as it travels, handed on once it arrives.
		const moving = raw <= 0 || raw >= 1 ? 0 : Math.sin(Math.PI * raw);
		const arrived = ease(clamp01(raw)) * EMPHASIS_RAISED_HOLD;
		const lit = lerp(FACET_DIM, 1, Math.max(moving, arrived));
		return 1 - (1 - lit) * release;
	});
}

/** Cube half-size. Only the graph inflates the mark into a solid. */
function extrudeAt(window: StageWindow): number {
	if (window.id === "assemble" || window.id === "orbit") return GRAPH_EXTRUDE;
	// Flatten across the whip, so the mark lands as the flat logo and the facet
	// sequence starts from a clean shape.
	if (window.id === "whip") return lerp(GRAPH_EXTRUDE, FLAT_EXTRUDE, ease(window.local));
	return FLAT_EXTRUDE;
}

/**
 * How far each facet is raised toward the viewer, 0..1. Shares its schedule
 * with the brightness through `riseProgressAt`, so the spotlight cannot drift
 * out of step with the movement it is meant to be marking.
 */
function liftAt(window: StageWindow): number[] {
	const down = new Array<number>(ROVO_P5_FACET_COUNT).fill(0);
	if (window.id !== "extrude") return down;

	if (window.local >= RISE_SHARE) {
		// Staggered out in the same order rather than dropped together, which was
		// an abrupt reversal right after the last facet had arrived.
		const fall = (window.local - RISE_SHARE) / (1 - RISE_SHARE);
		return down.map((_, facet) =>
			lerp(
				FACET_LIFT_PEAK,
				0,
				ease((fall - FACET_SLOT[facet] * FACET_FALL_SPACING) / FACET_FALL_DURATION),
			),
		);
	}

	const progress = riseProgressAt(window.local / RISE_SHARE);
	return down.map((_, facet) => FACET_LIFT_PEAK * easeOvershoot(progress[facet]));
}

export function directRovoP5(elapsedSeconds: number): RovoP5Direction {
	const window = locate(elapsedSeconds);
	const cycle = ROVO_P5_CYCLE_SECONDS;
	const wrapped = ((elapsedSeconds % cycle) + cycle) % cycle;

	// The whip carries the collapse: the graph is thrown around and arrives as
	// the mark in the same move. The form trails the camera slightly so the
	// particles are still travelling as the spin settles.
	const form =
		window.id === "assemble" || window.id === "orbit"
			? 1
			: window.id === "whip"
				? 1 - ease(clamp01((window.local - 0.12) / 0.88))
				: 0;

	const growth = window.id === "assemble" ? ease(window.local) : 1;

	// Links lead the collapse out, so the mark is not fighting a web of lines
	// on its way in.
	const linkOpacity =
		window.id === "assemble" || window.id === "orbit"
			? 1
			: window.id === "whip"
				? 1 - ease(Math.min(1, window.local * 1.6))
				: 0;

	// The whip arrives on the clean square-on mark and the perspective then
	// holds. It used to open for the facet sequence and close again, which
	// rescaled the entire mark and read as a wobble as the facets settled; the
	// lift now advances along the view ray, so it reads without any help.
	const perspective =
		window.id === "assemble" || window.id === "orbit"
			? GRAPH_PERSPECTIVE
			: window.id === "whip"
				? lerp(GRAPH_PERSPECTIVE, MARK_PERSPECTIVE, ease(window.local))
				: MARK_PERSPECTIVE;

	// One fade covers both ends of the loop: out across the last stage, back in
	// over the opening moment of the next.
	const fadeIn = ease(Math.min(1, wrapped / 0.9));
	const fadeOut = window.id === "fade" ? 1 - ease(window.local) : 1;

	return {
		stage: window.id,
		label: window.label,
		form,
		growth,
		spin: spinAt(window),
		tilt: tiltAt(window),
		perspective,
		extrude: extrudeAt(window),
		lift: liftAt(window),
		emphasis: emphasisAt(window),
		linkOpacity,
		opacity: Math.min(fadeIn, fadeOut),
		progress: wrapped / cycle,
	};
}
