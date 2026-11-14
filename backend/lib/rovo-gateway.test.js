const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const {
	isGenericIntegrationWrapperToolName,
	resolveToolNameForToolEvent,
	getThinkingActivityFromToolName,
	buildThinkingStatusFromToolEvent,
	isChatInProgressError,
	streamViaRovo,
	replayViaRovo,
	generateTextViaRovo,
	retryChatInProgress,
	shouldCancelConflictingTurn,
	parseToolCallArgsInput,
	resolveToolCallInput,
	initPool,
	WAIT_FOR_TURN_TIMEOUT_MS,
} = require("./rovo-gateway");

function listen(server) {
	return new Promise((resolve, reject) => {
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address !== "object") {
				reject(new Error("Failed to read test server address"));
				return;
			}
			resolve(address.port);
		});
	});
}

function close(server) {
	return new Promise((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
	});
}

test("isGenericIntegrationWrapperToolName detects wrapper tool names", () => {
	assert.equal(isGenericIntegrationWrapperToolName("mcp_invoke_tool"), true);
	assert.equal(
		isGenericIntegrationWrapperToolName("mcp__integrations__invoke_tool"),
		true
	);
	assert.equal(
		isGenericIntegrationWrapperToolName(
			"slack_slack_atlassian_channel_create_message"
		),
		false
	);
});

test("resolveToolNameForToolEvent prefers remembered integration tool over generic wrapper", () => {
	const resolvedToolName = resolveToolNameForToolEvent({
		reportedToolName: "mcp__integrations__invoke_tool",
		rememberedToolName: "slack_slack_atlassian_channel_create_message",
	});

	assert.equal(
		resolvedToolName,
		"slack_slack_atlassian_channel_create_message"
	);
});

test("resolveToolNameForToolEvent keeps non-wrapper reported tool when remembered name is wrapper", () => {
	const resolvedToolName = resolveToolNameForToolEvent({
		reportedToolName: "slack_slack_atlassian_channel_get_message",
		rememberedToolName: "mcp_invoke_tool",
	});

	assert.equal(resolvedToolName, "slack_slack_atlassian_channel_get_message");
});

test("getThinkingActivityFromToolName maps known tool families", () => {
	assert.equal(
		getThinkingActivityFromToolName("mcp__figma__get_screenshot"),
		"image"
	);
	assert.equal(
		getThinkingActivityFromToolName("google_google_calendar_atlassian_calendar_list_events"),
		"data"
	);
	assert.equal(
		getThinkingActivityFromToolName("mcp__audio__generate_sound"),
		"audio"
	);
	assert.equal(
		getThinkingActivityFromToolName("mcp__figma__get_design_context"),
		"ui"
	);
	assert.equal(getThinkingActivityFromToolName("mcp_invoke_tool"), "results");
});

test("buildThinkingStatusFromToolEvent returns user-facing labels and metadata", () => {
	const startStatus = buildThinkingStatusFromToolEvent(
		"mcp__figma__get_screenshot",
		"start"
	);
	assert.equal(startStatus.label, "Generating image");
	assert.equal(startStatus.activity, "image");
	assert.equal(startStatus.source, "backend");

	const resultStatus = buildThinkingStatusFromToolEvent(
		"google_google_calendar_atlassian_calendar_list_events",
		"result"
	);
	assert.equal(resultStatus.label, "Working");
	assert.equal(resultStatus.activity, "data");
	assert.equal(resultStatus.source, "backend");

	const errorStatus = buildThinkingStatusFromToolEvent("mcp_invoke_tool", "error");
	assert.equal(errorStatus.label, "Result generation failed");
	assert.equal(errorStatus.activity, "results");
	assert.equal(errorStatus.source, "backend");
});

test("buildThinkingStatusFromToolEvent marks paused tool approvals distinctly", () => {
	const status = buildThinkingStatusFromToolEvent(
		"open_files",
		"start",
		{ permissionScenario: "prompt" }
	);

	assert.equal(status.label, "Awaiting approval");
	assert.equal(status.content, "Awaiting approval for open_files");
	assert.equal(status.activity, "results");
	assert.equal(status.source, "backend");
});

