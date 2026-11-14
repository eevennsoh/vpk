const assert = require("node:assert/strict");
const test = require("node:test");

const { createRovoAppManagedRunLifecycle } = require("./rovo-app-managed-run-lifecycle");
const {
	createRovoAppManagedRunProxy,
} = require("./rovo-app-managed-run-proxy");
const { createRovoAppRunManager } = require("./rovo-app-runs");
const { createRovoAppRunStateService } = require("./rovo-app-run-state");

function createResponse() {
	return {
		body: null,
		statusCode: 200,
		json(payload) {
			this.body = payload;
			return this;
		},
		status(statusCode) {
			this.statusCode = statusCode;
			return this;
		},
	};
}

function createHarness(overrides = {}) {
	const calls = [];
	const runs = new Map(overrides.runs || []);
	let attachOptions = null;
	const dependencies = {
		agentsRfpDemoChatStreamOwner: {
			streamAgentsRfpDemoChatTurn: (res, turn, requestBody) => {
				calls.push(["streamAgentsRfpDemoChatTurn", res, turn, requestBody]);
			},
		},
		logger: {
			info: (...args) => calls.push(["logger.info", args]),
		},
		persistRovoAppRunState: async (threadId, run) => {
			calls.push(["persistRovoAppRunState", threadId, run]);
		},
		persistRovoAppRunStateInBackground: (threadId, run) => {
			calls.push(["persistRovoAppRunStateInBackground", threadId, run]);
		},
		resolveAgentsRfpDemoChatTurn: (requestBody) => {
			calls.push(["resolveAgentsRfpDemoChatTurn", requestBody]);
			return overrides.agentsRfpDemoTurn || null;
		},
		rovoAppRunManager: {
			attachSubscriber: (threadId, res, options) => {
				calls.push(["attachSubscriber", threadId, res]);
				attachOptions = options;
				return overrides.subscriberId === undefined ? "subscriber-1" : overrides.subscriberId;
			},
			createRun: (input) => {
				calls.push(["createRun", input]);
				const run = {
					id: `run-${input.threadId}`,
					...input,
				};
				runs.set(input.threadId, run);
				return run;
			},
			getRun: (threadId) => {
				calls.push(["getRun", threadId]);
				return runs.get(threadId) || null;
			},
		},
		rovoCancelChat: async (rovoPort, options) => {
			calls.push(["rovoCancelChat", rovoPort, options]);
			if (overrides.rovoCancelChatError) {
				throw overrides.rovoCancelChatError;
			}
		},
		settleRovoAppRun: async (run, outcome) => {
			calls.push(["settleRovoAppRun", run, outcome]);
			if (runs.get(run?.threadId) === run) {
				runs.delete(run.threadId);
			}
			return true;
		},
		shouldReplaceActiveRunForRequest: ({ existingRun, requestBody }) => {
			calls.push(["shouldReplaceActiveRunForRequest", existingRun, requestBody]);
			return Boolean(overrides.replaceActiveRun);
		},
		startManagedRovoAppRun: async (run) => {
			calls.push(["startManagedRovoAppRun", run]);
		},
		...overrides.dependencies,
	};
	const proxy = createRovoAppManagedRunProxy(dependencies);

	return {
		calls,
		get attachOptions() {
			return attachOptions;
		},
		proxy,
		runs,
	};
}

test("createRovoAppManagedRunProxy validates required dependencies", () => {
	assert.throws(() => createRovoAppManagedRunProxy(), /streamAgentsRfpDemoChatTurn/u);
	assert.throws(
		() =>
			createRovoAppManagedRunProxy({
				agentsRfpDemoChatStreamOwner: {
					streamAgentsRfpDemoChatTurn: () => {},
				},
			}),
		/persistRovoAppRunState/u,
	);
});

test("proxyRovoAppChatRequest rejects requests without a thread id", async () => {
	const { calls, proxy } = createHarness();
	const res = createResponse();

	await proxy.proxyRovoAppChatRequest({ body: { id: "  " } }, res);

	assert.equal(res.statusCode, 400);
	assert.deepEqual(res.body, { error: "threadId is required" });
	assert.deepEqual(calls, []);
});

