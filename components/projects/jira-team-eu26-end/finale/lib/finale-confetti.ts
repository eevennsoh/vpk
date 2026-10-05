/**
 * Confetti for the moment the last keynote card lands in Done, and the bridge
 * into the column flash that follows it (`finale-column-flash.ts`).
 *
 * Three acts, each a pure function of show seconds since launch. The show's
 * clock runs at its own pace (`FINALE_CONFETTI_PACE`): the pop explodes fast,
 * the hang drops into bullet time, and the gather rushes in.
 * 1. Pop: two cannons at the viewport's lower corners fire a broad diagonal
 *    fan of 3D paper (a Rovo hue on each face), iridescent sequins whose film
 *    runs through the Rovo gradient, and curled satin ribbons. A few fly past
 *    the lens, out of focus.
 * 2. Hang: drag spends the launch; pieces flutter and tumble near the apex,
 *    catching the key light.
 * 3. Gather: a vortex opens on the foot of the Done column. Pieces spiral
 *    down onto its bottom border (the farthest leave first and arrive last),
 *    shedding their shading until they are pure hue, and are gone as they
 *    land. The bento tiles' own pulsing glow lights the column's two top
 *    corners and is traced steadily down its sides through the pull, rounding
 *    the bottom corners to meet in the middle of its foot. Once joined it is
 *    spent with the pull: it eases out to nothing exactly as the last piece
 *    lands, so nothing lingers on the border once the burst is absorbed, and
 *    the flash floods up from a clean foot however late it ignites.
 *
 * Depth of field: most pieces fly near the page, in focus. A foreground layer
 * passes close to the lens (large and soft) and a background layer flies away
 * from it, behind the page (small, soft and faint); the vortex draws both back
 * to the page, into focus.
 *
 * A drop that does not complete the board (one card or a bulk drag) puffs
 * instead (`createFinaleConfettiPuff`). Seen from above, the cards slam onto
 * the page and the confetti squirts out from under every edge of their
 * footprint at once: a low ring of the finale's own variety (paper, sequins
 * and coiled ribbons, smaller) that spreads along the page, decelerates hard,
 * settles in a mixed scatter and fades (`SMALL_CONFETTI_TIMING`). It has no
 * vortex, no glow and no depth layers, and it never crosses back over the
 * cards it came from.
 *
 * Space: viewport CSS px, y DOWN, z toward the viewer (z = 0 is the page, which
 * a perspective camera maps 1:1 onto CSS px). `finaleConfettiCenter` is ported
 * line for line to `FINALE_CONFETTI_MOTION_GLSL`, which moves every vertex on
 * the GPU, so a frame costs one uniform update however busy the main thread is.
 */

import { FLASH_ROVO_COLORS, FLASH_TIMING } from "./finale-column-flash";
import { EASE, clamp, lerp, progress } from "./finale-math";

// Seconds, resolved from the VPK duration tokens. The token contract test
// checks these against app/tailwind-theme.css to prevent drift.
const MOTION_DURATION = {
	xxshort: 0.05, // --duration-xxshort (motion.duration.xxshort)
	fast: 0.1, // --duration-fast (motion.duration.xshort)
	medium: 0.2, // --duration-medium (motion.duration.medium)
	slow: 0.25, // --duration-slow (motion.duration.long)
	slower: 0.4, // --duration-slower (motion.duration.xlong)
	slowest: 0.6, // --duration-slowest (motion.duration.xxlong)
} as const;

export const FINALE_CONFETTI_TIMING = {
	/**
	 * Both cannons fire across this window, front-loaded, with the slow trail
	 * dribbling out last: a stream the eye can follow out of each corner,
	 * rather than a fan that is already formed within a few frames.
	 */
	volley: MOTION_DURATION.slow,
	/**
	 * Free flight (launch, apex and a flutter) before the vortex opens, while
	 * nearly every piece is still in the air.
	 */
	gatherStart: MOTION_DURATION.slowest + MOTION_DURATION.slower,
	/** Pieces join the stream across this window, farthest first. */
	gatherSpread: MOTION_DURATION.slow,
	/**
	 * The column's glow pulses in on the top of both its sides across this
	 * window, from the moment the vortex opens: one brief pulse, already moving.
	 */
	glowIn: MOTION_DURATION.slow,
	/** The nearest piece reaches the source here… */
	firstArrival: MOTION_DURATION.slowest * 2 + MOTION_DURATION.medium,
	/** …and the farthest here: the burst is absorbed and the flash may ignite. */
	gathered: MOTION_DURATION.slowest * 3,
	/**
	 * The glow eases out (`--ease-in`) across this last stretch of the pull,
	 * from just after its two leads meet on the foot, and is exactly dark from
	 * `gathered` on. At the pull's pace it is about half the glow-in's real time.
	 */
	glowOut: MOTION_DURATION.slow,
	/** Whatever a show still draws when the flash ignites clears over exactly the flash's own rise. */
	release: FLASH_TIMING.rise,
} as const;

/**
 * A drop's puff, in real seconds (it has no show clock): the launch is all but
 * spent by ~0.4s (`PUFF.drag`), the dust lies all but still for a beat, then
 * fades away as dust settles rather than snapping off.
 */
export const SMALL_CONFETTI_TIMING = {
	fadeStart: MOTION_DURATION.slowest,
	fade: MOTION_DURATION.slower,
} as const;

