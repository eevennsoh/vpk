const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const SUGGESTED_QUESTIONS_HOOK_SOURCE = readSource("use-rovo-app-suggested-questions.ts");

test("Rovo app core delegates suggested-question lifecycle to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-suggested-questions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppSuggestedQuestions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /fetchSuggestedQuestions: fetchRovoAppSuggestedQuestions/u);
	assert.match(CORE_HOOK_SOURCE, /messages: normalizedRovoMessages/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /runRovoAppSuggestedQuestionsLifecycle/u);

	assert.match(
		SUGGESTED_QUESTIONS_HOOK_SOURCE,
		/export function useRovoAppSuggestedQuestions/u,
	);
	assert.match(SUGGESTED_QUESTIONS_HOOK_SOURCE, /runRovoAppSuggestedQuestionsLifecycle/u);
	assert.match(SUGGESTED_QUESTIONS_HOOK_SOURCE, /requestedSuggestionMessageIdsRef/u);
	assert.match(SUGGESTED_QUESTIONS_HOOK_SOURCE, /suggestionsAbortControllerRef/u);
});
