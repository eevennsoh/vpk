/**
 * Import contract for the aggregate agent activity row.
 *
 * The row draws its own avatars through `AgentAvatarVisual`, so it must not
 * pull agent-list or agent-state *components* into the Jira Issue bundle.
 *
 * The guard reads value imports alone. Type-only specifiers erase at build
 * time and cost nothing, so barring them would police spelling rather than
 * bundle weight — and it would break the moment a shared model needs a type
 * from those barrels, which is exactly what `invokedBy: AgentListInvoker` does.
 *
 * Split out of `jira-issue.test.js`, which sits at the 1000-line file budget.
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const AGENT_ACTIVITY_SOURCE = readFileSync(join(__dirname, "agent-activity.tsx"), "utf8");
// The row is split across the container and its presentation half, so the
// guard has to read both — otherwise moving a component import one file over
// would satisfy it while the bundle is unchanged.
const ROW_PRESENTATION_SOURCE = readFileSync(
	join(__dirname, "agent-activity-row-presentation.tsx"),
	"utf8",
);
const ROW_SOURCE = [AGENT_ACTIVITY_SOURCE, ROW_PRESENTATION_SOURCE].join("\n");
const VALUE_IMPORTS = ROW_SOURCE.replace(/^import type [\s\S]*?;$/gmu, "");

test("the aggregate agent row pulls no agent-list or agent-state components", () => {
	assert.doesNotMatch(VALUE_IMPORTS, /from "@\/components\/blocks\/agent-list/u);
	assert.doesNotMatch(VALUE_IMPORTS, /from "@\/components\/blocks\/agent-state/u);
});

test("the row still draws its own avatars through AgentAvatarVisual", () => {
	assert.match(
		ROW_SOURCE,
		/import \{ AgentAvatarVisual \} from "@\/components\/ui-custom\/agent-avatar-visual";/u,
	);
});

test("a type-only agent-list import is allowed, so the invoker model can be shared", () => {
	// Proves the guard above measures bundle weight, not import spelling: this
	// type import is present in the source and must not trip it.
	assert.match(
		AGENT_ACTIVITY_SOURCE,
		/^import type \{ AgentListHost, AgentListInvoker \} from "@\/components\/blocks\/agent-list";$/mu,
	);
});

test("the assign hover catalog always includes the shared AgentSelector directory", () => {
	assert.match(AGENT_ACTIVITY_SOURCE, /function mergeJiraIssueAgentCatalog\(/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /mergeJiraIssueAgentCatalog\(activities, assignment\?\.agents\)/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /function canonicalizeJiraIssueAgentId\(/u);
	assert.doesNotMatch(AGENT_ACTIVITY_SOURCE, /assignment\?\.agents \?\? getJiraIssueAgentCatalog/u);
});
