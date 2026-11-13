const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const ACTIVE_DOCUMENT_SYNC_HOOK_SOURCE = readSource("use-rovo-app-active-document-sync.ts");

test("Rovo app core delegates active document draft synchronization to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-active-document-sync";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppActiveDocumentSync\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /setArtifactDraftContent/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /useEffect/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /activeDocument\.versions\.at\(-1\)/u);

	assert.match(
		ACTIVE_DOCUMENT_SYNC_HOOK_SOURCE,
		/export function useRovoAppActiveDocumentSync/u,
	);
	assert.match(ACTIVE_DOCUMENT_SYNC_HOOK_SOURCE, /useEffect/u);
	assert.match(ACTIVE_DOCUMENT_SYNC_HOOK_SOURCE, /setArtifactDraftContent/u);
	assert.match(ACTIVE_DOCUMENT_SYNC_HOOK_SOURCE, /activeDocument\.versions\.at\(-1\)/u);
});
