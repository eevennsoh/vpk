const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const ARTIFACT_PANEL_CONTROLLER_SOURCE = readSource("use-rovo-app-artifact-panel-controller.ts");

test("Rovo app core delegates artifact panel callbacks to a focused controller hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-artifact-panel-controller";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppArtifactPanelController\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppArtifactPanelActions\(\{/u);
	assert.doesNotMatch(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/lib\/rovo-app-artifact-panel-dispatcher";/u,
	);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /openRovoAppArtifactFromMessageCore/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /saveRovoAppArtifactDraftCore/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /hideRovoAppArtifactPaneCore/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /export function useRovoAppArtifactPanelController/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /export function useRovoAppArtifactPanelActions/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /hideRovoAppArtifactPane/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /persistRovoAppActiveDocumentSelection/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /saveRovoAppStreamingArtifactCheckpoint/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /hydrateRovoAppPersistedArtifact/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /openRovoAppArtifactFromMessage/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /openRovoAppDocument/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /openRovoAppPlanAsDocument/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /saveRovoAppArtifactDraft/u);
	assert.match(ARTIFACT_PANEL_CONTROLLER_SOURCE, /deleteRovoAppDocumentWithLifecycle/u);
});
