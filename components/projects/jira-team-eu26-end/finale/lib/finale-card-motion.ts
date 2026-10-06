import { CUE } from "../data/finale-cues";
import type { FinaleRect } from "../data/finale-stories";
import {
	HERO_FRAME_SHARE,
	cameraBasis,
	cameraDistance,
	cameraSpeed,
	finaleCameraRig,
	fromView,
	heroAnchor,
	identityRig,
	toView,
	type FinaleCameraBasis,
	type FinaleCameraRig,
	type FinaleViewport,
	type Vec3,
} from "./finale-camera";
import { EASE, clamp, eased, hash01, lerp, progress } from "./finale-math";

export { FINALE_CAMERA_FOV, cameraDistance, type FinaleViewport } from "./finale-camera";

/** How the 1920×1080 stage is scaled into the viewport (type and gutters follow it). */
export interface FinaleFit {
	readonly scale: number;
	readonly x: number;
	readonly y: number;
}

export interface FinalePoint {
	readonly x: number;
	readonly y: number;
}

export function rectCentre(rect: FinaleRect): FinalePoint {
	return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function smooth(value: number): number {
	const x = clamp(value);
	return x * x * (3 - 2 * x);
}

/* ─── Card pose ───────────────────────────────────────────────────────── */

/**
 * A card's full pose in slide coordinates: x right and y down in CSS px on the
 * z = 0 slide plane, z toward the resting camera, plus rotation. The camera
 * (see `finale-camera.ts`) films this world; it never moves the cards.
 */
export interface FinaleCardPose {
	readonly x: number;
	readonly y: number;
	readonly z: number;
	readonly width: number;
	readonly height: number;
	readonly rotateX: number;
	readonly rotateY: number;
	readonly rotateZ: number;
	readonly opacity: number;
	/** 0 Jira card face → 1 its bento tile (as its face prints, or blank). */
	readonly face: number;
	/** 0 flat on the page → 1 airborne (Peel flutter, cloth). */
	readonly lift: number;
	/** Seconds since touchdown for the Peel landing wave (negative while it gathers, see `landingWaveAge`), or −1 before. */
	readonly waveAge: number;
	/** 1 while clipped to the Done column's scroll viewport → 0 once it has left it. */
	readonly clip: number;
}

/** A rect in a sheet's own uv space: x0, y0, x1, y1 (u right, v up; the whole sheet is 0..1). */
export type FinaleUvRect = readonly [number, number, number, number];

/**
 * The part of a resting card that the Done column's scroll viewport shows, in
 * the sheet's own uv. At rest the GL layer clips on screen, exactly like the
 * DOM; once a card is tossed it clips in this uv rect instead, so the part the
 * viewport hid fades in on the sheet itself and the column's screen-fixed edges
 * never cut through the burst.
 */
export function restClipUv(rect: FinaleRect, clip: FinaleRect): FinaleUvRect {
	const width = Math.max(rect.width, 1);
	const height = Math.max(rect.height, 1);
	return [
		(clip.x - rect.x) / width,
		1 - (clip.y + clip.height - rect.y) / height,
		(clip.x + clip.width - rect.x) / width,
		1 - (clip.y - rect.y) / height,
	];
}

export type FinaleCardRole =
	| { readonly kind: "hero"; readonly slot: FinaleRect }
	| { readonly kind: "tile"; readonly order: number; readonly slot: FinaleRect }
	| { readonly kind: "extra" }
	/** Deep-field copy of a card that fills out the space; never leaves the column. */
	| { readonly kind: "echo" };

export interface FinaleCardInput {
	/** The card's DOM rect in the Done column when the finale began (echoes: its size donor). */
	readonly rect: FinaleRect;
	/** Place in the field spiral, in drag order. */
	readonly fieldIndex: number;
	readonly fieldCount: number;
	/** The card's place in the column (top first); seeds its toss. */
	readonly burstIndex: number;
	readonly role: FinaleCardRole;
}

const GOLDEN_ANGLE = 2.399963229728653;
/** Nothing bursts closer than this fraction of the camera distance. */
const NEAREST = 0.75;
const TILE_HOLD_DEPTH = 0.35;

interface FieldHome {
	readonly x: number;
	readonly y: number;
	readonly z: number;
	readonly rotateX: number;
	readonly rotateY: number;
	readonly rotateZ: number;
	readonly seed: number;
}

/**
 * Where a card floats in the field: a golden-angle spiral (as seen from the
 * resting camera), each card at its own depth. Near cards are pushed outward
 * so the centre stays open; echoes sit deep in the fog.
 */
export function fieldHome(index: number, count: number, echo: boolean, viewport: FinaleViewport): FieldHome {
	const distance = cameraDistance(viewport);
	const seed = index + (echo ? 101 : 1);
	const z = echo ? -distance * lerp(0.9, 2.3, hash01(seed * 7.31)) : distance * lerp(-0.55, 0.1, hash01(seed * 3.17));
	const near = clamp((z + distance * 0.2) / (distance * 0.3));
	const spread = Math.sqrt((index + 0.5) / Math.max(1, count));
	const radius = Math.max(lerp(echo ? 0.15 : 0.24, 0.92, spread), 0.3 + 0.35 * near);
	const angle = index * GOLDEN_ANGLE + (echo ? 1.2 : 0.4);
	const depthScale = (distance - z) / distance;
	return {
		x: Math.cos(angle) * radius * viewport.width * 0.5 * depthScale,
		y: Math.sin(angle) * radius * viewport.height * 0.5 * depthScale,
		z,
		rotateX: (hash01(seed * 5.1) - 0.5) * 0.5,
		rotateY: (hash01(seed * 6.7) - 0.5) * 0.8,
		rotateZ: (hash01(seed * 8.3) - 0.5) * 0.35,
		seed,
	};
}

/** The hero's place in the field: far off, deep in the fog, waiting for the long zoom. */
function heroHome(viewport: FinaleViewport): FieldHome {
	const anchor = heroAnchor(viewport);
	return { x: anchor.x, y: -anchor.y, z: anchor.z, rotateX: 0.18, rotateY: -0.35, rotateZ: 0.06, seed: 1 };
}

/** Fixed back-to-front layers from the field's layout; camera motion must not swap overlapping cards. */
export function fieldDrawOrders(inputs: readonly FinaleCardInput[], viewport: FinaleViewport): readonly number[] {
	const sorted = inputs.map((input, index) => {
		const home = input.role.kind === "hero" ? heroHome(viewport) : fieldHome(input.fieldIndex, input.fieldCount, input.role.kind === "echo", viewport);
		return { index, z: home.z };
	}).sort((a, b) => a.z - b.z || a.index - b.index);
	const orders = new Array<number>(inputs.length);
	for (const [rank, card] of sorted.entries()) orders[card.index] = rank * 2 + 1;
	return orders;
}

export function flatPose(rect: FinaleRect, face: number): FinaleCardPose {
	const centre = rectCentre(rect);
	return { x: centre.x, y: centre.y, z: 0, width: rect.width, height: rect.height, rotateX: 0, rotateY: 0, rotateZ: 0, opacity: 1, face, lift: 0, waveAge: -1, clip: 0 };
}

/** Floating in the field. Cards hold still in the world; they only breathe. */
function fieldPose(home: FieldHome, rect: FinaleRect, time: number, viewport: FinaleViewport, sway = 1): FinaleCardPose {
	const phase = time + home.seed * 1.7;
	return {
		...flatPose(rect, 0),
		x: viewport.width / 2 + home.x + Math.cos(phase * 0.7) * 10 * sway,
		y: viewport.height / 2 + home.y + Math.sin(phase * 0.9) * 12 * sway,
		z: home.z,
		rotateX: home.rotateX + Math.sin(phase * 0.6) * 0.08 * sway,
		rotateY: home.rotateY + Math.cos(phase * 0.5) * 0.1 * sway,
		rotateZ: home.rotateZ,
		lift: 1,
	};
}

export function blendPose(from: FinaleCardPose, to: FinaleCardPose, amount: number): FinaleCardPose {
	return {
		x: lerp(from.x, to.x, amount),
		y: lerp(from.y, to.y, amount),
		z: lerp(from.z, to.z, amount),
		width: lerp(from.width, to.width, amount),
		height: lerp(from.height, to.height, amount),
		rotateX: lerp(from.rotateX, to.rotateX, amount),
		rotateY: lerp(from.rotateY, to.rotateY, amount),
		rotateZ: lerp(from.rotateZ, to.rotateZ, amount),
		opacity: lerp(from.opacity, to.opacity, amount),
		face: lerp(from.face, to.face, amount),
		lift: lerp(from.lift, to.lift, amount),
		waveAge: to.waveAge,
		clip: lerp(from.clip, to.clip, amount),
	};
}

/** Every card leaves at once, like a thrown deck: only a hair of random spread, no queue. */
function burstStart(input: FinaleCardInput): number {
	return CUE.burst + hash01(input.burstIndex * 7.7 + 3) * CUE.burstSpread;
}

/** Whole turns, so a flipped card still comes to rest at its field angle. */
export function turns(seed: number, chance: number): number {
	const roll = hash01(seed);
	if (roll > chance) return 0;
	return roll < chance / 2 ? -1 : 1;
}

/** Whole turns a tossed card tumbles through about each axis. */
interface FinaleTumble {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

function seededTumble(seed: number): FinaleTumble {
	return { x: turns(seed * 2.3, 0.35), y: turns(seed * 3.7, 0.25), z: turns(seed * 4.9, 0.3) };
}

/**
 * The hero always flips end over end, exactly once: the rush unwinds its
 * tumble as it squares up to the lens, so a seeded one flipped it from some
 * places in the column, spun it from others and left it still from the rest.
 */
const HERO_TUMBLE: FinaleTumble = { x: 1, y: 0, z: 0 };

/**
 * Column → field: the deck is tossed. Each card shoots out of its place in the
 * Done column on its own arc (up and toward the lens), tumbling as it goes —
 * some flip end over end, some spin, the rest tilt and wobble — and it is
 * airborne cloth from the first frame, so it bends with the throw.
 */
function burstPose(time: number, input: FinaleCardInput, home: FieldHome, viewport: FinaleViewport, sway = 1, tumble?: FinaleTumble): FinaleCardPose {
	const field = fieldPose(home, input.rect, time, viewport, sway);
	const start = burstStart(input);
	const seed = input.burstIndex * 13.1 + home.seed;
	const spin = tumble ?? seededTumble(seed);
	const flight = CUE.burstDuration * lerp(0.8, 1.15, hash01(seed * 1.9));
	const out = EASE.outPractical(progress(time, start, start + flight));
	const rest = { ...flatPose(input.rect, 0), clip: 1 };
	const pose = blendPose(rest, field, out);
	const arc = Math.sin(Math.PI * out);
	const distance = cameraDistance(viewport);
	const TAU = Math.PI * 2;
	const wobble = (hash01(seed * 9.7) - 0.5) * 1.4;
	return {
		...pose,
		x: pose.x + arc * (hash01(seed * 5.3) - 0.5) * 260,
		y: pose.y - arc * lerp(60, 240, hash01(seed * 6.1)),
		z: Math.min(pose.z + arc * distance * lerp(0.08, 0.2, hash01(seed * 4.3)), distance * NEAREST),
		rotateX: pose.rotateX + spin.x * TAU * out + arc * wobble * 0.6,
		rotateY: pose.rotateY + spin.y * TAU * out + arc * wobble,
		rotateZ: pose.rotateZ + spin.z * TAU * out + arc * (hash01(seed * 8.3) - 0.5) * 1.2,
		clip: 1 - progress(time, start, start + 0.18),
		lift: smooth(progress(time, start, start + 0.1)),
	};
}

/** Touchdown time of a bento tile: the hero lands first, the rest in stagger. */
export function touchdownTime(order: number): number {
	return order === 0 ? CUE.heroLand : tileFallStart(order) + CUE.tileFall;
}

export function tileFallStart(order: number): number {
	return CUE.tiles + (order - 1) * CUE.tileStagger;
}

/** When a landed tile's logo and heading start to build. */
export function tileRevealStart(order: number): number {
	return touchdownTime(order) + CUE.handoff + 0.05;
}

/**
 * How every card comes to rest on the page: the bento's tiles on the slide,
 * and the mega bento's thrown cards and arrivals on the wall. Paper lands
 * softly. Its swoop brings it to rest in its slot with no in-plane kick, and
 * the one reaction is Peel's wave, which gathers over the fall's last moments,
 * swells through touchdown and relaxes once. Each part starts and ends at
 * rest, so no frame of the landing jolts.
 */
export const LANDING = {
	/** The wave starts to gather this long before touchdown (s)… */
	lead: 0.1,
	/** …and has fully swelled this long after it (s). */
	swell: 0.06,
} as const;

/**
 * `FinaleCardPose.waveAge` at `time` for a card touching down at `touchdown`:
 * seconds since touchdown, negative while the wave gathers over the fall's
 * last `LANDING.lead`, and −1 before that.
 */
export function landingWaveAge(time: number, touchdown: number): number {
	const age = time - touchdown;
	return age >= -LANDING.lead ? age : -1;
}

/** How far the landing wave has swelled at `waveAge`: 0 → 1, leaving and reaching it at rest. */
export function landingSwell(waveAge: number): number {
	return smooth(progress(waveAge, -LANDING.lead, LANDING.swell));
}

/** A card on its way down to, or resting on, the page, carrying its landing wave. */
export function withLandingWave(pose: FinaleCardPose, touchdown: number, time: number): FinaleCardPose {
	return { ...pose, waveAge: landingWaveAge(time, touchdown) };
}

/**
 * How far a landing sheet has turned from its Done card into its tile (its
 * `face`), by how far it has flown to its slot: all in the flight's
 * fastest stretch, so the two pictures never sit over each other long enough
 * to read as a double exposure. The hero and the swooping tiles share it.
 */
function landingFace(flight: number): number {
	return smooth(progress(flight, 0.2, 0.8));
}

function landed(pose: FinaleCardPose, order: number, time: number): FinaleCardPose {
	return withLandingWave(pose, touchdownTime(order), time);
}

/**
 * Just outside the resting frame on the side of the tile's slot, lifted toward
 * the lens: tiles clear the field that way as the camera returns, and swoop
 * back in from there.
 */
function tileHoldPose(input: FinaleCardInput, slot: FinaleRect, viewport: FinaleViewport): FinaleCardPose {
	const distance = cameraDistance(viewport);
	const centre = { x: viewport.width / 2, y: viewport.height / 2 };
	const target = rectCentre(slot);
	const length = Math.hypot(target.x - centre.x, target.y - centre.y);
	const dx = length > 1 ? (target.x - centre.x) / length : 0;
	const dy = length > 1 ? (target.y - centre.y) / length : -1;
	const z = distance * TILE_HOLD_DEPTH;
	const scale = distance / (distance - z);
	const edge = Math.min(Math.abs(dx) > 1e-3 ? centre.x / Math.abs(dx) : Number.POSITIVE_INFINITY, Math.abs(dy) > 1e-3 ? centre.y / Math.abs(dy) : Number.POSITIVE_INFINITY);
	const reach = edge + (Math.hypot(input.rect.width, input.rect.height) / 2) * scale * 1.1;
	const seed = input.fieldIndex + 1;
	return {
		...flatPose(input.rect, 0),
		x: centre.x + (dx * reach) / scale,
		y: centre.y + (dy * reach) / scale,
		z,
		rotateX: -0.3,
		rotateY: dx * 0.5,
		rotateZ: (hash01(seed * 2.9) - 0.5) * 0.4,
		lift: 1,
	};
}

/** Everything that is not a tile leaves as the camera pulls back to the slide. */
function clearing(time: number): number {
	return 1 - smooth(progress(time, CUE.zoomEnd - 0.1, CUE.zoomEnd + 0.35));
}

/**
 * One card's whole life. It starts exactly on its DOM card in the Done column
 * and is tossed out of the column into the field with the rest of the deck. The camera sweeps the field,
 * finds the hero (the bento's first feature) far off and rushes in to it;
 * as the camera returns to the slide the hero becomes the first bento tile,
 * the other tiles clear the frame and swoop back onto their slots, and the
 * rest of the field fades away.
 */
export function cardPose(time: number, input: FinaleCardInput, viewport: FinaleViewport): FinaleCardPose {
	const role = input.role;


	if (role.kind === "echo") {
		const home = fieldHome(input.fieldIndex, input.fieldCount, true, viewport);
		const pose = fieldPose(home, input.rect, time, viewport);
		const reveal = hash01(home.seed * 3.3) * 0.5;
		return { ...pose, opacity: progress(time, CUE.burst + 0.2 + reveal, CUE.burst + 0.9 + reveal) * clearing(time) };
	}

	if (role.kind === "extra") {
		const pose = burstPose(time, input, fieldHome(input.fieldIndex, input.fieldCount, false, viewport), viewport);
		return { ...pose, opacity: clearing(time) };
	}

	if (role.kind === "hero") {
		const airborne = burstPose(time, input, heroHome(viewport), viewport, 0, HERO_TUMBLE);
		// Squares up to the lens during the rush, flipping as it does, so it arrives face-on.
		const square = 1 - eased(time, CUE.zoom, CUE.zoomEnd, EASE.inOut);
		// It arrives as its card, held square on, and turns into its tile only on the way down.
		if (time < CUE.zoomEnd) return { ...airborne, rotateX: airborne.rotateX * square, rotateY: airborne.rotateY * square, rotateZ: airborne.rotateZ * square, face: 0 };
		return landed(heroLanding(time, input, role.slot, viewport), 0, time);
	}

	// Tiles float until the camera pulls back, clear with the field, and wait
	// just out of frame to swoop in one by one.
	const airborne = burstPose(time, input, fieldHome(input.fieldIndex, input.fieldCount, false, viewport), viewport);
	const hold = tileHoldPose(input, role.slot, viewport);
	const leave = EASE.in(progress(time, CUE.zoomEnd, CUE.heroLand));
	const start = tileFallStart(role.order);
	const fall = EASE.inOut(progress(time, start, start + CUE.tileFall));
	if (fall <= 0) {
		if (leave <= 0) return { ...airborne, opacity: clearing(time) };
		return { ...blendPose(airborne, hold, leave), opacity: time >= CUE.heroLand ? 1 : clearing(time) };
	}
	const pose = blendPose(hold, flatPose(role.slot, 1), fall);
	return landed({ ...pose, face: landingFace(fall), lift: 1 - fall }, role.order, time);
}

/**
 * Rush → first tile, filmed in screen space: the hero's on-screen rect glides
 * from "centred, filling the frame" into slot a, and the card is placed in the
 * world wherever the returning camera needs it for that. So the landing reads
 * as one smooth move however far the camera travels back to the slide (by now
 * everything else has cleared, so the return itself is never seen).
 */
function heroLanding(time: number, input: FinaleCardInput, slot: FinaleRect, viewport: FinaleViewport): FinaleCardPose {
	const down = eased(time, CUE.zoomEnd, CUE.heroLand, EASE.inOut);
	const focal = cameraDistance(viewport);
	const rig = finaleCameraRig(time, viewport, input.rect);
	const basis = cameraBasis(rig);
	const startWidth = viewport.width * HERO_FRAME_SHARE;
	const screen = {
		x: lerp(viewport.width / 2, slot.x + slot.width / 2, down),
		y: lerp(viewport.height / 2, slot.y + slot.height / 2, down),
		width: lerp(startWidth, slot.width, down),
	};
	const width = lerp(input.rect.width, slot.width, down);
	const height = lerp(input.rect.height, slot.height, down);
	const depth = (width * focal) / screen.width;
	const view = { x: ((screen.x - viewport.width / 2) * depth) / focal, y: ((viewport.height / 2 - screen.y) * depth) / focal, z: depth };
	const offset = fromView(view, basis);
	const world = { x: rig.position.x + offset.x, y: rig.position.y + offset.y, z: rig.position.z + offset.z };
	return {
		...flatPose(slot, landingFace(down)),
		x: world.x + viewport.width / 2,
		y: viewport.height / 2 - world.y,
		z: world.z,
		width,
		height,
		lift: 1 - down,
	};
}

/* ─── Drop shadow ─────────────────────────────────────────────────────── */

/**
 * The surface a landing card casts its shadow on: the plane through `origin`
 * spanned by the orthonormal world axes `x` and `y`, with `z` its normal
 * toward the lens (so ground coordinates are px along the plane plus height
 * above it). `unit` is the scene scale (the camera distance of the shot), which
 * sizes the key light.
 */
export interface FinaleShadowGround {
	readonly origin: Vec3;
	readonly x: Vec3;
	readonly y: Vec3;
	readonly z: Vec3;
	readonly unit: number;
}

/** One layer of the shadow: the card's rect, carried onto the ground. */
export interface FinaleShadowLayer {
	/**
	 * Ground px → card px, as a row-major 3×3 homography:
	 * u = (H·[g, 1]).xy / (H·[g, 1]).z, where u is the card's own space (px, y up, origin at its centre).
	 */
	readonly toCard: readonly number[];
	/** The card's four corners on the ground (px, ground axes), counter-clockwise from bottom left. */
	readonly footprint: readonly FinalePoint[];
}

/** How dark and soft the shadow is at a given height above the ground (mirrored by the shader). */
export interface FinaleShadowFalloff {
	/** Cast penumbra σ (px) = sigmaMin + penumbra · h / (lightHeight − h). */
	readonly sigmaMin: number;
	readonly penumbra: number;
	readonly lightHeight: number;
	/** Cast density = cast / (1 + h / fillHeight): the sky fills in under a high card. */
	readonly cast: number;
	readonly fillHeight: number;
	/** Contact density = contact · exp(−h / contactFade), σ = contactSigma + contactSpread · h. */
	readonly contact: number;
	readonly contactFade: number;
	readonly contactSigma: number;
	readonly contactSpread: number;
}

export interface FinaleLandingShadow {
	/** The soft penumbra, projected from the key light through the card. */
	readonly cast: FinaleShadowLayer;
	/** Ambient occlusion right under the card (straight down), only near the ground. */
	readonly contact: FinaleShadowLayer;
	/** Card half size (px) in its own space, and its corner radius. */
	readonly halfSize: FinalePoint;
	readonly radius: number;
	/** Height of each card point above the ground: h(u) = a·u.x + b·u.y + c. */
	readonly heightPlane: readonly [number, number, number];
	readonly falloff: FinaleShadowFalloff;
	/** Ground-space box (px, y up; x/y is its lower-left corner) that the blurred shadow can reach. */
	readonly bounds: FinaleRect;
	/** Fade in as the card starts down, out once it lies flat (0–1). */
	readonly presence: number;
	/** Height of the card's centre above the ground (px). */
	readonly height: number;
	/** Cast penumbra σ under the card's centre (px). */
	readonly blur: number;
	/** Where the centre's shadow falls, relative to the point straight under the card (px, ground axes). */
	readonly offset: FinalePoint;
	/** Cast footprint area over the card's own area. */
	readonly scale: number;
	/** Peak darkness of both layers together, including presence. */
	readonly opacity: number;
}

/**
 * Unit vector toward the finale's key light: up and to the top left of the
 * frame (x right, y up, z toward the lens). The landing shadows are cast from
 * it and the paper sheets are lit by it, so folds shade toward their shadow.
 */
export const FINALE_LIGHT_DIRECTION: Vec3 = normalize3({ x: -0.35, y: 0.45, z: 1 });

const SHADOW = {
	/** The key is a big soft box well above the slide: distance and radius in camera distances. */
	lightDistance: 3,
	lightRadius: 0.9,
	/** Penumbra σ at contact (px): paper on paper is never razor sharp. */
	sigmaMin: 1.25,
	/** How much of the key the card blocks, before sky fill. */
	cast: 0.26,
	/** A card this high (in camera distances) casts half as dark a shadow: more sky reaches under it. */
	fillHeight: 0.25,
	/** Ambient occlusion at touchdown, how fast it fades with height (px), and its spread. */
	contact: 0.34,
	contactFade: 20,
	contactSigma: 1.1,
	contactSpread: 0.35,
	/** The hero lands through the returning camera: at full lift its ground sits this share of its depth behind it. */
	heroHeight: 0.3,
	fadeIn: 0.25,
	/** Gone as a tile's hand-off to its flat DOM tile ends (`CUE.tileHandoff`), and before a wall card's (`CUE.handoff`). */
	fadeOut: 0.42,
} as const;

function normalize3(v: Vec3): Vec3 {
	const size = Math.hypot(v.x, v.y, v.z) || 1;
	return { x: v.x / size, y: v.y / size, z: v.z / size };
}

function dot3(a: Vec3, b: Vec3): number {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** A card's in-plane axes in world space, matching the sheet's `rotation.set(rx, ry, −rz, "XYZ")`. */
function cardAxes(pose: FinaleCardPose): { readonly across: Vec3; readonly up: Vec3 } {
	const a = Math.cos(pose.rotateX);
	const b = Math.sin(pose.rotateX);
	const c = Math.cos(pose.rotateY);
	const d = Math.sin(pose.rotateY);
	const e = Math.cos(-pose.rotateZ);
	const f = Math.sin(-pose.rotateZ);
	return {
		across: { x: c * e, y: a * f + b * e * d, z: b * f - a * e * d },
		up: { x: -c * f, y: a * e - b * f * d, z: b * e + a * f * d },
	};
}

function invert3(m: readonly number[]): number[] | null {
	const [a, b, c, d, e, f, g, h, i] = m;
	const A = e * i - f * h;
	const B = f * g - d * i;
	const C = d * h - e * g;
	const det = a * A + b * B + c * C;
	if (Math.abs(det) < 1e-9) return null;
	const k = 1 / det;
	return [A * k, (c * h - b * i) * k, (b * f - c * e) * k, B * k, (a * i - c * g) * k, (c * d - a * f) * k, C * k, (b * g - a * h) * k, (a * e - b * d) * k];
}

function applyHomography(m: readonly number[], point: FinalePoint): FinalePoint {
	const w = m[6] * point.x + m[7] * point.y + m[8];
	return { x: (m[0] * point.x + m[1] * point.y + m[2]) / w, y: (m[3] * point.x + m[4] * point.y + m[5]) / w };
}

function polygonArea(points: readonly FinalePoint[]): number {
	let area = 0;
	points.forEach((point, index) => {
		const next = points[(index + 1) % points.length];
		area += point.x * next.y - next.x * point.y;
	});
	return Math.abs(area) / 2;
}

/** Abramowitz–Stegun 7.1.27 (the shader uses the same one). */
function erf(x: number): number {
	const a = Math.abs(x);
	const t = 1 + (0.278393 + (0.230389 + 0.078108 * a * a) * a) * a;
	const t4 = t * t * t * t;
	return Math.sign(x) * (1 - 1 / t4);
}

/** Share of a box (half size) that a Gaussian of σ centred on it keeps: the peak of a blurred box. */
function boxCover(halfSize: FinalePoint, sigma: number): number {
	const k = Math.SQRT1_2 / Math.max(sigma, 1e-3);
	return erf(halfSize.x * k) * erf(halfSize.y * k);
}

/** The slide itself (world z = 0), lit from its top left. */
export function slideShadowGround(viewport: FinaleViewport): FinaleShadowGround {
	return { origin: { x: 0, y: 0, z: 0 }, x: { x: 1, y: 0, z: 0 }, y: { x: 0, y: 1, z: 0 }, z: { x: 0, y: 0, z: 1 }, unit: cameraDistance(viewport) };
}

/**
 * The hero comes down while the camera flies back to the slide, so its
 * "slide" is filmed in the camera's frame: a plane square to the lens, behind
 * the card by a share of its depth that shrinks to nothing as it lands (where
 * this becomes the slide itself), lit from the top left of the frame.
 */
export function heroShadowGround(world: Vec3, basis: FinaleCameraBasis, depth: number, lift: number): FinaleShadowGround {
	const behind = SHADOW.heroHeight * Math.max(depth, 1) * clamp(lift);
	const back = basis.forward;
	return {
		origin: { x: world.x + back.x * behind, y: world.y + back.y * behind, z: world.z + back.z * behind },
		x: basis.right,
		y: basis.up,
		z: { x: -back.x, y: -back.y, z: -back.z },
		unit: Math.max(depth, 1),
	};
}

/** The key light's centre in ground coordinates (px; z is its height). */
export function shadowLight(ground: FinaleShadowGround): Vec3 {
	const reach = SHADOW.lightDistance * ground.unit;
	return { x: FINALE_LIGHT_DIRECTION.x * reach, y: FINALE_LIGHT_DIRECTION.y * reach, z: FINALE_LIGHT_DIRECTION.z * reach };
}

function shadowFalloff(ground: FinaleShadowGround): FinaleShadowFalloff {
	return {
		sigmaMin: SHADOW.sigmaMin,
		// A disc light of radius R at height H spreads a point at height h over a disc of R·h/(H−h); σ is half that.
		penumbra: (SHADOW.lightRadius * ground.unit) / 2,
		lightHeight: shadowLight(ground).z,
		cast: SHADOW.cast,
		fillHeight: SHADOW.fillHeight * ground.unit,
		contact: SHADOW.contact,
		contactFade: SHADOW.contactFade,
		contactSigma: SHADOW.contactSigma,
		contactSpread: SHADOW.contactSpread,
	};
}

function castSigma(height: number, falloff: FinaleShadowFalloff): number {
	const h = Math.max(0, height);
	return falloff.sigmaMin + (falloff.penumbra * h) / Math.max(falloff.lightHeight - h, 1);
}

function contactSigma(height: number, falloff: FinaleShadowFalloff): number {
	return falloff.contactSigma + falloff.contactSpread * Math.max(0, height);
}

/**
 * The shadow a landing tile casts on the slide, from its actual pose: the
 * card's rect (tilt, spin and height included) is projected from a soft key
 * light up and to the top left onto the ground, so a high card's shadow is
 * thrown down and to the right, a little larger than the card, and a tilted
 * card casts a trapezoid. The penumbra grows with each point's height (sharp
 * where the card nearly touches, broad and faint where it is high), and a
 * tight contact shadow darkens right under it at touchdown. It fades in as
 * the card starts down and out once it lies flat, before the hand-off to the
 * DOM tile. Null outside that window.
 */
export function landingShadow(time: number, order: number, pose: FinaleCardPose, viewport: FinaleViewport, ground: FinaleShadowGround = slideShadowGround(viewport), radius = 0): FinaleLandingShadow | null {
	const landing = order === 0 ? CUE.zoomEnd : tileFallStart(order);
	return landingShadowIn({ start: landing, settled: touchdownTime(order) }, time, pose, viewport, ground, radius);
}

/** When a landing card's shadow exists: from `start` (it starts down) to just after `settled` (it lies flat). */
export interface FinaleShadowWindow {
	readonly start: number;
	readonly settled: number;
}

/** `landingShadow` for any landing, timed by an explicit window rather than a bento tile's order. */
export function landingShadowIn(window: FinaleShadowWindow, time: number, pose: FinaleCardPose, viewport: FinaleViewport, ground: FinaleShadowGround = slideShadowGround(viewport), radius = 0): FinaleLandingShadow | null {
	const landing = window.start;
	const settled = window.settled;
	if (time < landing || time > settled + SHADOW.fadeOut) return null;
	const presence = smooth(progress(time, landing, landing + SHADOW.fadeIn)) * (1 - smooth(progress(time, settled, settled + SHADOW.fadeOut)));
	if (presence <= 0) return null;

	const world = poseToWorld(pose, viewport);
	const offsetWorld = { x: world.x - ground.origin.x, y: world.y - ground.origin.y, z: world.z - ground.origin.z };
	const centre = { x: dot3(offsetWorld, ground.x), y: dot3(offsetWorld, ground.y), z: dot3(offsetWorld, ground.z) };
	const axes = cardAxes(pose);
	const a = { x: dot3(axes.across, ground.x), y: dot3(axes.across, ground.y), z: dot3(axes.across, ground.z) };
	const b = { x: dot3(axes.up, ground.x), y: dot3(axes.up, ground.y), z: dot3(axes.up, ground.z) };
	const light = shadowLight(ground);
	// Card px [u, 1] → homogeneous ground point: along the ray from the light, and straight down.
	const castToGround = [
		light.z * a.x - a.z * light.x, light.z * b.x - b.z * light.x, light.z * centre.x - centre.z * light.x,
		light.z * a.y - a.z * light.y, light.z * b.y - b.z * light.y, light.z * centre.y - centre.z * light.y,
		-a.z, -b.z, light.z - centre.z,
	];
	const contactToGround = [a.x, b.x, centre.x, a.y, b.y, centre.y, 0, 0, 1];
	const castToCard = invert3(castToGround);
	const contactToCard = invert3(contactToGround);
	// Edge-on to the ground there is no footprint to speak of.
	if (!castToCard || !contactToCard) return null;

	const halfSize = { x: pose.width / 2, y: pose.height / 2 };
	const corners = [
		{ x: -halfSize.x, y: -halfSize.y },
		{ x: halfSize.x, y: -halfSize.y },
		{ x: halfSize.x, y: halfSize.y },
		{ x: -halfSize.x, y: halfSize.y },
	];
	const castFootprint = corners.map((corner) => applyHomography(castToGround, corner));
	const contactFootprint = corners.map((corner) => applyHomography(contactToGround, corner));
	const heightPlane: [number, number, number] = [a.z, b.z, centre.z];
	const cornerHeights = corners.map((corner) => a.z * corner.x + b.z * corner.y + centre.z);
	const highest = Math.max(...cornerHeights);
	const base = shadowFalloff(ground);
	// Contact occlusion only exists near the ground: off entirely (and skipped by the shader) until a corner gets close.
	const touching = Math.exp(-Math.max(0, Math.min(...cornerHeights)) / base.contactFade) > 0.004;
	const falloff = touching ? base : { ...base, contact: 0 };

	// Everything the blur can reach: the footprints, grown by 3σ at the highest corner
	// (the contact layer only counts while it is dense enough to see).
	const contactReach = touching ? contactSigma(Math.min(highest, base.contactFade * 4), base) : 0;
	const reach = 3 * Math.max(castSigma(highest, falloff), contactReach) + 2;
	const all = touching ? [...castFootprint, ...contactFootprint] : castFootprint;
	const minX = Math.min(...all.map((point) => point.x)) - reach;
	const minY = Math.min(...all.map((point) => point.y)) - reach;
	const maxX = Math.max(...all.map((point) => point.x)) + reach;
	const maxY = Math.max(...all.map((point) => point.y)) + reach;

	const height = Math.max(0, centre.z);
	const blur = castSigma(height, falloff);
	const castCentre = applyHomography(castToGround, { x: 0, y: 0 });
	const castPeak = (falloff.cast / (1 + height / falloff.fillHeight)) * boxCover(halfSize, blur);
	const contactPeak = falloff.contact * Math.exp(-height / falloff.contactFade) * boxCover(halfSize, contactSigma(height, falloff));
	return {
		cast: { toCard: castToCard, footprint: castFootprint },
		contact: { toCard: contactToCard, footprint: contactFootprint },
		halfSize,
		radius: Math.min(Math.max(0, radius), halfSize.x, halfSize.y),
		heightPlane,
		falloff,
		bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
		presence,
		height,
		blur,
		offset: { x: castCentre.x - centre.x, y: castCentre.y - centre.y },
		scale: polygonArea(castFootprint) / Math.max(1, pose.width * pose.height),
		opacity: presence * (1 - (1 - castPeak) * (1 - contactPeak)),
	};
}

/** The shortest a landed tile's sheet takes to dissolve off its DOM face. */
const TILE_DISSOLVE = 0.12;

/**
 * How long the frame's smear is still coming up over tile `order` once it has
 * touched down: until the swoop rising as it lands peaks (0 if none is).
 */
function smearRiseAfterLanding(order: number, tileCount = 6): number {
	const touchdown = touchdownTime(order);
	let rise = 0;
	for (let other = 1; other < tileCount; other += 1) {
		const start = tileFallStart(other);
		const peak = start + CUE.tileFall * SWOOP_PEAK;
		if (touchdown >= start && touchdown < peak) rise = Math.max(rise, peak - touchdown);
	}
	return rise;
}

/**
 * A landed tile hands over from its GL sheet to its crisp DOM face, the sheet
 * dissolving off it, gone `CUE.tileHandoff` + `TILE_DISSOLVE` after touchdown.
 * The frame's smear films every sheet still in GL, so the dissolve is what
 * clears a landed tile; it takes at least as long as the smear was still coming
 * up over the tile after it landed, so the smear never leaves a tile faster than
 * it arrived. The tiles after the first land smeared, mid-swoop, and dissolve
 * in `TILE_DISSOLVE`; the hero lands crisp just as the first swoop sets off, and
 * eases out of the smear over that swoop's rise.
 */
export function tileHandoff(time: number, order: number): number {
	const end = touchdownTime(order) + CUE.tileHandoff + TILE_DISSOLVE;
	return progress(time, end - Math.max(TILE_DISSOLVE, smearRiseAfterLanding(order)), end);
}

/* ─── Through the lens ────────────────────────────────────────────────── */

/** A pose's centre in world space (y up, origin at the centre of the slide). */
export function poseToWorld(pose: FinaleCardPose, viewport: FinaleViewport): Vec3 {
	return { x: pose.x - viewport.width / 2, y: viewport.height / 2 - pose.y, z: pose.z };
}

/** Approximate on-screen rect of a pose as filmed by `rig`. */
export function projectPose(pose: FinaleCardPose, viewport: FinaleViewport, rig: FinaleCameraRig = identityRig(viewport)): FinaleRect {
	const view = toView(poseToWorld(pose, viewport), rig);
	const scale = cameraDistance(viewport) / Math.max(1, view.z);
	const cx = viewport.width / 2 + view.x * scale;
	const cy = viewport.height / 2 - view.y * scale;
	const width = pose.width * scale * Math.abs(Math.cos(pose.rotateY));
	const height = pose.height * scale * Math.abs(Math.cos(pose.rotateX));
	return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Depth-fog toward the slide colour, by distance from the lens. */
export function fogAtDepth(depth: number, viewport: FinaleViewport): number {
	const distance = cameraDistance(viewport);
	return clamp((depth - distance * 1.2) / (distance * 2.1)) * 0.85;
}

/** Sheets fade as they reach the lens (and are culled behind it). */
export function lensFade(depth: number, viewport: FinaleViewport): number {
	const distance = cameraDistance(viewport);
	return smooth(progress(depth, distance * 0.1, distance * 0.3));
}

/* ─── Cloth ───────────────────────────────────────────────────────────── */

/** Window the sheet "feels" its motion over: the cloth answers with a little inertia. */
const CLOTH_LAG = 0.12;

/**
 * How a card moves as the camera sees it (px/s, world axes), averaged over
 * the cloth's lag: its own flight plus the camera's sweep, so sheets bend as
 * the camera pans past them. The weight fades out as a tile settles.
 */
export function cardVelocity(time: number, input: FinaleCardInput, viewport: FinaleViewport, subject: FinaleRect): Vec3 & { readonly weight: number } {
	const now = cardPose(time, input, viewport);
	const before = cardPose(time - CLOTH_LAG, input, viewport);
	const rigNow = finaleCameraRig(time, viewport, subject);
	const basis = cameraBasis(rigNow);
	const viewNow = toView(poseToWorld(now, viewport), rigNow, basis);
	const viewBefore = toView(poseToWorld(before, viewport), finaleCameraRig(time - CLOTH_LAG, viewport, subject));
	const velocity = fromView({ x: (viewNow.x - viewBefore.x) / CLOTH_LAG, y: (viewNow.y - viewBefore.y) / CLOTH_LAG, z: (viewNow.z - viewBefore.z) / CLOTH_LAG }, basis);
	return { ...velocity, weight: now.lift * now.opacity };
}

/* ─── Chromatic dispersion ────────────────────────────────────────────── */

/** A tile's swoop smear peaks this share of the way into its fall. */
const SWOOP_PEAK = 0.35;

function bump(time: number, start: number, peak: number, end: number): number {
	if (time <= start || time >= end) return 0;
	return time < peak ? smooth(progress(time, start, peak)) : 1 - smooth(progress(time, peak, end));
}

/**
 * Strength of the screen-space spectral smear (0 = untouched frame). It swells
 * with the burst, follows the camera's speed through the field, and on the
 * rush to the hero it goes long — a time-warp zoom with the edges streaking
 * radially. It flicks on each tile swoop; frame 0 and the final bento are
 * always clean.
 */
export function chromaStrength(time: number, viewport: FinaleViewport, subject: FinaleRect, tileCount = 6): number {
	if (time <= CUE.burst) return 0;
	const burst = bump(time, CUE.burst, CUE.burst + 0.4, CUE.burst + 1.4) * 0.55;
	// The camera only drives the smear while it is seen moving: through the rush's arrival.
	const camera = time < CUE.zoomEnd ? clamp(cameraSpeed(time, viewport, subject) / (cameraDistance(viewport) * 3)) : 0;
	const warp = bump(time, CUE.zoom, CUE.zoom + 0.45, CUE.zoomEnd) * 0.7;
	let swoop = 0;
	for (let order = 1; order < tileCount; order += 1) {
		const start = tileFallStart(order);
		swoop = Math.max(swoop, bump(time, start, start + CUE.tileFall * SWOOP_PEAK, touchdownTime(order)) * 0.4);
	}
	return Math.min(1.8, Math.max(burst, camera * 1.1) + warp + swoop);
}

/**
 * Spherical lens warp (0 = flat): while the camera is out in the field the
 * frame bulges as if the field were painted inside a sphere, deepening on the
 * rush; the column hand-off and the bento are always flat.
 */
export function sphereWarp(time: number): number {
	// Only once the deck is out of the column, so nothing warps as it leaves.
	const field = smooth(progress(time, CUE.burst + 0.6, CUE.burst + 1.4)) * (1 - smooth(progress(time, CUE.zoomEnd, CUE.heroLand)));
	return field * 0.22 + bump(time, CUE.zoom, CUE.zoom + 0.45, CUE.zoomEnd + 0.2) * 0.35;
}

export interface FinaleFieldRipple {
	readonly from: FinaleRect;
	readonly start: number;
	readonly amp: number;
	readonly radius?: number;
}
