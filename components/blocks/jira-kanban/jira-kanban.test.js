const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const DATA_SOURCE = readFileSync(join(__dirname, "jira-kanban-data.ts"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const HEADER_SOURCE = readFileSync(join(__dirname, "board-header.tsx"), "utf8");
const EXPERIMENTAL_SOURCE = readFileSync(join(__dirname, "experimental", "experimental-jira-kanban.tsx"), "utf8");
const EXPERIMENTAL_CARD_SOURCE = readFileSync(join(__dirname, "experimental", "experimental-jira-kanban-card.tsx"), "utf8");
const EXPERIMENTAL_PAGE_SOURCE = [
	readFileSync(join(__dirname, "experimental", "page.tsx"), "utf8"),
	readFileSync(join(__dirname, "experimental", "experimental-page-types.ts"), "utf8"),
].join("\n");
const EXPERIMENTAL_HEADER_SOURCE = readFileSync(join(__dirname, "experimental", "experimental-board-header.tsx"), "utf8");
const EXPERIMENTAL_V2_SOURCE = readFileSync(join(__dirname, "experimental-v2", "experimental-v2-jira-kanban.tsx"), "utf8");
const EXPERIMENTAL_V2_PAGE_SOURCE = readFileSync(join(__dirname, "experimental-v2", "page.tsx"), "utf8");
const EXPERIMENTAL_V2_HEADER_SOURCE = readFileSync(join(__dirname, "experimental-v2", "experimental-v2-board-header.tsx"), "utf8");
const EXPERIMENTAL_V2_PREVIEW_SOURCE = readFileSync(join(__dirname, "..", "..", "..", "app", "preview", "blocks", "jira-kanban-experimental-v2", "page.tsx"), "utf8");
const EXPERIMENTAL_HEADER_FACEPILE_SOURCE = readFileSync(join(__dirname, "experimental", "header-facepile.ts"), "utf8");
const EXPERIMENTAL_PULSE_RAIL_SOURCE = readFileSync(join(__dirname, "experimental", "pulse", "components", "pulse-rail.tsx"), "utf8");
const EXPERIMENTAL_PULSE_MODE_CONTROLS_SOURCE = readFileSync(join(__dirname, "experimental", "pulse", "components", "pulse-mode-controls.tsx"), "utf8");
const DETAIL_SOURCE = readFileSync(join(__dirname, "..", "..", "..", "app", "data", "details", "blocks", "jira-kanban.ts"), "utf8");
const DEMO_SOURCE = readFileSync(join(__dirname, "..", "..", "website", "demos", "blocks", "jira-kanban-demo.tsx"), "utf8");
const VARIANT_REGISTRY_SOURCE = readFileSync(join(__dirname, "..", "..", "website", "registry", "blocks-variants.ts"), "utf8");
const JIRA_ISSUE_SOURCE = readFileSync(join(__dirname, "..", "jira-issue", "index.tsx"), "utf8");
const JIRA_ISSUE_SUMMARY_SOURCE = readFileSync(join(__dirname, "..", "jira-issue", "summary.tsx"), "utf8");
const COLUMN_DRAG_SOURCE = SOURCE.slice(
	SOURCE.indexOf("const handleColumnDragOver"),
	SOURCE.indexOf("<BoardColumn", SOURCE.indexOf("const handleColumnDragOver")),
);

async function loadStateHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
					export {
					createJiraKanbanSelectionState,
					filterJiraKanbanColumnsByAssignee,
					getJiraKanbanAssignees,
					moveJiraKanbanCardsToColumn,
					selectJiraKanbanCard,
					getCommonJiraKanbanAgentIds,
					updateJiraKanbanCardAgentAssignment,
					unlinkJiraKanbanAgentSession,
					linkJiraKanbanAgentSession,
				} from "./components/blocks/jira-kanban/state";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "jira-kanban-state-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

async function loadDocsLayoutHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import { JIRA_KANBAN_DETAIL } from "./app/data/details/blocks/jira-kanban.ts";
				import { resolveExamplesShellLayout, shouldUseFullPagePreview } from "./components/website/component-doc/components/preview-layout.ts";

				export function getKanbanDocsShells() {
					const demoLayout = JIRA_KANBAN_DETAIL.demoLayout;
					const previewFullPage = shouldUseFullPagePreview("blocks", demoLayout);
					const previewFitContent = demoLayout?.previewHeight === "fit";

					return {
						previewFullPage,
						previewFitContent,
						examples: resolveExamplesShellLayout("blocks", demoLayout),
					};
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "jira-kanban-docs-layout-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

const SELECTION_COLUMNS = [
	{
		title: "Intake",
		count: 3,
		cards: ["RFP-101", "RFP-102", "RFP-103"].map((code) => ({ code })),
	},
	{ title: "Drafting", count: 0, cards: [] },
];

const FILTER_COLUMNS = [
	{
		title: "Intake",
		count: 2,
		cards: [
			{ code: "RFP-101", assignee: { id: "maya", name: "Maya", avatarSrc: "/maya.png" } },
			{ code: "RFP-102", assignee: { id: "jordan", name: "Jordan", avatarSrc: "/jordan.png" } },
		],
	},
	{
		title: "Review",
		count: 2,
		cards: [
			{ code: "RFP-161", assignee: { id: "maya", name: "Maya", avatarSrc: "/maya.png" } },
			{ code: "RFP-162", assignee: { id: "priya", name: "Priya", avatarSrc: "/priya.png" } },
		],
	},
];

test("Kanban demo preserves the rounded docs frame and leaves scrolling to the board", () => {
	assert.match(PAGE_SOURCE, /rounded-lg bg-surface/u);
	assert.doesNotMatch(PAGE_SOURCE, /rounded-lg bg-surface p-4 md:p-5/u);
	assert.doesNotMatch(PAGE_SOURCE, /overflow-x-auto/u);
	assert.match(SOURCE, /overflowX: "auto"/u);
});

test("Kanban docs examples use the same full-page fit shell as Preview", async () => {
	const harness = await loadDocsLayoutHarness();
	const { previewFullPage, previewFitContent, examples } = harness.getKanbanDocsShells();

	assert.equal(previewFullPage, true);
	assert.equal(previewFitContent, true);
	assert.equal(examples.fullPage, previewFullPage);
	assert.equal(examples.fitContent, previewFitContent);
	assert.equal(examples.contentWidth, undefined);
});

test("Kanban block demo includes the shared Jira header and assignee filter", () => {
	assert.match(PAGE_SOURCE, /<JiraKanbanBoardHeader/u);
	assert.match(PAGE_SOURCE, /filterJiraKanbanColumnsByAssignee/u);
	assert.match(PAGE_SOURCE, /boardColumns=\{filteredBoardColumns\}/u);
	assert.match(
		PAGE_SOURCE,
		/setSelection\(createJiraKanbanSelectionState\(\)\);[\s\S]*setDraggedCard\(null\);[\s\S]*setSelectedAssigneeIds\(assigneeIds\);/u,
	);
});

test("Kanban header matches the production board alignment and action groups", () => {
	assert.match(HEADER_SOURCE, /<header className="shrink-0 pb-4 pt-3">/u);
	assert.match(HEADER_SOURCE, /<div className="flex min-w-0 items-center gap-2 px-4">/u);
	assert.doesNotMatch(HEADER_SOURCE, /<header className="[^"]*border-b/u);
	assert.doesNotMatch(HEADER_SOURCE, />Filter by</u);
	assert.match(
		HEADER_SOURCE,
		/<div className="border-r border-border p-3">[\s\S]*<Button aria-disabled variant="ghost">[\s\S]*<Icon data-icon="inline-start" render=\{<AddIcon label="" size="small" \/>\} \/>[\s\S]*Add field[\s\S]*\{FILTER_FIELDS\.map/u,
	);
	assert.match(HEADER_SOURCE, /<AvatarUnassigned kind="person" label="Unassigned" size="sm" \/>/u);
	assert.match(HEADER_SOURCE, /aria-label=\{`Filter \$\{surfaceLabel\} by \$\{assignee\.name\}`\}/u);
	assert.match(HEADER_SOURCE, /aria-pressed=\{selectedAssigneeIds\.has\(assignee\.id\)\}/u);
	assert.match(HEADER_SOURCE, /onClick=\{\(\) => toggleAssignee\(assignee\.id\)\}/u);
	assert.match(HEADER_SOURCE, /<Button aria-disabled aria-label=\{`Group \$\{surfaceLabel\}`\} size=\{compact \? "icon" : undefined\} variant="outline">[\s\S]*Group/u);
	assert.match(HEADER_SOURCE, /className=\{cn\("flex items-center gap-1", compact \? undefined : "ml-auto"\)\}/u);
	assert.match(HEADER_SOURCE, /aria-label="View insights"/u);
	assert.match(HEADER_SOURCE, /aria-label=\{`More \$\{surfaceLabel\} controls`\}/u);
});

test("Kanban header places optional view tabs below the Jira Design label", () => {
	assert.match(HEADER_SOURCE, /<JiraProjectAvatar label=\{JIRA_DESIGN_PROJECT\.name\} src=\{JIRA_DESIGN_PROJECT\.imageSrc\} \/>/u);
	assert.doesNotMatch(HEADER_SOURCE, /<JiraIcon/u);
	assert.match(HEADER_SOURCE, /viewTabs\?: ReactNode;/u);
	assert.match(HEADER_SOURCE, /\{viewTabs \? <div className="mt-2">\{viewTabs\}<\/div> : null\}/u);
	assert.match(HEADER_SOURCE, /<div className="mt-4 flex flex-wrap items-center gap-2 px-4">/u);
	assert.match(PAGE_SOURCE, /viewTabs\?: ReactNode;/u);
	assert.match(PAGE_SOURCE, /<JiraKanbanBoardHeader[\s\S]*viewTabs=\{viewTabs\}/u);
});

test("Kanban header compacts its controls while an owning workspace is open", () => {
	assert.match(PAGE_SOURCE, /compactHeader\?: boolean;/u);
	assert.match(PAGE_SOURCE, /<JiraKanbanBoardHeader[\s\S]*compact=\{compactHeader\}/u);
	assert.match(HEADER_SOURCE, /compact\?: boolean;/u);
	assert.match(HEADER_SOURCE, /size=\{compact \? "icon" : undefined\}[\s\S]*\{compact \? null : "Filter"\}/u);
	assert.match(HEADER_SOURCE, /aria-label=\{`Group \$\{surfaceLabel\}`\} size=\{compact \? "icon" : undefined\}[\s\S]*\{compact \? null : "Group"\}/u);
	assert.match(HEADER_SOURCE, /className=\{cn\("flex items-center gap-1", compact \? undefined : "ml-auto"\)\}/u);
	assert.match(HEADER_SOURCE, /<FilterIcon label="" \/>/u);
	assert.match(HEADER_SOURCE, /<GroupIcon label="" \/>/u);
	assert.doesNotMatch(HEADER_SOURCE, /<(?:FilterIcon|GroupIcon) label="" size="small" \/>/u);
	assert.match(HEADER_SOURCE, /\{compact \? \([\s\S]*aria-label=\{`More \$\{surfaceLabel\} controls`\}[\s\S]*\) : \([\s\S]*aria-label="View insights"[\s\S]*aria-label=\{`\$\{surfaceTitle\} settings`\}[\s\S]*aria-label=\{`More \$\{surfaceLabel\} controls`\}/u);
	assert.doesNotMatch(HEADER_SOURCE, /aria-label="(?:Undo board change|Board announcements)"/u);
});

test("Kanban header supports owning surfaces with a custom search label", () => {
	assert.match(HEADER_SOURCE, /searchPlaceholder\?: string;/u);
	assert.match(HEADER_SOURCE, /searchPlaceholder = "Search board"/u);
	assert.match(HEADER_SOURCE, /<InputGroupInput aria-label=\{searchPlaceholder\} placeholder=\{searchPlaceholder\} readOnly \/>/u);
	assert.match(HEADER_SOURCE, /surfaceLabel = "board"/u);
});

test("Kanban assignee list fades into its fixed selection footer", () => {
	assert.match(HEADER_SOURCE, /import \{ ScrollMask \} from "@\/components\/visual\/scroll-mask";/u);
	assert.match(
		HEADER_SOURCE,
		/<ScrollMask[\s\S]*footer=\{[\s\S]*\{selectedAssigneeIds\.size\} selected[\s\S]*Clear all[\s\S]*footerClassName="bg-popover px-0 pb-0 pt-3"/u,
	);
	assert.doesNotMatch(HEADER_SOURCE, /max-h-64 overflow-y-auto/u);
});

test("Kanban card focus border stays inside the card and uses the focused border token", () => {
	assert.match(JIRA_ISSUE_SOURCE, /"group\/jira-issue relative w-full min-w-0 border outline-none focus-visible:border-ring"/);
	assert.doesNotMatch(JIRA_ISSUE_SOURCE, /border: "none"/);
});

test("Kanban card list gives the first card room for its raised edge", () => {
	assert.match(
		SOURCE,
		/overflowY: "auto",\n\s+display: "flex",\n\s+flexDirection: "column",\n\s+gap: token\("space\.050"\),\n\s+\.\.\.chrome\.cardList,/u,
	);
});

test("Experimental kanban card lists drop scroller padding while the default keeps its well", () => {
	assert.match(
		EXPERIMENTAL_SOURCE,
		/overflow-y-auto has-\[\[data-session-dragging\]\]:overflow-visible/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_SOURCE,
		/overflowY: "auto",[\s\S]{0,180}padding(?:Top|Bottom|Inline): token\("space\.(?:050|100)"\)/u,
	);
	assert.match(
		SOURCE,
		/overflowY: "auto",\n\s+display: "flex",\n\s+flexDirection: "column",\n\s+gap: token\("space\.050"\),\n\s+\.\.\.chrome\.cardList,/u,
	);
});

test("Experimental kanban default card gap and collapse padding come from the column recipe", () => {
	assert.match(
		EXPERIMENTAL_SOURCE,
		/gap: token\("space\.100"\),\n\s+\.\.\.cardListScrollMaskStyle,\n\s+\.\.\.chrome\.cardList,/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/paddingBottom: token\("space\.100"\), \.\.\.chrome\.header/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/paddingTop=\{chrome\.header\.paddingTop \?\? paddingTop\}/u,
	);
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /gap: token\("space\.025"\)/u);
});

test("Experimental kanban collapse control is not padded by column chrome", () => {
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /chrome\.resizeButtonClassName/u);
	assert.doesNotMatch(EXPERIMENTAL_V2_SOURCE, /chrome\.resizeButtonClassName/u);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/BOARD_COLUMN_ACTION_REVEAL,\n\s+"group-hover\/board-column:pointer-events-auto/u,
	);
});

test("Experimental kanban card gap matches the column gutter", () => {
	assert.match(
		EXPERIMENTAL_SOURCE,
		/className=\{cn\("flex w-max items-stretch", columnSizing === "fill" \? "min-h-full min-w-full" : "h-full"\)\}\s*style=\{\{ paddingInlineStart: resolvedColumnRowPaddingInlineStart \}\}/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/<div className="flex min-h-full flex-1 items-stretch gap-2">/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/overflow-y-auto has-\[\[data-session-dragging\]\]:overflow-visible/u,
	);
	assert.match(
		SOURCE,
		/overflowY: "auto",\n\s+display: "flex",\n\s+flexDirection: "column",\n\s+gap: token\("space\.050"\),\n\s+\.\.\.chrome\.cardList,/u,
	);
});

test("Kanban columns retain a readable minimum width when the board narrows", () => {
	assert.match(SOURCE, /style=\{\{ flex: "1 1 0", minWidth: "280px", borderRadius: token\("radius\.xlarge"\) \}\}/u);
});

test("Experimental kanban columns lock a 280px min and max width", () => {
	assert.match(EXPERIMENTAL_SOURCE, /const outerWidth = `\$\{getBoardColumnOuterWidthPx\(collapsed\)\}px`;/u);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/chrome\.dropShellClassName,\s*"min-w-0",\s*collapsed \|\| isResizing \? "overflow-hidden" : "overflow-visible"/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/<div className="flex min-h-full flex-1 items-stretch gap-2">/u,
	);
});

test("Experimental kanban cards cap at 280px so generative agent chrome cannot stretch them", () => {
	assert.match(EXPERIMENTAL_SOURCE, /className="w-full min-w-0 max-w-\[280px\]"/u);
});

test("Experimental kanban does not show a create-column control", () => {
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /BoardAddColumnButton/u);
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /aria-label="Create column"/u);
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /data-jira-kanban-add-column/u);
	assert.doesNotMatch(EXPERIMENTAL_V2_SOURCE, /BoardAddColumnButton/u);
	assert.doesNotMatch(EXPERIMENTAL_V2_SOURCE, /aria-label="Create column"/u);
	assert.doesNotMatch(SOURCE, /aria-label="Create column"/u);
});

