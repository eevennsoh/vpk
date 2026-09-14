const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SUBMENU_SOURCE = readFileSync(
	join(__dirname, "agent-session-link-work-item-submenu.tsx"),
	"utf8",
);
const MORE_MENU_SOURCE = readFileSync(join(__dirname, "agent-session-more-menu.tsx"), "utf8");
const MENU_HOOK_SOURCE = readFileSync(join(__dirname, "use-agent-session-menu.ts"), "utf8");
const CARD_SOURCE = readFileSync(join(__dirname, "agent-session-card.tsx"), "utf8");
const LIST_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
// The board host is the only consumer that wires these capabilities, so its two
// review-found contracts are pinned here beside the feature they belong to.
const BOARD_HOOK_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/hooks/use-board-menu-work-item.ts"),
	"utf8",
);
const BOARD_PAGE_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/page.tsx"),
	"utf8",
);
const INPUT_GROUP_SOURCE = readFileSync(join(__dirname, "../../ui/input-group.tsx"), "utf8");

test("the picker is a submenu of the row's own menu, not a second overlay", () => {
	assert.match(SUBMENU_SOURCE, /<DropdownMenuSub\b/u);
	assert.match(
		SUBMENU_SOURCE,
		/<DropdownMenuSubTrigger aria-haspopup="dialog">\{AGENT_SESSION_LINK_WORK_ITEM_LABEL\}<\/DropdownMenuSubTrigger>/u,
	);
	// A click inside the panel is not a menu selection; letting it bubble would
	// close the row's menu out from under the panel.
	assert.match(SUBMENU_SOURCE, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/u);
});

test("the panel offers Link to existing and Create new, in that order", () => {
	assert.match(
		SUBMENU_SOURCE,
		/<TabsTrigger disabled=\{!canLink\} value="existing">Link to existing<\/TabsTrigger>\s*<TabsTrigger disabled=\{!canCreate\} value="create">Create new<\/TabsTrigger>/u,
	);
	// The tab that opens is one the host can actually service.
	assert.match(SUBMENU_SOURCE, /defaultValue=\{canLink \? "existing" : "create"\}/u);
});

test("a tab whose capability is missing renders disabled rather than absent", () => {
	assert.match(SUBMENU_SOURCE, /const canLink = onLinkWorkItem !== undefined;/u);
	assert.match(SUBMENU_SOURCE, /const canCreate = onCreateWorkItem !== undefined;/u);
	assert.match(SUBMENU_SOURCE, /disabled=\{!canLink\}/u);
	assert.match(SUBMENU_SOURCE, /disabled=\{!canCreate\}/u);
});

test("Link to existing searches the host's own work items", () => {
	assert.match(SUBMENU_SOURCE, /aria-label="Search work items"/u);
	assert.match(SUBMENU_SOURCE, /placeholder="Search\.\.\."/u);
	// Key and summary are searched together so "RFP-103" and "Meridian" both hit.
	assert.match(
		SUBMENU_SOURCE,
		/`\$\{option\.key\} \$\{option\.summary\}`\.toLowerCase\(\)\.includes\(trimmedQuery\)/u,
	);
	// The heading names what the list is: recall at rest, matches while filtering.
	assert.match(SUBMENU_SOURCE, /trimmedQuery\.length > 0 \? "Results" : "Recently viewed"/u);
	assert.match(
		SUBMENU_SOURCE,
		/<DropdownMenuGroup[^>]*>\s*<DropdownMenuLabel>\s*\{trimmedQuery\.length > 0 \? "Results" : "Recently viewed"\}\s*<\/DropdownMenuLabel>/u,
	);
	assert.match(SUBMENU_SOURCE, /No matching work items\./u);
});

test("each row shows the work item's own issue-type glyph beside key and summary", () => {
	assert.match(
		SUBMENU_SOURCE,
		/import \{ IssueTypeGlyph \} from "@\/components\/blocks\/jira-list\/jira-list-cells";/u,
	);
	assert.match(SUBMENU_SOURCE, /<IssueTypeGlyph issueType=\{option\.issueType \?\? "task"\} \/>/u);
	assert.match(SUBMENU_SOURCE, /\{option\.key\} \{option\.summary\}/u);
});

