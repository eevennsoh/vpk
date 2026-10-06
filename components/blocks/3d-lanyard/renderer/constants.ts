import type { LanyardFormat, Strand, Vec3 } from "./types";

export const physicsDuration = 6;
export const swingStart = 1.2, swingPeriod = 4.8, swingCycles = 2;
export const duration = Math.round((swingStart + swingPeriod * swingCycles) * 1000) / 1000;
export const dimensions: Record<LanyardFormat, readonly [number, number]> = { portrait: [1080, 1440], wide: [1920, 1080], square: [1440, 1440] };

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const DEG = Math.PI / 180;
export const GRAVITY = 4400, RELEASE = .05, FALL = 1120;
// Figma 40:17760: 360 × 480 card, centered on the existing hook axis.
export const CARD = { x: 30, y: 394, width: 360, height: 480, radius: 24, header: 230, paddingX: 24, paddingY: 28 };
export const HOLE_R = 10;
export const CRIMP = { top: -142, bottom: -64, halfWidth: 33, radius: 9, centerZ: -1, entryHalfWidth: 28 };
export const STEPS = 240, LINKS = 22;
// Both cards turn about the SAME hole axis. Their 3.4-unit thicknesses are
// separated by a 4.6-unit clearance, so the fanning sheets cannot cross.
export const HOLE = { x: 0, y: 113, z: 0 }, REAR_DEPTH = -8;

export const distance = (a: Vec3, b: Vec3) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

// Assembly order is permanent: right strap behind, left strap in front.
// Both are clamped into the same collar and cannot trade places as it turns.
export const STRANDS: Strand[] = [
	{ anchor: { x: 547.52, y: -1200, z: -2 }, local: { x: 6, y: -133, z: 0 }, width: 42, rear: true, length: 0 },
	{ anchor: { x: -137.25, y: -1200, z: 0 }, local: { x: -6, y: -133, z: 0 }, width: 50, rear: false, length: 0 },
];
STRANDS.forEach((s) => { s.length = distance(s.anchor, { x: 210 + s.local.x, y: 306 + s.local.y, z: s.local.z }); });
