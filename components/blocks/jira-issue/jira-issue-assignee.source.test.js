const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const SUMMARY_SOURCE = readFileSync(join(__dirname, "summary.tsx"), "utf8");
const LIB_SOURCE = readFileSync(join(__dirname, "lib.ts"), "utf8");

test("Jira issue renders explicit unassigned avatars with the shared placeholder", () => {
	assert.match(SUMMARY_SOURCE, /AvatarUnassigned,/);
	assert.match(SOURCE, /assigneeUnassignedKind\?: AvatarUnassignedKind;/);
	assert.match(LIB_SOURCE, /export function resolveIssueAssigneeUnassignedKind/);
	assert.match(
		SUMMARY_SOURCE,
		/function JiraIssueAssignee[\s\S]*size = "sm"[\s\S]*const unassignedKind = resolveIssueAssigneeUnassignedKind\([\s\S]*assigneeAvatarSrc[\s\S]*assigneeUnassignedKind[\s\S]*if \(unassignedKind\) \{[\s\S]*<AvatarUnassigned[\s\S]*kind=\{unassignedKind\}[\s\S]*size=\{size\}/,
	);
	assert.match(SUMMARY_SOURCE, /usesStrokeChrome \? \([\s\S]*"flex size-6 shrink-0 items-center justify-center"[\s\S]*comfortableIcons \? undefined : "-mr-1"[\s\S]*data-slot="jira-issue-assignee-slot"[\s\S]*size=\{iconMetrics\.assigneeSize\}/);
	assert.match(SUMMARY_SOURCE, /size="sm"/);
});
test("Jira issue assignee avatars honor the shared hexagon shape for agents", () => {
	assert.match(SOURCE, /assigneeAvatarShape\?: NonNullable<AvatarProps\["shape"\]>;/);
	assert.match(SOURCE, /assigneeAvatarShape = "circle"/);
	assert.match(SUMMARY_SOURCE, /function JiraIssueAssignee[\s\S]*shape=\{assigneeAvatarShape\}/);
});
