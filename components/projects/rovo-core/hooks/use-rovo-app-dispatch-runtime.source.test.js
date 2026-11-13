const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readSource(fileName) {
	return readFileSync(path.join(__dirname, fileName), "utf8");
}

const CORE_HOOK_SOURCE = readSource("use-rovo-app-core.ts");
const DISPATCH_RUNTIME_SOURCE = readSource("use-rovo-app-dispatch-runtime.ts");

test("Rovo app core delegates queue processor refs and immediate-dispatch runtime plumbing to a focused hook", () => {
	assert.match(
		CORE_HOOK_SOURCE,
		/from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-dispatch-runtime";/u,
	);
	assert.match(CORE_HOOK_SOURCE, /useRovoAppDispatchRuntime\(\)/u);
	assert.match(CORE_HOOK_SOURCE, /immediateDispatchInProgressRef/u);
	assert.match(CORE_HOOK_SOURCE, /immediateDispatchLifecycle/u);
	assert.match(CORE_HOOK_SOURCE, /interruptActiveTurnRef/u);
	assert.match(CORE_HOOK_SOURCE, /processQueueRef/u);
	assert.match(CORE_HOOK_SOURCE, /queueProcessorRunningRef/u);
	assert.match(CORE_HOOK_SOURCE, /kickQueue/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /createRovoAppImmediateDispatchLifecycle/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /const queueProcessorRunningRef = useRef\(false\)/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /const processQueueRef = useRef/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /const kickQueue = useCallback/u);

	assert.match(DISPATCH_RUNTIME_SOURCE, /export function useRovoAppDispatchRuntime/u);
	assert.match(DISPATCH_RUNTIME_SOURCE, /createRovoAppImmediateDispatchLifecycle\(\{/u);
	assert.match(DISPATCH_RUNTIME_SOURCE, /const immediateDispatchInProgressRef = useRef\(false\)/u);
	assert.match(DISPATCH_RUNTIME_SOURCE, /const queueProcessorRunningRef = useRef\(false\)/u);
	assert.match(DISPATCH_RUNTIME_SOURCE, /const processQueueRef = useRef/u);
	assert.match(DISPATCH_RUNTIME_SOURCE, /const kickQueue = useCallback/u);
});