/**
 * The show's pace against real time, shared by the burst and the column's
 * trace (every time here, and `FINALE_CONFETTI_TIMING`, is in show seconds).
 * The cannons explode at `burst`× and carry the pieces up to their apex; it
 * eases into a brief bullet time at `hang`× while they float (held for
 * `--duration-medium` of show time, ~0.4s), and as the vortex opens it picks
 * up again to draw them in at `pull`× (~0.7s). Each change eases across its
 * window (show seconds).
 */
export const FINALE_CONFETTI_PACE = {
	burst: 1.7,
	slow: [
		FINALE_CONFETTI_TIMING.gatherStart - MOTION_DURATION.medium - MOTION_DURATION.slow,
		FINALE_CONFETTI_TIMING.gatherStart - MOTION_DURATION.medium,
	],
	hang: 0.5,
	rush: [FINALE_CONFETTI_TIMING.gatherStart, FINALE_CONFETTI_TIMING.gatherStart + MOTION_DURATION.slow],
	pull: 1.4,
} as const;

/** ∫₀ˢ smoothstep(edge0, edge1, x) dx: the eased share of a pace change, accrued by show second `s`. */
function easedArea(s: number, [edge0, edge1]: readonly [number, number]): number {
	const span = edge1 - edge0;
	const t = clamp01((s - edge0) / span);
	return span * (t ** 3 - t ** 4 / 2) + Math.max(0, s - edge1);
}

/** Real seconds the show takes to reach show second `show`: the integral of its slowness. */
export function finaleConfettiRealTime(show: number): number {
	const P = FINALE_CONFETTI_PACE;
	const s = Math.max(0, show);
	return s / P.burst + (1 / P.hang - 1 / P.burst) * easedArea(s, P.slow) + (1 / P.pull - 1 / P.hang) * easedArea(s, P.rush);
}

/** The show second reached `real` seconds after launch (the inverse of `finaleConfettiRealTime`). */
export function finaleConfettiShowTime(real: number): number {
	if (real <= 0) return 0;
	const P = FINALE_CONFETTI_PACE;
	let low = 0;
	let high = real * Math.max(P.burst, P.hang, P.pull);
	for (let step = 0; step < 48; step++) {
		const mid = (low + high) / 2;
		if (finaleConfettiRealTime(mid) < real) low = mid;
		else high = mid;
	}
	return (low + high) / 2;
}

/** The shortest pull into the vortex, so no piece is snatched to the source. */
const MIN_GATHER = MOTION_DURATION.slower;

/** Vertical field of view (degrees) of the camera that maps z = 0 onto CSS px. */
export const FINALE_CONFETTI_FOV = 40;

/** Camera distance (px) at which the page plane fills the viewport exactly. */
export function finaleConfettiCameraDistance(height: number): number {
	return height / 2 / Math.tan((FINALE_CONFETTI_FOV / 2) * Math.PI / 180);
}

const PIECES_PER_CORNER = 300;
/**
 * The puff out from under a drop's landing (`createFinaleConfettiPuff`), in
 * CSS px like the cards themselves: the board does not scale with the
 * viewport, so neither does the dust it pushes out.
 */
const PUFF = {
	/**
	 * One piece per this many px of the landing's border, within `count`: a
	 * sparse but unbroken ring round a card (~110 pieces on the board's
	 * cards), capped for a tall stack. It answers one card landing in one
	 * column, so it stays light beside the finale's 600.
	 */
	spacing: 11,
	count: [40, 120],
	/**
	 * How far past the edge (px) one card's dust skids. The draw is skewed
	 * (`reachBias`), so most settles close in and only a few flecks fly far:
	 * dense at the edge, thinning outward, as a puff does.
	 */
	reach: [12, 105],
	reachBias: 2,
	/**
	 * √area (px) of one card's footprint (~300 × 100), and how much wider a
	 * heavier stack pushes its dust (√ of the ratio, within `heft`): a bulk
	 * drop's puff spreads a little wider than a single card's, never a blast.
	 */
	card: 175,
	heft: [0.85, 1.45],
	/**
	 * Linear drag (1/s), three times the cannons': the launch is a fast outward
	 * squirt that is 95% spent within ~0.4s, so it reads as dust, not paper
	 * thrown. Launch speed is reach × drag, so the reach is exact.
	 */
	drag: [6.5, 9.5],
	/**
	 * Half-angle (rad) of each piece's spread about its outward direction,
	 * drawn triangular so most leave square to their edge, and well short of
	 * the edge itself, so none heads back along it.
	 */
	spread: 24 * Math.PI / 180,
	/**
	 * Toward each corner (within this share of the landing's shorter side) the
	 * outward direction fans round from one edge's to the next, as if the
	 * corner were rounder, so the ring rounds the corners rather than leaving
	 * a notch at each where two straight-out sheets part.
	 */
	fan: 0.35,
	/**
	 * Lift off the page as a share of the reach: dust rising slightly, low
	 * enough to stay in focus (well short of `FINALE_CONFETTI_LOOK.focus`) and
	 * never to project back over the card, even on an edge facing the
	 * viewport's centre (that would take a lift near the reach itself).
	 */
	lift: [0.05, 0.25],
	/** Every piece leaves inside this window (s), front-loaded: one impact, not a stream. */
	impact: MOTION_DURATION.xxshort,
	/** The finale's own variety (`VARIETY`), smaller, as the earlier small burst's was. */
	pieceSize: 0.7,
	/**
	 * Every piece skids at least this far (px) from where it sets off. A
	 * coiled ribbon starts so far out (its quad's reach) that its reach from
	 * the edge may not cover it, and none should sit still. It is also more
	 * than twice the sway, so the sway never carries one back toward the card.
	 */
	travel: 8,
	/**
	 * The tumble from a random pose (the finale's mixed scatter, both faces
	 * showing). Paper's is calmer than the cannons': it dies with the launch
	 * (`decay` matches the drag's order) to a slow `rest`. A ribbon keeps the
	 * cannons' livelier, slower-dying twist, so its coil keeps turning.
	 */
	spin: { paper: { start: [6, 14], rest: [0.3, 0.9], decay: 5 }, ribbon: { start: [5, 10], rest: [2, 4], decay: 3 } },
	/** A gentle sway (px, rad/s) as the dust hangs: small beside the shortest reach, so it never drifts back over the card. */
	flutter: { amplitude: [1, 3], frequency: [3, 6] },
} as const;
/** Launch speed (px/s) of a full-strength piece on a 900px-tall viewport. */
const LAUNCH_SPEED = 2200;
/** Fixed, so every rehearsal of the show is the same show. */
export const FINALE_CONFETTI_SEED = 2026;
/**
 * The margin (px) the renderer's quad leaves round each piece's footprint for
 * its antialiased edge, before defocus widens it (`pad` in its vertex
 * shader). A puff's piece sets off clear of its landing by as far as its
 * padded quad reaches (`finaleConfettiQuadReach`), and that margin also covers
 * the few per cent a turn toward the lens adds in perspective.
 */
