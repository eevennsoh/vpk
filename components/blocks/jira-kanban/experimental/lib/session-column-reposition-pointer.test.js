const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const {
	canStartSessionColumnReposition,
	resolveSessionColumnPreviewIndex,
} = require("./session-column-reposition-pointer.ts");

const HOOK_SOURCE = readFileSync(
	join(__dirname, "../components/use-session-column-reposition.ts"),
	"utf8",
);
const COLUMN_SOURCE = readFileSync(
	join(__dirname, "../components/in-flow-agent-session-column.tsx"),
	"utf8",
);
const HEADER_SOURCE = readFileSync(
	join(__dirname, "../../../agent-session-column/agent-session-column-header.tsx"),
	"utf8",
);
const RAIL_SOURCE = readFileSync(
	join(__dirname, "../../../agent-session-column/agent-session-column-rail.tsx"),
	"utf8",
);

test("the collapsed options button and entire expanded header start a column move", () => {
	assert.equal(
		canStartSessionColumnReposition({
			inHeader: false,
			inNotch: false,
			inRail: false,
			interactiveKind: "options",
		}),
		true,
	);
	assert.equal(
		canStartSessionColumnReposition({
			inHeader: false,
			inNotch: true,
			inRail: true,
			interactiveKind: "notch",
		}),
		false,
	);
	assert.equal(
		canStartSessionColumnReposition({
			inHeader: false,
			inNotch: false,
			inRail: true,
			interactiveKind: "none",
		}),
		false,
	);
	assert.equal(
		canStartSessionColumnReposition({
			inHeader: true,
			inNotch: false,
			inRail: false,
			interactiveKind: "none",
		}),
		true,
	);
});

test("expanded header controls remain valid drag origins", () => {
	assert.equal(
		canStartSessionColumnReposition({
			inHeader: true,
			inNotch: false,
			inRail: false,
			interactiveKind: "other",
		}),
		true,
	);
});

test("header content is draggable only inside the explicit move surface", () => {
	assert.equal(
		canStartSessionColumnReposition({
			inHeader: false,
			inNotch: false,
			inRail: false,
			interactiveKind: "other",
		}),
		false,
	);
	assert.equal(
		canStartSessionColumnReposition({
			inHeader: false,
			inNotch: false,
			inRail: false,
			interactiveKind: "move-handle",
		}),
		false,
	);
});

test("the expanded header advertises its full drag surface", () => {
	assert.match(COLUMN_SOURCE, /headerDragHandle: dragHandle/u);
	assert.match(HEADER_SOURCE, /data-session-column-move-surface/u);
});

test("the hook no longer special-cases an Expand aria-label", () => {
	assert.match(HOOK_SOURCE, /isSessionColumnRepositionPointerTarget/u);
	assert.match(HOOK_SOURCE, /resolveSessionColumnPreviewIndex/u);
	assert.doesNotMatch(HOOK_SOURCE, /startsWith\("Expand"\)/u);
	assert.doesNotMatch(HOOK_SOURCE, /The expand button doubles as a compact drag handle/u);
	assert.match(RAIL_SOURCE, /data-agent-session-column-rail=""/u);
});

test("collapsed drag advances placement as the pointer crosses column centers", () => {
	const centers = [120, 360, 600];
	assert.equal(
		resolveSessionColumnPreviewIndex({ centers, pointerX: 80, scrollOffset: 0 }),
		0,
	);
	assert.equal(
		resolveSessionColumnPreviewIndex({ centers, pointerX: 200, scrollOffset: 0 }),
		1,
	);
	assert.equal(
		resolveSessionColumnPreviewIndex({ centers, pointerX: 400, scrollOffset: 0 }),
		2,
	);
	assert.equal(
		resolveSessionColumnPreviewIndex({ centers, pointerX: 700, scrollOffset: 0 }),
		3,
	);
	assert.equal(
		resolveSessionColumnPreviewIndex({ centers, pointerX: 200, scrollOffset: 100 }),
		1,
	);
	assert.equal(
		resolveSessionColumnPreviewIndex({ centers, pointerX: 200, scrollOffset: -100 }),
		0,
	);
});

test("collapsed drag source clone parks as the rest timeline, not a focused chip", () => {
	assert.match(HOOK_SOURCE, /function restyleSessionColumnDragSourceClone/u);
	assert.match(HOOK_SOURCE, /node.removeAttribute\("aria-expanded"\)/u);
	assert.match(HOOK_SOURCE, /node.removeAttribute\("aria-pressed"\)/u);
	assert.match(HOOK_SOURCE, /node.removeAttribute\("data-popup-open"\)/u);
	assert.match(HOOK_SOURCE, /source.querySelectorAll\("\[data-agent-session-column-options\]"\)/u);
	assert.match(HOOK_SOURCE, /source.querySelectorAll<HTMLElement>\("\[data-agent-session-column-count\]"\)/u);
	assert.match(HOOK_SOURCE, /data-session-column-drag-source-rest/u);
	assert.match(HOOK_SOURCE, /"opacity: var\(--opacity-disabled\)"/u);
	assert.doesNotMatch(HOOK_SOURCE, /isCollapsedRail \? "opacity: 1"/u);
	assert.doesNotMatch(HOOK_SOURCE, /cloneSessionColumnDragSource[\s\S]*aria-expanded="true"/u);
});

