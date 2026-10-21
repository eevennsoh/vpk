const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const {
	extractChunkFromEvent,
	createSession,
	getCurrentSession,
	getSession,
	listSessions,
	restoreSession,
	resumeToolCalls,
	sendMessageStreaming,
	cancelChat,
} = require("./rovo-client");

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

test("extractChunkFromEvent bounds large retry-prompt payloads", () => {
	const largePayload = {
		calendarId: "esoh@atlassian.com",
		timeZone: "Australia/Sydney",
		events: Array.from({ length: 140 }, (_, index) => ({
			id: `ev-${index}`,
			status: "confirmed",
			summary: `Deep work ${index}`,
			htmlLink: `https://www.google.com/calendar/event?eid=${index}`,
		})),
	};

	const chunk = extractChunkFromEvent("retry-prompt", {
		content: largePayload,
		tool_name: "google_calendar",
		tool_call_id: "call-1",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "tool_result");
	assert.equal(chunk.toolName, "google_calendar");
	assert.equal(chunk.toolCallId, "call-1");
	assert.equal(typeof chunk.outputPreview, "string");
	assert.equal(chunk.text, chunk.outputPreview);
	assert.equal(chunk.outputTruncated, true);
	assert.ok(chunk.outputPreview.length <= 1200);
	assert.ok(chunk.outputBytes > chunk.outputPreview.length);
	assert.equal(typeof chunk.rawOutput, "object");
	assert.equal(Array.isArray(chunk.rawOutput.events), true);
	assert.equal(chunk.rawOutput.events.length, 140);
});

test("extractChunkFromEvent parses documented non-streaming text events", () => {
	const chunk = extractChunkFromEvent("text", {
		content: "Hello from Serve",
		part_kind: "text",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "text");
	assert.equal(chunk.text, "Hello from Serve");
});

test("extractChunkFromEvent parses documented non-streaming tool-call events", () => {
	const chunk = extractChunkFromEvent("tool-call", {
		tool_name: "open_files",
		args: { file_paths: ["README.md"] },
		tool_call_id: "call-0",
		part_kind: "tool-call",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "tool_call_start");
	assert.equal(chunk.toolName, "open_files");
	assert.equal(chunk.toolCallId, "call-0");
	assert.deepEqual(chunk.toolInput, {
		file_paths: ["README.md"],
	});
});

test("extractChunkFromEvent parses deferred tool requests", () => {
	const chunk = extractChunkFromEvent("deferred-request", {
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
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "deferred-tool-request");
	assert.equal(chunk.toolName, "ask_user_questions");
	assert.equal(chunk.toolCallId, "call-deferred-1");
	assert.deepEqual(chunk.toolInput, {
		questions: [
			{
				question: "What kind of app?",
				options: ["Dashboard", "Landing page"],
			},
		],
	});
});

test("extractChunkFromEvent marks error payloads as tool_error", () => {
	const chunk = extractChunkFromEvent("tool-return", {
		content: "Error: Google Calendar API quota exceeded",
		tool_name: "google_calendar",
		tool_call_id: "call-2",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "tool_error");
	assert.equal(chunk.toolName, "google_calendar");
	assert.equal(chunk.toolCallId, "call-2");
	assert.equal(chunk.outputPreview, "Error: Google Calendar API quota exceeded");
	assert.equal(chunk.outputTruncated, false);
	assert.equal(chunk.rawOutput, "Error: Google Calendar API quota exceeded");
});

test("extractChunkFromEvent parses tool_result success payload variants", () => {
	const chunk = extractChunkFromEvent("tool_result", {
		status: "success",
		output: {
			events: [
				{ id: "event-1", summary: "Standup" },
			],
		},
		toolName: "google_calendar",
		callId: "call-3",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "tool_result");
	assert.equal(chunk.toolName, "google_calendar");
	assert.equal(chunk.toolCallId, "call-3");
	assert.equal(typeof chunk.outputPreview, "string");
	assert.equal(typeof chunk.rawOutput, "object");
	assert.equal(Array.isArray(chunk.rawOutput.events), true);
});

test("extractChunkFromEvent preserves multi-field tool_result payloads without flattening", () => {
	const chunk = extractChunkFromEvent("tool_result", {
		status: "success",
		content: "Success",
		data: {
			manager: {
				name: "David Hoang",
			},
		},
		tool_name: "get_user_manager_v2",
		tool_call_id: "call-3b",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "tool_result");
	assert.equal(chunk.toolName, "get_user_manager_v2");
	assert.equal(chunk.toolCallId, "call-3b");
	assert.deepEqual(chunk.rawOutput, {
		content: "Success",
		data: {
			manager: {
				name: "David Hoang",
			},
		},
	});
	assert.match(chunk.outputPreview, /David Hoang/);
});

test("extractChunkFromEvent preserves non-metadata tool result fields beyond the legacy whitelist", () => {
	const chunk = extractChunkFromEvent("tool_result", {
		status: "success",
		content: "Success",
		key: "userManager",
		value: {
			data: {
				name: "David Hoang",
			},
		},
		tool_name: "get_user_manager_v2",
		tool_call_id: "call-3c",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "tool_result");
	assert.equal(chunk.toolName, "get_user_manager_v2");
	assert.equal(chunk.toolCallId, "call-3c");
	assert.deepEqual(chunk.rawOutput, {
		content: "Success",
		key: "userManager",
		value: {
			data: {
				name: "David Hoang",
			},
		},
	});
	assert.match(chunk.outputPreview, /userManager/);
	assert.match(chunk.outputPreview, /David Hoang/);
});

test("extractChunkFromEvent parses tool_result error payload variants", () => {
	const chunk = extractChunkFromEvent("tool_result", {
		status: "failed",
		error: "Permission denied for calendar",
		tool_name: "google_calendar",
		call_id: "call-4",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "tool_error");
	assert.equal(chunk.toolName, "google_calendar");
	assert.equal(chunk.toolCallId, "call-4");
	assert.match(chunk.outputPreview, /Permission denied/i);
});

test("extractChunkFromEvent treats structured error JSON output as tool_error", () => {
	const chunk = extractChunkFromEvent("tool_result", {
		output: JSON.stringify({
			httpStatus: 400,
			errors: [
				{
					type: "MCP_TOOL_CONFIGURATION_INVALID_INPUT",
					message: "restricted_action",
				},
			],
		}),
		tool_name: "mcp__integrations__invoke_tool",
		tool_call_id: "call-5",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "tool_error");
	assert.equal(chunk.toolName, "mcp__integrations__invoke_tool");
	assert.equal(chunk.toolCallId, "call-5");
	assert.match(chunk.outputPreview, /restricted_action/i);
});

test("extractChunkFromEvent parses warning events distinctly", () => {
	const chunk = extractChunkFromEvent("warning", {
		title: "Using fallback model",
		message: "Using fallback model - trying the backup provider.",
	});

	assert.ok(chunk);
	assert.equal(chunk.type, "warning");
	assert.equal(chunk.text, "Using fallback model - trying the backup provider.");
	assert.equal(chunk.warningTitle, "Using fallback model");
	assert.equal(chunk.outputTruncated, false);
	assert.equal(chunk.rawOutput.title, "Using fallback model");
});

test("sendMessageStreaming aborts silent SSE streams and cancels the server turn", async () => {
	let cancelSeenResolve;
	const cancelSeen = new Promise((resolve) => {
		cancelSeenResolve = resolve;
	});

	const server = http.createServer((req, res) => {
		if (req.url === "/v3/set_chat_message" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true }));
			return;
		}

		if (req.url?.startsWith("/v3/stream_chat") && req.method === "GET") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ cancelled: true }));
			cancelSeenResolve();
			return;
		}

		res.writeHead(404);
		res.end();
	});

	const port = await listen(server);

	try {
		const error = await new Promise((resolve, reject) => {
			const fallbackTimer = setTimeout(() => {
				reject(new Error("Timed out waiting for silent stream failure"));
			}, 1_000);

			sendMessageStreaming(
				"navigate to theverge.com",
				{
					onChunk: () => {},
					onDone: () => {
						clearTimeout(fallbackTimer);
						reject(new Error("Expected silent stream to fail"));
					},
					onError: (streamError) => {
						clearTimeout(fallbackTimer);
						resolve(streamError);
					},
				},
				port,
				{
					firstEventTimeoutMs: 25,
					idleTimeoutMs: 25,
				}
			);
		});

		await cancelSeen;

		assert.equal(error.code, "ROVO_STREAM_IDLE_TIMEOUT");
		assert.match(error.message, /never produced any sse activity/i);
		assert.equal(error.hadActivity, false);
	} finally {
		await close(server);
	}
});

test("cancelChat rejects when Rovo reports a timed out cancellation", async () => {
	const server = http.createServer((req, res) => {
		if (req.url === "/v3/cancel" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({
				message: "Chat cancellation timed out",
				cancelled: false,
			}));
			return;
		}

		res.writeHead(404);
		res.end();
	});

	const port = await listen(server);

	try {
		await assert.rejects(
			() => cancelChat(port, { timeoutMs: 100 }),
			(error) => {
				assert.equal(error.code, "ROVO_CANCEL_TIMEOUT");
				assert.equal(error.port, port);
				assert.match(error.message, /timed out/i);
				return true;
			}
		);
	} finally {
		await close(server);
	}
});

test("sendMessageStreaming reports timing milestones for queued and streamed turns", async () => {
	const timingStages = [];

	const server = http.createServer((req, res) => {
		if (req.url === "/v3/set_chat_message" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true }));
			return;
		}

		if (req.url?.startsWith("/v3/stream_chat") && req.method === "GET") {
			res.writeHead(200, {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
			});
			res.write("event: content_block_delta\n");
			res.write("data: Hello\n\n");
			res.end();
			return;
		}

		if (req.url === "/v3/cancel" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ cancelled: true }));
			return;
		}

		res.writeHead(404);
		res.end();
	});

	const port = await listen(server);

	try {
		await new Promise((resolve, reject) => {
			sendMessageStreaming(
				"hello",
				{
					onChunk: () => {},
					onDone: resolve,
					onError: reject,
				},
				port,
				{
					onTimingStage: (stage, details) => {
						timingStages.push({ stage, details });
					},
				}
			);
		});

		assert.deepEqual(
			timingStages.map((entry) => entry.stage),
			[
				"rovo_set_chat_message_complete",
				"rovo_stream_connected",
				"rovo_first_sse_event",
				"rovo_first_text_delta",
				"rovo_stream_complete",
			]
		);
		for (const entry of timingStages) {
			assert.equal(typeof entry.details?.stageMs, "number");
			assert.ok(entry.details.stageMs >= 0);
		}
	} finally {
		await close(server);
	}
});