export const FINALE_CONFETTI_PAD = 1.5;

export type FinaleConfettiMaterial = "paper" | "sequin" | "ribbon";
export type FinaleConfettiShape = "rect" | "disc" | "ribbon";

interface VarietyRange {
	readonly min: number;
	readonly span: number;
}

/**
 * The confetti's variety: one owner for the finale's cannons and a drop's
 * puff, so the two never drift apart. Each range is drawn as `min + random()
 * × span`, the very expression the finale was tuned on (a stored max would
 * round differently, and so change its show).
 */
const VARIETY = {
	/**
	 * One draw's cumulative shares: satin ribbons below `ribbon`, iridescent
	 * sequins below `sequin`, Rovo paper above, of which `disc` is round.
	 */
	mix: { ribbon: 0.07, sequin: 0.28, disc: 0.12 },
	/** Footprints (px) at full size: long ribbons, paper rectangles `aspect` of their length wide, and discs (paper or sequin). */
	ribbon: { length: { min: 80, span: 45 }, width: { min: 4.5, span: 1.5 } },
	rect: { length: { min: 9, span: 5 }, aspect: { min: 0.45, span: 0.2 } },
	disc: { length: { min: 6, span: 3 } },
	/**
	 * Curl along the length: a ribbon coils through whole `turns`, advancing
	 * by its helical `pitch` across its width (the swirly ones); paper bends
	 * through `paper` (rad); a sequin is all but flat.
	 */
	curl: { turns: { min: 0.8, span: 0.6 }, pitch: { min: 0.24, span: 0.16 }, paper: { min: 0.2, span: 0.8 }, sequin: 0.05 },
} as const;

function vary(range: VarietyRange, random: () => number): number {
	return range.min + random() * range.span;
}

function confettiMaterial(roll: number): FinaleConfettiMaterial {
	return roll < VARIETY.mix.ribbon ? "ribbon" : roll < VARIETY.mix.sequin ? "sequin" : "paper";
}

/** Draws only for paper: a sequin is always a disc, a ribbon a ribbon. */
function confettiShape(material: FinaleConfettiMaterial, random: () => number): FinaleConfettiShape {
	return material === "ribbon" ? "ribbon" : material === "sequin" || random() < VARIETY.mix.disc ? "disc" : "rect";
}

/** Length (px) at full size. */
function confettiLength(shape: FinaleConfettiShape, random: () => number): number {
	return vary(VARIETY[shape].length, random);
}

/** Draws only for a rectangle: its width as a share of its length. */
function confettiAspect(shape: FinaleConfettiShape, random: () => number): number {
	return shape === "rect" ? vary(VARIETY.rect.aspect, random) : 1;
}

/** Width (px) at full size: a ribbon's own, otherwise its length × aspect. */
function confettiWidth(shape: FinaleConfettiShape, length: number, aspect: number, random: () => number): number {
	return shape === "ribbon" ? vary(VARIETY.ribbon.width, random) : length * aspect;
}

/** Bend (rad) along the length and helical pitch, drawn in that order. */
function confettiCurl(material: FinaleConfettiMaterial, random: () => number): { readonly arc: number; readonly pitch: number } {
	const { curl } = VARIETY;
	const arc = material === "ribbon" ? vary(curl.turns, random) * Math.PI * 2 : material === "sequin" ? curl.sequin : vary(curl.paper, random);
	const pitch = material === "ribbon" ? vary(curl.pitch, random) : 0;
	return { arc, pitch };
}

interface Vec3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

/** A box on the page (viewport px) and its corner radius. */
export interface FinaleConfettiBox {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly radius: number;
}

/** The Done column: the vortex drains onto its bottom border. */
export type FinaleConfettiColumn = FinaleConfettiBox;

