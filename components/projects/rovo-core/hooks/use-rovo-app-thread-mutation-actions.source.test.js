const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const THREAD_MUTATION_ACTIONS_SOURCE = readSource("use-rovo-app-thread-mutation-actions.ts");

test("Rovo app core delegates thread deletion and vote wiring to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-thread-mutation-actions";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppThreadMutationActions\(\{/u);
	assert.match(CORE_HOOK_SOURCE, /deleteAllThreads/u);
	assert.match(CORE_HOOK_SOURCE, /deleteThread/u);
	assert.match(CORE_HOOK_SOURCE, /voteOnMessage/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /deleteRovoAppThreadWithLifecycle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /deleteAllRovoAppThreadsWithLifecycle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /setRovoAppVote/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /applyRovoAppVoteToMap/u);

	assert.match(THREAD_MUTATION_ACTIONS_SOURCE, /export function useRovoAppThreadMutationActions/u);
	assert.match(THREAD_MUTATION_ACTIONS_SOURCE, /deleteRovoAppThreadWithLifecycle/u);
	assert.match(THREAD_MUTATION_ACTIONS_SOURCE, /deleteAllRovoAppThreadsWithLifecycle/u);
	assert.match(THREAD_MUTATION_ACTIONS_SOURCE, /setRovoAppVote/u);
	assert.match(THREAD_MUTATION_ACTIONS_SOURCE, /applyRovoAppVoteToMap/u);
});
