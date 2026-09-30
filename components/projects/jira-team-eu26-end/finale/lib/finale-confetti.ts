/**
 * Confetti for the moment the last keynote card lands in Done, and the bridge
 * into the column flash that follows it (`finale-column-flash.ts`).
 *
 * Three acts, each a pure function of seconds since launch:
 * 1. Pop: two cannons at the viewport's lower corners fire a broad diagonal
 *    fan of 3D paper (a Rovo hue on each face), iridescent sequins whose film
 *    runs through the Rovo gradient, and curled satin ribbons. A few fly past
 *    the lens, out of focus.
 * 2. Hang: drag spends the launch; pieces flutter and tumble near the apex,
 *    catching the key light.
 * 3. Gather: a vortex opens on the foot of the Done column. Pieces spiral
 *    down onto its bottom border (the farthest leave first and arrive last),
 *    shedding their shading until they are pure hue. The bento tiles' own
 *    pulsing glow lights the column's two top corners and is traced steadily
 *    down its sides through the pull, rounding the bottom corners to meet in
 *    the middle of its foot as the last piece lands. When
 *    the finale ignites, the flash floods up from the foot and the glow
 *    blooms into it.
 *
 * Depth of field: most pieces fly near the page, in focus. A foreground layer
 * passes close to the lens (large and soft) and a background layer flies away
 * from it, behind the page (small, soft and faint); the vortex draws both back
 * to the page, into focus.
 *
 * Space: viewport CSS px, y DOWN, z toward the viewer (z = 0 is the page, which
 * a perspective camera maps 1:1 onto CSS px). `finaleConfettiCenter` is ported
 * line for line to `FINALE_CONFETTI_MOTION_GLSL`, which moves every vertex on
 * the GPU, so a frame costs one uniform update however busy the main thread is.
 */

import { FLASH_ROVO_COLORS, FLASH_TIMING } from "./finale-column-flash";
import { progress } from "./finale-math";

// Seconds, resolved from the VPK duration tokens. The token contract test
// checks these against app/tailwind-theme.css to prevent drift.
const MOTION_DURATION = {
	xxshort: 0.05, // --duration-xxshort (motion.duration.xxshort)
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
	 * Free flight (launch, apex and a long flutter) before the vortex opens.
	 * Drag leaves pieces at a slow terminal fall, so ~94% are still on screen here.
	 */
	gatherStart: MOTION_DURATION.slowest * 2 + MOTION_DURATION.medium,
	/** Pieces join the stream across this window, farthest first. */
	gatherSpread: MOTION_DURATION.slower,
	/**
	 * The column's glow pulses in on the top of both its sides across this
	 * window, which ends as the vortex opens: one brief pulse, then it sets off.
	 */
	glowIn: MOTION_DURATION.slower,
	/** The nearest piece reaches the source here… */
	firstArrival: (MOTION_DURATION.slowest + MOTION_DURATION.slower) * 2,
	/** …and the farthest here: the ember is fully charged and the flash may ignite. */
	gathered: MOTION_DURATION.slowest * 4,
	/** The ember blooms into the flash over exactly the flash's own rise. */
	release: FLASH_TIMING.rise,
} as const;

/** The shortest pull into the vortex, so no piece is snatched to the source. */
const MIN_GATHER = MOTION_DURATION.slower;

/** Vertical field of view (degrees) of the camera that maps z = 0 onto CSS px. */
export const FINALE_CONFETTI_FOV = 40;

/** Camera distance (px) at which the page plane fills the viewport exactly. */
export function finaleConfettiCameraDistance(height: number): number {
	return height / 2 / Math.tan((FINALE_CONFETTI_FOV / 2) * Math.PI / 180);
}

const PIECES_PER_CORNER = 300;
/** Launch speed (px/s) of a full-strength piece on a 900px-tall viewport. */
const LAUNCH_SPEED = 2200;
/** Fixed, so every rehearsal of the show is the same show. */
export const FINALE_CONFETTI_SEED = 2026;

export type FinaleConfettiMaterial = "paper" | "sequin" | "ribbon";
export type FinaleConfettiShape = "rect" | "disc" | "ribbon";

interface Vec3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

/** The Done column (viewport px) and its corner radius: the vortex drains onto its bottom border. */
export interface FinaleConfettiColumn {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly radius: number;
}

export interface FinaleConfettiStage {
	readonly width: number;
	readonly height: number;
	readonly column: FinaleConfettiColumn;
}