/**
 * Where a show plays: the finale's burst drains onto the Done column; a small
 * one puffs out from under the cards a drop has just landed (their union).
 */
export type FinaleConfettiTarget =
	| { readonly size?: "large"; readonly column: FinaleConfettiColumn }
	| { readonly size: "small"; readonly landing: FinaleConfettiBox };

export type FinaleConfettiStage = { readonly width: number; readonly height: number } & FinaleConfettiTarget;

/** Share of the launching (non-trail) pieces in each depth layer; the rest fly near the page. */
export const FINALE_CONFETTI_DEPTH = {
	/** Past the lens: reaches this share of the way to the camera. */
	near: { share: 0.14, reach: [0.25, 0.6] },
	/** Away from the lens, behind the page, by this share of the camera distance. */
	far: { share: 0.18, reach: [0.35, 1.25] },
} as const;

export interface FinaleConfettiPiece {
	/** The cannon that fired it; `null` for a puff's, which leaves from under its landing. */
	readonly corner: "left" | "right" | null;
	readonly material: FinaleConfettiMaterial;
	readonly shape: FinaleConfettiShape;
	/** Rovo hues of the two faces (sequins show their film instead). */
	readonly front: string;
	readonly back: string;
	readonly origin: Vec3;
	readonly delay: number;
	readonly velocity: Vec3;
	/** Linear drag (1/s): the launch speed decays as e^(−drag·t). */
	readonly drag: number;
	/** Terminal fall speed (px/s) once the launch is spent. */
	readonly fall: number;
	/** Falling-leaf sway (px, rad/s, rad), growing as the launch is spent. */
	readonly flutter: { readonly amplitude: number; readonly frequency: number; readonly phase: number };
	readonly axis: Vec3;
	/** Tumble (rad, rad/s, rad/s, 1/s) plus the extra turns (rad) the vortex adds. */
	readonly spin: { readonly phase: number; readonly start: number; readonly rest: number; readonly decay: number; readonly gather: number };
	/** Footprint (px), bend along the length (rad; ribbons curl through turns) and helical pitch. */
	readonly size: { readonly length: number; readonly width: number; readonly arc: number; readonly pitch: number };
	/** The pull into the vortex (s), its clockwise swirl (rad) and where it lands on the column's bottom border. */
	readonly gather: { readonly start: number; readonly end: number; readonly swirl: number; readonly sink: { readonly x: number; readonly y: number } } | null;
	readonly seed: number;
}

export interface FinaleConfettiBurst {
	readonly stage: FinaleConfettiStage;
	/** Drawn in this order: farthest from the camera first. */
	readonly pieces: readonly FinaleConfettiPiece[];
}

/** mulberry32: a small, fast, seedable PRNG. */
export function finaleConfettiRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

function clamp01(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}

type FinaleConfettiFlight = Pick<FinaleConfettiPiece, "origin" | "delay" | "velocity" | "drag" | "fall" | "flutter">;

/** Ballistic flight under linear drag toward a terminal fall, plus flutter. */
export function finaleConfettiFree(piece: FinaleConfettiFlight, time: number): Vec3 {
	const elapsed = Math.max(time - piece.delay, 0);
	const decay = 1 - Math.exp(-piece.drag * elapsed);
	const reach = decay / piece.drag;
	const sway = piece.flutter.amplitude * decay * decay;
	const phase = piece.flutter.frequency * elapsed + piece.flutter.phase;
	return {
		x: piece.origin.x + piece.velocity.x * reach + sway * Math.sin(phase),
		y: piece.origin.y + piece.velocity.y * reach + piece.fall * (elapsed - reach),
		z: piece.origin.z + piece.velocity.z * reach + sway * 0.6 * Math.cos(phase),
	};
}

/** 0 → 1 through the piece's pull into the vortex. */
export function finaleConfettiGather(piece: FinaleConfettiPiece, time: number): number {
	if (!piece.gather) return 0;
	return clamp01((time - piece.gather.start) / (piece.gather.end - piece.gather.start));
}

/**
 * The piece's centre: free flight, spiralled onto its sink. The pull and the
 * swirl (both s²: a steady draw rather than a snatch) start at rest, so the
 * hand-off from free flight keeps the piece's velocity; it lands on its sink,
 * on the page (z = 0), exactly at `gather.end`.
 */
export function finaleConfettiCenter(piece: FinaleConfettiPiece, time: number): Vec3 {
	const free = finaleConfettiFree(piece, time);
	if (!piece.gather) return free;
	const s = finaleConfettiGather(piece, time);
	const hold = 1 - s * s;
	const angle = piece.gather.swirl * s * s;
	const { sink } = piece.gather;
	const dx = free.x - sink.x;
	const dy = free.y - sink.y;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return {
		x: sink.x + (dx * cos - dy * sin) * hold,
		y: sink.y + (dx * sin + dy * cos) * hold,
		z: free.z * hold,
	};
}

/** A landing point on the column's bottom border, clear of its corners, favouring the centre (the flash's source). */
export function finaleConfettiSink(column: FinaleConfettiColumn, a: number, b: number): { readonly x: number; readonly y: number } {
	const inset = Math.min(column.radius + 4, column.width / 2);
	return { x: column.x + inset + (column.width - inset * 2) * (a + b) / 2, y: column.y + column.height };
}

