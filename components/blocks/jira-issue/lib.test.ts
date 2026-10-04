import assert from "node:assert/strict";
import test from "node:test";

import { getJiraIssueAgentSurfaceOffsets, JIRA_ISSUE_COMFORTABLE_COMPACT_ICON_CLASS, JIRA_ISSUE_COMFORTABLE_ISSUE_KEY_CLASS, JIRA_ISSUE_COMPACT_ISSUE_KEY_CLASS, resolveIssueAssigneeUnassignedKind, resolveJiraIssueIconMetrics, resolveJiraIssueSubtaskChrome } from "./lib.ts";

test("missing assignee photos resolve to the unassigned person placeholder", () => {
	assert.equal(resolveIssueAssigneeUnassignedKind(undefined), "person");
	assert.equal(resolveIssueAssigneeUnassignedKind(""), "person");
	assert.equal(resolveIssueAssigneeUnassignedKind("/maya.png"), undefined);
	assert.equal(resolveIssueAssigneeUnassignedKind(undefined, "agent"), "agent");
	assert.equal(resolveIssueAssigneeUnassignedKind("/maya.png", "person"), "person");
});

test("a resting card surface covers the whole agent shell", () => {
	assert.deepEqual(getJiraIssueAgentSurfaceOffsets(-1, false), {
		bottom: -1,
		left: -1,
		right: -1,
		top: -1,
	});
});

test("a chinless agent well insets every surface edge so the shell keeps its height", () => {
	// Regression: hovering an agent session highlights its board cards, and the
	// bottom band of the grey well used to be a 4px spacer row appended under the
	// card. That grew the shell from 124px to 128px on hover and nudged every card
	// below it down. All four edges must come out of the card instead.
	const offsets = getJiraIssueAgentSurfaceOffsets(3, true);

	assert.deepEqual(offsets, { bottom: 3, left: 3, right: 3, top: 3 });
	assert.equal(offsets.bottom, offsets.top);
});

test("compact icon metrics keep 12px glyphs and 16px avatars", () => {
	assert.deepEqual(resolveJiraIssueIconMetrics(), {
		assigneeSize: "xs",
		compactIconClassName: undefined,
		iconTileIconSize: "small",
		iconTileSize: "xxsmall",
		issueKeyClassName: JIRA_ISSUE_COMPACT_ISSUE_KEY_CLASS,
	});
	assert.deepEqual(resolveJiraIssueIconMetrics("compact"), {
		assigneeSize: "xs",
		compactIconClassName: undefined,
		iconTileIconSize: "small",
		iconTileSize: "xxsmall",
		issueKeyClassName: JIRA_ISSUE_COMPACT_ISSUE_KEY_CLASS,
	});
	assert.equal(JIRA_ISSUE_COMPACT_ISSUE_KEY_CLASS, "text-xs font-normal leading-4 text-text-subtlest");
});

test("comfortable icon metrics use 16px glyphs, 24px avatars, and the Subtasks label type", () => {
	assert.deepEqual(resolveJiraIssueIconMetrics("comfortable"), {
		assigneeSize: "sm",
		compactIconClassName: JIRA_ISSUE_COMFORTABLE_COMPACT_ICON_CLASS,
		iconTileIconSize: "medium",
		iconTileSize: "xxsmall",
		issueKeyClassName: JIRA_ISSUE_COMFORTABLE_ISSUE_KEY_CLASS,
	});
	assert.match(JIRA_ISSUE_COMFORTABLE_COMPACT_ICON_CLASS, /size-4!/u);
	assert.equal(JIRA_ISSUE_COMFORTABLE_ISSUE_KEY_CLASS, "text-xs font-medium leading-4 text-text-subtle");
});

test("nested subtask chrome inherits the parent unless overridden", () => {
	assert.equal(resolveJiraIssueSubtaskChrome("raised"), "raised");
	assert.equal(resolveJiraIssueSubtaskChrome("stroke"), "stroke");
	assert.equal(resolveJiraIssueSubtaskChrome("raised", "stroke"), "stroke");
	assert.equal(resolveJiraIssueSubtaskChrome("stroke", "raised"), "raised");
});

test("compact experimental cards keep nested subtask chrome stroke", () => {
	assert.equal(resolveJiraIssueSubtaskChrome("raised", undefined, true), "stroke");
	assert.equal(resolveJiraIssueSubtaskChrome("stroke", undefined, true), "stroke");
	assert.equal(resolveJiraIssueSubtaskChrome("raised", "raised", true), "raised");
});

test("a docked chin row keeps the surface bottom flush against it", () => {
	assert.deepEqual(getJiraIssueAgentSurfaceOffsets(3, false), {
		bottom: -1,
		left: 3,
		right: 3,
		top: 3,
	});
});
