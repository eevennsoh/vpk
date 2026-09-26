const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");

test("Jira Toolbar leads with Select all, Add agent, and Ask Rovo", () => {
	const assignIndex = SOURCE.indexOf('id: "assign"');
	const rovoIndex = SOURCE.indexOf('id: "ask-rovo"');
	assert.ok(assignIndex >= 0 && assignIndex < rovoIndex);
	assert.match(SOURCE, /ref=\{leadingRef\}[\s\S]*?<span>selected<\/span>[\s\S]*?Select all[\s\S]*?<ToolbarSeparator/u);
	assert.match(SOURCE, /@atlaskit\/icon-lab\/core\/rovo/u);
	assert.match(SOURCE, /icon: <RovoIcon label="" size="small"/u);
	assert.doesNotMatch(SOURCE, /RovoColorIcon|@\/components\/ui\/logo/u);
	assert.match(SOURCE, /@atlaskit\/icon\/core\/presenter-mode/u);
	assert.doesNotMatch(SOURCE, /Use skills|SkillSelector/u);
	assert.match(SOURCE, /id: "change-status",\s*alwaysOverflow: true/u);
	assert.match(SOURCE, /id: "delete",\s*alwaysOverflow: true/u);
});

test("Jira Toolbar only renders Merge for multi-selection", () => {
	assert.match(SOURCE, /selectedCount > 1[\s\S]*?id: "merge"[\s\S]*?: \[\]/u);
});

test("Jira Toolbar owns functional status, agent assignment, and clear callbacks", () => {
	assert.match(SOURCE, /onAgentAssignmentChange\(agentId, !selectedAgentIdSet\.has\(agentId\)\)/u);
	assert.match(SOURCE, /onSelect=\{\(\) => onStatusChange\(status\)\}/u);
	assert.match(SOURCE, /aria-label="Clear selection"[\s\S]*onClick=\{onClearSelection\}/u);
	assert.match(SOURCE, /event\.key === "Escape"[\s\S]*onClearSelection\(\)/u);
	assert.doesNotMatch(SOURCE, /addEventListener\("keydown", handleKeyDown, true\)/u);
});

test("Jira Toolbar preserves agent assignment and launches real Rovo navigation", () => {
	assert.match(SOURCE, /defaultPinnedAgentIds=\{defaultPinnedAgentIds\}/u);
	assert.match(SOURCE, /<AgentSelector[\s\S]*selectionMode="single"/u);
	assert.match(SOURCE, /disabled=\{!onSelectAll\}/u);
	assert.match(SOURCE, /rovoChat\.openChat\("sidebar"\)/u);
	assert.match(SOURCE, /router\.push\("\/rovo"\)/u);
});

test("Jira Toolbar uses token motion with a reduced-motion path", () => {
	assert.match(SOURCE, /duration: 0\.25,[\s\S]*ease: \[0, 0\.4, 0, 1\]/u);
	assert.match(SOURCE, /duration: 0\.2,[\s\S]*ease: \[0\.6, 0, 0\.8, 0\.6\]/u);
	assert.match(SOURCE, /useReducedMotion\(\)/u);
	assert.match(SOURCE, /willChange: "transform, opacity"/u);
});

test("Jira Toolbar keeps only the toolbar inverse while popups inherit the app theme", () => {
	assert.match(SOURCE, /data-color-mode="dark"/u);
	assert.match(SOURCE, /data-subtree-theme=""/u);
	assert.match(SOURCE, /boxShadow: token\("elevation.shadow.overlay"\)/u);
	assert.doesNotMatch(SOURCE, /POPUP_THEME_PROPS/u);
	assert.match(SOURCE, /computeContextBarOverflow\(/u);
});