/** The glow-in's pulse: how far it swells past the brightness it sets off at (~1.2× at its peak). */
const GLOW_IN_SWELL = 0.6;

/**
 * Brightness (0–1) of the column's glow: the envelope of everything it draws.
 * Dark through the hang, it glows in on the top of both sides as the vortex
 * opens, with one pulse (`glowIn`), already setting off down them: from
 * nothing, easing in so it never pops on, it swells and eases back. Its
 * spots orbit and beat throughout, and the pieces landing on it brighten it.
 * Over the last of the pull (`glowOut`) it is spent: it eases out to exactly
 * 0 as the last piece lands, and stays dark from then on.
 */
export function finaleConfettiGlow(time: number, charge: number): number {
	const T = FINALE_CONFETTI_TIMING;
	const at = progress(time, T.gatherStart, T.gatherStart + T.glowIn);
	const glowIn = at * at * (3 - 2 * at) + GLOW_IN_SWELL * Math.sin(Math.PI * at) ** 2;
	const spent = EASE.in(progress(time, T.gathered - T.glowOut, T.gathered));
	return glowIn * (0.65 + 0.35 * clamp01(charge)) * (1 - spent);
}

/**
 * How far the glow has been traced down the column (0 → 1), from the moment
 * the vortex opens and the pieces start to pour in (it sets off as it
 * appears, never pausing at the top) until the last piece lands. Steady in
 * show seconds, so it keeps the burst's own pace (`FINALE_CONFETTI_PACE`):
 * leaving bullet time slowly, then rushing down with the pull. Paced by time rather than by the pieces (whose
 * arrivals bunch in the middle of the pull), so it can be followed all the way down.
 */
export function finaleConfettiTrace(time: number): number {
	const T = FINALE_CONFETTI_TIMING;
	return progress(time, T.gatherStart, T.gathered);
}

/** Share of the burst that has landed on the border (0 → 1), eased over each piece's last 60ms. */
export function finaleConfettiCharge(burst: FinaleConfettiBurst, time: number): number {
	let charge = 0;
	for (const piece of burst.pieces) {
		if (!piece.gather) continue;
		const t = clamp01((time - (piece.gather.end - 0.06)) / 0.06);
		charge += t * t * (3 - 2 * t);
	}
	return burst.pieces.length ? charge / burst.pieces.length : 1;
}

function unitVector(random: () => number): Vec3 {
	const z = random() * 2 - 1;
	const angle = random() * Math.PI * 2;
	const ring = Math.sqrt(1 - z * z);
	return { x: ring * Math.cos(angle), y: ring * Math.sin(angle), z };
}

/**
 * The show for `stage`: the finale's cannons, or a drop's puff (its own
 * builder, so the finale's random stream, and so its pieces, never depend on it).
 */
