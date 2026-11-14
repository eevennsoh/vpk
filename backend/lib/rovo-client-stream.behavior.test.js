"use strict";

// How a Rovo chat stream ends (SM-BT-10): done, paused at a tool boundary, aborted, timed out
// before the first event or after activity, or failed. Each test drives sendMessageStreaming
// against a local Rovo stand-in. Stream timeouts use mocked setTimeout, ticked once the test
// has seen the stream reach the state it means to time out.

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const { sendMessageStreaming } = require("./rovo-client");

function listen(server) {
	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => resolve(server.address().port));
	});
}

/**
 * A Rovo stand-in: set_chat_message answers 200 (or `setChatStatus`), cancel answers 200,
 * and stream_chat is handed to `onStream(res)` after its SSE headers (or `streamStatus`).
 */
async function startRovo(t, { onStream = () => {}, setChatStatus = 200, streamStatus = 200 } = {}) {
	const requests = [];
	const waiters = [];
	const notify = () => {
		for (const waiter of [...waiters]) {
			if (waiter.match(requests)) {
				waiters.splice(waiters.indexOf(waiter), 1);
				waiter.resolve();
			}
		}
	};
	const server = http.createServer((req, res) => {
		requests.push(`${req.method} ${req.url.split("?")[0]}`);
		notify();
		req.resume();
		if (req.url === "/v3/set_chat_message") {
			res.writeHead(setChatStatus, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: setChatStatus === 200 }));
			return;
		}
		if (req.url === "/v3/cancel") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ cancelled: true }));
			return;
		}
		if (req.url.startsWith("/v3/stream_chat")) {
			if (streamStatus !== 200) {
				res.writeHead(streamStatus, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ detail: "stream refused" }));
				return;
			}
			res.writeHead(200, { "Content-Type": "text/event-stream" });
			// Sent now, so the client sees the stream open before any event.
			res.flushHeaders();
			onStream(res);
			return;
		}
		res.writeHead(404);
		res.end();
	});
	const port = await listen(server);
	t.after(async () => {
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	});
	return {
		port,
		requests,
		/** Resolves once `count` requests matching `line` were seen. */
		waitFor: (line, count = 1) =>
			new Promise((resolve) => {
				const waiter = { match: (seen) => seen.filter((each) => each === line).length >= count, resolve };
				waiters.push(waiter);
				notify();
			}),
	};
}

const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const textPart = (content) => sse("part_start", { index: 0, part: { content, part_kind: "text" }, event_kind: "part_start" });

/** Starts a stream and collects what reaches the callbacks. */
function stream(port, { callbacks = {}, options = {} } = {}) {
	const seen = { chunks: [], done: [], errors: [], stages: [] };
	let settle;
	const ended = new Promise((resolve) => {
		settle = resolve;
	});
	const handle = sendMessageStreaming(
		"hello",
		{
			onChunk: (chunk) => seen.chunks.push(chunk),
			onDone: (text) => {
				seen.done.push(text);
				settle("done");
			},
			onError: (error) => {
				seen.errors.push(error);
				settle("error");
			},
			...callbacks,
		},
		port,
		{
			onTimingStage: (stage) => seen.stages.push(stage),
			...options,
		},
	);
	return { ended, handle, seen };
}

function nextStage(seen, stage) {
	return new Promise((resolve) => {
		const check = () => (seen.stages.includes(stage) ? resolve() : setImmediate(check));
		check();
	});
}

test("a stream that ends normally is done with its full text", async (t) => {
	const rovo = await startRovo(t, {
		onStream: (res) => {
			res.write(textPart("Hello "));
			res.end(textPart("world"));
		},
	});
	const { ended, seen } = stream(rovo.port);

	assert.equal(await ended, "done");
	assert.deepEqual(seen.done, ["Hello world"]);
	assert.deepEqual(seen.errors, []);
	assert.deepEqual(rovo.requests, ["POST /v3/set_chat_message", "GET /v3/stream_chat"]);
});

test("a stream that ends with no events is done with no text, not timed out", async (t) => {
	const rovo = await startRovo(t, { onStream: (res) => res.end() });
	const { ended, seen } = stream(rovo.port);

	assert.equal(await ended, "done");
	assert.deepEqual(seen.done, [""]);
});

test("a stream silent before its first event times out without activity and cancels the turn", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const rovo = await startRovo(t);
	const { ended, seen } = stream(rovo.port, { options: { firstEventTimeoutMs: 5_000, idleTimeoutMs: 9_000 } });
	await nextStage(seen, "rovo_stream_connected");

	t.mock.timers.tick(5_000);

	assert.equal(await ended, "error");
	assert.equal(seen.errors[0].code, "ROVO_STREAM_IDLE_TIMEOUT");
	assert.equal(seen.errors[0].hadActivity, false);
	assert.equal(seen.errors[0].timeoutMs, 5_000);
	assert.match(seen.errors[0].message, /never produced any SSE activity after 5s/u);
	assert.deepEqual(seen.done, []);
	await rovo.waitFor("POST /v3/cancel");
});