test("proxyRovoAppChatRequest streams RFP demo turns before creating managed runs", async () => {
	const { calls, proxy } = createHarness({
		agentsRfpDemoTurn: { turn: "qualification" },
	});
	const res = createResponse();
	const requestBody = { id: "thread-1", messages: [{ role: "user", content: "qualify" }] };

	await proxy.proxyRovoAppChatRequest({ body: requestBody }, res);

	assert.deepEqual(calls.map(([name]) => name), [
		"getRun",
		"shouldReplaceActiveRunForRequest",
		"resolveAgentsRfpDemoChatTurn",
		"streamAgentsRfpDemoChatTurn",
	]);
	assert.equal(calls.some(([name]) => name === "createRun"), false);
	assert.equal(calls[3][2].turn, "qualification");
	assert.deepEqual(calls[3][3], requestBody);
});

test("proxyRovoAppChatRequest creates and starts AI Gateway managed runs", async () => {
	const { calls, proxy } = createHarness();
	const res = createResponse();
	const requestBody = { id: "thread-1", messages: [{ role: "user", content: "hello" }] };

	await proxy.proxyRovoAppChatRequest({ body: requestBody }, res);

	assert.deepEqual(calls.map(([name]) => name), [
		"getRun",
		"shouldReplaceActiveRunForRequest",
		"resolveAgentsRfpDemoChatTurn",
		"createRun",
		"attachSubscriber",
		"logger.info",
		"startManagedRovoAppRun",
		"getRun",
		"persistRovoAppRunState",
	]);
	assert.deepEqual(calls[3][1], {
		backend: "ai-gateway",
		threadId: "thread-1",
		requestBody,
		requestedPortIndex: null,
	});
	assert.equal(calls[6][1].backend, "ai-gateway");
	assert.equal(calls[8][1], "thread-1");
	assert.equal(calls[8][2].backend, "ai-gateway");
});

test("proxyRovoAppChatRequest attaches to existing runs without restarting them", async () => {
	const existingRun = { id: "run-thread-1", threadId: "thread-1", backend: "ai-gateway" };
	const { calls, proxy } = createHarness({
		runs: [["thread-1", existingRun]],
	});
	const res = createResponse();

	await proxy.proxyRovoAppChatRequest({ body: { id: "thread-1" } }, res);

	assert.deepEqual(calls.map(([name]) => name), [
		"getRun",
		"shouldReplaceActiveRunForRequest",
		"attachSubscriber",
		"getRun",
		"persistRovoAppRunState",
	]);
	assert.equal(calls.some(([name]) => name === "startManagedRovoAppRun"), false);
	assert.equal(calls[4][2], existingRun);
});

test("proxyRovoAppChatRequest persists detached subscriber run snapshots", async () => {
	const detachedRun = { id: "run-detached", threadId: "thread-1" };
	const harness = createHarness({
		runs: [["thread-1", { id: "run-thread-1", threadId: "thread-1" }]],
	});
	const res = createResponse();

	await harness.proxy.proxyRovoAppChatRequest({ body: { id: "thread-1" } }, res);
	harness.attachOptions.onDetached(detachedRun);

	assert.deepEqual(harness.calls.at(-1), [
		"persistRovoAppRunStateInBackground",
		"thread-1",
		detachedRun,
	]);
});

test("proxyRovoAppChatRequest returns 404 when no subscriber attaches", async () => {
	const { calls, proxy } = createHarness({
		runs: [["thread-1", { id: "run-thread-1", threadId: "thread-1" }]],
		subscriberId: null,
	});
	const res = createResponse();

	await proxy.proxyRovoAppChatRequest({ body: { id: "thread-1" } }, res);

	assert.equal(res.statusCode, 404);
	assert.deepEqual(res.body, { error: "No active Rovo run for threadId" });
	assert.equal(calls.some(([name]) => name === "persistRovoAppRunState"), false);
});

test("proxyRovoAppChatRequest cancels and clears replaceable active runs before creating a new one", async () => {
	const existingRun = {
		id: "run-old",
		threadId: "thread-1",
		rovoPort: 8006,
	};
	const { calls, proxy } = createHarness({
		replaceActiveRun: true,
		runs: [["thread-1", existingRun]],
	});
	const res = createResponse();

	await proxy.proxyRovoAppChatRequest({ body: { id: "thread-1" } }, res);

	assert.deepEqual(calls.map(([name]) => name), [
		"getRun",
		"shouldReplaceActiveRunForRequest",
		"rovoCancelChat",
		"settleRovoAppRun",
		"getRun",
		"resolveAgentsRfpDemoChatTurn",
		"createRun",
		"attachSubscriber",
		"logger.info",
		"startManagedRovoAppRun",
		"getRun",
		"persistRovoAppRunState",
	]);
	assert.deepEqual(calls[2], ["rovoCancelChat", 8006, { timeoutMs: 3_000 }]);
	assert.deepEqual(calls[3], ["settleRovoAppRun", existingRun, "cancelled"]);
	assert.equal(calls[6][1].backend, "ai-gateway");
});

