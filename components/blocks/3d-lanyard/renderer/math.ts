import { DEG } from "./constants";
import type { Axes, Vec3 } from "./types";

export function rotate(v: Vec3, roll: number, yaw: number, pitch: number): Vec3 {
	const a = pitch * DEG, b = yaw * DEG, c = roll * DEG;
	const y = v.y * Math.cos(a) - v.z * Math.sin(a), z = v.y * Math.sin(a) + v.z * Math.cos(a);
	const x = v.x * Math.cos(b) + z * Math.sin(b), zz = -v.x * Math.sin(b) + z * Math.cos(b);
	return { x: x * Math.cos(c) - y * Math.sin(c), y: x * Math.sin(c) + y * Math.cos(c), z: zz };
}
export const subtract = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const normalize = (a: Vec3): Vec3 => { const n = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / n, y: a.y / n, z: a.z / n }; };
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export function basis(left: Vec3, right: Vec3, hinge: Vec3, offset: boolean): Axes {
	const x = normalize(subtract(right, left));
	const middle = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, z: (left.z + right.z) / 2 };
	const y = normalize(subtract(middle, hinge));
	const z = normalize(cross(x, y));
	return [x, normalize(cross(z, x)), z].map((v, i) => i > 0 && offset ? { x: -v.x, y: -v.y, z: -v.z } : v) as unknown as Axes;
}
export function transform(v: Vec3, axes: Axes): Vec3 {
	return { x: axes[0].x * v.x + axes[1].x * v.y + axes[2].x * v.z,
		y: axes[0].y * v.x + axes[1].y * v.y + axes[2].y * v.z,
		z: axes[0].z * v.x + axes[1].z * v.y + axes[2].z * v.z };
}
