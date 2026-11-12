const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const MESSAGE_EDIT_ACTIONS_SOURCE = readSource("use-rovo-app-message-edit-actions.ts");

test("Rovo app core delegates message edit and regeneration wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-message-edit-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppMessageEditActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /editMessage/u);
	assert.match(CORE_HOOK_SOURCE, /regenerateLatest/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /buildEditedRovoAppMessageHistory/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /window\.setTimeout/u);

	assert.match(MESSAGE_EDIT_ACTIONS_SOURCE, /export function useRovoAppMessageEditActions/u);
	assert.match(MESSAGE_EDIT_ACTIONS_SOURCE, /buildEditedRovoAppMessageHistory/u);
	assert.match(MESSAGE_EDIT_ACTIONS_SOURCE, /window\.setTimeout/u);
	assert.match(MESSAGE_EDIT_ACTIONS_SOURCE, /void regenerate\(\)/u);
});
