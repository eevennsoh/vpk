import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { clampCamera, COORDINATE_LIMIT, fitCamera, MAX_ZOOM, MIN_ZOOM, revealDelta, zoomAt } from "./camera.ts";
import { LAYOUT_VERSION, parseCanvasLayout, serializeCanvasLayout } from "./layout-storage.ts";

const KNOWN = new Set(["ledger-popover", "focus-deck"]);

describe("canvas camera", () => {
	test("zoomAt keeps the canvas point under the anchor fixed in both directions", () => {
		const start = { x: 120, y: -40, zoom: 0.8 };
		const anchor = { x: 500, y: 300 };
		const canvasPoint = { x: (anchor.x - start.x) / start.zoom, y: (anchor.y - start.y) / start.zoom };
		for (const nextZoom of [2.4, 0.25]) {
			const next = zoomAt(start, anchor, nextZoom);
			assert.ok(Math.abs(canvasPoint.x * next.zoom + next.x - anchor.x) < 1e-9);
			assert.ok(Math.abs(canvasPoint.y * next.zoom + next.y - anchor.y) < 1e-9);
		}
	});

	test("zoom and coordinates stay finite and bounded", () => {
		assert.equal(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0 }, 99).zoom, MAX_ZOOM);
		assert.equal(zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0 }, 0).zoom, MIN_ZOOM);
		const wild = clampCamera({ x: Number.POSITIVE_INFINITY, y: -1e12, zoom: Number.NaN });
		assert.deepEqual(wild, { x: 0, y: -COORDINATE_LIMIT, zoom: 1 });
	});

	test("fitCamera centres bounds and never zooms past 100%", () => {
		const small = fitCamera({ x: 0, y: 0, width: 100, height: 100 }, { width: 1000, height: 800 });
		assert.deepEqual(small, { x: 450, y: 350, zoom: 1 });
		const large = fitCamera({ x: 0, y: 0, width: 4000, height: 1000 }, { width: 1000, height: 800 }, 50);
		assert.equal(large.zoom, 900 / 4000);
	});

	test("revealDelta pans only as far as needed", () => {
		assert.deepEqual(revealDelta({ x: 100, y: 100, width: 40, height: 20 }, { width: 800, height: 600 }), { x: 0, y: 0 });
		assert.deepEqual(revealDelta({ x: 790, y: 100, width: 40, height: 20 }, { width: 800, height: 600 }), { x: -62, y: 0 });
	});
});

describe("canvas layout storage", () => {
	test("round-trips camera and positions for known ids", () => {
		const raw = serializeCanvasLayout({ camera: { x: 10, y: 20, zoom: 0.5 }, positions: { "focus-deck": { x: 4, y: 8 }, removed: { x: 1, y: 1 } } }, KNOWN);
		assert.deepEqual(parseCanvasLayout(raw, KNOWN), { camera: { x: 10, y: 20, zoom: 0.5 }, positions: { "focus-deck": { x: 4, y: 8 } } });
	});

	test("ignores stale ids, invalid ids, non-finite values and saved membership", () => {
		const raw = JSON.stringify({
			version: LAYOUT_VERSION,
			camera: { x: 1, y: 2, zoom: 1 },
			positions: { "ledger-popover": { x: "1", y: 2 }, "focus-deck": { x: 3, y: 4 }, "gone": { x: 0, y: 0 }, "__proto__": { x: 0, y: 0 } },
			names: { "focus-deck": "Injected" },
			hidden: ["focus-deck"],
		});
		assert.deepEqual(parseCanvasLayout(raw, KNOWN), { camera: { x: 1, y: 2, zoom: 1 }, positions: { "focus-deck": { x: 3, y: 4 } } });
	});

	test("rejects malformed, oversized and unknown-version documents", () => {
		assert.equal(parseCanvasLayout("{not json", KNOWN), null);
		assert.equal(parseCanvasLayout(JSON.stringify({ version: 99, camera: { x: 0, y: 0, zoom: 1 } }), KNOWN), null);
		assert.equal(parseCanvasLayout("x".repeat(20_000), KNOWN), null);
		assert.equal(parseCanvasLayout(null, KNOWN), null);
	});

	test("clamps an out-of-range saved camera instead of dropping it", () => {
		const raw = JSON.stringify({ version: LAYOUT_VERSION, camera: { x: 0, y: 0, zoom: 40 }, positions: {} });
		assert.equal(parseCanvasLayout(raw, KNOWN)?.camera.zoom, MAX_ZOOM);
	});
});
