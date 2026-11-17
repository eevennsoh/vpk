"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { setImmediate: nextTurn } = require("node:timers/promises");

const { replayViaRovo, streamViaRovo } = require("./rovo-gateway");
const {
	runPausedRovoToolContinuation,
} = require("../chat/rovo-paused-continuation");
const {
	createRovoStreamToolCallbacks,
} = require("../chat/rovo-stream-tool-callbacks");
const { cancelChat, resumeToolCalls } = require("./rovo-client");

function deferred() {
	return Promise.withResolvers();
}

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const textPart = (content) => sse("part_start", { part: { content, part_kind: "text" } });
const deferredRequest = (toolName = "ask_user_questions") => sse("deferred-request", {
	calls: [{ tool_name: toolName, tool_call_id: "deferred-1", args: "{}" }],
});
const replayBoundary = sse("on_call_tools_start", {
	parts: [{ tool_name: "ask_user_questions", tool_call_id: "paused-1", args: {} }],
});
const toolResult = (id) => sse("tool_result", {
	tool_name: "lookup", tool_call_id: id, content: "done",
});

async function startRovo(t, { body, keepOpen = false, cancelStatus = 200 }) {
	const cancelled = deferred();
	const streamResponse = deferred();
	const requests = [];
	const server = http.createServer((req, res) => {
		req.resume();
		const path = req.url.split("?")[0];
		requests.push(`${req.method} ${path}`);
		if (path === "/v3/stream_chat" || path === "/v3/replay") {
			res.writeHead(200, { "Content-Type": "text/event-stream" });
			streamResponse.resolve(res);
			if (keepOpen) {
				res.write(body);
			} else {
				res.end(body);
			}
			return;
		}
		const status = path === "/v3/cancel" ? cancelStatus : 200;
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok: status === 200 }));
		if (path === "/v3/cancel") cancelled.resolve();
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(async () => {
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	});
	return {
		port: server.address().port,
		cancelled: cancelled.promise,
		requests,
		end: async (body) => { (await streamResponse.promise).end(body); },
	};
}

const modes = ["live", "replay", "paused continuation"];

function startGateway(mode, port, events, options = {}) {
	const handle = {
		resume() {},
		settleLease(disposition) {
			events.push(`lease:${disposition}`);
			return true;
		},
	};
	const common = {
		onTextDelta: (text) => events.push(text),
		...options,
	};
	let task;
	if (mode === "live") {
		task = streamViaRovo({
			message: "hello",
			port,
			portHandle: handle,
			conflictPolicy: "wait-for-turn",
			enableDeferredTools: true,
			onComplete: () => events.push("complete"),
			...common,
		});
	} else if (mode === "replay") {
		task = replayViaRovo({ port, portHandle: handle, ...common });
	} else {
		task = runPausedRovoToolContinuation({
			approvalSubmission: { decision: "approved" },
			buildApprovalResumeDecision: () => null,
			hasPausedApprovalToolCall: true,
			logger: { info() {} },
			pausedToolCallRecord: { port, handle, toolCallId: "paused-1", kind: "approval" },
			replayViaRovo,
			rovoResumeToolCalls: resumeToolCalls,
			rovoCancelChat: cancelChat,
			streamCommonOptions: common,
		});
	}
	return task.then(() => events.push("resolved"));
}

function streamBody(mode, body) {
	return mode === "paused continuation" ? replayBoundary + body : body;
}

function waitForResponseData(t, expected) {
	const received = deferred();
	const originalRequest = http.request;
	t.mock.method(http, "request", (...args) => {
		const request = originalRequest(...args);
		request.on("response", (response) => {
			let body = "";
			response.on("data", (chunk) => {
				body += chunk;
				if (body.includes(expected)) received.resolve();
			});
		});
		return request;
	});
	return received.promise;
}