test("parseToolCallArgsInput returns object only when JSON args are complete", () => {
	assert.deepEqual(
		parseToolCallArgsInput('{"questions":[{"question":"Which space?","options":["Engineering"]}]}'),
		{
			questions: [
				{
					question: "Which space?",
					options: ["Engineering"],
				},
			],
		}
	);

	assert.equal(
		parseToolCallArgsInput('{"questions":[{"question":"Incomplete"}'),
		null
	);
	assert.equal(parseToolCallArgsInput(""), null);
});

test("resolveToolCallInput prefers merged args payload and falls back to start input", () => {
	const merged = resolveToolCallInput({
		initialInput: {
			tool_name: "request_user_input",
		},
		argsBuffer:
			'{"questions":[{"question":"Which page type?","choices":["Status update","Project brief"]}]}',
	});
	assert.deepEqual(merged, {
		tool_name: "request_user_input",
		questions: [
			{
				question: "Which page type?",
				choices: ["Status update", "Project brief"],
			},
		],
	});

	const fallback = resolveToolCallInput({
		initialInput: { questions: [{ question: "Which page type?" }] },
		argsBuffer: "{not-json",
	});
	assert.deepEqual(fallback, {
		questions: [{ question: "Which page type?" }],
	});
});

test("isChatInProgressError detects Rovo 409 conflicts from structured metadata", () => {
	assert.equal(
		isChatInProgressError({
			message: "Stream failed (status 409): {\"error\":\"conflict\"}",
			status: 409,
			endpoint: "/v3/stream_chat",
		}),
		true
	);
});

test("isChatInProgressError does not match unrelated 409 responses", () => {
	assert.equal(
		isChatInProgressError({
			message: "Share summary failed with status 409",
			status: 409,
			endpoint: "/api/plan/runs/abc/share",
		}),
		false
	);
});

test("streamViaRovo propagates warning events without failing the turn", async () => {
	const server = http.createServer((req, res) => {
		if (req.url === "/v3/set_chat_message" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ response: "Chat message set" }));
			return;
		}

		if (req.url === "/v3/stream_chat" && req.method === "GET") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			res.write('event: warning\ndata: {"title":"Using fallback model","message":"Using fallback model - Switching to a backup model."}\n\n');
			res.write('event: part_start\ndata: {"index":0,"part":{"content":"Hello","part_kind":"text"},"event_kind":"part_start"}\n\n');
			res.end();
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ cancelled: true }));
			return;
		}

		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "Not Found" }));
	});

	const port = await listen(server);
	const previousPort = process.env.ROVO_PORT;
	process.env.ROVO_PORT = String(port);

	try {
		const warningEvents = [];
		let collectedText = "";

		await streamViaRovo({
			message: "hello",
			onTextDelta: (delta) => {
				collectedText += delta;
			},
			onWarning: (warningEvent) => {
				warningEvents.push(warningEvent);
			},
		});

		assert.equal(collectedText, "Hello");
		assert.deepEqual(warningEvents, [
			{
				eventName: "warning",
				message: "Using fallback model - Switching to a backup model.",
				rawData: '{"title":"Using fallback model","message":"Using fallback model - Switching to a backup model."}',
				title: "Using fallback model",
				payload: {
					title: "Using fallback model",
					message: "Using fallback model - Switching to a backup model.",
				},
			},
		]);
	} finally {
		if (previousPort === undefined) {
			delete process.env.ROVO_PORT;
		} else {
			process.env.ROVO_PORT = previousPort;
		}
		await close(server);
	}
});

