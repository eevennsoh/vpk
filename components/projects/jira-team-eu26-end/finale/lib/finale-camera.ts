import { CUE } from "../data/finale-cues";
import type { FinaleRect } from "../data/finale-stories";
import { clamp } from "./finale-math";

export interface FinaleViewport {
	readonly width: number;
	readonly height: number;
}

/** Right-handed world space, y up, 1 unit = 1 CSS px on the z = 0 slide plane. */
export interface Vec3 {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

/** Vertical field of view of the GL camera; distance follows so z = 0 maps 1 unit to 1 CSS px. */
export const FINALE_CAMERA_FOV = 30;

/** Resting camera distance, which is also the focal length in px. */
export function cameraDistance(viewport: FinaleViewport): number {
	return viewport.height / 2 / Math.tan((FINALE_CAMERA_FOV * Math.PI) / 360);
}

/**
 * Where a point lifted `z` toward the lens (x right, y down, viewport px)
 * shows on screen, filmed by the resting camera, and how much larger
 * anything there looks than on the z = 0 plane.
 */
export function projectLifted(point: { readonly x: number; readonly y: number; readonly z: number }, viewport: FinaleViewport): { x: number; y: number; scale: number } {
	const distance = cameraDistance(viewport);
	const scale = distance / Math.max(1, distance - point.z);
	return { x: viewport.width / 2 + (point.x - viewport.width / 2) * scale, y: viewport.height / 2 + (point.y - viewport.height / 2) * scale, scale };
}

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const length = (a: Vec3): number => Math.sqrt(dot(a, a));
const normalize = (a: Vec3): Vec3 => {
	const size = length(a) || 1;
	return { x: a.x / size, y: a.y / size, z: a.z / size };
};

/** Where the first card MCB dragged waits deep in the field for the long zoom. */
export function heroAnchor(viewport: FinaleViewport): Vec3 {
	const distance = cameraDistance(viewport);
	const z = -distance * 1.7;
	const depth = (distance - z) / distance;
	return { x: viewport.width * 0.13 * depth, y: viewport.height * 0.1 * depth, z };
}

/** The hero fills this share of the frame width when the rush arrives. */
export const HERO_FRAME_SHARE = 0.52;

export interface FinaleCameraRig {
	readonly position: Vec3;
	readonly target: Vec3;
	/** Bank about the view axis, radians (positive = counter-clockwise). */
	readonly roll: number;
}

interface CameraKey extends FinaleCameraRig {
	readonly time: number;
	/** Arrive at rest (zero velocity) instead of flowing through. */
	readonly settle?: boolean;
}

export function identityRig(viewport: FinaleViewport): FinaleCameraRig {
	return { position: { x: 0, y: 0, z: cameraDistance(viewport) }, target: { x: 0, y: 0, z: 0 }, roll: 0 };
}

/**
 * The shot list for the exploding field, as camera keys:
 *   recoil   — the cards burst at the lens; the camera flinches back and turns to the column
 *   reveal   — it cranes back and swings left, banking, to show the whole field
 *   sweep    — a low arc to the right, close enough for cards to slide past the lens
 *   find     — it settles on the first card MCB dragged, small and far away
 *   rush     — a long zoom from afar through the field, arriving face-on to it
 *   land     — back to the slide as that card becomes the first bento tile
 */
function cameraKeys(viewport: FinaleViewport, subject: FinaleRect): readonly CameraKey[] {
	const distance = cameraDistance(viewport);
	const w = viewport.width;
	const h = viewport.height;
	const hero = heroAnchor(viewport);
	const close = (subject.width * distance) / (w * HERO_FRAME_SHARE);
	const rest = identityRig(viewport);
	return [
		// Holds on the column for the first instant of the toss.
		{ time: 0, ...rest, settle: true },
		{ time: CUE.burst + 0.2, ...rest, settle: true },
		{ time: CUE.recoil, position: { x: w * 0.12, y: h * 0.02, z: distance * 1.15 }, target: { x: w * 0.2, y: 0, z: -distance * 0.35 }, roll: -0.03 },
		{ time: CUE.wide, position: { x: -w * 0.3, y: h * 0.14, z: distance * 1.45 }, target: { x: w * 0.05, y: 0, z: -distance * 0.7 }, roll: 0.07 },
		{ time: CUE.sweep, position: { x: w * 0.28, y: -h * 0.12, z: distance * 0.95 }, target: { x: 0, y: h * 0.02, z: -distance * 0.9 }, roll: -0.09 },
		{ time: CUE.zoom, position: add(hero, { x: w * 0.18, y: -h * 0.06, z: distance * 1.9 }), target: hero, roll: 0.02 },
		{ time: CUE.zoomEnd, position: add(hero, { x: 0, y: 0, z: close }), target: hero, roll: 0, settle: true },
		{ time: CUE.heroLand, ...rest, settle: true },
	];
}

function hermite(p0: number, m0: number, p1: number, m1: number, s: number, span: number): number {
	const s2 = s * s;
	const s3 = s2 * s;
	return (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 * span + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1 * span;
}

type Channel = (key: CameraKey) => number;

const CHANNELS: readonly Channel[] = [
	(key) => key.position.x,
	(key) => key.position.y,
	(key) => key.position.z,
	(key) => key.target.x,
	(key) => key.target.y,
	(key) => key.target.z,
	(key) => key.roll,
];

/** Catmull-Rom tangent (per second) of a channel at key `index`; zero where the camera settles. */
function tangent(keys: readonly CameraKey[], index: number, channel: Channel): number {
	const key = keys[index];
	if (key.settle || index === 0 || index === keys.length - 1) return 0;
	const before = keys[index - 1];
	const after = keys[index + 1];
	return (channel(after) - channel(before)) / (after.time - before.time);
}

/**
 * The camera at `time`: a C1 spline through the shot keys, identical to the
 * resting slide camera on frame 0 and from the hero's landing on, so the
 * board hand-off and every bento measurement stay pixel-exact.
 */
export function finaleCameraRig(time: number, viewport: FinaleViewport, subject: FinaleRect): FinaleCameraRig {
	const keys = cameraKeys(viewport, subject);
	const last = keys[keys.length - 1];
	if (time <= 0 || time >= last.time) return identityRig(viewport);
	let index = 0;
	while (index < keys.length - 2 && time >= keys[index + 1].time) index += 1;
	const from = keys[index];
	const to = keys[index + 1];
	const span = to.time - from.time;
	const s = clamp((time - from.time) / span);
	const values = CHANNELS.map((channel) => hermite(channel(from), tangent(keys, index, channel), channel(to), tangent(keys, index + 1, channel), s, span));
	return {
		position: { x: values[0], y: values[1], z: values[2] },
		target: { x: values[3], y: values[4], z: values[5] },
		roll: values[6],
	};
}

export interface FinaleCameraBasis {
	readonly right: Vec3;
	readonly up: Vec3;
	readonly forward: Vec3;
}

/** The camera's view axes (matching three.js `lookAt` followed by a roll about the view axis). */
export function cameraBasis(rig: FinaleCameraRig): FinaleCameraBasis {
	const forward = normalize(sub(rig.target, rig.position));
	const flatRight = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
	const flatUp = cross(flatRight, forward);
	const cos = Math.cos(rig.roll);
	const sin = Math.sin(rig.roll);
	return {
		right: add({ x: flatRight.x * cos, y: flatRight.y * cos, z: flatRight.z * cos }, flatUp, sin),
		up: add({ x: flatUp.x * cos, y: flatUp.y * cos, z: flatUp.z * cos }, flatRight, -sin),
		forward,
	};
}

/** A world point in camera space: x right, y up, z = depth along the view axis. */
export function toView(point: Vec3, rig: FinaleCameraRig, basis = cameraBasis(rig)): Vec3 {
	const offset = sub(point, rig.position);
	return { x: dot(offset, basis.right), y: dot(offset, basis.up), z: dot(offset, basis.forward) };
}

/** Camera-space vector back to world axes. */
export function fromView(vector: Vec3, basis: FinaleCameraBasis): Vec3 {
	return add(add({ x: basis.right.x * vector.x, y: basis.right.y * vector.x, z: basis.right.z * vector.x }, basis.up, vector.y), basis.forward, vector.z);
}

/** Camera speed (px/s), folding in how fast the view swings (target speed). */
export function cameraSpeed(time: number, viewport: FinaleViewport, subject: FinaleRect): number {
	const step = 1 / 120;
	const a = finaleCameraRig(time - step, viewport, subject);
	const b = finaleCameraRig(time + step, viewport, subject);
	const move = length(sub(b.position, a.position));
	const swing = length(sub(b.target, a.target));
	return (move + swing * 0.5) / (step * 2);
}