test("session helpers and resume_tool_calls use documented V3 endpoints", async () => {
	const requests = [];

	const server = http.createServer((req, res) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => {
			const body = chunks.length > 0 ? Buffer.concat(chunks).toString("utf8") : "";
			const parsedUrl = new URL(req.url, "http://127.0.0.1");
			requests.push({
				method: req.method,
				url: req.url,
				body,
			});

			if (
				req.method === "GET" &&
				parsedUrl.pathname === "/v3/sessions/list" &&
				parsedUrl.searchParams.get("page") === "2" &&
				parsedUrl.searchParams.get("page_size") === "5"
			) {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({
					sessions: [
						{
							id: "session-1",
							title: "One",
							created: "2025-03-20T00:00:00.000Z",
							context_limit: 200000,
						},
					],
				}));
				return;
			}

			if (req.method === "GET" && req.url === "/v3/sessions/current_session") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({
					id: "session-current",
					title: "Current",
					created: "2025-03-20T00:00:00.000Z",
					context_limit: 200000,
				}));
				return;
			}

			if (req.method === "GET" && req.url === "/v3/sessions/session-2") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({
					id: "session-2",
					title: "Session 2",
					created: "2025-03-20T00:00:00.000Z",
					context_limit: 200000,
				}));
				return;
			}

			if (req.method === "POST" && req.url === "/v3/sessions/create") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({
					session_id: "session-created",
					title: "Custom title",
					message: "Session created successfully",
				}));
				return;
			}

			if (req.method === "POST" && req.url === "/v3/sessions/session-2/restore") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({
					session_id: "session-2",
					message: "Session restored successfully",
				}));
				return;
			}

			if (req.method === "POST" && req.url === "/v3/resume_tool_calls") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ message: "resume_tool_calls done" }));
				return;
			}

			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "unexpected route" }));
		});
	});

	const port = await listen(server);

	try {
		const sessions = await listSessions(port, { page: 2, pageSize: 5 });
		const currentSession = await getCurrentSession(port);
		const session = await getSession(port, "session-2");
		const createdSession = await createSession(port, { customTitle: "Custom title" });
		const restoredSession = await restoreSession(port, "session-2");
		const resumeResult = await resumeToolCalls(port, [
			{ tool_call_id: "tool-1", deny_message: null },
		]);

		assert.equal(sessions.sessions.length, 1);
		assert.equal(currentSession.id, "session-current");
		assert.equal(session.id, "session-2");
		assert.equal(createdSession.session_id, "session-created");
		assert.equal(restoredSession.session_id, "session-2");
		assert.equal(resumeResult.message, "resume_tool_calls done");

		assert.deepEqual(
			requests.map((entry) => `${entry.method} ${entry.url}`),
			[
				"GET /v3/sessions/list?page=2&page_size=5",
				"GET /v3/sessions/current_session",
				"GET /v3/sessions/session-2",
				"POST /v3/sessions/create",
				"POST /v3/sessions/session-2/restore",
				"POST /v3/resume_tool_calls",
			]
		);
		assert.deepEqual(JSON.parse(requests[3].body), { custom_title: "Custom title" });
		assert.deepEqual(JSON.parse(requests[5].body), {
			decisions: [{ tool_call_id: "tool-1", deny_message: null }],
		});
	} finally {
		await close(server);
	}
});

