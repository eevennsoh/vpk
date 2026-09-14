const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "agent-session-column-types.ts"), "utf8");
const PANEL_DEMO_SOURCE = readFileSync(
	join(__dirname, "agent-session-column-panel-demo.tsx"),
	"utf8",
);
const BOARD_PAGE_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental-v2/page.tsx"),
	"utf8",
);
const IN_FLOW_COLUMN_SOURCE = readFileSync(
	join(__dirname, "../jira-kanban/experimental/components/in-flow-agent-session-column.tsx"),
	"utf8",
);
const DETAIL_SOURCE = readFileSync(
	join(__dirname, "../../../app/data/details/blocks/agent-session-column.ts"),
	"utf8",
);

test("the scrolling effect is an optional boolean capability", () => {
	assert.match(TYPES_SOURCE, /hasScrollingEffect\?: boolean;/u);
	assert.match(INDEX_SOURCE, /hasScrollingEffect = false/u);
	assert.match(
		INDEX_SOURCE,
		/const deck = hasScrollingEffect\s*\? AGENT_SESSION_DECK_STACKED\s*: AGENT_SESSION_DECK_FLAT/u,
	);
	assert.match(BOARD_PAGE_SOURCE, /hasScrollingEffect: true/u);
	assert.match(PANEL_DEMO_SOURCE, /\bhasScrollingEffect\b/u);
	assert.match(DETAIL_SOURCE, /name: "hasScrollingEffect"/u);
	assert.match(DETAIL_SOURCE, /hasScrollingEffect/u);
	assert.doesNotMatch(TYPES_SOURCE, /deck\?: AgentSessionDeck/u);
});

test("the in-flow timeline enables deck depth and its end-state only in advanced mode", () => {
	assert.match(
		IN_FLOW_COLUMN_SOURCE,
		/<AgentSessionColumn[\s\S]*?hasScrollingEffect=\{advancedTimeline\}/u,
	);
	assert.match(
		INDEX_SOURCE,
		/\{hasScrollingEffect \? \(\s*<AgentSessionColumnEndState/u,
	);
});

test("the opt-in scrollport uses transient chrome and an extended bottom fade", () => {
	assert.match(INDEX_SOURCE, /scrollbar-auto-hide/u);
	assert.match(INDEX_SOURCE, /AGENT_SESSION_PLANE_BOTTOM_FADE_SIZE/u);
	assert.match(INDEX_SOURCE, /pointer-events-none absolute inset-0 z-10/u);
	assert.match(
		INDEX_SOURCE,
		/overflow-y-auto has-\[:focus-visible\]:overflow-visible relative z-0 scrollbar-auto-hide/u,
	);
	assert.match(
		INDEX_SOURCE,
		/edge="bottom"[\s\S]*?fadeSize=\{hasScrollingEffect\s*\? AGENT_SESSION_PLANE_BOTTOM_FADE_SIZE\s*: AGENT_SESSION_PLANE_TOP_FADE_SIZE\}/u,
	);
});

test("the deck renders its end state after the final session", () => {
	assert.match(INDEX_SOURCE, /AGENT_SESSION_DECK_END_SPACE_PX/u);
	assert.match(INDEX_SOURCE, /import \{ AgentSessionColumnEndState \}/u);
	assert.match(
		INDEX_SOURCE,
		/<AgentSessionColumnEndState[\s\S]*?count=\{sessionCount\}[\s\S]*?visible=\{view === "active" && hasScrolledToBottom\}/u,
	);
	assert.doesNotMatch(INDEX_SOURCE, /paddingBottom: AGENT_SESSION_DECK_END_SPACE_PX/u);
});

test("the hidden footer still follows the list-level masks", () => {
	assert.match(
		INDEX_SOURCE,
		/flex-1 overflow-y-auto has-\[:focus-visible\]:overflow-visible[^"]*"[\s\S]*?<\/div>\s*\)\}\s*\{showTopScrollMask \|\| showBottomScrollMask \?/u,
	);
});
