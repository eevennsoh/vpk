/**
 * Source contract: a filter that can hide cards must not leave a stale
 * selection behind.
 *
 * Bulk status change, bulk agent assignment, and multi-drag all read
 * `selection.selectedCardCodes` and write through `updateBoardColumns` against
 * the unfiltered board — not against what is on screen. So any control that
 * removes cards from view has to reset the selection in the same gesture, or
 * an action on the visible selection silently moves or reassigns cards the
 * viewer can no longer see. The assignee filter set that contract; the Agents
 * focus row joined it once it began scoping cards rather than only rows.
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const EXPERIMENTAL_DIR = __dirname;
const PAGE_SOURCE = readFileSync(join(EXPERIMENTAL_DIR, "page.tsx"), "utf8");
const BOARD_FILTER_HOOK_SOURCE = readFileSync(
	join(EXPERIMENTAL_DIR, "hooks/use-board-filter.ts"),
	"utf8",
);

/** Body of a single-expression arrow handler declared as `const <name> = (...) => { ... }`. */
function handlerBody(source, name) {
	const start = source.indexOf(`const ${name} = (`);
	assert.notEqual(start, -1, `${name} should exist in page.tsx`);
	const open = source.indexOf("{", source.indexOf("=>", start));
	assert.notEqual(open, -1, `${name} should have a block body`);

	let depth = 0;
	for (let index = open; index < source.length; index += 1) {
		if (source[index] === "{") depth += 1;
		if (source[index] === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(open, index + 1);
		}
	}

	throw new Error(`${name} body is unbalanced`);
}

test("changing the Agents focus row clears the card selection and any drag", () => {
	const body = handlerBody(PAGE_SOURCE, "handleAgentFilterChange");

	assert.match(body, /setSelection\(createJiraKanbanSelectionState\(\)\)/u);
	assert.match(body, /setDraggedCard\(null\)/u);
	assert.match(body, /setAgentFilterId\(nextAgentFilterId\)/u);
});

test("the focus row control is wired to that handler, not the raw setter", () => {
	assert.match(PAGE_SOURCE, /onAgentFilterIdChange=\{handleAgentFilterChange\}/u);
	assert.doesNotMatch(PAGE_SOURCE, /onAgentFilterIdChange=\{setAgentFilterId\}/u);
});

test("Needs input scopes unlink sessions with the same focus the board uses", () => {
	assert.match(PAGE_SOURCE, /useAgentFilterSessions\(\{/u);
	assert.match(PAGE_SOURCE, /items: displayedUntrackedAgentSessionItems,/u);
	assert.match(PAGE_SOURCE, /members: agentSessionMembers,/u);
});

test("the assignee filter still clears the same state, so both paths agree", () => {
	const body = handlerBody(PAGE_SOURCE, "handleAssigneeFilterChange");

	assert.match(body, /boardFilter\.actions\.setAssigneeIds\(assigneeIds\)/u);
});

test("every board-filter assignee mutation clears focused collapse and card state", () => {
	assert.match(
		PAGE_SOURCE,
		/const resetAssigneeScopedBoardState = useCallback\(\(\) => \{[\s\S]*?setSelection\(createJiraKanbanSelectionState\(\)\)[\s\S]*?setDraggedCard\(null\)[\s\S]*?setFocusedCollapsedColumns\(null\)[\s\S]*?\}, \[\]\);/u,
	);
	assert.match(PAGE_SOURCE, /useBoardFilter\(\{ onAssigneeChange: resetAssigneeScopedBoardState \}\)/u);
	assert.match(BOARD_FILTER_HOOK_SOURCE, /if \(fieldId === "assignee"\) onAssigneeChange\?\.\(\);[\s\S]*?toggleBoardFilterValue/u);
	assert.match(BOARD_FILTER_HOOK_SOURCE, /const setAssigneeIds = useCallback\([\s\S]*?onAssigneeChange\?\.\(\);/u);
	assert.match(BOARD_FILTER_HOOK_SOURCE, /const clearField = useCallback\([\s\S]*?if \(fieldId === "assignee"\) onAssigneeChange\?\.\(\);/u);
	assert.match(BOARD_FILTER_HOOK_SOURCE, /const clearAll = useCallback\([\s\S]*?onAssigneeChange\?\.\(\);/u);
	assert.match(PAGE_SOURCE, /boardFilter\.actions\.setAssigneeIds\(nextAssigneeIds\)/u);
});

test("bulk actions read the raw selection, which is why the reset is required", () => {
	const statusChange = handlerBody(PAGE_SOURCE, "handleSelectedCardsStatusChange");
	const agentAssignment = handlerBody(PAGE_SOURCE, "handleSelectedCardsAgentAssignmentChange");

	assert.match(statusChange, /\[\.\.\.selection\.selectedCardCodes\]/u);
	assert.match(agentAssignment, /selection\.selectedCardCodes/u);
});