test("proxyRovoAppChatRequest continues replacing active runs when cancel chat fails", async () => {
	const { calls, proxy } = createHarness({
		replaceActiveRun: true,
		rovoCancelChatError: new Error("cancel failed"),
		runs: [["thread-1", { id: "run-old", threadId: "thread-1", rovoPort: 8006 }]],
	});
	const res = createResponse();

	await proxy.proxyRovoAppChatRequest({ body: { id: "thread-1" } }, res);

	assert.equal(calls.some(([name]) => name === "settleRovoAppRun"), true);
	assert.equal(calls.some(([name]) => name === "startManagedRovoAppRun"), true);
});

// An SSE response the run manager can write to; ending it fires "close" like a real one.
function createStreamingResponse() {
	const listeners = new Map();
	return {
		ended: false,
		writes: [],
		end() {
			this.ended = true;
			listeners.get("close")?.();
		},
		flushHeaders() {},
		json() {
			return this;
		},
		once(eventName, listener) {
			listeners.set(eventName, listener);
			return this;
		},
		setHeader() {},
		status() {
			return this;
		},
		write(chunk) {
			this.writes.push(chunk);
		},
	};
}

test("a run whose every thread write fails ends failed without an unhandled rejection", async (t) => {
	const unhandled = [];
	const onUnhandled = (reason) => unhandled.push(reason instanceof Error ? reason.message : String(reason));
	process.on("unhandledRejection", onUnhandled);
	t.after(() => process.off("unhandledRejection", onUnhandled));

	const quiet = { error: () => {}, info: () => {}, warn: () => {} };
	const runManager = createRovoAppRunManager({ logger: quiet });
	let settled;
	const runSettled = new Promise((resolve) => {
		settled = resolve;
	});
	const state = createRovoAppRunStateService({
		activeRequests: new Map(),
		createFailureSseChunks: () => ["failure-chunk"],
		logger: quiet,
		rovoAppRunManager: runManager,
		rovoAppThreadManager: {
			listThreads: async () => [],
			updateThread: async () => {
				throw new Error("disk full");
			},
		},
		startNextQueuedRun: () => settled(),
		synchronizeRovoAppThreadGeneratedFiles: async () => {},
	});
	const lifecycle = createRovoAppManagedRunLifecycle({
		executeRovoAppManagedRun: (run) => state.settleRovoAppRun(run, "completed", { messages: [{ id: "assistant-1" }] }),
		logger: quiet,
		persistRovoAppRunState: state.persistRovoAppRunState,
		resolveRovoAppPortAvailability: () => ({}),
		rovoAppRunManager: runManager,
		settleRovoAppRun: state.settleRovoAppRun,
	});
	const proxy = createRovoAppManagedRunProxy({
		agentsRfpDemoChatStreamOwner: { streamAgentsRfpDemoChatTurn: () => {} },
		logger: quiet,
		persistRovoAppRunState: state.persistRovoAppRunState,
		persistRovoAppRunStateInBackground: state.persistRovoAppRunStateInBackground,
		resolveAgentsRfpDemoChatTurn: () => null,
		rovoAppRunManager: runManager,
		rovoCancelChat: async () => {},
		settleRovoAppRun: state.settleRovoAppRun,
		shouldReplaceActiveRunForRequest: () => false,
		startManagedRovoAppRun: lifecycle.startManagedRovoAppRun,
	});
	const res = createStreamingResponse();

	// The request's own final write fails too; the chat route reports that one.
	await proxy.proxyRovoAppChatRequest({ body: { id: "thread-1" } }, res).catch(() => {});
	await runSettled;
	for (let turn = 0; turn < 5; turn += 1) {
		await new Promise((resolve) => setImmediate(resolve));
	}

	assert.equal(runManager.getRun("thread-1"), null);
	assert.deepEqual(res.writes, ["failure-chunk"]);
	assert.equal(res.ended, true);
	assert.deepEqual(unhandled, []);
});
