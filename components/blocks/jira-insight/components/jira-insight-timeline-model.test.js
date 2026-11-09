const assert = require("node:assert/strict");
const test = require("node:test");

const {
	buildJiraInsightTimelineTicks,
	findNearestVisibleTimelineButtonIndex,
	findNearestTimelineCheckpointIndex,
	getTimelineKeyTargetIndex,
	getTimelineTickHeight,
	getTimelineWheelDelta,
} = require("./jira-insight-timeline-model.ts");

const CHECKPOINTS = [
	{ capturedAtMs: 100, sources: [] },
	{ capturedAtMs: 200, sources: [{}, {}, {}, {}] },
	{ capturedAtMs: 1_000, sources: [{}] },
];

test("timeline tick height combines local checkpoint density with explicit importance", () => {
	const quietHeight = getTimelineTickHeight(CHECKPOINTS, 2);
	const denseHeight = getTimelineTickHeight(CHECKPOINTS, 1);
	const explicitHeight = getTimelineTickHeight(CHECKPOINTS, 0, 1);

	assert.ok(denseHeight > quietHeight);
	assert.ok(explicitHeight > quietHeight);
	assert.equal(getTimelineTickHeight(CHECKPOINTS, 0, -10), 16);
	assert.equal(getTimelineTickHeight(CHECKPOINTS, 0, 10), 44);
});

test("timeline keyboard navigation clamps at the ends", () => {
	assert.equal(getTimelineKeyTargetIndex("ArrowRight", 1, 3), 2);
	assert.equal(getTimelineKeyTargetIndex("ArrowRight", 2, 3), 2);
	assert.equal(getTimelineKeyTargetIndex("ArrowLeft", 0, 3), 0);
	assert.equal(getTimelineKeyTargetIndex("Home", 2, 3), 0);
	assert.equal(getTimelineKeyTargetIndex("End", 0, 3), 2);
	assert.equal(getTimelineKeyTargetIndex("Enter", 1, 3), null);
});

test("vertical wheel travel becomes horizontal travel without overriding trackpads", () => {
	assert.equal(getTimelineWheelDelta({ deltaX: 0, deltaY: 64 }), 64);
	assert.equal(getTimelineWheelDelta({ deltaX: 72, deltaY: 12 }), 0);
	assert.equal(getTimelineWheelDelta({ deltaX: 0, deltaY: -40 }), -40);
});

test("track positions resolve to the nearest checkpoint", () => {
	assert.equal(findNearestTimelineCheckpointIndex(-10, 300, 3), 0);
	assert.equal(findNearestTimelineCheckpointIndex(151, 300, 3), 1);
	assert.equal(findNearestTimelineCheckpointIndex(400, 300, 3), 2);
	assert.equal(findNearestTimelineCheckpointIndex(0, 0, 0), null);
});

test("visible checkpoint selection reads invariant viewport geometry once", () => {
	let viewportRectReads = 0;
	const viewport = {
		clientWidth: 200,
		scrollLeft: 100,
		getBoundingClientRect() {
			viewportRectReads += 1;
			return { left: 40 };
		},
	};
	const buttons = [60, 150, 260].map((left) => ({
		getBoundingClientRect: () => ({ left, width: 20 }),
	}));

	assert.equal(findNearestVisibleTimelineButtonIndex(viewport, buttons), 1);
	assert.equal(viewportRectReads, 1);
});

test("timeline ticks interleave ordinary activity with insight landmarks without duplicate dates", () => {
	const ticks = buildJiraInsightTimelineTicks(CHECKPOINTS, [50, 100, 500, 1_500]);

	assert.deepEqual(
		ticks.map((tick) => [tick.kind, tick.capturedAtMs]),
		[
			["activity", 50],
			["insight", 100],
			["insight", 200],
			["activity", 500],
			["insight", 1_000],
			["activity", 1_500],
		],
	);
});
