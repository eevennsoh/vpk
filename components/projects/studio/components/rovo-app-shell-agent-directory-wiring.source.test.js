// Wiring contract between Studio's shell and the Agent Directory's template flow. The directory's
// rendered suites prove a host's template callbacks are called; they cannot prove Studio passes
// them, and typecheck cannot either because the props are optional. A rendered test of the Studio
// shell (planned with its state machine) would replace this file.
const assert = require("node:assert/strict");
const test = require("node:test");
const { readRovoAppShellSource } = require("../../../../scripts/lib/rovo-app-shell-sources.js");

const studioShell = readRovoAppShellSource("studio");

test("Studio hands the Agent Directory its template select, build and open-config handlers", () => {
	assert.match(studioShell, /onSelectTemplateAgent=\{handleTemplateAgentSelect\}/u);
	assert.match(studioShell, /onBuildTemplateAgent=\{handleBuildTemplateAgent\}/u);
	assert.match(studioShell, /onOpenBuiltTemplateAgentConfig=\{handleOpenBuiltTemplateAgentConfig\}/u);
});
