const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveMagneticPointerRelation } = require("../../../../ui-custom/hooks/magnetic-proximity-model.ts");

const {
	CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX,
	distanceFromPointToRect,
	resolveExclusiveProximityWinner,
	createExclusiveProximityScheduler,
} = require("./create-work-item-exclusive-proximity.ts");

const LEFT = {
	id: "To do",
	rect: { bottom: 624, left: 100, right: 360, top: 600 },
};
const RIGHT = {
	id: "In progress",
	rect: { bottom: 624, left: 376, right: 636, top: 600 },
};

test("board create targets retain a small approach halo without the former long reach", () => {
	assert.equal(CREATE_WORK_ITEM_PROXIMITY_HOVER_AREA_PX, 24);
	assert.equal(resolveExclusiveProximityWinner({ x: 60, y: 612 }, [LEFT, RIGHT]), null);
	assert.equal(resolveExclusiveProximityWinner({ x: 200, y: 503 }, [LEFT, RIGHT]), null);
	assert.equal(resolveExclusiveProximityWinner({ x: 200, y: 580 }, [LEFT, RIGHT]), "To do");
});

test("distance to a rect is zero inside and Euclidean to the nearest edge outside", () => {
	assert.equal(distanceFromPointToRect({ x: 200, y: 612 }, LEFT.rect), 0);
	assert.equal(distanceFromPointToRect({ x: 100, y: 580 }, LEFT.rect), 20);
	assert.equal(distanceFromPointToRect({ x: 368, y: 612 }, LEFT.rect), 8);
});

test("a pointer inside only one well selects that well", () => {
	assert.equal(
		resolveExclusiveProximityWinner({ x: 200, y: 612 }, [LEFT, RIGHT]),
		"To do",
	);
	assert.equal(
		resolveExclusiveProximityWinner({ x: 500, y: 612 }, [LEFT, RIGHT]),
		"In progress",
	);
});

test("exclusive candidates match the shared magnetic relation with the small halo", () => {
	const pointer = { x: 200, y: 580 };
	assert.equal(resolveMagneticPointerRelation(pointer, LEFT.rect, 24), "near");
	assert.equal(resolveMagneticPointerRelation(pointer, RIGHT.rect, 24), "outside");
	assert.equal(resolveExclusiveProximityWinner(pointer, [LEFT, RIGHT]), "To do");
});

test("a pointer outside every footprint selects none", () => {
	assert.equal(
		resolveExclusiveProximityWinner({ x: 200, y: 400 }, [LEFT, RIGHT]),
		null,
	);
});

test("overlapping halos pick the well whose actual rect is closer", () => {
	// Midway between the two resting wells is 8px from each edge; the 120px
	// pads overlap. Nudge toward the right well so it must win.
	assert.equal(
		resolveExclusiveProximityWinner({ x: 370, y: 612 }, [LEFT, RIGHT], 120),
		"In progress",
	);
	assert.equal(
		resolveExclusiveProximityWinner({ x: 366, y: 612 }, [LEFT, RIGHT], 120),
		"To do",
	);
});

test("equal distance prefers the leftmost well, then first registered", () => {
	const midpoint = { x: 368, y: 612 };
	assert.equal(distanceFromPointToRect(midpoint, LEFT.rect), 8);
	assert.equal(distanceFromPointToRect(midpoint, RIGHT.rect), 8);
	assert.equal(resolveExclusiveProximityWinner(midpoint, [RIGHT, LEFT], 120), "To do");

	const stacked = {
		id: "Later",
		rect: { bottom: 624, left: 100, right: 360, top: 600 },
	};
	assert.equal(
		resolveExclusiveProximityWinner({ x: 200, y: 612 }, [LEFT, stacked]),
		"To do",
	);
});

function createFrameHarness() {
	let nextId = 0;
	const pending = new Map();
	return {
		pending,
		requestFrame(callback) {
			const id = nextId++;
			pending.set(id, callback);
			return id;
		},
		cancelFrame(id) {
			pending.delete(id);
		},
		flush() {
			const callbacks = [...pending.values()];
			pending.clear();
			for (const callback of callbacks) callback();
		},
	};
}

test("pointer bursts measure current geometry once per frame using the latest pointer", () => {
	const frames = createFrameHarness();
	let wells = [LEFT, RIGHT];
	let rectangleReads = 0;
	const winners = [];
	const scheduler = createExclusiveProximityScheduler({
		...frames,
		onPointer(pointer) {
			rectangleReads += wells.length;
			winners.push(resolveExclusiveProximityWinner(pointer, wells));
		},
		onClear() {},
	});

	for (let index = 0; index < 100; index++) {
		scheduler.move({ x: 200, y: 612 }, "mouse");
	}
	scheduler.move({ x: 500, y: 612 }, "pen");
	assert.equal(frames.pending.size, 1);
	assert.equal(rectangleReads, 0);
	// Layout can change between the event and the frame; do not cache stale rects.
	wells = [{ ...RIGHT, id: "Moved well" }];
	frames.flush();
	assert.deepEqual(winners, ["Moved well"]);
	assert.equal(rectangleReads, 1);
	assert.equal(frames.pending.size, 0);
	frames.flush();
	assert.equal(rectangleReads, 1);

	scheduler.move({ x: 200, y: 400 }, "mouse");
	frames.flush();
	assert.deepEqual(winners, ["Moved well", null]);
});

test("touch and pointer leave clear feedback and cancel a queued mouse frame", () => {
	for (const clear of [
		(scheduler) => scheduler.move({ x: 200, y: 612 }, "touch"),
		(scheduler) => scheduler.clear(),
	]) {
		const frames = createFrameHarness();
		const feedback = [];
		const scheduler = createExclusiveProximityScheduler({
			...frames,
			onPointer: () => feedback.push("winner"),
			onClear: () => feedback.push(null),
		});
		scheduler.move({ x: 200, y: 612 }, "mouse");
		frames.flush();
		scheduler.move({ x: 500, y: 612 }, "mouse");
		clear(scheduler);
		assert.equal(frames.pending.size, 0);
		frames.flush();
		assert.deepEqual(feedback, ["winner", null]);
		scheduler.move({ x: 500, y: 612 }, "mouse");
		frames.flush();
		assert.deepEqual(feedback, ["winner", null, "winner"]);
	}
});

test("disposal cancels pending work without updating unmounted consumers", () => {
	const frames = createFrameHarness();
	const feedback = [];
	const scheduler = createExclusiveProximityScheduler({
		...frames,
		onPointer: () => feedback.push("winner"),
		onClear: () => feedback.push(null),
	});
	scheduler.move({ x: 200, y: 612 }, "mouse");
	scheduler.dispose();
	assert.equal(frames.pending.size, 0);
	scheduler.move({ x: 500, y: 612 }, "mouse");
	scheduler.clear();
	frames.flush();
	assert.deepEqual(feedback, []);
});
