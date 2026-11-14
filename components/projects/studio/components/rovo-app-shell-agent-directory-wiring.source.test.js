// Wiring contract between Studio's shell and the Agent Directory's template flow. The directory's
// rendered suites prove a host's template callbacks are called; they cannot prove Studio passes
// them, and typecheck cannot either because the props are optional. A rendered test of the Studio
// shell (planned with its state machine) would replace this file.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const studioShell = fs.readFileSync(path.join(__dirname, "rovo-app-shell.tsx"), "utf8");

test("Studio hands the Agent Directory its template select, build and open-config handlers", () => {
	assert.match(studioShell, /onSelectTemplateAgent=\{handleTemplateAgentSelect\}/u);
	assert.match(studioShell, /onBuildTemplateAgent=\{handleBuildTemplateAgent\}/u);
	assert.match(studioShell, /onOpenBuiltTemplateAgentConfig=\{handleOpenBuiltTemplateAgentConfig\}/u);
});