test("Kanban column drop targets expose a stable browser selector", () => {
	assert.match(COLUMN_DRAG_SOURCE, /data-jira-kanban-column=\{column\.title\}/u);
});

test("Kanban columns stretch through the available board height", () => {
	assert.match(PAGE_SOURCE, /<div className="flex min-h-0 min-w-0 flex-1">[\s\S]*<JiraKanban/u);
	assert.match(SOURCE, /<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">/u);
	assert.match(SOURCE, /<section[\s\S]*className="flex min-h-0 flex-1 focus-visible:outline-none/u);
	assert.match(SOURCE, /<div className="flex min-h-full items-stretch gap-2" style=\{\{ minWidth: "100%" \}\}>/u);
	assert.match(SOURCE, /className=\{cn\("group\/board-column", chrome\.columnClassName\)\}[\s\S]*height: "100%"/u);
});

test("Kanban board renders no scroll-for-more affordance or its measurement listeners", () => {
	for (const source of [SOURCE, PAGE_SOURCE, EXPERIMENTAL_SOURCE, EXPERIMENTAL_PAGE_SOURCE]) {
		assert.doesNotMatch(source, /Scroll for more/u);
		assert.doesNotMatch(source, /showScrollAffordance/u);
		assert.doesNotMatch(source, /canScrollRight/u);
		assert.doesNotMatch(source, /scrollend/u);
	}
});

test("Kanban page keeps plain activation separate from modifier-key bulk selection", () => {
	assert.match(PAGE_SOURCE, /onCardClick\?: \(card: JiraKanbanCardData, columnTitle: string\) => void;/u);
	assert.match(PAGE_SOURCE, /if \(onCardClick\) \{[\s\S]*setSelection\(createJiraKanbanSelectionState\(\)\);[\s\S]*onCardClick\(card, columnTitle\);[\s\S]*return;/u);
	assert.match(PAGE_SOURCE, /handleCardSelect\(cardCode, columnTitle, indexInColumn,[\s\S]*metaOrCtrlKey: false,[\s\S]*shiftKey: false,/u);
	assert.match(SOURCE, /if \(modifiers\.shiftKey \|\| modifiers\.metaOrCtrlKey\) \{[\s\S]*onCardSelect\?\.\(card\.code, column\.title, cardIndex, modifiers\);[\s\S]*return;[\s\S]*onCardClick\?\.\(card\.title, card\.code, card, column\.title\);/u);
});

test("Kanban tracks the active workspace card separately from bulk selection", () => {
	assert.match(SOURCE, /activeCardCode\?: string;/u);
	assert.match(SOURCE, /const isActive = activeCardCode === card\.code;/u);
	assert.match(SOURCE, /<JiraIssue[\s\S]*active=\{isActive\}[\s\S]*selected=\{isSelected\}/u);
	assert.match(PAGE_SOURCE, /activeCardCode\?: string;/u);
	assert.match(PAGE_SOURCE, /<JiraKanban[\s\S]*activeCardCode=\{activeCardCode\}/u);
});

test("Kanban drag-over uses the chrome drop-shell recipe instead of a hardcoded ring", () => {
	assert.match(COLUMN_DRAG_SOURCE, /setKanbanColumnDropArmed\(event\.currentTarget, chrome, true\)/u);
	assert.match(COLUMN_DRAG_SOURCE, /setKanbanColumnDropArmed\(event\.currentTarget, chrome, false\)/u);
	assert.match(COLUMN_DRAG_SOURCE, /className=\{chrome\.dropShellClassName\}/u);
	assert.match(SOURCE, /withKanbanDropRingClipGutter\(paddingTop, chrome\)/u);
	assert.match(SOURCE, /\.\.\.chrome\.dropContentPadding,/u);
	assert.doesNotMatch(COLUMN_DRAG_SOURCE, /classList\.add\("border-ring"\)/);
	assert.doesNotMatch(COLUMN_DRAG_SOURCE, /ring-border-bold/);
});

test("Kanban agent stack removes the avatar-group overlap ring", () => {
	assert.match(SOURCE, /<AvatarGroup className="-space-x-1\.5 \*:data-\[slot=avatar\]:ring-0!"/);
	assert.match(SOURCE, /label=\{agent\.name\} shape="hexagon" size="sm"/);
	assert.doesNotMatch(SOURCE, /showHexagonBorder/);
});

test("Kanban third-party agents use the shared hexagonal avatar frame", () => {
	assert.match(
		SOURCE,
		/if \(agent\.brandName\) \{[\s\S]*<Avatar className=\{className\} label=\{agent\.name\} shape="hexagon" size="sm">[\s\S]*<LogoThirdParty borderless label="" name=\{agent\.brandName\} size="xxsmall" \/>/u,
	);
	assert.doesNotMatch(SOURCE, /return <LogoThirdParty className=\{className\}/u);
});

test("Kanban agent assignment icons use selected icon color while the trigger is open", () => {
	assert.match(SOURCE, /className="ml-0\.5 text-icon-subtle group-aria-expanded\/button:text-icon-selected"/);
	assert.match(SOURCE, /className="text-icon-subtle group-aria-expanded\/button:text-icon-selected"/);
});

test("Kanban card renders explicit unassigned avatars with the shared placeholder", () => {
	assert.match(JIRA_ISSUE_SUMMARY_SOURCE, /AvatarUnassigned,/);
	assert.match(JIRA_ISSUE_SOURCE, /assigneeUnassignedKind\?: AvatarUnassignedKind;/);
	assert.match(SOURCE, /assigneeUnassignedKind=\{card\.avatarUnassignedKind\}/);
	assert.match(SOURCE, /assigneeAvatarLabel=\{card\.assignee\?\.name\}/);
	assert.match(
		JIRA_ISSUE_SUMMARY_SOURCE,
		/function JiraIssueAssignee[\s\S]*size = "sm"[\s\S]*const unassignedKind = resolveIssueAssigneeUnassignedKind\([\s\S]*assigneeAvatarSrc[\s\S]*assigneeUnassignedKind[\s\S]*if \(unassignedKind\) \{[\s\S]*<AvatarUnassigned[\s\S]*kind=\{unassignedKind\}[\s\S]*size=\{size\}/,
	);
});

test("Kanban multi-card drag fades every selected card", () => {
	assert.match(SOURCE, /const isSelectedCardBeingDragged = Boolean\(draggedCardCode && isMultiSelection && isSelected\);/);
	assert.match(SOURCE, /dragging=\{isCardBeingDragged \|\| isSelectedCardBeingDragged\}/);
});

test("Kanban multi-card drag uses a move cursor affordance without covering the item count", () => {
	assert.match(SOURCE, /event\.dataTransfer\.effectAllowed = "move";/);
	assert.match(SOURCE, /event\.dataTransfer\.dropEffect = "move";/);
	assert.match(SOURCE, /event\.dataTransfer\.setData\("text\/plain", card\.code\);/);
	assert.match(COLUMN_DRAG_SOURCE, /event\.dataTransfer\.dropEffect = "move";/);
	assert.match(SOURCE, /label\.style\.top = "18px";/);
	assert.match(SOURCE, /label\.style\.background = "var\(--ds-background-neutral-bold\)";/);
	assert.match(SOURCE, /event\.dataTransfer\.setDragImage\(dragImageRef\.current, 0, 0\);/);
});

test("Kanban multi-card drag does not render an extra count badge on the source card", () => {
	assert.doesNotMatch(SOURCE, /groupBadgeCount/);
	assert.doesNotMatch(SOURCE, /dragGroupCount/);
	assert.doesNotMatch(SOURCE, /draggedCardCount/);
});

test("Kanban selection supports a first Shift-click and a subsequent Shift range", async () => {
	const { createJiraKanbanSelectionState, selectJiraKanbanCard } = await loadStateHarness();
	let selection = createJiraKanbanSelectionState();

	selection = selectJiraKanbanCard(selection, SELECTION_COLUMNS, {
		cardCode: "RFP-101",
		columnTitle: "Intake",
		indexInColumn: 0,
		modifiers: { shiftKey: true, metaOrCtrlKey: false },
	});
	assert.deepEqual([...selection.selectedCardCodes], ["RFP-101"]);

	selection = selectJiraKanbanCard(selection, SELECTION_COLUMNS, {
		cardCode: "RFP-103",
		columnTitle: "Intake",
		indexInColumn: 2,
		modifiers: { shiftKey: true, metaOrCtrlKey: false },
	});
	assert.deepEqual([...selection.selectedCardCodes], ["RFP-101", "RFP-102", "RFP-103"]);
});

test("Kanban selected cards move together and keep derived column counts accurate", async () => {
	const { moveJiraKanbanCardsToColumn } = await loadStateHarness();
	const columns = moveJiraKanbanCardsToColumn(
		SELECTION_COLUMNS,
		["RFP-101", "RFP-102"],
		"Drafting",
	);

	assert.deepEqual(columns.find((column) => column.title === "Intake").cards.map((card) => card.code), ["RFP-103"]);
	assert.deepEqual(columns.find((column) => column.title === "Drafting").cards.map((card) => card.code), ["RFP-101", "RFP-102"]);
	assert.equal(columns.find((column) => column.title === "Intake").count, 1);
	assert.equal(columns.find((column) => column.title === "Drafting").count, 2);
});

test("Kanban agent session unlink removes only the dragged session and derives the remaining activity mode", async () => {
	const { unlinkJiraKanbanAgentSession } = await loadStateHarness();
	const columns = [{
		title: "In progress",
		count: 1,
		cards: [{
			code: "PAY-123",
			agentActivityMode: "awaiting-input",
			agentActivities: [
				{ id: "test-agent", state: "working" },
				{ id: "review-agent", state: "awaiting-input" },
			],
		}],
	}];

	const withoutReview = unlinkJiraKanbanAgentSession(columns, "PAY-123", "review-agent");
	assert.deepEqual(withoutReview[0].cards[0].agentActivities.map((activity) => activity.id), ["test-agent"]);
	assert.equal(withoutReview[0].cards[0].agentActivityMode, "working");

	const withoutTest = unlinkJiraKanbanAgentSession(withoutReview, "PAY-123", "test-agent");
	assert.deepEqual(withoutTest[0].cards[0].agentActivities, []);
	assert.equal(withoutTest[0].cards[0].agentActivityMode, "none");
});

test("Kanban agent session link restores a detached session onto its work item", async () => {
	const { linkJiraKanbanAgentSession, unlinkJiraKanbanAgentSession } = await loadStateHarness();
	const activity = { id: "test-agent", state: "working" };
	const columns = [{
		title: "In progress",
		count: 1,
		cards: [{
			code: "PAY-123",
			agentActivityMode: "working",
			agentActivities: [activity],
		}],
	}];

	const unlinked = unlinkJiraKanbanAgentSession(columns, "PAY-123", "test-agent");
	const relinked = linkJiraKanbanAgentSession(unlinked, "PAY-123", activity);

	assert.deepEqual(relinked[0].cards[0].agentActivities.map((item) => item.id), ["test-agent"]);
	assert.equal(relinked[0].cards[0].agentActivityMode, "working");
	assert.equal(
		linkJiraKanbanAgentSession(relinked, "PAY-123", activity)[0].cards[0].agentActivities.length,
		1,
		"linking an already-attached session is a no-op",
	);
});

test("Kanban status changes leave selected cards already in the target column in place", async () => {
	const { moveJiraKanbanCardsToColumn } = await loadStateHarness();
	const columns = moveJiraKanbanCardsToColumn(
		[
			{ title: "Intake", count: 1, cards: [{ code: "RFP-101" }] },
			{ title: "Drafting", count: 2, cards: [{ code: "RFP-141" }, { code: "RFP-142" }] },
		],
		["RFP-101", "RFP-142"],
		"Drafting",
	);

	assert.deepEqual(
		columns.find((column) => column.title === "Drafting").cards.map((card) => card.code),
		["RFP-101", "RFP-141", "RFP-142"],
	);
	assert.equal(columns.find((column) => column.title === "Intake").count, 0);
	assert.equal(columns.find((column) => column.title === "Drafting").count, 3);
});

test("Kanban assignee filtering preserves columns, ordering, and accurate counts", async () => {
	const { filterJiraKanbanColumnsByAssignee } = await loadStateHarness();
	const unfiltered = filterJiraKanbanColumnsByAssignee(FILTER_COLUMNS, new Set());
	const mayaOnly = filterJiraKanbanColumnsByAssignee(FILTER_COLUMNS, new Set(["maya"]));

	assert.deepEqual(unfiltered.map((column) => column.cards.map((card) => card.code)), [
		["RFP-101", "RFP-102"],
		["RFP-161", "RFP-162"],
	]);
	assert.deepEqual(mayaOnly.map((column) => column.title), ["Intake", "Review"]);
	assert.deepEqual(mayaOnly.map((column) => column.cards.map((card) => card.code)), [
		["RFP-101"],
		["RFP-161"],
	]);
	assert.deepEqual(mayaOnly.map((column) => column.count), [1, 1]);
});

test("Kanban multi-assignee filtering uses OR semantics and keeps empty columns", async () => {
	const { filterJiraKanbanColumnsByAssignee } = await loadStateHarness();
	const jordanAndPriya = filterJiraKanbanColumnsByAssignee(
		FILTER_COLUMNS,
		new Set(["jordan", "priya"]),
	);
	const nobody = filterJiraKanbanColumnsByAssignee(FILTER_COLUMNS, new Set(["nobody"]));

	assert.deepEqual(jordanAndPriya.map((column) => column.cards.map((card) => card.code)), [
		["RFP-102"],
		["RFP-162"],
	]);
	assert.deepEqual(nobody.map((column) => column.count), [0, 0]);
	assert.equal(nobody.length, FILTER_COLUMNS.length);
});

test("Kanban derives each assignee once in first-card order", async () => {
	const { getJiraKanbanAssignees } = await loadStateHarness();
	assert.deepEqual(getJiraKanbanAssignees(FILTER_COLUMNS).map((assignee) => assignee.id), [
		"maya",
		"jordan",
		"priya",
	]);
});

test("Kanban demo wires controlled selection and grouped drag state", () => {
	assert.match(PAGE_SOURCE, /selectedCardCodes=\{selection\.selectedCardCodes\}/u);
	assert.match(PAGE_SOURCE, /onCardSelect=\{handleCardSelect\}/u);
	assert.match(PAGE_SOURCE, /const isMultiDrag = selection\.selectedCardCodes\.has\(draggedCard\.card\.code\)/u);
});

test("Kanban composes the Jira Toolbar through explicit selection actions", () => {
	assert.match(SOURCE, /selectionToolbar\?: JiraKanbanSelectionToolbarConfig;/u);
	assert.match(SOURCE, /<JiraToolbar[\s\S]*selectedCount=\{selectedCount\}[\s\S]*selectedStatus=\{selectedStatus\}/u);
	assert.match(PAGE_SOURCE, /selectionToolbar=\{\{[\s\S]*onAgentAssignmentChange: handleSelectedCardsAgentAssignmentChange,[\s\S]*onStatusChange: handleSelectedCardsStatusChange/u);
});

test("Kanban agent assignment helpers apply toggles to every selected card", async () => {
	const {
		getCommonJiraKanbanAgentIds,
		updateJiraKanbanCardAgentAssignment,
	} = await loadStateHarness();
	const selected = new Set(["RFP-101", "RFP-102"]);
	let assignments = updateJiraKanbanCardAgentAssignment({}, selected, "agent-1", true);

	assert.deepEqual(assignments, {
		"RFP-101": ["agent-1"],
		"RFP-102": ["agent-1"],
	});
	assert.deepEqual(getCommonJiraKanbanAgentIds(assignments, selected), ["agent-1"]);

	assignments = updateJiraKanbanCardAgentAssignment(assignments, new Set(["RFP-101"]), "agent-1", false);
	assert.deepEqual(getCommonJiraKanbanAgentIds(assignments, selected), []);
});

test("Kanban cards expose and render Jira issue agent lifecycle presentation", () => {
	assert.match(SOURCE, /agentActivities\?: readonly JiraIssueAgentActivity\[\];/);
	assert.match(SOURCE, /agentActivityMode\?: JiraIssueAgentActivityMode;/);
	assert.match(SOURCE, /agentDoneRuns\?: readonly JiraIssueCompletedAgentRun\[\];/);
	assert.match(SOURCE, /pullRequestNumber\?: number;/);
	assert.match(SOURCE, /pullRequestPreview\?: JiraIssuePullRequestPreview;/);
	assert.match(SOURCE, /pullRequestStatus\?: JiraIssuePullRequestStatus;/);
	assert.match(SOURCE, /agentActivities=\{card\.agentActivities\}/);
	assert.match(SOURCE, /agentActivityMode=\{card\.agentActivityMode\}/);
	assert.match(SOURCE, /agentDoneRuns=\{card\.agentDoneRuns\}/);
	assert.match(SOURCE, /pullRequestNumber=\{card\.pullRequestNumber\}/);
	assert.match(SOURCE, /pullRequestPreview=\{card\.pullRequestPreview\}/);
	assert.match(SOURCE, /pullRequestStatus=\{card\.pullRequestStatus\}/);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /pullRequestPreview=\{card\.pullRequestPreview\}/);
	assert.match(EXPERIMENTAL_V2_SOURCE, /pullRequestPreview=\{card\.pullRequestPreview\}/);
	assert.match(DATA_SOURCE, /agentDoneRuns: card\.agentDoneRuns\?\.map\(\(run\) => \(\{ \.\.\.run \}\)\)/);
});

test("Kanban can animate cards between columns with reduced-motion support", () => {
	assert.match(SOURCE, /animateCardMoves\?: boolean;/u);
	assert.match(SOURCE, /useReducedMotion\(\)/u);
	assert.match(SOURCE, /const shouldAnimateCardMoves = animateCardMoves && !shouldReduceMotion;/u);
	assert.match(SOURCE, /<LayoutGroup id=\{cardLayoutGroupId\}>/u);
	assert.match(SOURCE, /cardMoveAnimation\?: JiraKanbanCardMoveAnimation;/u);
	assert.match(SOURCE, /const JIRA_KANBAN_CARD_MOVE: Transition = \{ duration: 0\.6,/u);
	assert.match(SOURCE, /const JIRA_KANBAN_CARD_DEPART: Transition = \{ duration: 0\.4,/u);
	assert.match(SOURCE, /if \(phase === "arriving"\) return 0\.9;/u);
	assert.match(SOURCE, /if \(phase === "departing"\) return 0\.96;/u);
	assert.match(SOURCE, /\{ scale: getJiraKanbanCardScale\(cardMovePhase\) \}/u);
	assert.match(SOURCE, /initial=\{false\}/u);
	assert.match(SOURCE, /const shouldAnimateCardPosition = shouldAnimateCardMoves && cardMovePhase === undefined;/u);
	assert.match(SOURCE, /layout=\{shouldAnimateCardPosition \? "position" : false\}/u);
	assert.match(SOURCE, /layoutId=\{shouldAnimateCardPosition \? `jira-kanban-card-\$\{card\.code\}` : undefined\}/u);
	assert.doesNotMatch(SOURCE, /layoutId=\{shouldAnimateCardMoves \?/u);
	assert.match(SOURCE, /transition=\{cardMovePhase === "departing" \? JIRA_KANBAN_CARD_DEPART : JIRA_KANBAN_CARD_MOVE\}/u);
});

test("Kanban card interactions preserve card and column context", () => {
	assert.match(
		SOURCE,
		/onCardGenerativeActionSubmit\?: \([\s\S]*request: JiraIssueGenerativeActionRequest,[\s\S]*card: JiraKanbanCardData,[\s\S]*columnTitle: string,[\s\S]*\) => void \| Promise<void>;/,
	);
	assert.match(
		SOURCE,
		/onSubmit: \(request\) =>[\s\S]*onCardGenerativeActionSubmit\(request, card, column\.title\)/,
	);
	assert.match(
		SOURCE,
		/onCardAgentActivityViewChat\?: \([\s\S]*activity: JiraIssueAgentActivity,[\s\S]*card: JiraKanbanCardData,[\s\S]*columnTitle: string,[\s\S]*\) => void;/,
	);
	assert.match(
		SOURCE,
		/\? \(activity\) => onCardAgentActivityViewChat\(activity, card, column\.title\)/,
	);
	assert.match(
		SOURCE,
		/\? \(open\) => onCardAgentActivityOpenChange\(open, card, column\.title\)/,
	);
	// The agent row answers clarifications in chat now, so no question-submit
	// callback is threaded from the board down into JiraIssue.
	assert.doesNotMatch(SOURCE, /onCardAgentActivityQuestionSubmit/);
	assert.doesNotMatch(SOURCE, /onAgentActivityQuestionSubmit/);
	assert.match(
		SOURCE,
		/onCardAgentDoneRunReview\?: \([\s\S]*run: JiraIssueCompletedAgentRun,[\s\S]*card: JiraKanbanCardData,[\s\S]*columnTitle: string,[\s\S]*\) => void;/,
	);
	assert.match(
		SOURCE,
		/onAgentDoneRunReview=\{[\s\S]*\? \(run\) => onCardAgentDoneRunReview\(run, card, column\.title\)/,
	);
});

test("Kanban sparkle agents and skills preserve selection-toolbar ordering", () => {
	assert.match(
		SOURCE,
		/function orderPickerItems[\s\S]*const pinnedIdSet = new Set\(pinnedIds\);[\s\S]*items\.filter\(\(item\) => pinnedIdSet\.has\(item\.id\)\)[\s\S]*items\.filter\(\(item\) => !pinnedIdSet\.has\(item\.id\)\)/u,
	);
	assert.match(
		SOURCE,
		/const generativeActionAgents = useMemo\([\s\S]*orderPickerItems\(\s*selectionToolbar\.agents,\s*selectionToolbar\.defaultPinnedAgentIds,\s*\)\.map\(mapAgentToMentionItem\)[\s\S]*"subagent"[\s\S]*selectionToolbar\?\.defaultPinnedAgentIds/u,
	);
	assert.match(
		SOURCE,
		/const generativeActionSkills = useMemo\([\s\S]*orderPickerItems\(\s*selectionToolbar\.skills,\s*selectionToolbar\.defaultPinnedSkillIds,\s*\)\.map\(mapSkillToMentionItem\)[\s\S]*"skill"[\s\S]*selectionToolbar\?\.defaultPinnedSkillIds/u,
	);
	assert.match(
		SOURCE,
		/generativeAction=\{[\s\S]*agents: generativeActionAgents,[\s\S]*onSubmit: \(request\) =>[\s\S]*skills: generativeActionSkills,/u,
	);
	assert.doesNotMatch(SOURCE, /generativeAction(?:Agents|Skills)[\s\S]{0,100}\.(?:sort|toSorted)\(/u);
});

test("Kanban derives visible column counts from rendered cards", () => {
	assert.match(SOURCE, /count=\{column\.cards\.length\}/);
	assert.doesNotMatch(SOURCE, /count=\{column\.count\}/);
});

test("Kanban column wells come from the shared chrome recipe", () => {
	assert.match(SOURCE, /resolveKanbanColumnChrome\(columnChrome\)/u);
	assert.match(SOURCE, /data-kanban-column-chrome=\{columnChrome\}/u);
	assert.match(SOURCE, /chrome\.dropShellClassName/u);
	assert.match(EXPERIMENTAL_SOURCE, /resolveKanbanColumnChrome\(columnChrome\)/u);
	assert.match(EXPERIMENTAL_SOURCE, /data-kanban-column-chrome=\{columnChrome\}/u);
	assert.match(EXPERIMENTAL_SOURCE, /chrome\.dropShellClassName/u);
	assert.doesNotMatch(SOURCE, /backgroundColor: token\("elevation.surface.sunken"\)/u);
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /backgroundColor: token\("elevation.surface.sunken"\)/u);
});

test("Experimental kanban column headers apply the chrome recipe over a board fallback", () => {
	assert.match(
		EXPERIMENTAL_SOURCE,
		/style=\{\{ paddingBottom: token\("space\.100"\), \.\.\.chrome\.header \}\}/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_SOURCE,
		/paddingTop: token\("space\.150"\)/u,
	);
	assert.match(
		SOURCE,
		/\.\.\.chrome\.header, paddingBottom: headerPaddingBlock/u,
	);
});

test("Kanban cards take issue chrome from the column well recipe", () => {
	assert.match(SOURCE, /chrome=\{chrome\.cardChrome\}/u);
	assert.match(EXPERIMENTAL_SOURCE, /chrome=\{chrome\.cardChrome\}/u);
	assert.match(EXPERIMENTAL_V2_SOURCE, /chrome=\{chrome\.cardChrome\}/u);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /<JiraIssue[\s\S]*chrome=\{chrome\}[\s\S]*compact/u);
	assert.match(EXPERIMENTAL_PULSE_RAIL_SOURCE, /<JiraIssue[\s\S]*chrome="stroke"/u);
	assert.doesNotMatch(SOURCE, /chrome="stroke"/u);
	assert.doesNotMatch(EXPERIMENTAL_CARD_SOURCE, /chrome="stroke"/u);
	assert.doesNotMatch(EXPERIMENTAL_V2_SOURCE, /chrome="stroke"/u);
	assert.doesNotMatch(EXPERIMENTAL_SOURCE, /issueChrome/u);
	assert.doesNotMatch(SOURCE, /issueChrome/u);
});

test("Experimental kanban cards forward their configured agent activity layout", () => {
	assert.match(EXPERIMENTAL_SOURCE, /agentActivityLayout\?: JiraIssueAgentActivityLayout;/u);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /<JiraIssue[\s\S]*agentActivityLayout=\{agentActivityLayout\}/u);
});

test("Experimental kanban cards opt into draggable agent-session unlink when the host handles it", () => {
	assert.match(EXPERIMENTAL_SOURCE, /onCardAgentSessionUnlink\?: \(/u);
	assert.match(EXPERIMENTAL_SOURCE, /onCardAgentSessionLink\?: \(/u);
	// Any non-completed chin is unlinkable — 1 agent, 1-n, and needs-input —
	// not a dedicated transfer-phase card.
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/const firstActiveAgentSession = card\.agentActivities\?\.find\(\s*\n\s*\(activity\) => activity\.state !== "completed",\s*\n\s*\);/u,
	);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/const canUnlinkAgentSession = Boolean\(onSessionUnlink && firstActiveAgentSession\);/u,
	);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/const canTransferAgentSession = canUnlinkAgentSession \|\| canLinkAgentSession \|\| isBoardDropTarget;/u,
	);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /onSessionUnlink\?\.\(resolvedSession, card, columnTitle\)/u);
	assert.doesNotMatch(EXPERIMENTAL_CARD_SOURCE, /JIRA_ISSUE_SESSION_TRANSFER_GROUP_CLASS/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/onCardAgentSessionUnlink=\{onCardAgentSessionUnlink\s*\n\s*\? handleCardAgentSessionUnlink\s*\n\s*: undefined\}/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/onCardAgentSessionLink=\{onCardAgentSessionLink\s*\n\s*\? handleCardAgentSessionLink\s*\n\s*: undefined\}/u,
	);
	assert.match(EXPERIMENTAL_SOURCE, /showAgentSessionUnlinkWell\?: boolean;/u);
	assert.match(EXPERIMENTAL_SOURCE, /showUnlinkWell=\{showAgentSessionUnlinkWell\}/u);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /showUnlinkWell,/u);
});

test("Experimental kanban keeps the Unlink grey backdrop when a related session stays detached", () => {
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/const agentActivityMode = resolveRelatedJiraIssueAgentActivityMode\(\s*\n\s*card\.agentActivityMode,\s*\n\s*detachedAgentSessions\.length > 0,\s*\n\s*\);/u,
	);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /agentActivityMode=\{agentActivityMode\}/u);
	assert.match(
		EXPERIMENTAL_CARD_SOURCE,
		/Related detached sessions keep the Unlink grey backdrop even after the/u,
	);
});

test("Experimental kanban renders detached sessions beneath their source card with the shared medium-detached variant", () => {
	assert.match(EXPERIMENTAL_SOURCE, /detachedAgentSessionsByCard\?: Readonly<Record<string, readonly AgentSessionItem\[\]>>;/u);
	assert.match(EXPERIMENTAL_SOURCE, /const detachedAgentSessions = detachedAgentSessionsByCard\?\.\[card\.code\] \?\? \[\];/u);
	assert.match(EXPERIMENTAL_SOURCE, /"flex w-full min-w-0 max-w-\[280px\] flex-col gap-2 rounded-lg"/u);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /<JiraIssue[\s\S]*<AgentSession[\s\S]*issueKey=\{card\.code\}[\s\S]*items=\{detachedAgentSessions\}[\s\S]*style=\{\{ marginTop: token\("space\.025"\) \}\}[\s\S]*variant="medium-detached"/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /detachedAgentSessionsByCard=\{proximityAgentSessionsByCard\}/u);
});

test("Experimental kanban cards use the hexagon avatar for agent assignees", () => {
	assert.match(EXPERIMENTAL_CARD_SOURCE, /function getCardAssigneeAvatarSrc\(card: JiraKanbanCardData\)/);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /function getCardAssigneeAvatarShape\(card: JiraKanbanCardData\)/);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /getCardAssigneeAvatarSrc\(card\)\?\.startsWith\("\/avatar-agent\/"\) \? "hexagon" as const : undefined/);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /assigneeAvatarShape=\{getCardAssigneeAvatarShape\(card\)\}/);
	assert.match(EXPERIMENTAL_CARD_SOURCE, /assigneeAvatarSrc=\{getCardAssigneeAvatarSrc\(card\)\}/);
	assert.match(
		EXPERIMENTAL_PULSE_RAIL_SOURCE,
		/assigneeAvatarShape=\{face\.kind === "agent" \? "hexagon" : "circle"\}/,
	);
	assert.match(SOURCE, /assigneeAvatarShape=\{card\.avatarShape\}/);
});

test("Experimental kanban column wrappers stay overflow-visible so card strokes are not clipped", () => {
	assert.match(EXPERIMENTAL_SOURCE, /className=\{cn\("group\/board-column min-w-0 overflow-visible", chrome\.columnClassName\)\}/u);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/collapsed \|\| isResizing \? "overflow-hidden" : "overflow-visible"/u,
	);
	assert.doesNotMatch(SOURCE, /group\/board-column overflow-visible/u);
});

test("Experimental kanban column card lists reuse the shared top and bottom scroll-mask", () => {
	assert.match(EXPERIMENTAL_SOURCE, /import \{ useHasVerticalOverflow \} from "@\/components\/hooks\/use-has-vertical-overflow";/u);
	assert.match(EXPERIMENTAL_SOURCE, /import \{ buildScrollMaskStyle \} from "@\/components\/visual\/scroll-mask\/lib";/u);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/const \{ ref: cardListRef, showBottomScrollMask, showTopScrollMask \} = useHasVerticalOverflow<HTMLDivElement>\(\);[\s\S]*buildScrollMaskStyle\(\{\s*fadeBottom: showBottomScrollMask,\s*fadeSize: "3rem",\s*fadeTop: showTopScrollMask,\s*scrollbarWidth: 0,\s*\}\)[\s\S]*ref=\{cardListRef\}[\s\S]*overflow-y-auto has-\[\[data-session-dragging\]\]:overflow-visible[\s\S]*\.\.\.cardListScrollMaskStyle/u,
	);
	assert.match(EXPERIMENTAL_V2_SOURCE, /buildScrollMaskStyle\(\{[\s\S]*scrollbarWidth: 0,[\s\S]*\}\)/u);
	assert.doesNotMatch(SOURCE, /useHasVerticalOverflow/u);
	assert.doesNotMatch(SOURCE, /buildScrollMaskStyle/u);
});

test("Kanban Create footers stretch to the same width as column cards", () => {
	assert.match(
		EXPERIMENTAL_SOURCE,
		/<div className="w-full" style=\{\{ paddingBlock: token\("space\.050"\) \}\}>[\s\S]*<Button[\s\S]*"w-full justify-start gap-2 rounded-lg"/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_SOURCE,
		/<div(?: className="w-full")? style=\{\{ padding(?!Block): token\("space\.050"\) \}\}>[\s\S]*Create/u,
	);
	assert.match(
		SOURCE,
		/<div className="w-full" style=\{\{ paddingBlock: token\("space\.050"\), \.\.\.chrome\.footer \}\}>[\s\S]*<Button className="w-full justify-start gap-2 rounded-lg"/u,
	);
});

test("Experimental kanban Create is hover-revealed on the column while the default stays visible", () => {
	assert.match(
		EXPERIMENTAL_SOURCE,
		/pointer-events-none opacity-0 transition-opacity duration-normal ease-out-practical[\s\S]*group-hover\/board-column:pointer-events-auto group-hover\/board-column:opacity-100[\s\S]*group-has-\[:focus-visible\]\/board-column:pointer-events-auto group-has-\[:focus-visible\]\/board-column:opacity-100[\s\S]*motion-reduce:transition-none[\s\S]*Create/u,
	);
	assert.match(
		SOURCE,
		/<Button className="w-full justify-start gap-2 rounded-lg" size="default" variant="ghost">\n\t\t\t\t\t<Icon render=\{<AddIcon label="" size="small" \/>\} \/>\n\t\t\t\t\tCreate/u,
	);
});

test("Experimental kanban column agent assignment uses the compact trigger and work-item selector", () => {
	assert.match(
		EXPERIMENTAL_SOURCE,
		/import \{ WorkItemAgentSelector \} from "@\/components\/blocks\/jira-work-item\/experimental-v3\/components\/work-item-agent-selector";/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/const \[pinnedAgentIds, setPinnedAgentIds\] = useState<readonly string\[\]>\(DEFAULT_PINNED_SPACE_AGENT_IDS\);/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/hasAssignedAgents \? "default" : "icon-compact"/u,
	);
	assert.doesNotMatch(
		EXPERIMENTAL_SOURCE,
		/hasAssignedAgents \? "h-8 min-w-0 gap-1 px-1\.5" : "size-8"/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/<WorkItemAgentSelector[\s\S]*agents=\{agents\}[\s\S]*onPinnedAgentIdsChange=\{setPinnedAgentIds\}[\s\S]*pinnedAgentIds=\{pinnedAgentIds\}[\s\S]*selectedAgentIds=\{assignedAgentIds\}/u,
	);
});

test("Experimental kanban variant owns its own tree without touching the default variant", () => {
	// The fork renders its own board/header so experimental changes cannot leak
	// into the standard variant.
	assert.match(EXPERIMENTAL_SOURCE, /export function ExperimentalJiraKanban\(props: Readonly<ExperimentalJiraKanbanProps>\)/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /export function ExperimentalJiraKanbanBoardHeader\(\{/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /export default function ExperimentalJiraKanbanPage\(\{/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /from "\.\/experimental-jira-kanban"/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /from "\.\/experimental-board-header"/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /from "\.\.\/board-header"/u);
	assert.doesNotMatch(EXPERIMENTAL_PAGE_SOURCE, /from "\.\.\/page"/u);
	// Default variant stays free of any experimental import.
	assert.doesNotMatch(SOURCE, /experimental/iu);
	assert.doesNotMatch(PAGE_SOURCE, /experimental/iu);
	assert.doesNotMatch(HEADER_SOURCE, /experimental/iu);
});

test("Experimental v2 is exposed as an independently owned copy of Experimental", () => {
	assert.match(DETAIL_SOURCE, /title: "Experimental v2"/u);
	assert.match(DETAIL_SOURCE, /demoSlug: "jira-kanban-demo-experimental-v2"/u);
	assert.match(DEMO_SOURCE, /import ExperimentalV2Page from "@\/components\/blocks\/jira-kanban\/experimental-v2\/page";/u);
	assert.match(DEMO_SOURCE, /export function JiraKanbanDemoExperimentalV2\(\)/u);
	assert.match(DEMO_SOURCE, /aria-label="Kanban column chrome"/u);
	assert.match(DEMO_SOURCE, /<ToggleGroupItem value="default">Default<\/ToggleGroupItem>/u);
	assert.match(DEMO_SOURCE, /<ToggleGroupItem value="simple">Simple<\/ToggleGroupItem>/u);
	assert.match(VARIANT_REGISTRY_SOURCE, /"jira-kanban-demo-experimental-v2"/u);
	assert.equal(
		existsSync(join(__dirname, "..", "..", "..", "app", "preview", "blocks", "jira-kanban-experimental-v2", "page.tsx")),
		true,
	);
	assert.match(EXPERIMENTAL_V2_SOURCE, /export function ExperimentalV2JiraKanban\(\{/u);
	assert.match(EXPERIMENTAL_V2_HEADER_SOURCE, /export function ExperimentalV2JiraKanbanBoardHeader\(\{/u);
	assert.match(EXPERIMENTAL_V2_PAGE_SOURCE, /export default function ExperimentalV2JiraKanbanPage\(\{/u);
	assert.match(EXPERIMENTAL_V2_PAGE_SOURCE, /import \{ ExperimentalV2JiraKanban \} from "\.\/experimental-v2-jira-kanban";/u);
	assert.match(
		EXPERIMENTAL_V2_PAGE_SOURCE,
		/import \{\s*ExperimentalV2JiraKanbanBoardHeader,\s*type ExperimentalV2JiraKanbanView,\s*\} from "\.\/experimental-v2-board-header";/u,
	);
	assert.doesNotMatch(EXPERIMENTAL_V2_PAGE_SOURCE, /from "\.\.\/experimental\/page"/u);
	assert.match(EXPERIMENTAL_V2_PREVIEW_SOURCE, /<div className="h-dvh">/u);
	assert.doesNotMatch(EXPERIMENTAL_V2_PREVIEW_SOURCE, /<main/u);
});

test("Experimental v2 mirrors the Golden Journeys v4 board and list contract", () => {
	assert.match(EXPERIMENTAL_V2_PAGE_SOURCE, /activeView\?: ExperimentalV2JiraKanbanView;/u);
	assert.match(EXPERIMENTAL_V2_PAGE_SOURCE, /insightsEnabled\?: boolean;/u);
	assert.match(
		EXPERIMENTAL_V2_PAGE_SOURCE,
		/renderListContent\?: \(columns: readonly JiraKanbanColumnData\[\]\) => ReactNode;/u,
	);
	assert.match(EXPERIMENTAL_V2_PAGE_SOURCE, /activeView === "list" && renderListContent/u);
	assert.match(EXPERIMENTAL_V2_PAGE_SOURCE, /modeToggle=\{insightsEnabled \? \(/u);
	assert.match(EXPERIMENTAL_V2_PAGE_SOURCE, /showAgentSessionColumn\?: boolean;/u);
	assert.match(EXPERIMENTAL_V2_SOURCE, /agentActivityLayout\?: JiraIssueAgentActivityLayout;/u);
	assert.match(EXPERIMENTAL_V2_SOURCE, /collapsedColumns\?: CollapsedBoardColumns;/u);
	assert.match(
		EXPERIMENTAL_V2_HEADER_SOURCE,
		/<TabsList aria-label="Work items view">[\s\S]*<TabsTrigger value="board">[\s\S]*Board[\s\S]*<TabsTrigger value="list">[\s\S]*List/u,
	);
	const v2ModeToggleIndex = EXPERIMENTAL_V2_HEADER_SOURCE.indexOf("{modeToggle}");
	const v2OverflowIndex = EXPERIMENTAL_V2_HEADER_SOURCE.indexOf('aria-label={`More ${surfaceLabel} controls`}');
	const v2ViewSwitcherIndex = EXPERIMENTAL_V2_HEADER_SOURCE.indexOf('aria-label="Work items view"');
	assert.ok(v2ModeToggleIndex > 0 && v2ModeToggleIndex < v2OverflowIndex);
	assert.ok(v2OverflowIndex > 0 && v2OverflowIndex < v2ViewSwitcherIndex);
	assert.match(DEMO_SOURCE, /createJiraGoldenJourneysV4PayBoardColumns/u);
	assert.match(DEMO_SOURCE, /JIRA_GOLDEN_JOURNEYS_V4_PAY_BOARD_AGENTS/u);
	assert.match(DEMO_SOURCE, /<ExperimentalV2Page[\s\S]*insightsEnabled=\{false\}/u);
	assert.match(DEMO_SOURCE, /activeView=\{activeView\}[\s\S]*onViewChange=\{setActiveView\}/u);
	assert.match(DEMO_SOURCE, /renderListContent=\{\(columns\) =>/u);
	assert.match(DEMO_SOURCE, /<JiraList[\s\S]*rows=\{listRows\}/u);
});

test("Experimental kanban header keeps only configure and more actions", () => {
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /import CustomizeIcon from "@atlaskit\/icon\/core\/customize";/u);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/showCustomizeControl \? \(\s*<Button aria-disabled aria-label="Customize" size="icon" variant="outline">/u,
	);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /aria-label=\{`More \$\{surfaceLabel\} controls`\}/u);
	assert.doesNotMatch(EXPERIMENTAL_HEADER_SOURCE, /aria-label="(?:View insights|Undo board change|Board announcements)"/u);
	assert.doesNotMatch(EXPERIMENTAL_HEADER_SOURCE, /\$\{surfaceTitle\} settings/u);
});

test("Insights keeps the seven-item header facepile at one reserved width", () => {
	assert.match(EXPERIMENTAL_HEADER_FACEPILE_SOURCE, /JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS = 7/u);
	assert.match(
		EXPERIMENTAL_HEADER_FACEPILE_SOURCE,
		/JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME =\s*\n?\s*"w-33 shrink-0 isolate items-center -space-x-1\.5/u,
	);
	assert.match(
		EXPERIMENTAL_HEADER_SOURCE,
		/<AvatarGroup\s+className=\{JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME\}[\s\S]*<AvatarUnassigned[\s\S]*assignees\.slice\(0, JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS - 1\)/u,
	);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /shape=\{isAgent \? "hexagon" : "circle"\}/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /headerAssignees\?: readonly JiraKanbanAssigneeData\[\];/u);
	assert.match(EXPERIMENTAL_PAGE_SOURCE, /fillBoardFacepileAssignees\(/u);
	assert.match(
		EXPERIMENTAL_PULSE_MODE_CONTROLS_SOURCE,
		/<AvatarGroup[\s\S]*className=\{JIRA_KANBAN_HEADER_FACEPILE_CLASS_NAME\}[\s\S]*members\.slice\(0, JIRA_KANBAN_HEADER_FACEPILE_MAX_ITEMS\)\.map/u,
	);
	assert.doesNotMatch(EXPERIMENTAL_PULSE_MODE_CONTROLS_SOURCE, /-mx-0\.5|px-0\.5/u);
	assert.match(
		EXPERIMENTAL_PULSE_MODE_CONTROLS_SOURCE,
		/<Button[\s\S]*className=\{cn\(active \? "border-border-selected text-text-selected! \[&_svg\]:text-icon-selected!" : null\)\}[\s\S]*size="default"[\s\S]*variant="outline"/u,
	);
});

test("Experimental kanban keeps its column or session-rail gutter on the scroll row", () => {
	assert.doesNotMatch(
		EXPERIMENTAL_SOURCE.match(/<section[\s\S]*?<\/section>/u)?.[0] ?? "",
		/paddingInline: token\("space\.200"\)/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/className=\{cn\("flex w-max items-stretch", columnSizing === "fill" \? "min-h-full min-w-full" : "h-full"\)\}\s*style=\{\{ paddingInlineStart: resolvedColumnRowPaddingInlineStart \}\}/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/className="flex min-h-full flex-1 items-stretch gap-2"/u,
	);
	assert.match(
		EXPERIMENTAL_SOURCE,
		/style=\{\{ width: `calc\(var\(--spacing\) \* 6 \+ \$\{scrollEndInset\}px\)` \}\}/u,
	);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /items-center gap-2 px-6/u);
	assert.match(EXPERIMENTAL_HEADER_SOURCE, /flex-wrap items-center gap-2 px-6/u);
});