test("streamViaRovo can reuse a reserved port handle for deferred continuations", async () => {
	const requests = [];
	const server = http.createServer((req, res) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => {
			const body = chunks.length > 0 ? Buffer.concat(chunks).toString("utf8") : "";
			requests.push({
				method: req.method,
				url: req.url,
				body,
			});

			if (req.url === "/v3/set_chat_message" && req.method === "POST") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ response: "Chat message set" }));
				return;
			}

			if (req.url === "/v3/stream_chat" && req.method === "GET") {
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});
				res.write('event: part_start\ndata: {"index":0,"part":{"content":"Plan next","part_kind":"text"},"event_kind":"part_start"}\n\n');
				res.end();
				return;
			}

			if (req.url === "/v3/cancel" && req.method === "POST") {
				req.resume();
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ cancelled: true }));
				return;
			}

			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ detail: "Not Found" }));
		});
	});

	const port = await listen(server);
	let releaseCount = 0;

	try {
		await streamViaRovo({
			message: {
				message: {
					tool_call_id: "tool-call-123",
					result: {
						"What should we build?": ["Dashboard"],
					},
				},
			},
			port,
			portHandle: {
				port,
				settleLease: () => {
					releaseCount += 1;
					return true;
				},
			},
			onTextDelta: () => {},
		});

		assert.equal(releaseCount, 1);
		assert.deepEqual(JSON.parse(requests[0].body), {
			message: {
				tool_call_id: "tool-call-123",
				result: {
					"What should we build?": ["Dashboard"],
				},
			},
		});
	} finally {
		await close(server);
	}
});

test("streamViaRovo can continue a deferred turn without queuing another message", async () => {
	const requests = [];
	const server = http.createServer((req, res) => {
		req.resume();
		requests.push({
			method: req.method,
			url: req.url,
		});

		if (req.url === "/v3/stream_chat" && req.method === "GET") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			res.write(
				'event: part_start\ndata: {"index":0,"part":{"content":"Continue with plan","part_kind":"text"},"event_kind":"part_start"}\n\n'
			);
			res.end();
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ cancelled: true }));
			return;
		}

		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "Not Found" }));
	});

	const port = await listen(server);
	let releaseCount = 0;

	try {
		let collectedText = "";
		await streamViaRovo({
			message: null,
			port,
			portHandle: {
				port,
				settleLease: () => {
					releaseCount += 1;
					return true;
				},
			},
			onTextDelta: (delta) => {
				collectedText += delta;
			},
			skipSetChatMessage: true,
		});

		assert.equal(collectedText, "Continue with plan");
		assert.equal(releaseCount, 1);
		assert.deepEqual(requests, [
			{
				method: "GET",
				url: "/v3/stream_chat",
			},
		]);
	} finally {
		await close(server);
	}
});

test("streamViaRovo emits deferred tool requests after streamed text", async () => {
	const requests = [];
	const server = http.createServer((req, res) => {
		req.resume();
		requests.push({
			method: req.method,
			url: req.url,
		});

		if (req.url === "/v3/set_chat_message" && req.method === "POST") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ response: "Chat message set" }));
			return;
		}

		if (req.url === "/v3/stream_chat?enable_deferred_tools=true" && req.method === "GET") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			res.write('event: part_start\ndata: {"index":0,"part":{"content":"I need a few details first.","part_kind":"text"},"event_kind":"part_start"}\n\n');
			res.write(
				`event: deferred-request\ndata: ${JSON.stringify({
					calls: [
						{
							tool_name: "ask_user_questions",
							args: JSON.stringify({
								questions: [
									{
										question: "What kind of app?",
										options: ["Dashboard", "Landing page"],
									},
								],
							}),
							tool_call_id: "call-deferred-1",
						},
					],
				})}\n\n`
			);
			res.end();
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ cancelled: true }));
			return;
		}

		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "Not Found" }));
	});

	const port = await listen(server);
	const previousPort = process.env.ROVO_PORT;
	process.env.ROVO_PORT = String(port);

	try {
		const events = [];
		const toolStarts = [];

		await streamViaRovo({
			message: "hello",
			onTextDelta: (delta) => {
				events.push({ type: "text", delta });
			},
			onToolCallStart: (toolCall) => {
				toolStarts.push(toolCall);
			},
			onDeferredToolRequest: (toolCall) => {
				events.push({ type: "deferred", toolCall });
			},
			enableDeferredTools: true,
		});

		assert.deepEqual(toolStarts, []);
		assert.equal(events.length, 2);
		assert.deepEqual(events[0], {
			type: "text",
			delta: "I need a few details first.",
		});
		assert.deepEqual(events[1], {
			type: "deferred",
			toolCall: {
				toolName: "ask_user_questions",
				toolCallId: "call-deferred-1",
				toolInput: {
					questions: [
						{
							question: "What kind of app?",
							options: ["Dashboard", "Landing page"],
						},
					],
				},
			},
		});
		assert.deepEqual(
			requests.map((request) => `${request.method} ${request.url}`),
			[
				"POST /v3/set_chat_message",
				"GET /v3/stream_chat?enable_deferred_tools=true",
			],
		);
	} finally {
		if (previousPort === undefined) {
			delete process.env.ROVO_PORT;
		} else {
			process.env.ROVO_PORT = previousPort;
		}
		await close(server);
	}
});

