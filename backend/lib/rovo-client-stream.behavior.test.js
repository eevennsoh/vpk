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
async function startRovo(t, { onStream = () => {}, onRefusedStream = null, setChatStatus = 200, streamStatus = 200 } = {}) {
	const requests = [];
	let streamClosedBeforeEnd = 0;
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
			res.on("close", () => {
				if (!res.writableEnded) {
					streamClosedBeforeEnd += 1;
					requests.push("CLOSED /v3/stream_chat");
					notify();
				}
			});
			if (onRefusedStream) {
				onRefusedStream(res);
				return;
			}
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
		/** How many stream responses the client closed before Rovo ended them. */
		closedByClient: () => streamClosedBeforeEnd,
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
	const { ended, handle, seen } = stream(rovo.port);
	assert.equal(handle.getPhase(), "queuing");

	assert.equal(await ended, "done");
	assert.equal(handle.getPhase(), "done");
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

test("text that arrives while a pause decision is pending is not delivered once the pause disconnects", async (t) => {
	let streamRes;
	const rovo = await startRovo(t, {
		onStream: (res) => {
			streamRes = res;
			res.write(textPart("Before the tool. "));
			res.write(pauseEvent);
		},
	});
	const { ended, seen } = stream(rovo.port, {
		callbacks: {
			onPauseToolCalls: async () => {
				// More of the turn arrives before the decision is made.
				await new Promise((resolve) => streamRes.write(textPart("after the pause"), resolve));
				for (let turn = 0; turn < 20; turn += 1) {
					await new Promise((resolve) => setImmediate(resolve));
				}
				return { disconnect: true };
			},
		},
	});

	assert.equal(await ended, "done");
	assert.deepEqual(seen.done, ["Before the tool. "]);
	assert.equal(seen.chunks.some((chunk) => chunk.text === "after the pause"), false);
});

test("a timeout names the phase it happened in", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const silent = await startRovo(t);
	const first = stream(silent.port, { options: { firstEventTimeoutMs: 5_000, idleTimeoutMs: 9_000 } });
	await nextStage(first.seen, "rovo_stream_connected");
	t.mock.timers.tick(5_000);
	await first.ended;

	const stalled = await startRovo(t, { onStream: (res) => res.write(textPart("partial")) });
	const second = stream(stalled.port, { options: { firstEventTimeoutMs: 5_000, idleTimeoutMs: 9_000 } });
	await nextStage(second.seen, "rovo_first_text_delta");
	t.mock.timers.tick(9_000);
	await second.ended;

	assert.equal(first.seen.errors[0].phase, "awaiting-first-event");
	assert.equal(second.seen.errors[0].phase, "streaming");
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

	assert.equal(handle.getPhase(), "streaming");
	await handle.abort();
	await rovo.waitFor("POST /v3/cancel");

	assert.equal(handle.getPhase(), "aborted");
	assert.deepEqual(rovo.requests.filter((line) => !line.startsWith("CLOSED")), ["GET /v3/stream_chat", "POST /v3/cancel"]);
});

test("a refused stream fails with its HTTP status", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const rovo = await startRovo(t, { streamStatus: 503 });
	const { ended, seen } = stream(rovo.port, { options: { firstEventTimeoutMs: 5_000 } });

	assert.equal(await ended, "error");
	assert.equal(seen.errors[0].statusCode, 503);
	assert.match(seen.errors[0].message, /status 503/u);
	assert.deepEqual(seen.done, []);

	// The first-event timer stops with the refusal; it used to fire later and cancel the
	// turn on Rovo after the stream had already failed.
	t.mock.timers.tick(5_000);
	// A request sent after the tick: a cancel the timer sent would have reached Rovo first.
	await new Promise((resolve) => {
		http.get(`http://127.0.0.1:${rovo.port}/probe`, (res) => res.resume().on("end", resolve));
	});
	await rovo.waitFor("GET /probe");
	assert.equal(rovo.requests.includes("POST /v3/cancel"), false);
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

// Sends a request after the test's last action: anything the client sent before it
// (a cancel) has reached the stand-in by the time this one has.
function probe(rovo) {
	return new Promise((resolve) => {
		http.get(`http://127.0.0.1:${rovo.port}/probe`, (res) => res.resume().on("end", resolve));
	}).then(() => rovo.waitFor("GET /probe"));
}

const cancels = (rovo) => rovo.requests.filter((line) => line === "POST /v3/cancel").length;

test("a refused stream whose body breaks off fails with its status and cancels nothing", async (t) => {
	const rovo = await startRovo(t, {
		onRefusedStream: (res) => {
			res.writeHead(503, { "Content-Type": "text/plain", "Content-Length": "100" });
			res.write("partial", () => res.socket.destroy());
		},
	});
	const { ended, handle, seen } = stream(rovo.port);

	assert.equal(await ended, "error");
	assert.equal(seen.errors[0].statusCode, 503);
	assert.equal(handle.getPhase(), "failed");
	await probe(rovo);
	assert.equal(cancels(rovo), 0);
});

test("a refused stream whose body stalls fails at the first-event timeout and cancels nothing", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	const rovo = await startRovo(t, {
		onRefusedStream: (res) => {
			res.writeHead(503, { "Content-Type": "text/plain", "Content-Length": "100" });
			res.write("partial");
		},
	});
	const { ended, seen } = stream(rovo.port, { options: { firstEventTimeoutMs: 5_000 } });
	await nextStage(seen, "rovo_set_chat_message_complete");
	await rovo.waitFor("GET /v3/stream_chat");
	for (let turn = 0; turn < 20; turn += 1) {
		await new Promise((resolve) => setImmediate(resolve));
	}

	t.mock.timers.tick(5_000);

	assert.equal(await ended, "error");
	assert.equal(seen.errors[0].statusCode, 503);
	await probe(rovo);
	assert.equal(cancels(rovo), 0);
});