test("drag moves only the outlined chip; both sources share opacity-disabled", () => {
	assert.match(HOOK_SOURCE, /function createSessionColumnDragChip/u);
	assert.match(HOOK_SOURCE, /data-session-column-drag-chip/u);
	assert.match(HOOK_SOURCE, /buttonVariants\(\{ variant: "outline", size: "icon-compact" \}\)/u);
	assert.match(HOOK_SOURCE, /border-border bg-surface text-icon-subtle/u);
	assert.match(HOOK_SOURCE, /const SESSION_COLUMN_DRAG_CHIP_FALLBACK_WIDTH_PX = 56/u);
	assert.match(HOOK_SOURCE, /return \{ width: box.width, height: box.height \}/u);
	assert.doesNotMatch(HOOK_SOURCE, /Math.min\(box.width, box.height\)/u);
	assert.match(HOOK_SOURCE, /\[data-agent-session-column-options\]/u);
	assert.match(HOOK_SOURCE, /current.element.style.visibility = "hidden"/u);
	assert.match(HOOK_SOURCE, /if \(current.chip\) positionSessionColumnDragChip\(current.chip, current.x, current.startY\)/u);
	assert.doesNotMatch(
		HOOK_SOURCE,
		/current.element.style.transform = `translateX\(\$\{current.startLeft \+ current.x - current.startX\}px\)`/u,
	);
	assert.match(HOOK_SOURCE, /"opacity: var\(--opacity-disabled\)"/u);
});

test("a short click stays a click; only a 6px move claims the gesture", () => {
	assert.match(HOOK_SOURCE, /resolveSessionColumnRepositionCaptureElement/u);
	assert.match(HOOK_SOURCE, /const captureElement = resolveSessionColumnRepositionCaptureElement\(target, element\)/u);
	assert.match(HOOK_SOURCE, /captureElement\.setPointerCapture\(event.pointerId\)/u);
	assert.match(HOOK_SOURCE, /captureElement,/u);
	assert.doesNotMatch(HOOK_SOURCE, /element\.setPointerCapture\(event.pointerId\)/u);
	assert.match(HOOK_SOURCE, /if \(!current.active && Math.abs\(current.x - current.startX\) < 6\) return/u);
	assert.match(HOOK_SOURCE, /suppressClick.current = true/u);
	assert.match(HOOK_SOURCE, /onClickCapture: \(event: React.MouseEvent<HTMLDivElement>\) => \{/u);
	assert.match(HOOK_SOURCE, /if \(!suppressClick.current\) return/u);
});

test("a stationary column drag sleeps until the pointer moves or auto-scroll advances", () => {
	assert.match(
		HOOK_SOURCE,
		/if \(current\.active\) \{\s*current\.scheduleFrame\?\.\(\);\s*return;\s*\}/u,
		"an active drag must restart its frame from the next pointer move",
	);
	assert.match(HOOK_SOURCE, /const previousScrollLeft = current\.scrollport\.scrollLeft;/u);
	assert.match(
		HOOK_SOURCE,
		/if \(current\.scrollport\.scrollLeft !== previousScrollLeft\) \{\s*scheduleFrame\(\);\s*\}/u,
		"the loop may continue only while edge auto-scroll actually advances",
	);
});

test("the expanded header move handle stays mounted while a width resize is live", () => {
	assert.match(HOOK_SOURCE, /available: placement !== null,/u);
	assert.match(HOOK_SOURCE, /enabled: placement !== null && !disabled,/u);
	assert.match(COLUMN_SOURCE, /disabled: sessionFlyoutsSuspended \|\| resize\.isResizing,/u);
	assert.match(COLUMN_SOURCE, /const dragHandle = reposition\.available \? \(/u);
	assert.doesNotMatch(COLUMN_SOURCE, /const dragHandle = reposition\.enabled \? \(/u);
});

test("the Base UI collapsed menu captures its drag gesture on the host", () => {
	assert.match(
		readFileSync(join(__dirname, "session-column-reposition-pointer.ts"), "utf8"),
		/control\.hasAttribute\("data-agent-session-column-options"\)[\s\S]*?return host/u,
	);
});

test("unpinning a shifted session column returns it to the leading gutter", () => {
	assert.match(
		COLUMN_SOURCE,
		/if \(next\.pinned\) \{\s*setIsHovered\(true\);\s*\} else \{\s*setIsHovered\(false\);\s*setIsMenuOpen\(false\);\s*\}/u,
	);
	assert.match(
		HOOK_SOURCE,
		/moveToLeadingGutter: \(\) => \{\s*placement\?\.move\(0\);\s*\}/u,
	);
	assert.match(
		COLUMN_SOURCE,
		/const handlePinnedPlacementChange = \(nextPinned: boolean\) => \{[\s\S]*?handlePinnedChange\(nextPinned\);[\s\S]*?if \(!nextPinned\) reposition\.moveToLeadingGutter\(\);[\s\S]*?\};/u,
	);
	assert.match(COLUMN_SOURCE, /onPinnedChange=\{handlePinnedPlacementChange\}/u);
});

test("a shifted session column follows status-column width transitions", () => {
	assert.match(HOOK_SOURCE, /new MutationObserver\(schedulePositionSync\)/u);
	assert.match(HOOK_SOURCE, /attributeFilter: \["data-collapsed"\]/u);
	assert.match(HOOK_SOURCE, /root\.addEventListener\("transitionrun", handleColumnTransitionRun\)/u);
	assert.match(HOOK_SOURCE, /root\.addEventListener\("transitionend", handleColumnTransitionEnd\)/u);
	assert.match(HOOK_SOURCE, /root\.addEventListener\("transitioncancel", handleColumnTransitionEnd\)/u);
	assert.match(HOOK_SOURCE, /positionFrame = requestAnimationFrame\(trackColumnPosition\)/u);
	assert.match(HOOK_SOURCE, /cancelAnimationFrame\(positionFrame\)/u);
});
