const { before, test } = require("node:test");
const assert = require("node:assert/strict");

const { createCapturedResponse } = require("./in-process-http");

test("createCapturedResponse.waitForHeaders resolves after headers are flushed", async () => {
	const response = createCapturedResponse();

	const waitPromise = response.waitForHeaders();
	response.setHeader("Content-Type", "text/event-stream");
	response.flushHeaders();

	await waitPromise;

	assert.equal(response.headersSent, true);
	assert.equal(response.getHeader("content-type"), "text/event-stream");
});

let createUIMessageStream;
let pipeUIMessageStreamToResponse;

before(async () => {
	({
		createUIMessageStream,
		pipeUIMessageStreamToResponse,
	} = await import("ai"));
});

const {
	createInProcessRequest,
	dispatchInProcessHttpRequest,
	pipeWebResponseToExpressResponse,
} = require("./in-process-http");

test("createCapturedResponse captures JSON responses as a web Response", async () => {
	const response = createCapturedResponse();

	response.status(418).json({ ok: true });

	const webResponse = response.toWebResponse();
	assert.equal(webResponse.status, 418);
	assert.equal(
		webResponse.headers.get("content-type"),
		"application/json; charset=utf-8",
	);
	assert.deepEqual(await webResponse.json(), { ok: true });
});

test("createCapturedResponse merges bulk Node response headers before writing", async () => {
	const response = createCapturedResponse();
	response.setHeader("X-Existing", "preserved");
	const result = response.setHeaders(new Headers({
		"Content-Type": "text/plain",
		"X-Bulk": "initial",
	}));
	response.setHeaders(new Map([["X-Bulk", "replaced"]]));

	assert.equal(result === response, true);
	assert.equal(response.headersSent, false);
	response.writeHead(202);
	response.end("captured");

	const webResponse = response.toWebResponse();
	assert.equal(webResponse.status, 202);
	assert.equal(webResponse.headers.get("x-existing"), "preserved");
	assert.equal(webResponse.headers.get("x-bulk"), "replaced");
	assert.equal(webResponse.headers.get("content-type"), "text/plain");
	assert.equal(await webResponse.text(), "captured");
});

test("createCapturedResponse works with pipeUIMessageStreamToResponse", async () => {
	const response = createCapturedResponse();
	const stream = createUIMessageStream({
		execute: ({ writer }) => {
			writer.write({ type: "text-start", id: "text-1" });
			writer.write({ type: "text-delta", id: "text-1", delta: "Hello" });
			writer.write({ type: "text-end", id: "text-1" });
		},
	});

	pipeUIMessageStreamToResponse({
		response,
		stream,
	});

	const webResponse = response.toWebResponse();
	const payload = await webResponse.text();
	assert.equal(webResponse.status, 200);
	assert.match(webResponse.headers.get("content-type") || "", /text\/event-stream/i);
	assert.match(payload, /data: \{"type":"text-start","id":"text-1"/);
	assert.match(payload, /data: \{"type":"text-delta","id":"text-1","delta":"Hello"/);
	assert.match(payload, /data: \[DONE\]/);
});

test("createInProcessRequest exposes headers via get() and abort events via signal", async () => {
	const abortController = new AbortController();
	const request = createInProcessRequest({
		body: { hello: "world" },
		headers: {
			"X-Test": "value",
		},
		signal: abortController.signal,
	});

	let aborted = false;
	let closed = false;
	request.on("aborted", () => {
		aborted = true;
	});
	request.on("close", () => {
		closed = true;
	});

	assert.deepEqual(request.body, { hello: "world" });
	assert.equal(request.get("x-test"), "value");

	abortController.abort();

	assert.equal(aborted, true);
	assert.equal(closed, true);
});

test("pipeWebResponseToExpressResponse copies status, headers, and body chunks", async () => {
	const calls = [];
	const chunks = [];
	const response = {
		status(statusCode) {
			calls.push(["status", statusCode]);
			return this;
		},
		setHeader(name, value) {
			calls.push(["setHeader", name.toLowerCase(), value]);
			return this;
		},
		write(chunk) {
			chunks.push(Buffer.from(chunk));
			return true;
		},
		end() {
			calls.push(["end"]);
			return this;
		},
	};
	const webResponse = new Response("hello", {
		status: 201,
		headers: {
			"Content-Length": "5",
			"Content-Type": "text/plain",
			"X-Test": "value",
		},
	});

	await pipeWebResponseToExpressResponse(webResponse, response);

	assert.deepEqual(calls, [
		["status", 201],
		["setHeader", "content-type", "text/plain"],
		["setHeader", "x-test", "value"],
		["end"],
	]);
	assert.equal(Buffer.concat(chunks).toString("utf8"), "hello");
});

test("pipeWebResponseToExpressResponse ends responses without a body", async () => {
	const calls = [];
	const response = {
		status(statusCode) {
			calls.push(["status", statusCode]);
			return this;
		},
		setHeader(name, value) {
			calls.push(["setHeader", name.toLowerCase(), value]);
			return this;
		},
		write() {
			calls.push(["write"]);
			return true;
		},
		end() {
			calls.push(["end"]);
			return this;
		},
	};
	const webResponse = new Response(null, {
		status: 204,
		headers: {
			"X-Empty": "true",
		},
	});

	await pipeWebResponseToExpressResponse(webResponse, response);

	assert.deepEqual(calls, [
		["status", 204],
		["setHeader", "x-empty", "true"],
		["end"],
	]);
});

test("dispatchInProcessHttpRequest runs a handler and returns a web response", async () => {
	const response = await dispatchInProcessHttpRequest({
		body: { hello: "world" },
		handleRequest: async (req, res) => {
			assert.deepEqual(req.body, { hello: "world" });
			assert.equal(req.get("x-test"), "value");
			res.status(202).json({ ok: true });
		},
		headers: {
			"X-Test": "value",
		},
	});

	assert.equal(response.status, 202);
	assert.deepEqual(await response.json(), { ok: true });
});

test("dispatchInProcessHttpRequest validates required dependencies", async () => {
	await assert.rejects(
		() => dispatchInProcessHttpRequest(),
		/dispatchInProcessHttpRequest requires handleRequest/u,
	);
	await assert.rejects(
		() => dispatchInProcessHttpRequest({
			createRequest: null,
			handleRequest: async () => {},
		}),
		/dispatchInProcessHttpRequest requires createRequest/u,
	);
	await assert.rejects(
		() => dispatchInProcessHttpRequest({
			createResponse: null,
			handleRequest: async () => {},
		}),
		/dispatchInProcessHttpRequest requires createResponse/u,
	);
});