for (const mode of modes) {
	test(`${mode} waits for the deferred handler before completion at EOF`, { timeout: 5_000 }, async (t) => {
		const gate = deferred();
		const entered = deferred();
		const events = [];
		const rovo = await startRovo(t, { body: streamBody(mode, deferredRequest()) });
		const task = startGateway(mode, rovo.port, events, {
			onDeferredToolRequest: async () => {
				events.push("deferred:start");
				entered.resolve();
				await gate.promise;
				events.push("card");
			},
		});
		try {
			await entered.promise;
			await nextTurn();
			t.diagnostic(`Before the deferred handler settles: ${JSON.stringify(events)}`);
			assert.deepEqual(events, ["deferred:start"]);
		} finally {
			gate.resolve();
			await task;
		}
		assert.equal(events.indexOf("card") < events.indexOf("resolved"), true);
		if (mode === "live") {
			assert.equal(events.indexOf("card") < events.indexOf("complete"), true);
		}
	});

	test(`${mode} holds later network chunks behind a deferred handler`, { timeout: 5_000 }, async (t) => {
		const gate = deferred();
		const entered = deferred();
		const events = [];
		const rovo = await startRovo(t, {
			body: streamBody(mode, deferredRequest()), keepOpen: true,
		});
		const receivedAfter = waitForResponseData(t, '"content":"after"');
		const task = startGateway(mode, rovo.port, events, {
			onDeferredToolRequest: async () => {
				entered.resolve();
				await gate.promise;
				events.push("card");
			},
		});
		try {
			await entered.promise;
			await rovo.end(textPart("after"));
			await receivedAfter;
			assert.deepEqual(events, []);
		} finally {
			gate.resolve();
			await task;
		}
		assert.deepEqual(events.slice(0, 2), ["card", "after"]);
	});

	for (const toolName of ["ask_user_questions", "exit_plan_mode"]) {
		test(`${mode} preserves text, tool and ${toolName} card order across a deferred wait`, { timeout: 5_000 }, async (t) => {
			const gate = deferred();
			const entered = deferred();
			const events = [];
			const rovo = await startRovo(t, {
				body: streamBody(mode,
					textPart("before") + toolResult("before") + deferredRequest(toolName)
					+ textPart("after") + toolResult("after")),
			});
			const { onDeferredToolRequest } = createRovoStreamToolCallbacks({
				isRequestUserInputTool: (name) => name === "ask_user_questions",
				isExitPlanModeTool: (name) => name === "exit_plan_mode",
				registerActiveDeferredToolCall: () => events.push("registered"),
				resolvedRovoPort: rovo.port,
				threadId: "thread-1",
				syncThreadSessionFromCurrentPort: async () => {
					events.push("sync:start");
					entered.resolve();
					await gate.promise;
					events.push("sync:done");
				},
				emitRequestUserInputQuestionCard: () => events.push("question-card"),
				emitExitPlanWidget: () => events.push("plan-widget"),
				onObservedDeferredToolRequest: () => events.push("observed"),
			});
			const task = startGateway(mode, rovo.port, events, {
				onDeferredToolRequest,
				onToolCallResult: ({ toolCallId }) => events.push(`tool:${toolCallId}`),
			});
			try {
				await entered.promise;
				await nextTurn();
				assert.deepEqual(events, ["before", "tool:before", "registered", "sync:start"]);
			} finally {
				gate.resolve();
				await task;
			}
			assert.deepEqual(events.slice(0, 9), [
				"before", "tool:before", "registered", "sync:start", "sync:done",
				toolName === "ask_user_questions" ? "question-card" : "plan-widget",
				"observed", "after", "tool:after",
			]);
		});
	}

	for (const failOnError of mode === "paused continuation" ? [false] : [false, true]) {
		test(`${mode} handles deferred rejection with failOnError=${failOnError}`, { timeout: 5_000 }, async (t) => {
			const gate = deferred();
			const entered = deferred();
			const events = [];
			const failure = new Error("deferred handler failed");
			const rovo = await startRovo(t, {
				body: streamBody(mode, deferredRequest() + textPart("after")),
			});
			const outcome = startGateway(mode, rovo.port, events, {
				failOnError,
				onDeferredToolRequest: async () => {
					entered.resolve();
					await gate.promise;
					throw failure;
				},
			}).then(() => null, (error) => error);
			await entered.promise;
			gate.resolve();
			const error = await outcome;
			if (failOnError) {
				assert.equal(error?.message, "Rovo error: deferred handler failed");
				assert.equal(error.cause, failure);
				assert.equal(events.includes("resolved"), false);
			} else {
				assert.equal(error, null);
				assert.equal(events.includes("\n\n⚠️ Rovo error: deferred handler failed"), true);
				assert.equal(events.at(-1), "resolved");
			}
			assert.equal(events.includes("after"), false);
		});
	}

	for (const [settlement, keepOpen] of [["resolve", true], ["reject", true], ["resolve", false], ["reject", false]]) {
		test(`${mode} aborts pending deferred work with keepOpen=${keepOpen} and handles its late ${settlement}`, { timeout: 5_000 }, async (t) => {
			const gate = deferred();
			const entered = deferred();
			const events = [];
			const controller = new AbortController();
			const rovo = await startRovo(t, {
				body: streamBody(mode, deferredRequest()), keepOpen,
			});
			const task = startGateway(mode, rovo.port, events, {
				signal: controller.signal,
				onDeferredToolRequest: async () => {
					entered.resolve();
					await gate.promise;
				},
			});
			try {
				await entered.promise;
				await nextTurn();
				assert.equal(events.includes("resolved"), false);
				controller.abort();
				await task;
				await rovo.cancelled;
				assert.equal(events.includes("complete"), false);
				assert.equal(events.at(-1), "resolved");
				if (settlement === "reject") {
					gate.reject(new Error("late deferred failure"));
				} else {
					gate.resolve();
				}
				await nextTurn();
				assert.equal(events.filter((event) => event === "resolved").length, 1);
				assert.equal(events.some((event) => event.includes("Rovo error")), false);
				assert.equal(rovo.requests.filter((request) => request === "POST /v3/cancel").length, 1);
			} finally {
				controller.abort();
				gate.resolve();
				await task;
			}
		});
	}

	test(`${mode} preserves cancellation failure handling during a deferred wait`, { timeout: 5_000 }, async (t) => {
		const gate = deferred();
		const entered = deferred();
		const events = [];
		const controller = new AbortController();
		const rovo = await startRovo(t, {
			body: streamBody(mode, deferredRequest()), keepOpen: true, cancelStatus: 500,
		});
		const outcome = startGateway(mode, rovo.port, events, {
			signal: controller.signal,
			onDeferredToolRequest: async () => {
				entered.resolve();
				await gate.promise;
			},
		}).then(() => null, (error) => error);
		try {
			await entered.promise;
			controller.abort();
			const error = await outcome;
			await rovo.cancelled;
			assert.equal(events.includes("complete"), false);
			if (mode === "live") {
				assert.equal(error?.code, "ROVO_ABORT_CANCEL_FAILED");
				assert.deepEqual(events, ["lease:unhealthy"]);
			} else {
				assert.equal(error, null);
				assert.equal(events.at(-1), "resolved");
			}
		} finally {
			controller.abort();
			gate.resolve();
			await outcome;
		}
	});

	test(`${mode} keeps ordinary text and tool callbacks in the same microtask`, { timeout: 5_000 }, async (t) => {
		const events = [];
		const rovo = await startRovo(t, {
			body: streamBody(mode, textPart("before") + toolResult("middle") + textPart("after")),
		});
		await startGateway(mode, rovo.port, events, {
			onTextDelta: (text) => {
				events.push(text);
				if (text === "before") queueMicrotask(() => events.push("microtask"));
			},
			onToolCallResult: () => events.push("tool"),
		});
		assert.deepEqual(events.slice(0, 4), ["before", "tool", "after", "microtask"]);
	});
}