/** Share of the launching (non-trail) pieces in each depth layer; the rest fly near the page. */
export const FINALE_CONFETTI_DEPTH = {
	/** Past the lens: reaches this share of the way to the camera. */
	near: { share: 0.14, reach: [0.25, 0.6] },
	/** Away from the lens, behind the page, by this share of the camera distance. */
	far: { share: 0.18, reach: [0.35, 1.25] },
} as const;

export interface FinaleConfettiPiece {
	readonly corner: "left" | "right";
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
	readonly gather: { readonly start: number; readonly end: number; readonly swirl: number; readonly sink: { readonly x: number; readonly y: number } };
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
 * Brightness (0–1) of the column's glow, before its hand-off to the flash.
 * Just before the vortex opens it glows in on the top of both sides with one
 * pulse (`glowIn`): from nothing, easing in so it never pops on, it swells
 * and eases back just as the trace sets off, so it never lingers there. Its
 * spots orbit and beat throughout; the pieces landing on it then bring it to
 * full.
 */
export function finaleConfettiGlow(time: number, charge: number): number {
	const T = FINALE_CONFETTI_TIMING;
	const at = progress(time, T.gatherStart - T.glowIn, T.gatherStart);
	const glowIn = at * at * (3 - 2 * at) + GLOW_IN_SWELL * Math.sin(Math.PI * at) ** 2;
	return glowIn * (0.65 + 0.35 * clamp01(charge));
}

/**
 * How far the glow has been traced down the column (0 → 1): steadily, across
 * the whole pull, from the moment the vortex opens until the last piece lands.
 * Paced by time rather than by the pieces (whose arrivals bunch in the middle
 * of the pull), so the trace never races and can be followed all the way up.
 */
export function finaleConfettiTrace(time: number): number {
	return progress(time, FINALE_CONFETTI_TIMING.gatherStart, FINALE_CONFETTI_TIMING.gathered);
}

/** Share of the burst that has landed on the border (0 → 1), eased over each piece's last 60ms. */
export function finaleConfettiCharge(burst: FinaleConfettiBurst, time: number): number {
	let charge = 0;
	for (const piece of burst.pieces) {
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

export function createFinaleConfettiBurst(stage: FinaleConfettiStage, random = finaleConfettiRandom(FINALE_CONFETTI_SEED)): FinaleConfettiBurst {
	const { width, height } = stage;
	const scale = height / 900;
	const sizeScale = Math.min(1.3, Math.max(0.85, Math.sqrt(scale)));
	const lens = finaleConfettiCameraDistance(height);
	const T = FINALE_CONFETTI_TIMING;
	const { near, far } = FINALE_CONFETTI_DEPTH;
	const draft = Array.from({ length: PIECES_PER_CORNER * 2 }, (_, index): Omit<FinaleConfettiPiece, "gather"> & { swirl: number; jitter: number; sink: { x: number; y: number } } => {
		const corner = index < PIECES_PER_CORNER ? "left" : "right";
		const roll = random();
		const material: FinaleConfettiMaterial = roll < 0.07 ? "ribbon" : roll < 0.28 ? "sequin" : "paper";
		const shape: FinaleConfettiShape = material === "ribbon" ? "ribbon" : material === "sequin" || random() < 0.12 ? "disc" : "rect";
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
		const length = material === "ribbon" ? 80 + random() * 45 : shape === "disc" ? 6 + random() * 3 : 9 + random() * 5;
		const aspect = shape === "rect" ? 0.45 + random() * 0.2 : 1;
		return {
			corner,
			material,
			shape,
			front: FLASH_ROVO_COLORS[index % FLASH_ROVO_COLORS.length],
			back: FLASH_ROVO_COLORS[(index + 1) % FLASH_ROVO_COLORS.length],
			origin: { x: corner === "left" ? 0 : width, y: height + 8, z: random() * 40 },
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
				width: (material === "ribbon" ? 4.5 + random() * 1.5 : length * aspect) * sizeScale * (hero ? 1.1 : 1),
				arc: material === "ribbon" ? (0.8 + random() * 0.6) * Math.PI * 2 : material === "sequin" ? 0.05 : 0.2 + random() * 0.8,
				pitch: material === "ribbon" ? 0.24 + random() * 0.16 : 0,
			},
			seed: random(),
			swirl: 0.7 + random() * 0.6,
			jitter: (random() - 0.5) * 0.06,
			sink: finaleConfettiSink(stage.column, random(), random()),
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
		aGather: [4, (p) => [p.gather.start, p.gather.end, p.gather.swirl, p.seed]],
		aSink: [2, (p) => [p.gather.sink.x, p.gather.sink.y]],
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
