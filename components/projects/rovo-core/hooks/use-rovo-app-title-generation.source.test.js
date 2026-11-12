const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const TITLE_GENERATION_HOOK_SOURCE = readSource("use-rovo-app-title-generation.ts");

test("Rovo app core delegates title generation bookkeeping to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-title-generation";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppTitleGeneration\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /fetchTitle: fetchRovoAppAITitle/u);
	assert.match(CORE_HOOK_SOURCE, /updateThread: updateRovoAppThread/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /runRovoAppTitleGenerationLifecycle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /resolveChatTitle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /trimTitleText/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /shouldPersistResolvedRovoAppTitle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /updateRovoAppThreadTitleRecord/u);

	assert.match(
		TITLE_GENERATION_HOOK_SOURCE,
		/export function useRovoAppTitleGeneration/u,
	);
	assert.match(TITLE_GENERATION_HOOK_SOURCE, /runRovoAppTitleGenerationLifecycle/u);
	assert.match(TITLE_GENERATION_HOOK_SOURCE, /shouldPersistResolvedRovoAppTitle/u);
	assert.match(TITLE_GENERATION_HOOK_SOURCE, /updateRovoAppThreadTitleRecord/u);
	assert.match(TITLE_GENERATION_HOOK_SOURCE, /isRovoAppThreadNotFoundError/u);
	assert.match(TITLE_GENERATION_HOOK_SOURCE, /clearPendingTitleGeneration/u);
});
