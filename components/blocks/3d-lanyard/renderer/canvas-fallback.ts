import { backdropDepth } from "./gpu";
import type { Face, LanyardSurface, Vec2 } from "./types";

const tints = new WeakMap<LanyardSurface, Map<number, LanyardSurface>>();

function tinted(image: LanyardSurface, shade: number) {
	const level = Math.round(shade * 32);
	if (level <= 0) return image;
	let entries = tints.get(image);
	if (!entries) { entries = new Map(); tints.set(image, entries); }
	let tile = entries.get(level);
	if (!tile) {
		const canvas = document.createElement("canvas");
		canvas.width = image.width; canvas.height = image.height;
		const c = canvas.getContext("2d")!;
		c.drawImage(image, 0, 0);
		c.globalCompositeOperation = "source-atop"; c.fillStyle = `rgba(0,0,0,${level / 32 * .92})`;
		c.fillRect(0, 0, canvas.width, canvas.height);
		entries.set(level, canvas);
		tile = canvas;
	}
	return tile;
}

/** Affine-maps a source triangle of `image` onto a destination triangle. */
export function triangle(ctx: CanvasRenderingContext2D, scale: number, image: LanyardSurface, s: Vec2[], d: Vec2[], shade = 0) {
	const [a, b, c] = s, [p, q, r] = d;
	const det = a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y);
	if (Math.abs(det) < .0001) return;
	const cx = (p.x + q.x + r.x) / 3, cy = (p.y + q.y + r.y) / 3;
	ctx.save(); ctx.beginPath();
	[p, q, r].forEach((v, i) => {
		const n = Math.hypot(v.x - cx, v.y - cy) || 1;
		const x = v.x + (v.x - cx) / n * (.85 / scale), y = v.y + (v.y - cy) / n * (.85 / scale);
		if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
	});
	ctx.closePath(); ctx.clip();
	const A = (p.x * (b.y - c.y) + q.x * (c.y - a.y) + r.x * (a.y - b.y)) / det;
	const B = (p.y * (b.y - c.y) + q.y * (c.y - a.y) + r.y * (a.y - b.y)) / det;
	const C = (p.x * (c.x - b.x) + q.x * (a.x - c.x) + r.x * (b.x - a.x)) / det;
	const D = (p.y * (c.x - b.x) + q.y * (a.x - c.x) + r.y * (b.x - a.x)) / det;
	const E = (p.x * (b.x * c.y - c.x * b.y) + q.x * (c.x * a.y - a.x * c.y) + r.x * (a.x * b.y - b.x * a.y)) / det;
	const F = (p.y * (b.x * c.y - c.x * b.y) + q.y * (c.x * a.y - a.x * c.y) + r.y * (a.x * b.y - b.x * a.y)) / det;
	ctx.transform(A, B, C, D, E, F); ctx.drawImage(tinted(image, shade), 0, 0);
	ctx.restore();
}

/** Software renderer used when WebGL2 is unavailable. */
export function createCanvasFallback(isSolid: (face: Face) => boolean) {
	let shadowLayer: HTMLCanvasElement | undefined, shadowUnion: HTMLCanvasElement | undefined;

	// The Canvas renderer uses projected silhouettes with per-object distance
	// and blur. Opaque grayscale masks merge by maximum, avoiding doubled
	// background shadows where two card silhouettes overlap.
	function drawShadows(target: CanvasRenderingContext2D, groups: Face[][], width: number, height: number, ox: number, oy: number, zoom: number) {
		if (!shadowLayer || !shadowUnion) { shadowLayer = document.createElement("canvas"); shadowUnion = document.createElement("canvas"); }
		const layerCanvas = shadowLayer, unionCanvas = shadowUnion;
		const resolution = Math.min(1, 1000 / Math.max(width, height)), w = Math.ceil(width * resolution), h = Math.ceil(height * resolution);
		for (const c of [layerCanvas, unionCanvas]) if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
		const union = unionCanvas.getContext("2d")!;
		union.setTransform(1, 0, 0, 1, 0, 0); union.globalCompositeOperation = "source-over"; union.filter = "none"; union.fillStyle = "#000"; union.fillRect(0, 0, w, h);
		const groundZ = backdropDepth(groups.flat());
		for (const faces of groups) {
			if (!faces.length) continue;
			const depth = faces.reduce((sum, f) => sum + f.z, 0) / faces.length, separation = Math.max(0, depth - groundZ);
			const ctx = layerCanvas.getContext("2d")!, scale = zoom * resolution;
			ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "source-over"; ctx.clearRect(0, 0, w, h);
			ctx.save(); ctx.translate(ox * resolution, oy * resolution); ctx.scale(scale, scale);
			const solid = new Path2D();
			for (const face of faces) {
				if (isSolid(face)) {
					const [a, b, c] = face.d, ccw = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0;
					solid.moveTo(a.x, a.y); solid.lineTo(ccw ? b.x : c.x, ccw ? b.y : c.y); solid.lineTo(ccw ? c.x : b.x, ccw ? c.y : b.y); solid.closePath();
				} else triangle(ctx, scale, face.image, face.s, face.d, 0);
			}
			ctx.fillStyle = "#fff"; ctx.fill(solid); ctx.restore();
			const strength = Math.round(255 * 180 / (180 + separation));
			ctx.globalCompositeOperation = "source-in"; ctx.fillStyle = `rgb(${strength},${strength},${strength})`; ctx.fillRect(0, 0, w, h);
			ctx.globalCompositeOperation = "destination-over"; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h); ctx.globalCompositeOperation = "source-over";
			union.globalCompositeOperation = "lighten"; union.filter = `blur(${Math.min(80, separation * .20) * zoom * resolution}px)`;
			union.drawImage(layerCanvas, separation * .65 * zoom * resolution, separation * .45 * zoom * resolution);
		}
		target.save(); target.globalCompositeOperation = "multiply"; target.globalAlpha = .19; target.filter = "invert(1)";
		target.drawImage(unionCanvas, 0, 0, width, height); target.restore();
	}

	function drawFaces(ctx: CanvasRenderingContext2D, ordered: Face[], ox: number, oy: number, scale: number) {
		ctx.save(); ctx.translate(ox, oy); ctx.scale(scale, scale);
		for (const face of ordered) triangle(ctx, scale, face.image, face.s, face.d, face.shade);
		ctx.restore();
	}

	return { drawShadows, drawFaces };
}