test("replayViaRovo skips buffered replay output until the resumed tool call boundary", async () => {
	const requests = [];
	const server = http.createServer((req, res) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => {
			requests.push({
				method: req.method,
				url: req.url,
				body: chunks.length > 0 ? Buffer.concat(chunks).toString("utf8") : "",
			});

			if (req.url === "/v3/replay" && req.method === "POST") {
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});
				res.write(
					'event: part_start\ndata: {"index":0,"part":{"content":"Old clarification text","part_kind":"text"},"event_kind":"part_start"}\n\n'
				);
				res.write(
					'event: on_call_tools_start\ndata: {"parts":[{"tool_name":"ask_user_questions","args":{},"tool_call_id":"tool-call-123"}],"timestamp":"2026-03-23T00:00:00.000Z","part_kind":"on_call_tools_start"}\n\n'
				);
				res.write(
					'event: part_start\ndata: {"index":0,"part":{"content":"Continue with plan","part_kind":"text"},"event_kind":"part_start"}\n\n'
				);
				res.end();
				return;
			}

			if (req.url === "/v3/resume_tool_calls" && req.method === "POST") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ resumed: true }));
				return;
			}

			if (req.url === "/v3/cancel" && req.method === "POST") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ cancelled: true }));
				return;
			}

			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ detail: "Not Found" }));
		});
	});

	const port = await listen(server);

	try {
		let collectedText = "";
		let pausedToolCallCount = 0;
		await replayViaRovo({
			port,
			onTextDelta: (delta) => {
				collectedText += delta;
			},
			onPausedToolCalls: async () => {
				pausedToolCallCount += 1;
				return { disconnect: false };
			},
			skipReplayUntilToolCallId: "tool-call-123",
		});

		assert.equal(collectedText, "Continue with plan");
		assert.equal(pausedToolCallCount, 0);
		assert.equal(
			requests.filter((request) => request.url === "/v3/resume_tool_calls").length,
			0
		);
	} finally {
		await close(server);
	}
});

test("replayViaRovo filters the resumed replay boundary from genuinely new paused tool calls", async () => {
	const server = http.createServer((req, res) => {
		req.resume();

		if (req.url === "/v3/replay" && req.method === "POST") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			res.write(
				`event: on_call_tools_start\ndata: ${JSON.stringify({
					parts: [
						{
							tool_name: "ask_user_questions",
							args: JSON.stringify({
								questions: [
									{
										question: "What should we build?",
										options: ["Dashboard"],
									},
								],
							}),
							tool_call_id: "tool-call-123",
						},
						{
							tool_name: "ask_user_questions",
							args: JSON.stringify({
								questions: [
									{
										question: "Which deployment target?",
										options: ["Micros"],
									},
								],
							}),
							tool_call_id: "tool-call-456",
						},
					],
					timestamp: "2026-03-23T00:00:00.000Z",
					part_kind: "on_call_tools_start",
				})}\n\n`
			);
			res.end();
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ cancelled: true }));
			return;
		}

		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "Not Found" }));
	});

	const port = await listen(server);

	try {
		const pausedEvents = [];

		await replayViaRovo({
			port,
			onTextDelta: () => {},
			onPausedToolCalls: async ({ rawEvent }) => {
				pausedEvents.push(rawEvent);
				return { disconnect: false };
			},
			skipReplayUntilToolCallId: "tool-call-123",
		});

		assert.equal(pausedEvents.length, 1);
		assert.deepEqual(pausedEvents[0].parts, [
			{
				tool_name: "ask_user_questions",
				args: JSON.stringify({
					questions: [
						{
							question: "Which deployment target?",
							options: ["Micros"],
						},
					],
				}),
				tool_call_id: "tool-call-456",
			},
		]);
	} finally {
		await close(server);
	}
});

