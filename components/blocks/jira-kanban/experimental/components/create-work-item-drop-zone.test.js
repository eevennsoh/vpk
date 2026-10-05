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
const MAGNETIC_LABEL = readFileSync(join(__dirname, "../../../jira-dropzone/jira-dropzone-magnetic-label.tsx"), "utf8");

test("normal create becomes solid on column hover without borrowing button hover colors", () => {
	assert.match(FOOTER, /"w-full border-dashed group-hover\/board-column:border-solid"/u);
	assert.doesNotMatch(FOOTER, /group-hover\/board-column:[^"\s]*bg-/u);
	assert.match(FOOTER, /control\?\.active \? "group-hover\/board-column:border-dashed" : null/u);
	assert.equal(require("../../../jira-dropzone/lib/jira-dropzone-chrome.ts").JIRA_DROPZONE_WELL_CHROME_CLASS, "rounded-lg border border-dashed bg-clip-padding");
	assert.match(
		DROPZONE,
		/className=\{cn\([\s\S]*JIRA_DROPZONE_WELL_CHROME_CLASS[\s\S]*resolveJiraDropzoneWellColors\(selected\)[\s\S]*marching \? JIRA_DROPZONE_ANTS_CLASS/u,
	);
});

test("session drag pops the create well in on every column", () => {
	assert.match(
		DROPZONE,
		/initial=\{shouldReduceMotion[\s\S]*false[\s\S]*JIRA_DROPZONE_WELL_HIDDEN[\s\S]*JIRA_DROPZONE_WELL_ENTER/u,
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

test("columns keep drag targets at the bottom and select one creation owner", () => {
	const createAction = BOARD.indexOf("const createAction = <BoardColumnCreateAction");
	const cardList = BOARD.indexOf("<BoardColumnCardList");
	const cards = BOARD.indexOf("{children}", cardList);
	const actionRender = BOARD.indexOf("{createAction}", cardList);

	assert.ok(createAction >= 0);
	assert.ok(cardList > createAction);
	assert.ok(cards > cardList);
	assert.ok(actionRender > cards);
	assert.equal((BOARD.match(/\{createAction\}/gu) ?? []).length, 1);
	assert.match(FOOTER, /renderControl=\{columnSizing === "content"[\s\S]*<BoardColumnAddButton[\s\S]*reveal="always"/u);
	assert.match(CARD_LIST, /columnSizing === "fill" \? <div/u);
	assert.match(CARD_LIST, /\{children\}[\s\S]*data-board-work-item-create[\s\S]*<BoardColumnAddButton/u);
	assert.match(BOARD, /isEmpty=\{isEmptyColumn\}/u);
	assert.doesNotMatch(CARD_LIST, /order: isEmpty/u);
	assert.match(CARD_LIST, /data-jira-kanban-card-list=""/u);
	assert.match(BOARD, /placement="bottom"/u);
});

test("empty columns keep the same create action inset as populated columns", () => {
	assert.match(
		BOARD,
		/style=\{chrome\.footer\}/u,
	);
	assert.doesNotMatch(BOARD, /!isEmptyColumn \? chrome\.footer : \{\}/u);
});

test("session previews keep their source card list vertically scrollable", () => {
	assert.match(CARD_LIST, /overflow-y-auto overscroll-y-contain/u);
	assert.doesNotMatch(CARD_LIST, /has-\[\[data-session-dragging\]\]:overflow-visible/u);
});

test("drop receipts land in the geometric center of the well", () => {
	assert.match(DROPZONE, /resolveJiraDropzoneLandingPoint\(rect\)/u);
	assert.doesNotMatch(DROPZONE, /JIRA_DROPZONE_FLIGHT_LANDING_INSET_PX/u);
});

test("vertical pinning anchors the surface while labels follow both axes", () => {
	assert.match(FOOTER, /pinVerticalMagnet=\{columnSizing === "content"\}/u);
	assert.match(DROPZONE, /y: pinMagnet \|\| pinVerticalMagnet \? 0 : magnet\.y/u);
	assert.match(DROPZONE, /x: pinMagnet \? 0 : magnet\.x/u);
	assert.doesNotMatch(DROPZONE, /<JiraDropzoneMagneticLabel\b[^>]*pinVertical=/u);
	assert.match(MAGNETIC_LABEL, /const stationary = pinned \|\| shouldReduceMotion;/u);
	assert.match(MAGNETIC_LABEL, /y: stationary \? 0 : magnet\.labelY/u);
	assert.match(MAGNETIC_LABEL, /x: stationary \? 0 : magnet\.labelX/u);
});

test("board insertion marker avoids clipped paint before its anchor resolves", () => {
	const lineSource = readFileSync(join(__dirname, "board-card-insertion-line.tsx"), "utf8");
	const contextSource = readFileSync(
		join(__dirname, "board-card-hover-insertion-context.tsx"),
		"utf8",
	);
	const motionSource = readFileSync(join(__dirname, "created-card-arrival-motion.tsx"), "utf8");

	assert.match(lineSource, /pointer-events-none fixed z-30 h-0\.5/u);
	assert.match(lineSource, /createPortal\([\s\S]*anchor\.ownerDocument\.body/u);
	assert.match(lineSource, /left: "anchor\(left, -100vw\)"/u);
	assert.match(lineSource, /positionAnchor: anchorName/u);
	assert.match(lineSource, /positionVisibility: "anchors-visible"/u);
	assert.match(lineSource, /top: "anchor\(top, -100vh\)"/u);
	assert.match(lineSource, /width: "anchor-size\(width, 0px\)"/u);
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
		/if \(suppressCardInsertion\) \{\s*setHoverInsertion\(\(current\) => \(current === null \? current : null\)\);\s*return;\s*\}/u,
	);
	assert.match(
		CARD_LIST,
		/<BoardCardHoverInsertionContext value=\{suppressCardInsertion \? null : hoverInsertion\}>/u,
	);
});

test("the card viewport retains its stacking context and fade during inline insertion", async () => {
	const esbuild = require("esbuild");
	const React = require("react");
	const { renderToStaticMarkup } = require("react-dom/server");
	const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");
	const result = await esbuild.build({
		entryPoints: [join(__dirname, "board-column-card-list.tsx")],
		bundle: true,
		format: "cjs",
		platform: "node",
		external: ["react", "react/*", "next/image"],
		loader: { ".css": "empty" },
		tsconfig: join(process.cwd(), "tsconfig.json"),
		write: false,
	});
	const { BoardColumnCardList } = loadCjsModuleFromText(result.outputFiles[0].text);
	for (const insertionArmed of [false, true]) {
		const markup = renderToStaticMarkup(React.createElement(BoardColumnCardList, {
			chrome: { headerFrame: "enclosed", cardList: { gap: "4px" } },
			columnTitle: "Context", columnSizing: "content", count: 2,
			insertionArmed, isEmpty: false,
		}, React.createElement("div", null, "Cards")));
		const viewport = markup.match(/<div\b[^>]*data-slot="scroll-area-viewport"[^>]*>/u)?.[0];
		assert.ok(viewport);
		assert.match(viewport, /class="[^"]*\bisolate\b/u);
		const classes = viewport.match(/class="([^"]*)"/u)[1].split(" ");
		assert.ok(!classes.includes("[mask-image:none]!"), "insertion must not override the viewport fade");
		assert.ok(!classes.includes("[-webkit-mask-image:none]!"));
	}
});

test("normal create uses the full-width compact button and the shared creation field", () => {
	assert.match(FOOTER, /aria-label=\{control\?\.active \? [^\n]+ : `Create in \$\{title\}`\}[\s\S]*"w-full border-dashed group-hover\/board-column:border-solid"[\s\S]*size=\{size\}[\s\S]*variant="outline"/u);
	assert.match(FOOTER, /<CreateWorkItemField/u);
});

test("scrolling dismisses a hovered creation gap until the pointer moves again", async () => {
	const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");
	const { act } = require("react");
	const view = await renderComponent({
		source: `
			import { use } from "react";
			import { BoardColumnCardList } from "@/components/blocks/jira-kanban/experimental/components/board-column-card-list";
			import { BoardCardHoverInsertionContext } from "@/components/blocks/jira-kanban/experimental/components/board-card-hover-insertion-context";
			function GapState() {
				const insertion = use(BoardCardHoverInsertionContext);
				return <output>{insertion ? "Gap visible" : "Gap hidden"}</output>;
			}
			export default function Fixture() {
				return <BoardColumnCardList chrome={{ cardList: { gap: "4px" } }} columnTitle="Done"
					columnSizing="content" count={2} insertionArmed={false} isEmpty={false}>
					{[0, 1].map(index => <div key={index} data-board-agent-session-drop-zone="issue"
						data-board-column-title="Done" data-issue-key={"TEU-" + index}
						data-board-card-index={index} data-board-card-count="2">Card {index}</div>)}
					<GapState />
				</BoardColumnCardList>;
			}
		`,
	});
	const viewport = view.getByRole("region", { name: "Done work items" });
	viewport.getBoundingClientRect = () => new DOMRect(0, 0, 200, 300);
	const cards = viewport.querySelectorAll('[data-board-agent-session-drop-zone="issue"]');
	cards.forEach((card, index) => {
		card.getBoundingClientRect = () => new DOMRect(0, index * 104, 200, 100);
	});
	const hoverGap = () => act(async () => {
		viewport.dispatchEvent(new PointerEvent("pointermove", {
			bubbles: true, pointerType: "mouse", clientX: 100, clientY: 102,
		}));
	});
	for (const event of [new WheelEvent("wheel", { bubbles: true, deltaY: 50 }), new Event("scroll")]) {
		await hoverGap();
		assert.equal(view.queryByText("Gap visible") !== null, true);
		await act(async () => { viewport.dispatchEvent(event); });
		assert.equal(view.queryByText("Gap hidden") !== null, true, `${event.type} clears the stale gap`);
	}
	await hoverGap();
	assert.equal(view.queryByText("Gap visible") !== null, true, "fresh hover restores creation");
});
