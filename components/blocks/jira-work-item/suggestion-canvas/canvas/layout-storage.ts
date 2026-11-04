import { clampCamera, clampCoordinate, DEFAULT_CAMERA, type CanvasCamera, type CanvasPoint } from "./camera.ts";

/** Saved layout: camera and item positions only. Membership, names and sizes always come from the registry. */
export const LAYOUT_STORAGE_KEY = "vpk:canvas:jira-suggestion-panel:layout";
export const LAYOUT_VERSION = 1;
const MAX_DOCUMENT_BYTES = 16_384;
const MAX_POSITIONS = 64;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export interface CanvasLayout {
	camera: CanvasCamera;
	positions: Readonly<Record<string, CanvasPoint>>;
}

interface StoredLayoutV1 {
	version: 1;
	camera: CanvasCamera;
	positions: Record<string, CanvasPoint>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readCamera(value: unknown): CanvasCamera | null {
	if (!isRecord(value)) return null;
	const x = readNumber(value.x);
	const y = readNumber(value.y);
	const zoom = readNumber(value.zoom);
	if (x == null || y == null || zoom == null) return null;
	return clampCamera({ x, y, zoom });
}

function readPoint(value: unknown): CanvasPoint | null {
	if (!isRecord(value)) return null;
	const x = readNumber(value.x);
	const y = readNumber(value.y);
	if (x == null || y == null) return null;
	return { x: clampCoordinate(x), y: clampCoordinate(y) };
}

/** Parse untrusted stored JSON. Keeps only valid positions for ids the registry still knows. */
export function parseCanvasLayout(raw: string | null, knownIds: ReadonlySet<string>): CanvasLayout | null {
	if (raw == null || raw.length > MAX_DOCUMENT_BYTES) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isRecord(parsed) || parsed.version !== LAYOUT_VERSION) return null;
	const camera = readCamera(parsed.camera) ?? DEFAULT_CAMERA;
	const positions: Record<string, CanvasPoint> = {};
	if (isRecord(parsed.positions)) {
		for (const [id, value] of Object.entries(parsed.positions).slice(0, MAX_POSITIONS)) {
			if (!ID_PATTERN.test(id) || !knownIds.has(id)) continue;
			const point = readPoint(value);
			if (point) positions[id] = point;
		}
	}
	return { camera, positions };
}

export function serializeCanvasLayout(layout: CanvasLayout, knownIds: ReadonlySet<string>): string {
	const positions: Record<string, CanvasPoint> = {};
	for (const [id, point] of Object.entries(layout.positions)) {
		if (knownIds.has(id)) positions[id] = { x: clampCoordinate(point.x), y: clampCoordinate(point.y) };
	}
	const document: StoredLayoutV1 = { version: LAYOUT_VERSION, camera: clampCamera(layout.camera), positions };
	return JSON.stringify(document);
}

export function loadCanvasLayout(knownIds: ReadonlySet<string>): CanvasLayout | null {
	try {
		return parseCanvasLayout(window.localStorage.getItem(LAYOUT_STORAGE_KEY), knownIds);
	} catch {
		return null;
	}
}

export function saveCanvasLayout(layout: CanvasLayout, knownIds: ReadonlySet<string>): void {
	try {
		window.localStorage.setItem(LAYOUT_STORAGE_KEY, serializeCanvasLayout(layout, knownIds));
	} catch {
		// Storage unavailable or over quota: the canvas keeps working with an unsaved layout.
	}
}