test("streamViaRovo treats exception events as hard failures", async () => {
	const server = http.createServer((req, res) => {
		if (req.url === "/v3/set_chat_message" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ response: "Chat message set" }));
			return;
		}

		if (req.url === "/v3/stream_chat" && req.method === "GET") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			res.write('event: exception\ndata: {"title":"Server error","message":"Something broke"}\n\n');
			res.end();
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ cancelled: true }));
			return;
		}

		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "Not Found" }));
	});

	const port = await listen(server);
	const previousPort = process.env.ROVO_PORT;
	process.env.ROVO_PORT = String(port);

	try {
		await assert.rejects(
			() =>
				streamViaRovo({
					message: "hello",
					onTextDelta: () => {},
					failOnError: true,
				}),
			/Something broke/
		);
	} finally {
		if (previousPort === undefined) {
			delete process.env.ROVO_PORT;
		} else {
			process.env.ROVO_PORT = previousPort;
		}
		await close(server);
	}
});

test("streamViaRovo releases the port normally after abort when cancel succeeds", async () => {
	let releaseCount = 0;
	let unhealthyReleaseCount = 0;
	let cancelCount = 0;
	let streamStartedResolve;
	const streamStarted = new Promise((resolve) => {
		streamStartedResolve = resolve;
	});

	const server = http.createServer((req, res) => {
		if (req.url === "/v3/set_chat_message" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ response: "Chat message set" }));
			return;
		}

		if (req.url === "/v3/stream_chat" && req.method === "GET") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			req.on("close", () => {
				if (!res.writableEnded) {
					res.end();
				}
			});
			streamStartedResolve();
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			cancelCount += 1;
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ cancelled: true }));
			return;
		}

		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "Not Found" }));
	});

	const port = await listen(server);
	initPool({
		acquire: async () => ({
			port,
			settleLease: (disposition) => {
				if (disposition === "unhealthy") unhealthyReleaseCount += 1;
				else releaseCount += 1;
				return true;
			},
		}),
	});

	try {
		const controller = new AbortController();
		const streamPromise = streamViaRovo({
			message: "hello",
			onTextDelta: () => {},
			signal: controller.signal,
			conflictPolicy: "wait-for-turn",
		});

		await streamStarted;
		controller.abort();
		await streamPromise;

		assert.equal(cancelCount, 1);
		assert.equal(releaseCount, 1);
		assert.equal(unhealthyReleaseCount, 0);
	} finally {
		initPool(null);
		await close(server);
	}
});

test("streamViaRovo quarantines the port after abort when cancel times out", async () => {
	let releaseCount = 0;
	let unhealthyReleaseCount = 0;
	let streamStartedResolve;
	const streamStarted = new Promise((resolve) => {
		streamStartedResolve = resolve;
	});

	const server = http.createServer((req, res) => {
		if (req.url === "/v3/set_chat_message" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ response: "Chat message set" }));
			return;
		}

		if (req.url === "/v3/stream_chat" && req.method === "GET") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			req.on("close", () => {
				if (!res.writableEnded) {
					res.end();
				}
			});
			streamStartedResolve();
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({
				message: "Chat cancellation timed out",
				cancelled: false,
			}));
			return;
		}

		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "Not Found" }));
	});

	const port = await listen(server);
	initPool({
		acquire: async () => ({
			port,
			settleLease: (disposition) => {
				if (disposition === "unhealthy") unhealthyReleaseCount += 1;
				else releaseCount += 1;
				return true;
			},
		}),
	});

	try {
		const controller = new AbortController();
		const streamPromise = streamViaRovo({
			message: "hello",
			onTextDelta: () => {},
			signal: controller.signal,
			conflictPolicy: "wait-for-turn",
		});

		await streamStarted;
		controller.abort();

		await assert.rejects(
			() => streamPromise,
			(error) => {
				assert.equal(error.code, "ROVO_ABORT_CANCEL_FAILED");
				assert.equal(error.port, port);
				return true;
			}
		);

		assert.equal(releaseCount, 0);
		assert.equal(unhealthyReleaseCount, 1);
	} finally {
		initPool(null);
		await close(server);
	}
});