export function createFinaleConfettiBurst(stage: FinaleConfettiStage, random = finaleConfettiRandom(FINALE_CONFETTI_SEED)): FinaleConfettiBurst {
	if (stage.size === "small") return createFinaleConfettiPuff(stage, random);
	const { width, height, column } = stage;
	const scale = height / 900;
	const sizeScale = Math.min(1.3, Math.max(0.85, Math.sqrt(height / 900)));
	const lens = finaleConfettiCameraDistance(height);
	const T = FINALE_CONFETTI_TIMING;
	const { near, far } = FINALE_CONFETTI_DEPTH;
	const draft = Array.from({ length: PIECES_PER_CORNER * 2 }, (_, index): Omit<FinaleConfettiPiece, "gather"> & { swirl: number; jitter: number; sink: { x: number; y: number } } => {
		const corner = index < PIECES_PER_CORNER ? "left" : "right";
		const material = confettiMaterial(random());
		const shape = confettiShape(material, random);
		// The forceful broad diagonal fan, never past vertical (off the edge of
		// the screen). A quarter travels gently and falls slowly, keeping a
		// trail near each corner.
		const angle = ((corner === "left" ? -60 : -120) + (0.5 - random()) * 60) * Math.PI / 180;
		// Drawn, not index-derived: an index pattern would align with the hue cycle below.
		const gentle = random() < 0.25;
		const layerRoll = random();
		const layer = gentle ? "focus" : layerRoll < near.share ? "near" : layerRoll < near.share + far.share ? "far" : "focus";
		const speed = LAUNCH_SPEED * scale * (gentle ? 0.16 + random() * 0.3 : 0.55 + random() * 0.9);
		const drag = material === "ribbon" ? 3.1 : material === "sequin" ? 2.3 : 2.35 + random() * 0.5;
		// Depth is reached as velocity / drag.
		const reach = (bounds: readonly [number, number]) => bounds[0] + random() * (bounds[1] - bounds[0]);
		const depth = layer === "near" ? lens * reach(near.reach) : layer === "far" ? -lens * reach(far.reach) : speed / drag * (random() * 0.4 - 0.05);
		const hero = layer === "near";
		const fallBase = material === "sequin" ? 190 + random() * 80 : material === "ribbon" ? 90 + random() * 60 : 120 + random() * 110;
		const length = confettiLength(shape, random);
		const aspect = confettiAspect(shape, random);
		return {
			corner,
			material,
			shape,
			front: FLASH_ROVO_COLORS[index % FLASH_ROVO_COLORS.length],
			back: FLASH_ROVO_COLORS[(index + 1) % FLASH_ROVO_COLORS.length],
			origin: {
				x: corner === "left" ? 0 : width,
				y: height + 8,
				z: random() * 40,
			},
			// One draw, as before: the plume's head leaves first, the gentle trail last.
			delay: ((roll) => T.volley * (gentle ? 0.35 + 0.65 * roll : roll ** 1.5))(random()),
			velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: depth * drag },
			drag,
			fall: fallBase * scale * (gentle ? 0.45 : 1),
			flutter: {
				amplitude: scale * (material === "ribbon" ? 22 + random() * 20 : material === "sequin" ? 8 + random() * 10 : 14 + random() * 22),
				frequency: 4.5 + random() * 4,
				phase: random() * Math.PI * 2,
			},
			axis: unitVector(random),
			spin: material === "ribbon"
				? { phase: random() * Math.PI * 2, start: 5 + random() * 5, rest: 2 + random() * 2, decay: 3, gather: 4 + random() * 4 }
				: { phase: random() * Math.PI * 2, start: 10 + random() * 14, rest: 3.5 + random() * 4, decay: 3, gather: 6 + random() * 6 },
			size: {
				length: length * sizeScale * (hero ? 1.1 : 1),
				width: confettiWidth(shape, length, aspect, random) * sizeScale * (hero ? 1.1 : 1),
				...confettiCurl(material, random),
			},
			seed: random(),
			swirl: 0.7 + random() * 0.6,
			jitter: (random() - 0.5) * 0.06,
			sink: finaleConfettiSink(column, random(), random()),
		};
	});
	// Rank by distance from its sink when the vortex opens: the farthest
	// leave first and arrive last, so arrivals pour in at a steady rate.
	const probe = (piece: (typeof draft)[number]) => {
		const at = finaleConfettiFree(piece, T.gatherStart);
		return Math.hypot(at.x - piece.sink.x, at.y - piece.sink.y, at.z);
	};
	const order = draft.map((piece, index) => ({ index, distance: probe(piece) })).sort((a, b) => a.distance - b.distance);
	const rank = new Array<number>(draft.length);
	order.forEach(({ index }, position) => {
		rank[index] = order.length > 1 ? position / (order.length - 1) : 1;
	});
	const pieces = draft.map(({ swirl, jitter, sink, ...piece }, index): FinaleConfettiPiece => {
		const end = T.firstArrival + (T.gathered - T.firstArrival) * rank[index];
		const start = Math.min(T.gatherStart + T.gatherSpread * (1 - rank[index]) + jitter, end - MIN_GATHER);
		return { ...piece, gather: { start: Math.max(start, T.gatherStart - 0.03), end, swirl, sink } };
	});
	// Draw far to near, by depth mid-flight.
	const depthAt = (piece: FinaleConfettiPiece) => finaleConfettiFree(piece, T.gatherStart * 0.75).z;
	return { stage, pieces: pieces.map((piece) => ({ piece, depth: depthAt(piece) })).sort((a, b) => a.depth - b.depth).map(({ piece }) => piece) };
}

type FinaleConfettiPuffStage = Extract<FinaleConfettiStage, { readonly size: "small" }>;

interface FinaleConfettiBorder {
	/** Its length (px), corners included. */
	readonly length: number;
	/** The point `along` (0 → 1) of the way round it by arc length, clockwise from the top edge's left end, and the outward normal there (rad, y down). */
	readonly at: (along: number) => { readonly x: number; readonly y: number; readonly normal: number };
}

/**
 * A box's rounded border: square to each side, radial round each corner. A
 * box with no extent is a point, outward every way.
 */
function finaleConfettiBorder(box: FinaleConfettiBox): FinaleConfettiBorder {
	const r = clamp(box.radius, 0, Math.min(box.width, box.height) / 2);
	const across = box.width - 2 * r;
	const down = box.height - 2 * r;
	const corner = Math.PI * r / 2;
	const length = 2 * (across + down) + 4 * corner;
	if (!(length > 0)) return { length: 0, at: (along) => ({ x: box.x, y: box.y, normal: along * Math.PI * 2 }) };
	const right = box.x + box.width;
	const bottom = box.y + box.height;
	// Each side from its start, then the corner it runs into, about that corner's centre.
	const sides = [
		{ length: across, x: box.x + r, y: box.y, dx: 1, dy: 0, normal: -Math.PI / 2, cx: right - r, cy: box.y + r },
		{ length: down, x: right, y: box.y + r, dx: 0, dy: 1, normal: 0, cx: right - r, cy: bottom - r },
		{ length: across, x: right - r, y: bottom, dx: -1, dy: 0, normal: Math.PI / 2, cx: box.x + r, cy: bottom - r },
		{ length: down, x: box.x, y: bottom - r, dx: 0, dy: -1, normal: Math.PI, cx: box.x + r, cy: box.y + r },
	];
	return {
		length,
		at: (along) => {
			let rest = clamp(along) * length;
			for (const side of sides) {
				if (rest <= side.length) return { x: side.x + side.dx * rest, y: side.y + side.dy * rest, normal: side.normal };
				rest -= side.length;
				if (rest <= corner) {
					const normal = side.normal + rest / r;
					return { x: side.cx + r * Math.cos(normal), y: side.cy + r * Math.sin(normal), normal };
				}
				rest -= corner;
			}
			// Round-off past the last corner: the top edge's left end, where the border began.
			return { x: sides[0].x, y: sides[0].y, normal: sides[0].normal };
		},
	};
}

