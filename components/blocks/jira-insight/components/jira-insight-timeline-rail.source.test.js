const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const RAIL_PATH = path.join(__dirname, "jira-insight-timeline-rail.tsx");
const SCRUBBER_PATH = path.join(__dirname, "jira-insight-scrubber.tsx");

test("the decision rail supports overflow, wheel, pointer, and scrollbar navigation", () => {
	const source = fs.readFileSync(RAIL_PATH, "utf8");

	assert.match(source, /overflow-x-auto/u);
	assert.match(source, /addEventListener\("wheel", handleWheel, \{ passive: false \}\)/u);
	assert.match(source, /removeEventListener\("wheel", handleWheel\)/u);
	assert.match(source, /onScroll=\{handleScroll\}/u);
	assert.match(source, /requestAnimationFrame\(selectNearestVisibleCheckpoint\)/u);
	assert.match(source, /onPointerDown=\{handlePointerDown\}/u);
	assert.match(source, /onPointerMove=\{drag\.onPointerMove\}/u);
	assert.match(source, /scrollTo\(\{/u);
	assert.match(source, /shouldReduceMotion \? "auto" : "smooth"/u);
});

test("programmatic selection cannot be replaced by its own smooth scroll", () => {
	const source = fs.readFileSync(RAIL_PATH, "utf8");

	assert.match(source, /programmaticScrollTargetRef/u);
	assert.match(
		source,
		/if \(programmaticScrollTargetRef\.current != null\) return;/u,
	);
	assert.match(
		source,
		/handlePointerDown[\s\S]*programmaticScrollTargetRef\.current = null;/u,
	);
	assert.match(
		source,
		/handleWheel[\s\S]*programmaticScrollTargetRef\.current = null;[\s\S]*getTimelineWheelDelta/u,
	);
});

test("viewport-aware edge padding lets both timeline endpoints reach the scrubber center", () => {
	const source = fs.readFileSync(RAIL_PATH, "utf8");

	assert.match(source, /new ResizeObserver\(syncViewportWidth\)/u);
	assert.match(source, /Math\.max\(TRACK_EDGE_PADDING_PX, viewportWidth \/ 2\)/u);
	assert.match(source, /timelineEdgePadding \* 2/u);
});

test("scroll-frame selection delegates invariant geometry reads to the tested model", () => {
	const source = fs.readFileSync(RAIL_PATH, "utf8");

	assert.match(source, /findNearestVisibleTimelineButtonIndex\(viewport, buttonRefs\.current\)/u);
});

test("ordinary activity supplies minor ticks while the active decision keeps a constant landmark", () => {
	const source = fs.readFileSync(RAIL_PATH, "utf8");

	assert.match(source, /activityTimestamps\?: readonly number\[\]/u);
	assert.match(source, /buildJiraInsightTimelineTicks/u);
	assert.match(source, /tick\.kind === "activity"/u);
	assert.match(source, /ACTIVE_TICK_HEIGHT_PX = 34/u);
});

test("every decision tick exposes keyboard selection and a hover or focus tooltip", () => {
	const source = fs.readFileSync(RAIL_PATH, "utf8");

	assert.match(source, /TooltipTrigger/u);
	assert.match(source, /TooltipContent[\s\S]*side="top"/u);
	assert.match(source, /onKeyDown=\{\(event\) => handleTickKeyDown\(event, index\)\}/u);
	assert.match(source, /aria-current=\{isActive \? "step" : undefined\}/u);
	assert.match(source, /tabIndex=\{isActive \? 0 : -1\}/u);
	assert.match(source, /data-jira-insight-active-marker/u);
	assert.match(source, /bottom-\[3\.25rem\]/u);
	assert.match(source, /whitespace-nowrap/u);
});

test("the existing scrubber API delegates to the reusable decision rail", () => {
	const source = fs.readFileSync(SCRUBBER_PATH, "utf8");

	assert.match(source, /JiraInsightTimelineRail/u);
	assert.match(source, /activeCheckpointId=\{activeCheckpointId\}/u);
	assert.match(source, /checkpoints=\{checkpoints\}/u);
	assert.match(source, /onCheckpointSelect=\{selectCheckpoint\}/u);
});