test("selecting a row links that key and closes the whole menu", () => {
	assert.match(SUBMENU_SOURCE, /onClick=\{\(\) => handleLink\(option\.key\)\}/u);
	assert.match(
		SUBMENU_SOURCE,
		/function handleLink\(workItemKey: string\) \{\s*onRequestClose\(\);\s*reset\(\);\s*onLinkWorkItem\?\.\(workItemKey\);/u,
	);
});

test("Create new submits the typed name and the chosen type together", () => {
	assert.match(SUBMENU_SOURCE, /placeholder="Name this work item"/u);
	assert.match(
		SUBMENU_SOURCE,
		/onCreateWorkItem\?\.\(\{ issueType, summary: trimmedSummary \}\)/u,
	);
	// A blank name must not mint a card titled with whitespace.
	assert.match(SUBMENU_SOURCE, /if \(trimmedSummary\.length === 0\) \{\s*return;/u);
	assert.match(SUBMENU_SOURCE, /const canSubmit = summary\.trim\(\)\.length > 0;/u);
	assert.match(SUBMENU_SOURCE, /disabled=\{!canSubmit\}/u);
	assert.match(
		SUBMENU_SOURCE,
		/function CreateWorkItemField[\s\S]*<form[\s\S]*<InputGroup>[\s\S]*<InputGroupAddon>[\s\S]*<IssueTypePicker[\s\S]*<InputGroupInput[\s\S]*name="summary"[\s\S]*<InputGroupAddon align="inline-end">[\s\S]*<InputGroupButton/u,
	);
});

test("the return chip is a real submit button, reachable by pointer and by Enter", () => {
	assert.match(SUBMENU_SOURCE, /import ReturnIcon from "@atlaskit\/icon-lab\/core\/return";/u);
	assert.match(SUBMENU_SOURCE, /aria-label="Create work item"/u);
	assert.match(SUBMENU_SOURCE, /<form[\s\S]*onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*if \(canSubmit\) \{\s*onSubmit\(\);/u);
	assert.match(SUBMENU_SOURCE, /<InputGroupButton[\s\S]*type="submit"/u);
});

test("a disabled empty-submit button does not make the editable input group look disabled", () => {
	assert.match(
		INPUT_GROUP_SOURCE,
		/has-\[\[data-slot=input-group-control\]:disabled\]:bg-input\/50/u,
	);
	assert.match(
		INPUT_GROUP_SOURCE,
		/has-\[\[data-slot=input-group-control\]:disabled\]:opacity-50/u,
	);
	assert.doesNotMatch(INPUT_GROUP_SOURCE, /\bhas-disabled:(?:bg-input\/50|opacity-50)\b/u);
});

test("the issue-type picker stays inside the menu without leaving the a11y tree", () => {
	// Model the picker as another submenu so Base UI keeps it inside the parent
	// menu tree while its shared portal remains in the viewport coordinate space.
	assert.match(SUBMENU_SOURCE, /<DropdownMenuSub onOpenChange=\{setOpen\} open=\{open\}>/u);
	assert.doesNotMatch(SUBMENU_SOURCE, /portalContainer/u);
	assert.doesNotMatch(SUBMENU_SOURCE, /useRef/u);
	assert.match(SUBMENU_SOURCE, /aria-label=\{`Work item type: \$\{issueTypeLabel\(value\)\}`\}/u);
	// The results list remains the panel's only scroll owner.
	assert.doesNotMatch(SUBMENU_SOURCE, /className="max-h-none w-\[22rem\] overflow-hidden p-0"/u);
	assert.match(SUBMENU_SOURCE, /max-h-\[16rem\] flex-col gap-0\.5 overflow-y-auto/u);
});

test("the issue-type picker matches Jira List geometry without shifting the name field", () => {
	assert.match(
		SUBMENU_SOURCE,
		/<DropdownMenuRadioItem\s+className="gap-2"\s+indicatorPlacement="end"/u,
	);
	assert.match(
		SUBMENU_SOURCE,
		/<Button\s+aria-label=\{`Work item type: \$\{issueTypeLabel\(value\)\}`\}\s+className="shrink-0 gap-1 px-2"\s+size="compact"\s+type="button"\s+variant="ghost"/u,
	);
	assert.match(
		SUBMENU_SOURCE,
		/<DropdownMenuSubTrigger[\s\S]*className="h-6 w-auto gap-1 rounded-md px-2"[\s\S]*showChevron=\{false\}/u,
	);
	assert.match(SUBMENU_SOURCE, /<DropdownMenuSubTrigger[\s\S]*nativeButton[\s\S]*render=\{/u);
	assert.match(
		SUBMENU_SOURCE,
		/<DropdownMenuSubContent\s+align="start"\s+alignOffset=\{0\}\s+className="min-w-40"\s+side="bottom"\s+sideOffset=\{4\}/u,
	);
});

test("selecting the active issue type still closes the picker and restores the title field", () => {
	assert.match(
		SUBMENU_SOURCE,
		/<DropdownMenuRadioItem[\s\S]*onClick=\{\(\) => setOpen\(false\)\}[\s\S]*value=\{issueType\}/u,
	);
});

test("closing the panel clears the query, the draft name and the type", () => {
	assert.match(
		SUBMENU_SOURCE,
		/function reset\(\) \{\s*setQuery\(""\);\s*setSummary\(""\);\s*setIssueType\("task"\);/u,
	);
	assert.match(SUBMENU_SOURCE, /onOpenChange=\{\(open\) => \{\s*if \(!open\) \{\s*reset\(\);/u);
});

test("motion in the panel honours reduced motion", () => {
	for (const match of SUBMENU_SOURCE.matchAll(/transition-colors[^"]*/gu)) {
		assert.match(match[0], /motion-reduce:transition-none/u);
	}
});

test("the menu renders the picker only when the host supplied a capability", () => {
	assert.match(
		MORE_MENU_SOURCE,
		/const canPickWorkItem = actions\.onLinkWorkItem !== undefined\s*\|\| actions\.onCreateWorkItem !== undefined;/u,
	);
	assert.match(MORE_MENU_SOURCE, /onRequestClose=\{\(\) => onOpenChange\(false\)\}/u);
	assert.match(
		MORE_MENU_SOURCE,
		/\{showLinkWorkItemMenuItem && canPickWorkItem \?\s*\(\s*<AgentSessionLinkWorkItemSubmenu/u,
	);
	assert.match(MORE_MENU_SOURCE, /workItemOptions=\{workItemOptions\}\s*\/>\s*\) : null\}/u);
	assert.doesNotMatch(MORE_MENU_SOURCE, /<DropdownMenuItem[^>]*>\{AGENT_SESSION_LINK_WORK_ITEM_LABEL\}/u);
});

test("the host can hide only the Link work item menu row", () => {
	assert.match(MORE_MENU_SOURCE, /showLinkWorkItemMenuItem = true,/u);
	assert.match(
		MORE_MENU_SOURCE,
		/\{showLinkWorkItemMenuItem && canPickWorkItem \?/u,
	);
	assert.match(CARD_SOURCE, /showLinkWorkItemMenuItem=\{showLinkWorkItemMenuItem\}/u);
	assert.match(LIST_SOURCE, /showLinkWorkItemMenuItem=\{showLinkWorkItemMenuItem\}/u);
});

test("the hook resolves each capability to undefined when the host omits it", () => {
	assert.match(
		MENU_HOOK_SOURCE,
		/onCreateWorkItem: onCreateWorkItemFromDraft === undefined\s*\? undefined/u,
	);
	assert.match(MENU_HOOK_SOURCE, /onLinkWorkItem: onLinkWorkItem === undefined\s*\? undefined/u);
	// The draft callback is deliberately separate from `onCreateWorkItem`, whose
	// second argument the board's drag-to-create path already spends on a column.
	assert.doesNotMatch(MENU_HOOK_SOURCE, /onCreateWorkItem\?: \(item: AgentSessionItem, draft/u);
});

test("the list threads the picker's capabilities, visibility, and options down to the card", () => {
	for (const prop of ["onCreateWorkItemFromDraft", "onLinkWorkItem", "showLinkWorkItemMenuItem", "workItemOptions"]) {
		assert.match(LIST_SOURCE, new RegExp(`${prop}=\\{${prop}\\}`, "u"));
		assert.match(CARD_SOURCE, new RegExp(`\\b${prop}\\b`, "u"));
	}
	assert.match(CARD_SOURCE, /workItemOptions=\{workItemOptions\}/u);
});

test("the host forwards the picked issue type, not just the typed name", () => {
	// The hosted create path reads the session's title for the card summary, but
	// the type has no such carrier: dropping it would silently make every
	// Bug/Story/Epic a Task on the routes that own board creation.
	assert.match(BOARD_PAGE_SOURCE, /\{ \.\.\.item, title: draft\.summary \}/u);
	assert.match(BOARD_PAGE_SOURCE, /draft\.issueType,/u);
});

test("the fallback captures a session only once a card exists to hold it", () => {
	// Capture hides the row from untracked work. Capturing when the mutation
	// could not land leaves the session attached to nothing.
	assert.match(
		BOARD_HOOK_SOURCE,
		/if \(boardColumns\.length === 0\) \{\s*return;\s*\}\s*\n\s*updateBoardColumns/u,
	);
	assert.match(
		BOARD_HOOK_SOURCE,
		/if \(workItemKey === undefined \|\| !boardHasWorkItem\(boardColumns, workItemKey\)\) \{\s*return;\s*\}/u,
	);
});