/**
 * The way dust leaves `point` on `box`'s border: square to its side, fanning
 * round toward each corner as if that corner had radius `fan` (never less
 * than its own). Within 45° of the border's own normal, so always outward.
 */
function finaleConfettiPuffHeading(box: FinaleConfettiBox, point: ReturnType<FinaleConfettiBorder["at"]>, fan: number): number {
	const inset = Math.min(Math.max(box.radius, fan), box.width / 2, box.height / 2);
	const dx = point.x - clamp(point.x, box.x + inset, box.x + box.width - inset);
	const dy = point.y - clamp(point.y, box.y + inset, box.y + box.height - inset);
	return Math.hypot(dx, dy) > 1e-6 ? Math.atan2(dy, dx) : point.normal;
}

/**
 * The farthest the renderer's quad for a piece of `size` reaches from its
 * centre, whatever its turn. It is padded by `FINALE_CONFETTI_PAD` all round,
 * then bent along its length (`confettiSurface`): each point sits at the chord
 * of its bend (no longer than the length bent, nor than the curl's diameter,
 * 2 × length / arc), pitched across by `along × pitch`. Paper and sequins
 * reach their padded half-diagonal; a coiled ribbon, far less than its length.
 */
function finaleConfettiQuadReach(size: FinaleConfettiPiece["size"]): number {
	const along = size.length / 2 + FINALE_CONFETTI_PAD;
	const chord = Math.min(along, 2 * size.length / Math.max(size.arc, 0.001));
	return Math.hypot(chord, size.width / 2 + FINALE_CONFETTI_PAD + along * size.pitch);
}

/**
 * A drop's puff, seen from above: as the cards slam onto the page, confetti
 * squirts out from under every edge of their footprint (`landing`) at once.
 * Each piece leaves from its own slot round the border (evenly by arc length,
 * corners included), just clear of it, outward, and skids to a stop along the
 * page (`PUFF`): a slight lift, no fall (a top-down view has no down), a
 * tumble from a random pose, and a sway far shorter than its travel, so none
 * drifts back over the cards. Its looks are the finale's (`VARIETY`).
 */
function createFinaleConfettiPuff(stage: FinaleConfettiPuffStage, random: () => number): FinaleConfettiBurst {
	const { landing } = stage;
	const border = finaleConfettiBorder(landing);
	const count = Math.round(clamp(border.length / PUFF.spacing, PUFF.count[0], PUFF.count[1]));
	const heft = clamp(Math.sqrt(Math.sqrt(landing.width * landing.height) / PUFF.card), PUFF.heft[0], PUFF.heft[1]);
	const fan = PUFF.fan * Math.min(landing.width, landing.height);
	const within = (bounds: readonly [number, number], amount: number) => lerp(bounds[0], bounds[1], amount);
	const { spin, flutter } = PUFF;
	const pieces = Array.from({ length: count }, (_, index): FinaleConfettiPiece => {
		const point = border.at((index + random()) / count);
		const heading = finaleConfettiPuffHeading(landing, point, fan) + PUFF.spread * (random() - random());
		const material = confettiMaterial(random());
		const shape = confettiShape(material, random);
		const length = confettiLength(shape, random);
		const aspect = confettiAspect(shape, random);
		const size = { length: length * PUFF.pieceSize, width: confettiWidth(shape, length, aspect, random) * PUFF.pieceSize, ...confettiCurl(material, random) };
		// It sets off as far out as its drawn quad reaches, whatever its turn, so the
		// launch streak swept back to here stops at the edge rather than over the card.
		const clearance = finaleConfettiQuadReach(size);
		const drag = within(PUFF.drag, random());
		// The reach is from the edge, so the clearance it starts at is already part of it.
		const speed = Math.max(heft * within(PUFF.reach, random() ** PUFF.reachBias) - clearance, PUFF.travel) * drag;
		const lift = within(PUFF.lift, random());
		const delay = PUFF.impact * random() ** 3;
		const tumble = material === "ribbon" ? spin.ribbon : spin.paper;
		return {
			corner: null,
			material,
			shape,
			front: FLASH_ROVO_COLORS[index % FLASH_ROVO_COLORS.length],
			back: FLASH_ROVO_COLORS[(index + 1) % FLASH_ROVO_COLORS.length],
			origin: { x: point.x + Math.cos(point.normal) * clearance, y: point.y + Math.sin(point.normal) * clearance, z: 0 },
			delay,
			velocity: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed, z: lift * speed },
			drag,
			fall: 0,
			flutter: { amplitude: within(flutter.amplitude, random()), frequency: within(flutter.frequency, random()), phase: random() * Math.PI * 2 },
			axis: unitVector(random),
			spin: { phase: random() * Math.PI * 2, start: within(tumble.start, random()), rest: within(tumble.rest, random()), decay: tumble.decay, gather: 0 },
			size,
			gather: null,
			seed: random(),
		};
	});
	// Draw far to near: the dust lifted highest lies on top.
	const depthAt = (piece: FinaleConfettiPiece) => finaleConfettiFree(piece, SMALL_CONFETTI_TIMING.fadeStart).z;
	return { stage, pieces: pieces.map((piece) => ({ piece, depth: depthAt(piece) })).sort((a, b) => a.depth - b.depth).map(({ piece }) => piece) };
}

