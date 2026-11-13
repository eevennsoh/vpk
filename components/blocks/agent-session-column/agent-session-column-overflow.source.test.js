const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const OVERFLOW_MENU_SOURCE = readFileSync(join(__dirname, "agent-session-column-overflow-menu.tsx"), "utf8");
const OVERFLOW_SOURCE = readFileSync(join(__dirname, "agent-session-column-overflow.ts"), "utf8");
const DETAIL_SOURCE = readFileSync(join(__dirname, "../../../app/data/details/blocks/agent-session-column.ts"), "utf8");

test("the overflow menu is Link all suggestions, then Auto sync and Suggest link toggles", () => {
	assert.match(OVERFLOW_MENU_SOURCE, /Link all suggestions/u);
	assert.doesNotMatch(OVERFLOW_MENU_SOURCE, />\s*Link all\s*</u);
	assert.match(OVERFLOW_MENU_SOURCE, /<DropdownMenuSeparator/u);
	assert.match(OVERFLOW_MENU_SOURCE, /label="Auto sync"/u);
	assert.match(OVERFLOW_MENU_SOURCE, /const \[autoSync, setAutoSync\] = useState\(true\)/u);
	assert.match(OVERFLOW_MENU_SOURCE, /label="Suggest link"/u);
	assert.match(OVERFLOW_MENU_SOURCE, /const \[autoLink, setAutoLink\] = useState\(true\)/u);
	assert.match(OVERFLOW_MENU_SOURCE, /elemAfter=\{\(/u);
	assert.match(OVERFLOW_MENU_SOURCE, /<SwitchIndicator/u);
	assert.match(OVERFLOW_MENU_SOURCE, /aria-checked=\{checked\}/u);
	assert.match(OVERFLOW_MENU_SOURCE, /role="menuitemcheckbox"/u);
	assert.doesNotMatch(OVERFLOW_MENU_SOURCE, /<Switch[\s>]/u);
	assert.doesNotMatch(OVERFLOW_MENU_SOURCE, /suppressMenuDismissal/u);
	assert.doesNotMatch(OVERFLOW_MENU_SOURCE, /onCheckedChange=\{onCheckedChange\}/u);
	assert.match(OVERFLOW_MENU_SOURCE, /closeOnClick=\{false\}/u);
	assert.match(OVERFLOW_MENU_SOURCE, /linkAllAgentSessions/u);
	assert.match(OVERFLOW_SOURCE, /export function collectLinkableAgentSessions/u);
	assert.match(OVERFLOW_SOURCE, /export function linkAllAgentSessions/u);
	assert.match(DETAIL_SOURCE, /header overflow's Link all suggestions action/u);
	assert.doesNotMatch(DETAIL_SOURCE, /header overflow's Link all action/u);
});
