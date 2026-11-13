const assert = require("node:assert/strict");
const path = require("node:path");
const { readFileSync } = require("node:fs");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const test = require("node:test");
const esbuild = require("esbuild");

function readProjectFile(relativePath) {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

async function loadRovoAppShellLayoutHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export { getRovoAppShellLayout } from "./components/projects/rovo-core/lib/rovo-app-shell-layout.ts";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "rovo-app-shell-layout-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("uses overlay mode below the mobile breakpoint", async () => {
	const { getRovoAppShellLayout } = await loadRovoAppShellLayoutHarness();
	const layout = getRovoAppShellLayout(767);

	assert.equal(layout.mode, "overlay");
	assert.equal(layout.chatPaneWidth, null);
	assert.equal(layout.artifactPaneX, 0);
	assert.equal(layout.artifactPaneWidth, 767);
});

test("uses overlay mode when split panes would be too cramped", async () => {
	const { getRovoAppShellLayout } = await loadRovoAppShellLayoutHarness();
	const layout = getRovoAppShellLayout(790);

	assert.equal(layout.mode, "overlay");
	assert.equal(layout.chatPaneWidth, null);
	assert.equal(layout.artifactPaneX, 0);
	assert.equal(layout.artifactPaneWidth, 790);
});

test("keeps split panes aligned on desktop widths", async () => {
	const { getRovoAppShellLayout } = await loadRovoAppShellLayoutHarness();
	const layout = getRovoAppShellLayout(980);

	assert.equal(layout.mode, "split");
	assert.equal(layout.chatPaneWidth, 441);
	assert.equal(layout.artifactPaneX, 0);
	assert.equal(layout.artifactPaneWidth, 539);
	assert.equal(layout.chatPaneWidth + layout.artifactPaneWidth, 980);
});

test("clamps the chat pane width on wide screens", async () => {
	const { getRovoAppShellLayout } = await loadRovoAppShellLayoutHarness();
	const layout = getRovoAppShellLayout(1600);

	assert.equal(layout.mode, "split");
	assert.equal(layout.chatPaneWidth, 560);
	assert.equal(layout.artifactPaneX, 0);
	assert.equal(layout.artifactPaneWidth, 1040);
});

test("Studio keeps its established composer width", () => {
	const studioLayoutConstantsSource = readProjectFile("components/projects/studio/lib/studio-layout-constants.ts");
	assert.match(studioLayoutConstantsSource, /export const ROVO_APP_STUDIO_COMPOSER_MAX_WIDTH_CLASS = "max-w-\[600px\]";/u);
});
