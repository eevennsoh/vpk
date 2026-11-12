const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const ARTIFACT_RESET_ACTIONS_SOURCE = readSource("use-rovo-app-artifact-reset-actions.ts");

test("Rovo app core delegates transient artifact reset wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-artifact-reset-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppArtifactResetActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /clearStreamingArtifactState/u);
	assert.match(CORE_HOOK_SOURCE, /resetPendingArtifactAssociation/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /setPendingArtifactResult\(null\)/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /pendingArtifactAssociationRef\.current = false/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /pendingArtifactAssociationRef = useRef/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /streamingArtifactMessageIdRef = useRef/u);

	assert.match(ARTIFACT_RESET_ACTIONS_SOURCE, /export function useRovoAppArtifactResetActions/u);
	assert.match(ARTIFACT_RESET_ACTIONS_SOURCE, /pendingArtifactAssociationRef = useRef\(false\)/u);
	assert.match(ARTIFACT_RESET_ACTIONS_SOURCE, /streamingArtifactMessageIdRef = useRef<string \| null>\(null\)/u);
	assert.match(ARTIFACT_RESET_ACTIONS_SOURCE, /clearQueuedStreamingArtifactDelta\(\)/u);
	assert.match(ARTIFACT_RESET_ACTIONS_SOURCE, /setStreamingArtifact\(null\)/u);
	assert.match(ARTIFACT_RESET_ACTIONS_SOURCE, /setPendingArtifactResult\(null\)/u);
	assert.match(ARTIFACT_RESET_ACTIONS_SOURCE, /pendingArtifactAssociationRef\.current = false/u);
});