test("generateTextViaRovo quarantines the port after abort when cancel times out", async () => {
	let releaseCount = 0;
	let unhealthyReleaseCount = 0;
	let streamStartedResolve;
	const streamStarted = new Promise((resolve) => {
		streamStartedResolve = resolve;
	});

	const server = http.createServer((req, res) => {
		if (req.url === "/v3/set_chat_message" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ response: "Chat message set" }));
			return;
		}

		if (req.url === "/v3/stream_chat" && req.method === "GET") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			req.on("close", () => {
				if (!res.writableEnded) {
					res.end();
				}
			});
			streamStartedResolve();
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({
				message: "Chat cancellation timed out",
				cancelled: false,
			}));
			return;
		}

		res.writeHead(404, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ detail: "Not Found" }));
	});

	const port = await listen(server);
	initPool({
		acquire: async () => ({
			port,
			settleLease: (disposition) => {
				if (disposition === "unhealthy") unhealthyReleaseCount += 1;
				else releaseCount += 1;
				return true;
			},
		}),
	});

	try {
		const controller = new AbortController();
		const generationPromise = generateTextViaRovo({
			prompt: "hello",
			signal: controller.signal,
			conflictPolicy: "wait-for-turn",
		});

		await streamStarted;
		controller.abort();

		await assert.rejects(
			() => generationPromise,
			(error) => error?.name === "AbortError" || error?.code === "ABORT_ERR"
		);

		assert.equal(releaseCount, 0);
		assert.equal(unhealthyReleaseCount, 1);
	} finally {
		initPool(null);
		await close(server);
	}
});

test("generateTextViaRovo rejects immediately when signal is already aborted", async () => {
	const controller = new AbortController();
	controller.abort();

	await assert.rejects(
		() =>
			generateTextViaRovo({
				prompt: "Hello",
				signal: controller.signal,
			}),
		(error) => error?.name === "AbortError" || error?.code === "ABORT_ERR"
	);
});

test("streamViaRovo uses wait-for-turn timeout while acquiring a non-pinned port", async () => {
	let observedTimeoutMs = null;
	initPool({
		acquire: async ({ timeoutMs }) => {
			observedTimeoutMs = timeoutMs;
			throw new Error("stop after acquire");
		},
	});

	await assert.rejects(
		() =>
			streamViaRovo({
				message: "hello",
				onTextDelta: () => {},
				conflictPolicy: "wait-for-turn",
			}),
		/stop after acquire/,
	);

	assert.equal(observedTimeoutMs, WAIT_FOR_TURN_TIMEOUT_MS);
	initPool(null);
});

test("streamViaRovo forwards preferred and avoided ports to the pool", async () => {
	let observedAcquireOptions = null;
	initPool({
		acquire: async (options) => {
			observedAcquireOptions = options;
			throw new Error("stop after acquire");
		},
	});

	await assert.rejects(
		() =>
			streamViaRovo({
				message: "hello",
				onTextDelta: () => {},
				preferredPort: 8004,
				avoidPorts: [8000, 8001],
			}),
		/stop after acquire/
	);

	assert.equal(observedAcquireOptions.preferredPort, 8004);
	assert.deepEqual(observedAcquireOptions.avoidPorts, [8000, 8001]);
	initPool(null);
});

test("generateTextViaRovo forwards preferred and avoided ports to the pool", async () => {
	let observedAcquireOptions = null;
	initPool({
		acquire: async (options) => {
			observedAcquireOptions = options;
			throw new Error("stop after acquire");
		},
	});

	await assert.rejects(
		() =>
			generateTextViaRovo({
				prompt: "hello",
				preferredPort: 8005,
				avoidPorts: [8002],
			}),
		/stop after acquire/
	);

	assert.equal(observedAcquireOptions.preferredPort, 8005);
	assert.deepEqual(observedAcquireOptions.avoidPorts, [8002]);
	initPool(null);
});

