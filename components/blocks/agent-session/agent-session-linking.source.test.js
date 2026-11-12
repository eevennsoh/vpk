const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const DATA_SOURCE = readFileSync(join(__dirname, "data.ts"), "utf8");
const INDEX_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const PAGE_SOURCE = readFileSync(join(__dirname, "page.tsx"), "utf8");
const TYPES_SOURCE = readFileSync(join(__dirname, "agent-session-types.ts"), "utf8");
const WORK_ITEM_SOURCE = readFileSync(join(__dirname, "agent-session-work-item.ts"), "utf8");
const FLYOUT_SOURCE = readFileSync(join(__dirname, "../product-sidebar/variants/jira-session-flyout.tsx"), "utf8");
const UNTRACKED_CARD_SOURCE = readFileSync(join(__dirname, "../product-sidebar/variants/jira-session-untracked-work-card.tsx"), "utf8");
const RAIL_SOURCE = readFileSync(join(__dirname, "../jira-kanban/experimental/pulse/components/pulse-rail.tsx"), "utf8");
const COLUMN_SOURCE = readFileSync(join(__dirname, "../agent-session-column/index.tsx"), "utf8");
const COLUMN_RAIL_SOURCE = readFileSync(join(__dirname, "../agent-session-column/agent-session-column-rail.tsx"), "utf8");

test("the untracked-work flyout offers the first candidate key", () => {
	assert.match(DATA_SOURCE, /export const AGENT_SESSION_MULTI_LINK_KEYS/u);
	assert.match(DATA_SOURCE, /"lw-scope-thread": \["PAY-101", "PAY-121", "PAY-104"\]/u);
	assert.match(DATA_SOURCE, /issueStatus: "Done"/u);
	assert.match(DATA_SOURCE, /issueStatus: "In review"/u);
	assert.match(TYPES_SOURCE, /getSuggestedWorkItemKeys\?: \(item: AgentSessionItem\) => readonly string\[\] \| undefined;/u);
	assert.match(TYPES_SOURCE, /onLinkWorkItem\?: \(item: AgentSessionItem, workItemKey\?: string\) => void;/u);
	assert.match(TYPES_SOURCE, /onArchiveSession\?: \(item: AgentSessionItem\) => void;/u);
	assert.match(WORK_ITEM_SOURCE, /export function resolveAgentSessionWorkItemKey/u);
	assert.match(WORK_ITEM_SOURCE, /const firstKey = getSuggestedWorkItemKeys\?\.\(item\)\?\.\[0\];/u);
	assert.match(INDEX_SOURCE, /onLinkWorkItem=\{flyoutActions\.onLinkWorkItem\}/u);
	assert.match(PAGE_SOURCE, /onSubtasks=\{handleCapture\}/u);
	assert.match(WORK_ITEM_SOURCE, /export function bindAgentSessionFlyoutActions/u);
	assert.match(WORK_ITEM_SOURCE, /capturedItemIds\?: ReadonlySet<string>;/u);
	assert.match(
		WORK_ITEM_SOURCE,
		/actions\.onLinkWorkItem\?\.\(item, workItemKey\.length > 0 \? workItemKey : undefined\)/u,
	);
	assert.match(WORK_ITEM_SOURCE, /actions\.onArchiveSession\?\.\(item\)/u);
	assert.match(WORK_ITEM_SOURCE, /actions\.onCreateWorkItem\?\.\(item\)/u);
	assert.match(WORK_ITEM_SOURCE, /actions\.onSubtasks\?\.\(item\)/u);
	assert.match(WORK_ITEM_SOURCE, /if \(isCaptured\(session\)\) \{\s*return;/u);
	assert.match(
		WORK_ITEM_SOURCE,
		/if \(trimmed === undefined \|\| trimmed\.length === 0 \|\| trimmed === session\.issueKey\)/u,
	);
	assert.match(WORK_ITEM_SOURCE, /return \{ \.\.\.session, issueKey: trimmed \};/u);
	assert.match(FLYOUT_SOURCE, /capturedSessionIds\?: ReadonlySet<string>;/u);
	assert.match(UNTRACKED_CARD_SOURCE, /const linkLabel = hasIssueKey \? `Link to \$\{issueKey\}` : "Link work item";/u);
	assert.match(FLYOUT_SOURCE, /captureLocked \|\| onLinkWorkItem === undefined/u);
	assert.match(INDEX_SOURCE, /onArchiveSession=\{flyoutActions\.onArchiveSession\}/u);
	assert.match(INDEX_SOURCE, /archiveActionLabel=\{visibilityLabel\}/u);
});
test("collapsed session rail forwards archive capability to its shared flyout", () => {
	assert.match(COLUMN_SOURCE, /onArchiveSession=\{handleArchiveSession\}/u);
	assert.match(COLUMN_RAIL_SOURCE, /onArchiveSession\?: \(item: AgentSessionItem\) => void;/u);
	assert.match(COLUMN_RAIL_SOURCE, /onArchiveSession,\s*onCreateWorkItem,/u);
	assert.match(COLUMN_RAIL_SOURCE, /onArchiveSession=\{flyoutActions\.onArchiveSession\}/u);
});

test("Pulse's uncaptured column renders sessions through this block", () => {
	assert.match(
		RAIL_SOURCE,
		/import \{ AgentSession \} from "@\/components\/blocks\/agent-session";/u,
	);
	assert.match(
		RAIL_SOURCE,
		/<JiraIssue[\s\S]*variant="uncaptured-work"[\s\S]*<AgentSession[\s\S]*items=\{sessionItems\}/u,
	);
	assert.doesNotMatch(RAIL_SOURCE, /<AgentList\b/u);
	assert.doesNotMatch(RAIL_SOURCE, /variant="uncaptured"/u);
});