test("sendMessageStreaming restores the requested session, honors pause_on_call_tools_start, and surfaces warnings", async () => {
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

			if (req.method === "POST" && req.url === "/v3/sessions/thread-1/restore") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({
					session_id: "thread-1",
					message: "Session restored successfully",
				}));
				return;
			}

			if (req.method === "POST" && req.url === "/v3/set_chat_message") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ response: "Chat message set" }));
				return;
			}

			if (req.method === "GET" && req.url === "/v3/stream_chat?pause_on_call_tools_start=true") {
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});
				res.write('event: warning\ndata: {"title":"Using fallback model","message":"Using fallback model - switching providers"}\n\n');
				res.write('event: part_start\ndata: {"index":0,"part":{"content":"Hello","part_kind":"text"},"event_kind":"part_start"}\n\n');
				res.end();
				return;
			}

			if (req.method === "POST" && req.url === "/v3/cancel") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ cancelled: true }));
				return;
			}

			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "unexpected route" }));
		});
	});

	const port = await listen(server);

	try {
		const chunks = [];
		const warnings = [];

		await new Promise((resolve, reject) => {
			sendMessageStreaming(
				{
					message: "hello",
					context: [{ type: "note", content: "remember the session" }],
					enableDeepPlan: true,
				},
				{
					onChunk: (chunk) => {
						chunks.push(chunk);
						if (chunk.type === "warning") {
							warnings.push(chunk);
						}
					},
					onDone: resolve,
					onError: reject,
				},
				port,
				{
					sessionId: "thread-1",
					pauseOnCallToolsStart: true,
				}
			);
		});

		assert.equal(chunks[0].type, "warning");
		assert.equal(chunks[0].warningTitle, "Using fallback model");
		assert.equal(chunks[1].type, "text");
		assert.equal(warnings.length, 1);
		assert.equal(
			chunks
				.filter((chunk) => chunk.type === "text")
				.map((chunk) => chunk.text)
				.join(""),
			"Hello"
		);
		assert.deepEqual(
			requests.map((entry) => `${entry.method} ${entry.url}`),
			[
				"POST /v3/sessions/thread-1/restore",
				"POST /v3/set_chat_message",
				"GET /v3/stream_chat?pause_on_call_tools_start=true",
			]
		);
		assert.deepEqual(JSON.parse(requests[1].body), {
			message: "hello",
			context: [{ type: "note", content: "remember the session" }],
			enable_deep_plan: true,
		});
	} finally {
		await close(server);
	}
});