const SHAPE_CODE: Record<FinaleConfettiShape, number> = { rect: 0, disc: 1, ribbon: 2 };
const MATERIAL_CODE: Record<FinaleConfettiMaterial, number> = { paper: 0, sequin: 1, ribbon: 2 };

function rgb(hex: string): readonly number[] {
	return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

/** Per-instance attribute layout read by `FINALE_CONFETTI_MOTION_GLSL`. */
export function packFinaleConfettiBurst(burst: FinaleConfettiBurst): Record<string, { readonly array: Float32Array; readonly itemSize: number }> {
	const rows: Record<string, readonly [number, (piece: FinaleConfettiPiece) => readonly number[]]> = {
		aOrigin: [4, (p) => [p.origin.x, p.origin.y, p.origin.z, p.delay]],
		aVelocity: [4, (p) => [p.velocity.x, p.velocity.y, p.velocity.z, p.drag]],
		aFall: [4, (p) => [p.fall, p.flutter.amplitude, p.flutter.frequency, p.flutter.phase]],
		aAxis: [4, (p) => [p.axis.x, p.axis.y, p.axis.z, p.spin.phase]],
		aSpin: [4, (p) => [p.spin.start, p.spin.rest, p.spin.decay, p.spin.gather]],
		aSize: [4, (p) => [p.size.length, p.size.width, p.size.arc, p.size.pitch]],
		aGather: [4, (p) => p.gather ? [p.gather.start, p.gather.end, p.gather.swirl, p.seed] : [0, 0, 0, p.seed]],
		aSink: [2, (p) => p.gather ? [p.gather.sink.x, p.gather.sink.y] : [0, 0]],
		aLook: [2, (p) => [SHAPE_CODE[p.shape], MATERIAL_CODE[p.material]]],
		aFront: [3, (p) => rgb(p.front)],
		aBack: [3, (p) => rgb(p.back)],
	};
	return Object.fromEntries(Object.entries(rows).map(([name, [itemSize, row]]) => {
		const array = new Float32Array(burst.pieces.length * itemSize);
		burst.pieces.forEach((piece, index) => array.set(row(piece), index * itemSize));
		return [name, { array, itemSize }];
	}));
}

/**
 * GLSL port of the motion, line for line with `finaleConfettiFree`,
 * `finaleConfettiGather` and `finaleConfettiCenter`. Declares the per-instance
 * attributes packed by `packFinaleConfettiBurst`.
 */
export const FINALE_CONFETTI_MOTION_GLSL = /* glsl */ `
attribute vec4 aOrigin;
attribute vec4 aVelocity;
attribute vec4 aFall;
attribute vec4 aAxis;
attribute vec4 aSpin;
attribute vec4 aSize;
attribute vec4 aGather;
attribute vec2 aSink;
attribute vec2 aLook;
attribute vec3 aFront;
attribute vec3 aBack;

vec3 confettiFree(float time) {
	float elapsed = max(time - aOrigin.w, 0.0);
	float decay = 1.0 - exp(-aVelocity.w * elapsed);
	float reach = decay / aVelocity.w;
	float sway = aFall.y * decay * decay;
	float phase = aFall.z * elapsed + aFall.w;
	return vec3(
		aOrigin.x + aVelocity.x * reach + sway * sin(phase),
		aOrigin.y + aVelocity.y * reach + aFall.x * (elapsed - reach),
		aOrigin.z + aVelocity.z * reach + sway * 0.6 * cos(phase)
	);
}

float confettiGather(float time) {
	if (aGather.y <= aGather.x) return 0.0;
	return clamp((time - aGather.x) / (aGather.y - aGather.x), 0.0, 1.0);
}

vec3 confettiCenter(float time) {
	vec3 free = confettiFree(time);
	float s = confettiGather(time);
	float hold = 1.0 - s * s;
	float angle = aGather.z * s * s;
	vec2 d = free.xy - aSink;
	float c = cos(angle);
	float n = sin(angle);
	return vec3(aSink + vec2(d.x * c - d.y * n, d.x * n + d.y * c) * hold, free.z * hold);
}

/** Tumble: a decaying launch spin settling to a steady flutter, sped up by the vortex. */
mat3 confettiTurn(float time) {
	float elapsed = max(time - aOrigin.w, 0.0);
	float s = confettiGather(time);
	float angle = aAxis.w + aSpin.y * elapsed + (aSpin.x - aSpin.y) * (1.0 - exp(-aSpin.z * elapsed)) / aSpin.z + aSpin.w * s * s * s;
	vec3 k = aAxis.xyz;
	float c = cos(angle);
	float n = sin(angle);
	mat3 skew = mat3(0.0, k.z, -k.y, -k.z, 0.0, k.x, k.y, -k.x, 0.0);
	return mat3(c) + n * skew + (1.0 - c) * outerProduct(k, k);
}

/**
 * The piece's surface at (along, across) px from its centre: an arc of the
 * given bend along its length (ribbons curl through whole turns, advancing by
 * their pitch across the width). Writes the surface normal.
 */
vec3 confettiSurface(float along, float across, float span, out vec3 outNormal) {
	float arc = max(aSize.z, 0.001);
	float a = along / max(span, 0.001) * arc;
	float radius = max(span, 0.001) / arc;
	float bend = sin(a * 0.5);
	outNormal = vec3(-sin(a), 0.0, cos(a));
	return vec3(radius * sin(a), across + along * aSize.w, radius * 2.0 * bend * bend);
}
`;
