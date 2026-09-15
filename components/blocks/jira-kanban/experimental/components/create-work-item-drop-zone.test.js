/**
 * Create-well chrome source contracts.
 *
 * Split out of `jira-golden-journeys-v4.test.js` so that suite stays under the
 * 1000-line file-size budget. These assertions belong with the drop-zone owner,
 * not the v4 page harness.
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const FOOTER = readFileSync(join(__dirname, "create-work-item-drop-zone.tsx"), "utf8");
const BOARD = readFileSync(join(__dirname, "board-column.tsx"), "utf8");
const CARD_LIST = readFileSync(join(__dirname, "board-column-card-list.tsx"), "utf8");
const DROPZONE = readFileSync(
	join(__dirname, "../../../jira-dropzone/jira-dropzone.tsx"),
	"utf8",
);

test("create button and dropzone share dashed well chrome", () => {
	assert.match(
		FOOTER,
		/const CREATE_WORK_ITEM_WELL_CHROME_CLASS = "rounded-lg border border-dashed";/u,
	);
	assert.match(
		DROPZONE,
		/export const JIRA_DROPZONE_WELL_CHROME_CLASS = "rounded-lg border border-dashed";/u,
	);
	assert.match(
		FOOTER,
		/<Button[\s\S]*aria-label=\{`Create in \$\{title\}`\}[\s\S]*CREATE_WORK_ITEM_WELL_CHROME_CLASS/u,
	);
	assert.match(
		DROPZONE,
		/className=\{cn\([\s\S]*JIRA_DROPZONE_WELL_CHROME_CLASS[\s\S]*selected\s*\n\t\t\t\t\t\? "border-border-selected bg-bg-selected text-text-selected"\n\t\t\t\t\t: "border-border bg-surface text-text-subtlest"[\s\S]*marching \? JIRA_DROPZONE_ANTS_CLASS/u,
	);
});

test("session drag pops the create well in on every column", () => {
	assert.match(
		DROPZONE,
		/initial=\{shouldReduceMotion[\s\S]*false[\s\S]*opacity: 0, scale: JIRA_DROPZONE_WELL_ENTER_SCALE[\s\S]*JIRA_DROPZONE_WELL_ENTER/u,
	);
	assert.match(
		DROPZONE,
		/useReducedMotion\(\)/u,
	);
	assert.match(
		FOOTER,
		/const drag: JiraDropzoneDragState = resolveBoardCreateDropzoneDrag\(\s*sessionDragTransaction,\s*title,\s*\);/u,
	);
});

test("empty columns keep the create well at the top and always visible", () => {
	// The ordering contract now spans two files: the board declares the action,
	// renders the list, then the action; the list owns its own `order` and marker.
	const createAction = BOARD.indexOf("const createAction = <BoardColumnCreateAction");
	const cardList = BOARD.indexOf("<BoardColumnCardList");
	const cards = BOARD.indexOf("{children}", cardList);
	const actionRender = BOARD.indexOf("{createAction}", cardList);

	assert.ok(createAction >= 0);
	assert.ok(cardList > createAction);
	assert.ok(cards > cardList);
	assert.ok(actionRender > cards);
	assert.equal((BOARD.match(/\{createAction\}/gu) ?? []).length, 1);
	assert.match(
		BOARD,
		/reveal=\{isEmptyColumn \? "always" : "column-hover"\}[\s\S]*sessionDragTransaction=\{sessionDragTransaction\}/u,
	);
	assert.match(BOARD, /isEmpty=\{isEmptyColumn\}/u);
	assert.match(CARD_LIST, /order: isEmpty \? 1 : 0/u);
	assert.match(CARD_LIST, /data-jira-kanban-card-list=""/u);
	assert.match(BOARD, /order: isEmptyColumn \? 0 : 1/u);
});

test("drop receipts land in the geometric center of the well", () => {
	assert.match(DROPZONE, /resolveJiraDropzoneLandingPoint\(rect\)/u);
	assert.doesNotMatch(DROPZONE, /JIRA_DROPZONE_FLIGHT_LANDING_INSET_PX/u);
});

test("board insertion marker avoids clipped paint before its anchor resolves", () => {
	const lineSource = readFileSync(join(__dirname, "board-card-insertion-line.tsx"), "utf8");
	const contextSource = readFileSync(
		join(__dirname, "board-card-hover-insertion-context.tsx"),
		"utf8",
	);
	const motionSource = readFileSync(join(__dirname, "created-card-arrival-motion.tsx"), "utf8");

	assert.match(lineSource, /fixed z-30 flex size-6 -translate-x-1\/2 -translate-y-1\/2/u);
	assert.match(lineSource, /left: "anchor\(left, -100vw\)"/u);
	assert.match(lineSource, /positionAnchor: anchorName/u);
	assert.match(lineSource, /positionVisibility: "anchors-visible"/u);
	assert.match(lineSource, /top: "anchor\(center, -100vh\)"/u);
	assert.match(lineSource, /border border-border bg-surface-overlay/u);
	assert.doesNotMatch(lineSource, /boxShadow|elevation\.shadow\.overlay/u);
	assert.doesNotMatch(lineSource, /absolute left-0 top-1\/2 flex size-6 -translate-y-1\/2/u);
	assert.doesNotMatch(lineSource, /export const BoardCardHoverInsertionContext/u);
	assert.match(contextSource, /export const BoardCardHoverInsertionContext/u);
	assert.match(CARD_LIST, /pickBoardCardInsertionAtPoint/u);
	assert.match(CARD_LIST, /function toDropBounds\(rect: DOMRectReadOnly\)/u);
	assert.match(CARD_LIST, /onPointerMove=\{handlePointerMove\}/u);
	assert.match(CARD_LIST, /event\.pointerType === "touch"/u);
	assert.match(motionSource, /cardInsertion \?\? hoverInsertion/u);
});

test("board insertion rule and marker reveal without animation", () => {
	const lineSource = readFileSync(join(__dirname, "board-card-insertion-line.tsx"), "utf8");

	assert.doesNotMatch(lineSource, /animate-in|transition-opacity|duration-fast/u);
});

test("card arrival suppresses the inline create seam until its entrance completes", () => {
	assert.match(CARD_LIST, /const suppressCardInsertion = createdCardArrival !== undefined;/u);
	assert.match(
		CARD_LIST,
		/const paintInsertion = !suppressCardInsertion && \(insertionArmed \|\| hoverInsertion !== null\);/u,
	);
	assert.match(
		CARD_LIST,
		/if \(suppressCardInsertion\) \{\s*setHoverInsertion\(\(current\) => \(current === null \? current : null\)\);\s*return;\s*\}/u,
	);
	assert.match(
		CARD_LIST,
		/<BoardCardHoverInsertionContext value=\{suppressCardInsertion \? null : hoverInsertion\}>/u,
	);
});

test("create button rests icon-subtlest and solidifies on hover", () => {
	assert.match(
		FOOTER,
		/<Button[\s\S]*aria-label=\{`Create in \$\{title\}`\}[\s\S]*\[&_\[data-slot=icon\]\]:text-icon-subtlest \[&_svg\]:text-icon-subtlest/u,
	);
	assert.match(
		FOOTER,
		/<Button[\s\S]*aria-label=\{`Create in \$\{title\}`\}[\s\S]*hover:border-solid hover:\[&_\[data-slot=icon\]\]:text-icon-subtle hover:\[&_svg\]:text-icon-subtle/u,
	);
});