test("sendMessageStreaming resolves when pause_on_call_tools_start disconnects the stream intentionally", async () => {
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

			if (req.method === "POST" && req.url === "/v3/set_chat_message") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ response: "Chat message set" }));
				return;
			}

			if (req.method === "GET" && req.url === "/v3/stream_chat?pause_on_call_tools_start=true") {
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});
				res.write('event: part_start\ndata: {"index":0,"part":{"content":"Need a bit more detail.","part_kind":"text"},"event_kind":"part_start"}\n\n');
				res.write('event: on_call_tools_start\ndata: {"parts":[{"tool_name":"ask_user_questions","args":"{\\"questions\\":[{\\"question\\":\\"What feature?\\",\\"options\\":[\\"Page\\",\\"API\\"]}]}","tool_call_id":"tool-call-1"}],"part_kind":"on_call_tools_start"}\n\n');
				// Keep the connection open; the client-side manual disconnect should resolve the turn.
				return;
			}

			if (req.method === "POST" && req.url === "/v3/cancel") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ cancelled: true }));
				return;
			}

			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "unexpected route" }));
		});
	});

	const port = await listen(server);

	try {
		const chunks = [];
		let completionText = null;

		await new Promise((resolve, reject) => {
			sendMessageStreaming(
				"help me plan a feature",
				{
					onChunk: (chunk) => {
						chunks.push(chunk);
					},
					onPauseToolCalls: async () => ({ disconnect: true }),
					onDone: (fullText) => {
						completionText = fullText;
						resolve();
					},
					onError: reject,
				},
				port,
				{
					pauseOnCallToolsStart: true,
				}
			);
		});

		assert.equal(completionText, "Need a bit more detail.");
		assert.deepEqual(
			chunks.map((chunk) => chunk.type),
			["text", "tool_call_start"],
		);
		assert.deepEqual(
			requests.map((entry) => `${entry.method} ${entry.url}`),
			[
				"POST /v3/set_chat_message",
				"GET /v3/stream_chat?pause_on_call_tools_start=true",
			]
		);
	} finally {
		await close(server);
	}
});