test("a pause decision that throws fails the turn, closes the stream and cancels the turn once", async (t) => {
	const rovo = await startRovo(t, {
		onStream: (res) => {
			res.write(textPart("Before. "));
			res.write(pauseEvent);
		},
	});
	const { ended, seen } = stream(rovo.port, {
		callbacks: {
			onPauseToolCalls: async () => {
				throw new Error("resume_tool_calls failed");
			},
		},
	});

	assert.equal(await ended, "error");
	assert.equal(seen.errors[0].message, "resume_tool_calls failed");
	await rovo.waitFor("CLOSED /v3/stream_chat");
	await rovo.waitFor("POST /v3/cancel");
	await probe(rovo);
	assert.equal(cancels(rovo), 1);
});

test("an error event closes a stream Rovo holds open and cancels the turn once; nothing after it is delivered", async (t) => {
	const rovo = await startRovo(t, {
		onStream: (res) => {
			res.write(sse("error", { message: "model overloaded" }));
			res.write(textPart("after the error"));
		},
	});
	const { ended, seen } = stream(rovo.port);

	assert.equal(await ended, "error");
	await rovo.waitFor("CLOSED /v3/stream_chat");
	await probe(rovo);
	assert.equal(cancels(rovo), 1);
	assert.equal(seen.chunks.some((chunk) => chunk.text === "after the error"), false);
});

test("data that arrives while a pause decision is pending keeps the stream alive", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	let streamRes;
	const rovo = await startRovo(t, {
		onStream: (res) => {
			streamRes = res;
			res.write(textPart("Before. "));
			res.write(pauseEvent);
		},
	});
	let decide;
	const decision = new Promise((resolve) => {
		decide = resolve;
	});
	let pauseSeen;
	const pauseReached = new Promise((resolve) => {
		pauseSeen = resolve;
	});
	const { ended, seen } = stream(rovo.port, {
		callbacks: {
			onPauseToolCalls: async () => {
				pauseSeen();
				await decision;
				return { disconnect: false };
			},
		},
		options: { firstEventTimeoutMs: 9_000, idleTimeoutMs: 9_000 },
	});
	await pauseReached;

	for (let step = 0; step < 3; step += 1) {
		t.mock.timers.tick(5_000);
		await new Promise((resolve) => streamRes.write(textPart(`more ${step}. `), resolve));
		for (let turn = 0; turn < 20; turn += 1) {
			await new Promise((resolve) => setImmediate(resolve));
		}
	}
	assert.deepEqual(seen.errors, []);
	decide();
	streamRes.end();

	assert.equal(await ended, "done");
	assert.deepEqual(seen.done, ["Before. more 0. more 1. more 2. "]);
	assert.equal(cancels(rovo), 0);
});

test("a stream that ends during a pending pause decision waits for it and never cancels", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] });
	for (const decisionCompletes of [true, false]) {
		const rovo = await startRovo(t, {
			onStream: (res) => {
				res.write(textPart("Before. "));
				res.end(pauseEvent);
			},
		});
		let decide;
		const decision = new Promise((resolve) => {
			decide = resolve;
		});
		const { ended, seen } = stream(rovo.port, {
			callbacks: { onPauseToolCalls: () => decision.then(() => ({ disconnect: false })) },
			options: { firstEventTimeoutMs: 9_000, idleTimeoutMs: 9_000 },
		});
		await nextStage(seen, "rovo_first_sse_event");
		for (let turn = 0; turn < 20; turn += 1) {
			await new Promise((resolve) => setImmediate(resolve));
		}

		t.mock.timers.tick(5_000);
		if (decisionCompletes) {
			decide();
			assert.equal(await ended, "done", "decision completes");
		} else {
			t.mock.timers.tick(5_000);
			assert.equal(await ended, "error", "decision never completes");
			assert.equal(seen.errors[0].code, "ROVO_STREAM_PAUSE_DECISION_TIMEOUT");
			decide();
		}
		await probe(rovo);
		assert.equal(cancels(rovo), 0, String(decisionCompletes));
	}
});

test("a turn that ends before its stream opens reports a terminal phase", async (t) => {
	const refused = await startRovo(t, { setChatStatus: 500 });
	const failed = stream(refused.port);
	await failed.ended;
	assert.equal(failed.handle.getPhase(), "failed");

	const rovo = await startRovo(t);
	const { handle } = stream(rovo.port);
	await handle.abort();
	assert.equal(handle.getPhase(), "aborted");
});