test("shouldCancelConflictingTurn honors cancel grace threshold", () => {
	assert.equal(
		shouldCancelConflictingTurn({
			cancelOnConflict: true,
			cancelAfterMs: 5000,
			elapsedMs: 4999,
		}),
		false
	);
	assert.equal(
		shouldCancelConflictingTurn({
			cancelOnConflict: true,
			cancelAfterMs: 5000,
			elapsedMs: 5000,
		}),
		true
	);
	assert.equal(
		shouldCancelConflictingTurn({
			cancelOnConflict: false,
			cancelAfterMs: 0,
			elapsedMs: 50_000,
		}),
		false
	);
});

test("retryChatInProgress waits before cancellation and then cancels after threshold", async () => {
	let attempts = 0;
	let cancelCalls = 0;
	const retryProgress = [];

	const { value, aborted } = await retryChatInProgress(
		async () => {
			attempts += 1;
			if (attempts <= 4) {
				const conflictError = new Error("chat already in progress");
				conflictError.status = 409;
				conflictError.endpoint = "/v3/stream_chat";
				throw conflictError;
			}
			return "ok";
		},
		{
			logPrefix: "retryChatInProgress.test",
			timeoutMs: 4000,
			cancelOnConflict: true,
			cancelAfterMs: 700,
			cancelConflictTurn: async () => {
				cancelCalls += 1;
			},
			onRetryProgress: (status) => {
				retryProgress.push(status);
			},
		}
	);

	assert.equal(aborted, false);
	assert.equal(value, "ok");
	assert.ok(retryProgress.some((status) => status?.willCancel === false));
	assert.ok(retryProgress.some((status) => status?.willCancel === true));
	assert.ok(cancelCalls >= 1);
});

test("retryChatInProgress does not cancel when cancelOnConflict is disabled", async () => {
	let attempts = 0;
	let cancelCalls = 0;
	const retryProgress = [];

	const { value, aborted } = await retryChatInProgress(
		async () => {
			attempts += 1;
			if (attempts <= 2) {
				const conflictError = new Error("chat already in progress");
				conflictError.status = 409;
				conflictError.endpoint = "/v3/stream_chat";
				throw conflictError;
			}
			return "ok";
		},
		{
			logPrefix: "retryChatInProgress.test.no-cancel",
			timeoutMs: 2000,
			cancelOnConflict: false,
			cancelAfterMs: 0,
			cancelConflictTurn: async () => {
				cancelCalls += 1;
			},
			onRetryProgress: (status) => {
				retryProgress.push(status);
			},
		}
	);

	assert.equal(aborted, false);
	assert.equal(value, "ok");
	assert.equal(cancelCalls, 0);
	assert.ok(retryProgress.every((status) => status?.willCancel === false));
});

test("retryChatInProgress throttles consecutive cancel calls by cancelMinIntervalMs", async () => {
	let attempts = 0;
	const cancelTimestamps = [];

	await retryChatInProgress(
		async () => {
			attempts += 1;
			if (attempts <= 6) {
				const conflictError = new Error("chat already in progress");
				conflictError.status = 409;
				conflictError.endpoint = "/v3/stream_chat";
				throw conflictError;
			}
			return "ok";
		},
		{
			logPrefix: "retryChatInProgress.test.throttle",
			timeoutMs: 8000,
			cancelOnConflict: true,
			cancelAfterMs: 0,
			cancelMinIntervalMs: 500,
			cancelConflictTurn: async () => {
				cancelTimestamps.push(Date.now());
			},
		}
	);

	assert.ok(cancelTimestamps.length >= 2, "expected at least 2 cancel calls");
	for (let i = 1; i < cancelTimestamps.length; i++) {
		const gap = cancelTimestamps[i] - cancelTimestamps[i - 1];
		assert.ok(gap >= 400, `cancel gap ${gap}ms was shorter than throttle interval`);
	}
});
