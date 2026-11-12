const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const DATA_PART_ACTIONS_SOURCE = readSource("use-rovo-app-data-part-actions.ts");

test("Rovo app core delegates data-part dispatch wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-data-part-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppDataPartActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /handleRovoAppDataPart/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /dispatchRovoAppDataPart/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /toast\("Previous version saved"/u);

	assert.match(DATA_PART_ACTIONS_SOURCE, /export function useRovoAppDataPartActions/u);
	assert.match(DATA_PART_ACTIONS_SOURCE, /dispatchRovoAppDataPart\(dataPart, \{/u);
	assert.match(DATA_PART_ACTIONS_SOURCE, /toast\("Previous version saved"/u);
	assert.match(DATA_PART_ACTIONS_SOURCE, /notifyStreamingCancelled/u);
});
