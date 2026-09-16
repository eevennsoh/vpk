/**
 * Contract for the drag *host* — `AgentSessionMediumDrag` and the overlay it
 * mounts: which node keeps pointer capture, what the source ghost does while a
 * chip travels, and when the transfer is published.
 *
 * The chip's own markup, its motion tokens, and the placeholder class
 * combinations have their own suites alongside this one. Split out of
 * `agent-session.test.js`, which sits at the 1000-line file budget.
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const CARD_SOURCE = readFileSync(join(__dirname, "agent-session-card.tsx"), "utf8");
const MEDIUM_DRAG_SOURCE = readFileSync(
	join(__dirname, "agent-session-medium-drag.tsx"),
	"utf8",
);
const DRAG_OVERLAY_SOURCE = readFileSync(
	join(__dirname, "agent-session-drag-overlay.tsx"),
	"utf8",
);
const COHORT_CHIP_SOURCE = readFileSync(
	join(__dirname, "agent-session-cohort-chip.tsx"),
	"utf8",
);

test("the drag overlay portals the shared cohort chip with overlay elevation", () => {
	// The host owns the pointer gesture and mounts the overlay; the overlay owns
	// the portal and the chip. Keeping the portal out of the host is what stops
	// the gesture component from growing a second concern.
	assert.match(MEDIUM_DRAG_SOURCE, /\{children\(sessionDragBind\)\}/u);
	// Normal previews mount for the gesture. Preparation is explicitly limited
	// to the optional peel renderer and disabled for reduced motion.
	assert.match(MEDIUM_DRAG_SOURCE, /isDragging \|\| preparePeel \? \(\s*\n\s*<AgentSessionDragOverlay/u);
	assert.match(MEDIUM_DRAG_SOURCE, /const preparePeel = sessionDrag\.previewEffect === "peel"[\s\S]*previewPreparation === "eager" \|\| peelIntent[\s\S]*!reduceChipMotion;/u);
	assert.match(MEDIUM_DRAG_SOURCE, /dragging=\{isDragging\}/u);
	assert.match(MEDIUM_DRAG_SOURCE, /useSessionDragChipPointer/u);
	assert.doesNotMatch(MEDIUM_DRAG_SOURCE, /createPortal/u);

	assert.match(DRAG_OVERLAY_SOURCE, /import \{ createPortal \} from "react-dom";/u);
	assert.match(DRAG_OVERLAY_SOURCE, /z-\[400\]/u);
	assert.match(DRAG_OVERLAY_SOURCE, /<AgentSessionCohortChip[\s\S]*elevated/u);
	assert.match(
		DRAG_OVERLAY_SOURCE,
		/className="pointer-events-none flex w-fit max-w-full -translate-x-1\/2 -translate-y-1\/2 items-center justify-start"/u,
	);
	assert.match(DRAG_OVERLAY_SOURCE, /sessionDragChipViewportStyle\(true\)/u);
	assert.match(
		DRAG_OVERLAY_SOURCE,
		/createPortal\([\s\S]*data-session-drag-overlay=\{dragging \? "" : undefined\}[\s\S]*document\.body/u,
	);
	assert.match(DRAG_OVERLAY_SOURCE, /data-session-dragging=\{dragging \? "" : undefined\}/u);
	assert.match(MEDIUM_DRAG_SOURCE, /chipPointer\.snapToPointer\(\s*\{ x: event\.clientX, y: event\.clientY \},?\s*\);/u);
	assert.doesNotMatch(MEDIUM_DRAG_SOURCE, /chipPointer\.(?:snapToPointer|followPointer)\([\s\S]{0,100}event\.currentTarget/u);
	assert.match(DRAG_OVERLAY_SOURCE, /-translate-x-1\/2 -translate-y-1\/2/u);
	assert.match(DRAG_OVERLAY_SOURCE, /data-session-chip-centered=""/u);
	// The goo measures the drawn lead pill, so the overlay marks it through
	// `isFusionSource` and never stamps the attribute on the centring wrapper —
	// `document.querySelector` would take the wrapper by document order and the
	// source rect would sit still through the chip's entrance FLIP.
	assert.match(DRAG_OVERLAY_SOURCE, /<AgentSessionCohortChip[\s\S]*isFusionSource/u);
	assert.doesNotMatch(DRAG_OVERLAY_SOURCE, /data-session-fusion-chip=/u);
	assert.doesNotMatch(DRAG_OVERLAY_SOURCE, /bg-surface-raised/u);
	assert.doesNotMatch(MEDIUM_DRAG_SOURCE, /h-\[33px\] w-fit/u);
	assert.doesNotMatch(MEDIUM_DRAG_SOURCE, /from "@\/components\/visual\/gooey"/u);
	assert.doesNotMatch(MEDIUM_DRAG_SOURCE, /<Gooey/u);
});

test("medium drag keeps pointer capture on the motion host instead of swapping a chip button", () => {
	// Replacing `children(sessionDragBind)` with a new chip button on drag-start
	// unmounted the node that called setPointerCapture. pointerup never fired,
	// so the card stuck on an empty grey attach chin.
	assert.doesNotMatch(MEDIUM_DRAG_SOURCE, /isDragging \? chip : children\(sessionDragBind\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /\{children\(sessionDragBind\)\}/u);
	// The placeholder/ghost class combinations moved to a pure module with its
	// own suite (`agent-session-drag-layout.test.js`), so this file pins the
	// delegation rather than re-grepping the class strings.
	assert.match(MEDIUM_DRAG_SOURCE, /cn\(sessionDragPlaceholderClasses\(layoutState\)\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /cn\(sessionDragSourceClasses\(layoutState\)\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /from "\.\/agent-session-drag-layout"/u);
	assert.match(MEDIUM_DRAG_SOURCE, /aria-hidden=\{isDragging \|\| isFollower \|\| undefined\}/u);
	assert.match(MEDIUM_DRAG_SOURCE, /inert=\{isDragging \|\| isFollower \|\| undefined\}/u);
	assert.match(MEDIUM_DRAG_SOURCE, /window\.addEventListener\("pointerup", onPointerUp\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /window\.addEventListener\("pointercancel", onPointerCancel\)/u);
});

test("multi-session drag chips use the concise sessions count", () => {
	// One copy of the sentence, in the chip that prints it. The cohort entry
	// point is a pass-through so the two cannot drift apart.
	const dragChipSource = readFileSync(join(__dirname, "agent-session-drag-chip.tsx"), "utf8");
	assert.match(dragChipSource, /return `\$\{total\} sessions`;/u);
	assert.doesNotMatch(dragChipSource, /agent sessions/u);
	assert.doesNotMatch(COHORT_CHIP_SOURCE, /sessions`/u);
	assert.doesNotMatch(COHORT_CHIP_SOURCE, /agent sessions/u);
});

test("drag-source ghosts leave the grid accessibility tree while inert", () => {
	assert.match(CARD_SOURCE, /const isTransferSource = Boolean\(draggingIds\?\.has\(item\.id\)\);/u);
	assert.match(CARD_SOURCE, /ariaHidden: isTransferSource \|\| isDeparting \|\| undefined/u);
	assert.match(CARD_SOURCE, /aria-hidden=\{rowMotion\.ariaHidden\}/u);
	assert.match(CARD_SOURCE, /inert=\{rowMotion\.ariaHidden\}/u);
});

test("medium drag publishes the attach transfer only after the pointer moves", () => {
	// Publishing on pointerdown grows the card chin under the pill and arms
	// onLink, so a click without movement reattaches the session.
	assert.match(MEDIUM_DRAG_SOURCE, /SESSION_DRAG_PUBLISH_THRESHOLD_PX = 2/u);
	assert.match(MEDIUM_DRAG_SOURCE, /pointerOriginRef\.current = \{ x: event\.clientX, y: event\.clientY \}/u);
	assert.doesNotMatch(
		MEDIUM_DRAG_SOURCE,
		/onPointerDown: \(event: ReactPointerEvent<HTMLElement>\) => \{\s*\n\s*drag\.bind\.onPointerDown\(event\);\s*\n\s*publishSessionDrag\(true, event\);/u,
	);
	assert.match(MEDIUM_DRAG_SOURCE, /if \(moved\) \{[\s\S]*publishSessionDrag\(true, event\);/u);
});

test("large untracked-work cards opt into the shared session drag without collapsing their row", () => {
	assert.match(CARD_SOURCE, /sessionDrag\?: JiraIssueAgentSessionDragBinding;/u);
	assert.match(CARD_SOURCE, /<AgentSessionMediumDrag[\s\S]*preserveSourceFootprint[\s\S]*source="untracked"/u);
	assert.match(CARD_SOURCE, /\{\(bind\) => \{[\s\S]*<article[\s\S]*\{\.\.\.bind\}/u);
	assert.match(INDEX_SOURCE, /<AgentSessionCard[\s\S]*sessionDrag=\{sessionDrag\}/u);
	assert.match(MEDIUM_DRAG_SOURCE, /preserveSourceFootprint \? sourceHeight : undefined/u);
	assert.match(MEDIUM_DRAG_SOURCE, /source: source/u);
	assert.match(MEDIUM_DRAG_SOURCE, /data-session-drag-placeholder=\{preserveSourceFootprint \|\| undefined\}/u);
});

test("session drag ignores nested controls and suppresses the click after a real pointer drag", () => {
	assert.match(CARD_SOURCE, /from "\.\/agent-session-drag-interactive"/u);
	assert.match(MEDIUM_DRAG_SOURCE, /from "\.\/agent-session-drag-interactive"/u);
	assert.doesNotMatch(MEDIUM_DRAG_SOURCE, /export const SESSION_DRAG_INTERACTIVE_SELECTOR/u);
	assert.match(MEDIUM_DRAG_SOURCE, /SESSION_DRAG_INTERACTIVE_SELECTOR/u);
	assert.match(MEDIUM_DRAG_SOURCE, /event\.target\.closest\(SESSION_DRAG_INTERACTIVE_SELECTOR\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /interactiveTarget !== null && interactiveTarget !== event\.currentTarget/u);
	assert.match(MEDIUM_DRAG_SOURCE, /didPublishDragRef\.current = true/u);
	assert.match(MEDIUM_DRAG_SOURCE, /onClickCapture: \(event: ReactMouseEvent<HTMLElement>\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/u);
	assert.match(MEDIUM_DRAG_SOURCE, /onPointerCancel: cancelSessionDrag/u);
});
