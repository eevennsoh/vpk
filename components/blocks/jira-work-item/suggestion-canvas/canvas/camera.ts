/** Pure camera math for the suggestion canvas. Screen point = canvas point × zoom + (x, y). */

export interface CanvasCamera {
	x: number;
	y: number;
	zoom: number;
}

export interface CanvasPoint {
	x: number;
	y: number;
}

export interface CanvasRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
/** Camera offsets and item positions stay inside ±COORDINATE_LIMIT canvas pixels. */
export const COORDINATE_LIMIT = 100_000;
export const DEFAULT_CAMERA: CanvasCamera = { x: 48, y: 48, zoom: 1 };

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function clampZoom(zoom: number): number {
	return clamp(finiteOr(zoom, 1), MIN_ZOOM, MAX_ZOOM);
}

export function clampCoordinate(value: number): number {
	return clamp(finiteOr(value, 0), -COORDINATE_LIMIT, COORDINATE_LIMIT);
}

export function clampCamera(camera: CanvasCamera): CanvasCamera {
	const zoom = clampZoom(camera.zoom);
	const limit = COORDINATE_LIMIT * zoom;
	return {
		x: clamp(finiteOr(camera.x, 0), -limit, limit),
		y: clamp(finiteOr(camera.y, 0), -limit, limit),
		zoom,
	};
}

/** Zoom to `nextZoom` while the canvas point under `anchor` (screen space) stays fixed. */
export function zoomAt(camera: CanvasCamera, anchor: CanvasPoint, nextZoom: number): CanvasCamera {
	const zoom = clampZoom(nextZoom);
	const canvasX = (anchor.x - camera.x) / camera.zoom;
	const canvasY = (anchor.y - camera.y) / camera.zoom;
	return clampCamera({ x: anchor.x - canvasX * zoom, y: anchor.y - canvasY * zoom, zoom });
}

export function panBy(camera: CanvasCamera, dx: number, dy: number): CanvasCamera {
	return clampCamera({ ...camera, x: camera.x + dx, y: camera.y + dy });
}

export function screenToCanvas(camera: CanvasCamera, point: CanvasPoint): CanvasPoint {
	return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
}

export function unionRects(rects: readonly CanvasRect[]): CanvasRect | null {
	if (rects.length === 0) return null;
	let left = Infinity;
	let top = Infinity;
	let right = -Infinity;
	let bottom = -Infinity;
	for (const rect of rects) {
		left = Math.min(left, rect.x);
		top = Math.min(top, rect.y);
		right = Math.max(right, rect.x + rect.width);
		bottom = Math.max(bottom, rect.y + rect.height);
	}
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Camera that fits `bounds` inside a viewport with `padding`, never zooming past 100%. */
export function fitCamera(bounds: CanvasRect, viewport: { width: number; height: number }, padding = 48): CanvasCamera {
	const availableWidth = Math.max(1, viewport.width - padding * 2);
	const availableHeight = Math.max(1, viewport.height - padding * 2);
	const zoom = clampZoom(Math.min(availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height), 1));
	return clampCamera({
		x: (viewport.width - bounds.width * zoom) / 2 - bounds.x * zoom,
		y: (viewport.height - bounds.height * zoom) / 2 - bounds.y * zoom,
		zoom,
	});
}

/** Smallest pan that brings `rect` (screen space) inside the viewport with `margin`. */
export function revealDelta(rect: CanvasRect, viewport: { width: number; height: number }, margin = 32): CanvasPoint {
	const axis = (start: number, size: number, limit: number) => {
		if (size + margin * 2 > limit || start < margin) return margin - start;
		if (start + size > limit - margin) return limit - margin - (start + size);
		return 0;
	};
	return { x: axis(rect.x, rect.width, viewport.width), y: axis(rect.y, rect.height, viewport.height) };
}
