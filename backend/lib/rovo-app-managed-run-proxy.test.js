const assert = require("node:assert/strict");
const test = require("node:test");

const {
	createRovoAppManagedRunProxy,
} = require("./rovo-app-managed-run-proxy");

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
		clearRovoAppRunState: async (threadId) => {
			calls.push(["clearRovoAppRunState", threadId]);
			runs.delete(threadId);
		},
		logger: {
			info: (...args) => calls.push(["logger.info", args]),
		},
		persistRovoAppRunState: async (threadId, run) => {
			calls.push(["persistRovoAppRunState", threadId, run]);
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
			settleRun: (threadId, options) => {
				calls.push(["settleRun", threadId, options]);
				runs.delete(threadId);
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
		/clearRovoAppRunState/u,
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
		"persistRovoAppRunState",
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
		"settleRun",
		"clearRovoAppRunState",
		"resolveAgentsRfpDemoChatTurn",
		"createRun",
		"attachSubscriber",
		"logger.info",
		"startManagedRovoAppRun",
		"getRun",
		"persistRovoAppRunState",
	]);
	assert.deepEqual(calls[2], ["rovoCancelChat", 8006, { timeoutMs: 3_000 }]);
	assert.deepEqual(calls[3], ["settleRun", "thread-1", { outcome: "cancelled" }]);
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

	assert.equal(calls.some(([name]) => name === "settleRun"), true);
	assert.equal(calls.some(([name]) => name === "startManagedRovoAppRun"), true);
});