test("a stream that goes silent after activity times out with activity and cancels the turn", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const rovo = await startRovo(t, { onStream: (res) => res.write(textPart("partial")) });
	const { ended, seen } = stream(rovo.port, { options: { firstEventTimeoutMs: 5_000, idleTimeoutMs: 9_000 } });
	await nextStage(seen, "rovo_first_text_delta");

	t.mock.timers.tick(5_000);
	assert.deepEqual(seen.errors, []);
	t.mock.timers.tick(4_000);

	assert.equal(await ended, "error");
	assert.equal(seen.errors[0].code, "ROVO_STREAM_IDLE_TIMEOUT");
	assert.equal(seen.errors[0].hadActivity, true);
	assert.equal(seen.errors[0].timeoutMs, 9_000);
	assert.match(seen.errors[0].message, /stalled after 9s/u);
	assert.deepEqual(seen.done, []);
	await rovo.waitFor("POST /v3/cancel");
});

const pauseEvent = sse("on_call_tools_start", {
	parts: [{ tool_name: "ask_user_questions", tool_call_id: "tool-1", args: {} }],
	part_kind: "on_call_tools_start",
});

test("a stream paused at a tool boundary is done with its partial text", async (t) => {
	const rovo = await startRovo(t, {
		onStream: (res) => {
			res.write(textPart("Before the tool. "));
			res.write(pauseEvent);
		},
	});
	const pauses = [];
	const { ended, seen } = stream(rovo.port, {
		callbacks: {
			onPauseToolCalls: async (event) => {
				pauses.push(event.parts[0].tool_call_id);
				return { disconnect: true };
			},
		},
	});

	assert.equal(await ended, "done");
	assert.deepEqual(seen.done, ["Before the tool. "]);
	assert.deepEqual(pauses, ["tool-1"]);
	assert.deepEqual(seen.errors, []);
});

test("a pause that does not disconnect lets the stream continue to its end", async (t) => {
	const rovo = await startRovo(t, {
		onStream: (res) => {
			res.write(textPart("Before. "));
			res.write(pauseEvent);
			res.end(textPart("after."));
		},
	});
	const { ended, seen } = stream(rovo.port, {
		callbacks: { onPauseToolCalls: async () => ({ disconnect: false }) },
	});

	assert.equal(await ended, "done");
	assert.deepEqual(seen.done, ["Before. after."]);
});

test("a stream disconnected by its caller is done with its partial text", async (t) => {
	const rovo = await startRovo(t, { onStream: (res) => res.write(textPart("so far")) });
	const { ended, handle, seen } = stream(rovo.port);
	await nextStage(seen, "rovo_first_text_delta");

	handle.disconnect();

	assert.equal(await ended, "done");
	assert.deepEqual(seen.done, ["so far"]);
});

test("an aborted stream reports neither done nor error and cancels the queued turn once", async (t) => {
	const rovo = await startRovo(t, { onStream: (res) => res.write(textPart("so far")) });
	const { handle, seen } = stream(rovo.port);
	await nextStage(seen, "rovo_first_text_delta");

	const first = handle.abort();
	const second = handle.abort();
	await Promise.all([first, second]);
	await rovo.waitFor("POST /v3/cancel");
	await new Promise((resolve) => setImmediate(resolve));

	assert.deepEqual(seen.done, []);
	assert.deepEqual(seen.errors, []);
	assert.equal(rovo.requests.filter((line) => line === "POST /v3/cancel").length, 1);
});

test("a stream aborted before its message was queued sends no cancel", async (t) => {
	const rovo = await startRovo(t);
	const { handle, seen } = stream(rovo.port);

	assert.equal(await handle.abort(), null);
	await new Promise((resolve) => setImmediate(resolve));

	assert.deepEqual(seen.done, []);
	assert.deepEqual(seen.errors, []);
	assert.equal(rovo.requests.includes("POST /v3/cancel"), false);
});

test("a continuation that reuses the queued turn skips set_chat_message and cancels on abort", async (t) => {
	const rovo = await startRovo(t, { onStream: (res) => res.write(textPart("resumed")) });
	const { handle, seen } = stream(rovo.port, { options: { skipSetChatMessage: true } });
	await nextStage(seen, "rovo_first_text_delta");

	await handle.abort();
	await rovo.waitFor("POST /v3/cancel");

	assert.deepEqual(rovo.requests, ["GET /v3/stream_chat", "POST /v3/cancel"]);
});

test("a refused stream fails with its HTTP status", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const rovo = await startRovo(t, { streamStatus: 503 });
	const { ended, seen } = stream(rovo.port, { options: { firstEventTimeoutMs: 5_000 } });

	assert.equal(await ended, "error");
	assert.equal(seen.errors[0].statusCode, 503);
	assert.match(seen.errors[0].message, /status 503/u);
	assert.deepEqual(seen.done, []);

	// Today the first-event timer is still armed after the refusal: when it fires it
	// cancels the turn on Rovo, after the stream has already failed.
	t.mock.timers.tick(5_000);
	await rovo.waitFor("POST /v3/cancel");
	assert.equal(seen.errors.length, 1);
});

test("a refused message fails before any stream opens", async (t) => {
	const rovo = await startRovo(t, { setChatStatus: 500 });
	const { ended, seen } = stream(rovo.port);

	assert.equal(await ended, "error");
	assert.match(seen.errors[0].message, /Failed to queue message \(status 500\)/u);
	assert.deepEqual(rovo.requests, ["POST /v3/set_chat_message"]);
});

test("an error event fails the stream with its message", async (t) => {
	const rovo = await startRovo(t, {
		onStream: (res) => {
			res.write(textPart("partial"));
			res.write(sse("error", { message: "model overloaded" }));
		},
	});
	const { ended, seen } = stream(rovo.port);

	assert.equal(await ended, "error");
	assert.equal(seen.errors[0].message, "model overloaded");
	assert.deepEqual(seen.done, []);
});
