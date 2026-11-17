"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { setImmediate: nextTurn } = require("node:timers/promises");
const { replayStreaming, sendMessageStreaming } = require("./rovo-client");
const { createRovoToolEventDispatcher } = require("./rovo-gateway-tool-event-dispatcher");

const deferredRequest = `event: deferred-request\ndata: ${JSON.stringify({
	calls: [{ tool_name: "ask_user_questions", tool_call_id: "deferred-1", args: { question: "input-marker" } }],
})}\n\n`;

async function startRovo(t, { keepOpen, body = deferredRequest }) {
	const cancelled = Promise.withResolvers();
	const requests = [];
	const server = http.createServer((req, res) => {
		req.resume();
		const path = req.url.split("?")[0];
		requests.push(`${req.method} ${path}`);
		if (path === "/v3/stream_chat" || path === "/v3/replay") {
			res.writeHead(200, { "Content-Type": "text/event-stream" });
			if (keepOpen) res.write(body);
			else res.end(body);
			return;
		}
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok: true }));
		if (path === "/v3/cancel") cancelled.resolve();
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(async () => {
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	});
	return { port: server.address().port, requests, cancelled: cancelled.promise };
}

function waitForStreamEnd(t) {
	const ended = Promise.withResolvers();
	const originalRequest = http.request;
	t.mock.method(http, "request", (...args) => {
		const request = originalRequest(...args);
		request.on("response", (response) => {
			if (response.headers["content-type"] === "text/event-stream") {
				response.on("end", ended.resolve);
			}
		});
		return request;
	});
	return ended.promise;
}

function openStream(mode, port, onDeferredToolRequest, onPauseToolCalls) {
	const ended = Promise.withResolvers();
	const seen = { errors: [], done: [] };
	const dispatcher = createRovoToolEventDispatcher({ onDeferredToolRequest });
	const callbacks = {
		onChunk: dispatcher.handleChunk,
		onPauseToolCalls,
		onDone: (text) => { seen.done.push(text); ended.resolve("done"); },
		onError: (error) => { seen.errors.push(error); ended.resolve("error"); },
	};
	const options = { firstEventTimeoutMs: 50, idleTimeoutMs: 25 };
	const handle = mode === "live"
		? sendMessageStreaming("hello", callbacks, port, options)
		: replayStreaming(callbacks, port, options);
	return { handle, seen, ended: ended.promise };
}

for (const mode of ["live", "replay"]) {
	test(`${mode} reports a deferred handler timeout after EOF without cancelling`, { timeout: 5_000 }, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const rovo = await startRovo(t, { keepOpen: false });
		const gate = Promise.withResolvers();
		const entered = Promise.withResolvers();
		t.after(() => gate.resolve());
		const eof = waitForStreamEnd(t);
		const { ended, seen } = openStream(mode, rovo.port, () => {
			entered.resolve();
			return gate.promise;
		});
		await Promise.all([eof, entered.promise]);
		t.mock.timers.tick(24);
		assert.deepEqual(seen, { errors: [], done: [] });
		t.mock.timers.tick(1);
		assert.equal(await ended, "error");
		assert.equal(seen.errors[0].code, "ROVO_STREAM_DEFERRED_HANDLER_TIMEOUT");
		assert.equal(seen.errors[0].phase, "ended");
		assert.equal(seen.errors[0].message, "Rovo stream ended but its deferred tool handler did not finish within 1s");
		assert.deepEqual(seen.done, []);
		assert.equal(rovo.requests.includes("POST /v3/cancel"), false);
	});

	test(`${mode} keeps the pause timeout code and message after a deferred handler finishes`, { timeout: 5_000 }, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const rovo = await startRovo(t, {
			keepOpen: false,
			body: deferredRequest + `event: on_call_tools_start\ndata: ${JSON.stringify({
				parts: [{ tool_name: "lookup", tool_call_id: "pause-2", args: {} }],
			})}\n\n`,
		});
		const gate = Promise.withResolvers();
		const pauseEntered = Promise.withResolvers();
		const decision = Promise.withResolvers();
		t.after(() => { gate.resolve(); decision.resolve(); });
		const eof = waitForStreamEnd(t);
		const { ended, seen } = openStream(mode, rovo.port, () => gate.promise, () => {
			pauseEntered.resolve();
			return decision.promise;
		});
		await eof;
		gate.resolve();
		await pauseEntered.promise;
		t.mock.timers.tick(25);
		assert.equal(await ended, "error");
		assert.equal(seen.errors[0].code, "ROVO_STREAM_PAUSE_DECISION_TIMEOUT");
		assert.equal(seen.errors[0].message, "Rovo stream ended but its pending tool pause decision did not complete within 1s");
		assert.equal(rovo.requests.includes("POST /v3/cancel"), false);
	});

	test(`${mode} cancels on silence while a deferred handler is pending in an open stream`, { timeout: 5_000 }, async (t) => {
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const rovo = await startRovo(t, { keepOpen: true });
		const gate = Promise.withResolvers();
		const entered = Promise.withResolvers();
		t.after(() => gate.resolve());
		const { ended, seen } = openStream(mode, rovo.port, () => {
			entered.resolve();
			return gate.promise;
		});
		await entered.promise;
		t.mock.timers.tick(25);
		assert.equal(await ended, "error");
		assert.equal(seen.errors[0].code, "ROVO_STREAM_IDLE_TIMEOUT");
		assert.equal(seen.errors[0].phase, "streaming");
		assert.equal(seen.errors[0].hadActivity, true);
		await rovo.cancelled;
		assert.equal(rovo.requests.filter((request) => request === "POST /v3/cancel").length, 1);
		assert.deepEqual(seen.done, []);
	});

	for (const terminal of ["abort", "EOF timeout"]) {
		test(`${mode} logs one late deferred rejection after ${terminal} without the tool input`, { timeout: 5_000 }, async (t) => {
			t.mock.timers.enable({ apis: ["setTimeout"] });
			const warnings = [];
			t.mock.method(console, "warn", (...args) => warnings.push(args));
			const rovo = await startRovo(t, { keepOpen: terminal === "abort" });
			const gate = Promise.withResolvers();
			const entered = Promise.withResolvers();
			t.after(() => gate.resolve());
			const eof = waitForStreamEnd(t);
			const { handle, ended, seen } = openStream(mode, rovo.port, () => {
				entered.resolve();
				return gate.promise;
			});
			await entered.promise;
			if (terminal === "abort") {
				await handle.abort();
			} else {
				await eof;
				t.mock.timers.tick(25);
				assert.equal(await ended, "error");
			}
			const errorCount = seen.errors.length;
			gate.reject(Object.assign(new Error("late handler failure"), { toolInput: "input-marker" }));
			await nextTurn();
			assert.deepEqual(warnings, [[
				"[rovo] Deferred tool handler rejected after stream finished:",
				{ port: rovo.port, phase: terminal === "abort" ? "aborted" : "failed", error: "late handler failure" },
			]]);
			assert.equal(JSON.stringify(warnings).includes("input-marker"), false);
			assert.equal(seen.errors.length, errorCount);
			assert.deepEqual(seen.done, []);
		});
	}
}
