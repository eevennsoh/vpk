const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { getJiraIssueAgentAvatarSize } = require("./agent-activity-avatar.ts");

test("coding-agent chins retain Claude's compact size without resizing other brands", () => {
	for (const brand of ["claude", "cursor", "openai-codex", "github-copilot"]) {
		assert.equal(getJiraIssueAgentAvatarSize(brand), 20);
	}
	for (const brand of ["slack", "github", undefined]) {
		assert.equal(getJiraIssueAgentAvatarSize(brand), 24);
	}
});

const AGENT_ACTIVITY_SOURCE = readFileSync(join(__dirname, "agent-activity.tsx"), "utf8");
const AGENT_ACTIVITY_PRESENTATION_SOURCE = readFileSync(
	join(__dirname, "agent-activity-row-presentation.tsx"),
	"utf8",
);

test("all Jira chin identity paths use the coding appearance", () => {
	const rowContent = AGENT_ACTIVITY_PRESENTATION_SOURCE.slice(
		AGENT_ACTIVITY_PRESENTATION_SOURCE.indexOf("export function JiraIssueAgentRowContent"),
		AGENT_ACTIVITY_PRESENTATION_SOURCE.indexOf("export function JiraIssueAgentRowSurface"),
	);
	assert.equal((rowContent.match(/<AgentAvatarVisual\s+appearance="coding"/gu) ?? []).length, 2);
	assert.match(AGENT_ACTIVITY_PRESENTATION_SOURCE, /function toAgentLoadingAgent[\s\S]*?avatar: \{\s*appearance: "coding"/u);
});

test("assignment flyout access is independent of the session lifecycle", () => {
	const assignmentHandle = AGENT_ACTIVITY_PRESENTATION_SOURCE.slice(
		AGENT_ACTIVITY_PRESENTATION_SOURCE.indexOf("export function JiraIssueAgentAssignmentHandle"),
		AGENT_ACTIVITY_PRESENTATION_SOURCE.indexOf("export function JiraIssueAgentRowSurface"),
	);
	assert.match(assignmentHandle, /if \(!showAssignmentFlyout\) \{\s*return rowHandle;/u);
	assert.match(assignmentHandle, /<AgentAssignment[\s\S]*openMode="click"[\s\S]*side="right"[\s\S]*trigger=\{rowHandle\}/u);
	assert.doesNotMatch(assignmentHandle, /isCompletedRow|\.state\s*===|\.state\s*!==/u);
});

test("chin rows keep lifecycle copy stable while flyout rows retain detailed status sequences", () => {
	assert.match(
		AGENT_ACTIVITY_PRESENTATION_SOURCE,
		/if \(isAwaitingInput\) \{[\s\S]*<span[\s\S]*\{rowLabel\}[\s\S]*<AnimatedDots/u,
	);
	assert.doesNotMatch(
		AGENT_ACTIVITY_PRESENTATION_SOURCE,
		/isAwaitingInput \? \([\s\S]*?<Shimmer[\s\S]*?\{rowLabel\}/u,
	);
	assert.match(AGENT_ACTIVITY_PRESENTATION_SOURCE, /className="block min-w-0 flex-1 truncate text-sm leading-5 text-text"[\s\S]*\{rowLabel\}/u);
	assert.doesNotMatch(AGENT_ACTIVITY_PRESENTATION_SOURCE, /JiraIssueCyclingAgentLabel|JIRA_ISSUE_AGENT_SHIMMER/u);
	assert.match(AGENT_ACTIVITY_SOURCE, /statusSequence: activity\.state === "working" \? getJiraIssueAgentWorkingLabels\(activity\) : undefined/u);
});

test("new Jira agent sessions show Working immediately", async () => {
	const { renderComponent } = require("../../../scripts/lib/render-component.js");
	const activity = {
		id: "new-session",
		name: "Claude",
		state: "working",
		label: "Working",
		startupSequence: "jira-work-item-start",
		startedAtMs: Date.now(),
	};
	const view = await renderComponent({
		entry: "components/blocks/jira-issue/agent-activity.tsx",
		exportName: "JiraIssueAgentActivityRows",
		props: {
			activities: [activity],
			iconScale: "comfortable",
			shouldReduceMotion: false,
			usesStrokeChrome: true,
		},
	});
	assert.ok(Boolean(view.getByText("Working")));
	assert.equal(Boolean(view.queryByText("Let's get started")), false);
	assert.equal(Boolean(view.queryByText("Gathering context")), false);
});
