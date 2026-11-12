const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readHookSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readHookSource("use-rovo-app-core.ts");
const ARTIFACT_PANEL_EFFECTS_SOURCE = readHookSource("use-rovo-app-artifact-panel-effects.ts");

test("Rovo app core delegates artifact panel lifecycle effects to a focused hook", () => {
	assert.match(CORE_HOOK_SOURCE, /from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-artifact-panel-effects";/u);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppArtifactPanelEffects\(\{/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /resolveRovoAppStreamingArtifactAutoOpenPlan/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /resolveRovoAppCompletedArtifactAutoOpen/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /shouldOpenDelayedRovoAppStreamingArtifact/u);
	assert.match(ARTIFACT_PANEL_EFFECTS_SOURCE, /export function useRovoAppArtifactPanelEffects/u);
	assert.match(ARTIFACT_PANEL_EFFECTS_SOURCE, /pendingArtifactAssociationRef\.current = false/u);
	assert.match(ARTIFACT_PANEL_EFFECTS_SOURCE, /getMessageArtifactResult\(associatedMessage\)/u);
	assert.match(ARTIFACT_PANEL_EFFECTS_SOURCE, /resolveRovoAppStreamingArtifactAutoOpenPlan/u);
	assert.match(ARTIFACT_PANEL_EFFECTS_SOURCE, /resolveRovoAppCompletedArtifactAutoOpen/u);
	assert.match(ARTIFACT_PANEL_EFFECTS_SOURCE, /shouldOpenDelayedRovoAppStreamingArtifact/u);
});
