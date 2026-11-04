import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { attachCanvasGestures, CANVAS_SURFACE_ATTR } from "./gestures.ts";

/** A viewport that behaves like a browser for pointer capture: releasing a capture fires `lostpointercapture`. */
class FakeViewport extends EventTarget {
	captured = new Set<number>();
	dataset: Record<string, string> = {};
	clientHeight = 600;
	scrollLeft = 0;
	scrollTop = 0;
	setPointerCapture(id: number) {
		this.captured.add(id);
	}
	hasPointerCapture(id: number) {
		return this.captured.has(id);
	}
	releasePointerCapture(id: number) {
		if (!this.captured.delete(id)) return;
		this.dispatchEvent(pointer("lostpointercapture", id, 0, 0, this));
	}
	getBoundingClientRect() {
		return { left: 0, top: 0, width: 800, height: 600 };
	}
}

class FakeSurface extends EventTarget {
	hasAttribute(name: string) {
		return name === CANVAS_SURFACE_ATTR;
	}
}

function pointer(type: string, pointerId: number, clientX: number, clientY: number, target: EventTarget) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, { pointerId, pointerType: "touch", clientX, clientY, button: 0 });
	Object.defineProperty(event, "target", { value: target });
	return event;
}

const globals = globalThis as Record<string, unknown>;
const saved: Record<string, unknown> = {};

beforeEach(() => {
	for (const key of ["window", "document", "Element"]) saved[key] = globals[key];
	globals.window = new EventTarget();
	globals.document = Object.assign(new EventTarget(), {
		documentElement: { style: {} },
		body: { style: {} },
		activeElement: null,
		hidden: false,
	});
	globals.Element = FakeSurface;
});

afterEach(() => {
	for (const [key, value] of Object.entries(saved)) globals[key] = value;
});

test("a second finger turns a touch pan into a pinch that zooms", () => {
	const viewport = new FakeViewport();
	const surface = new FakeSurface();
	const zooms: number[] = [];
	const controller = {
		camera: { x: 0, y: 0, zoom: 1 },
		pan: () => {},
		zoomAround: (_anchor: unknown, zoom: number) => zooms.push(zoom),
	};
	const detach = attachCanvasGestures(controller as never, viewport as unknown as HTMLElement);

	viewport.dispatchEvent(pointer("pointerdown", 1, 100, 100, surface));
	viewport.dispatchEvent(pointer("pointerdown", 2, 200, 100, surface));
	// Both fingers must still be tracked: the first keeps its capture through the pan-to-pinch handoff.
	assert.equal(viewport.hasPointerCapture(1), true);
	viewport.dispatchEvent(pointer("pointermove", 2, 250, 100, surface));
	viewport.dispatchEvent(pointer("pointermove", 2, 300, 100, surface));

	assert.equal(zooms.length > 0, true);
	assert.equal(zooms.at(-1)! > 1, true);
	detach();
});