test("sendMessageStreaming accepts DeferredToolResponse messages", async () => {
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

			if (req.method === "POST" && req.url === "/v3/set_chat_message") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ response: "Chat message set" }));
				return;
			}

			if (req.method === "GET" && req.url === "/v3/stream_chat") {
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});
				res.write('event: part_start\ndata: {"index":0,"part":{"content":"Thanks","part_kind":"text"},"event_kind":"part_start"}\n\n');
				res.end();
				return;
			}

			if (req.method === "POST" && req.url === "/v3/cancel") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ cancelled: true }));
				return;
			}

			res.writeHead(404);
			res.end();
		});
	});

	const port = await listen(server);

	try {
		await new Promise((resolve, reject) => {
			sendMessageStreaming(
				{
					message: {
						tool_call_id: "tool-call-123",
						result: {
							"What should we build?": ["Dashboard"],
						},
					},
				},
				{
					onChunk: () => {},
					onDone: resolve,
					onError: reject,
				},
				port
			);
		});

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

test("sendMessageStreaming treats exception events as fatal", async () => {
	const server = http.createServer((req, res) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => {
			if (req.method === "POST" && req.url === "/v3/set_chat_message") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ response: "Chat message set" }));
				return;
			}

			if (req.method === "GET" && req.url === "/v3/stream_chat") {
				res.writeHead(200, {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache",
					Connection: "keep-alive",
				});
				res.write('event: exception\ndata: {"title":"Server error","message":"Model crashed"}\n\n');
				res.end();
				return;
			}

			if (req.method === "POST" && req.url === "/v3/cancel") {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ cancelled: true }));
				return;
			}

			res.writeHead(404);
			res.end();
		});
	});

	const port = await listen(server);

	try {
		const error = await new Promise((resolve, reject) => {
			sendMessageStreaming(
				"hello",
				{
					onChunk: () => {},
					onDone: () => reject(new Error("Expected exception stream to fail")),
					onError: resolve,
				},
				port
			);
		});

		assert.match(error.message, /Model crashed/i);
	} finally {
		await close(server);
	}
});

test("sendMessageStreaming keeps the SSE event name when data arrives in a later chunk", async () => {
	const chunks = [];

	const server = http.createServer((req, res) => {
		if (req.url === "/v3/set_chat_message" && req.method === "POST") {
			req.resume();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true }));
			return;
		}

		if (req.url?.startsWith("/v3/stream_chat") && req.method === "GET") {
			res.writeHead(200, { "Content-Type": "text/event-stream" });
			res.flushHeaders();
			// Delay the data line so it reaches the client as a separate network chunk.
			res.write("event: content_block_delta\n");
			setTimeout(() => {
				res.write("data: Hello\n\n");
				res.end();
			}, 50);
			return;
		}

		req.resume();
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok: true }));
	});

	const port = await listen(server);

	try {
		const text = await new Promise((resolve, reject) => {
			sendMessageStreaming(
				"hello",
				{
					onChunk: (chunk) => chunks.push(chunk),
					onDone: resolve,
					onError: reject,
				},
				port,
			);
		});

		assert.equal(text, "Hello");
		assert.deepEqual(chunks, [{ type: "text", text: "Hello" }]);
	} finally {
		await close(server);
	}
});
