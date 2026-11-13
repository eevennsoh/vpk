"use strict";

const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const test = require("node:test");

const {
	FALLBACK_BODY_LIMIT,
	ROUTE_JSON_BODY_LIMITS,
	createPayloadTooLargeHandler,
	registerBodyLimitMiddleware,
} = require("./body-limits");

function createFakeExpress() {
	const calls = [];
	return {
		calls,
		json: (options) => {
			calls.push({ parser: "json", options });
			return { parser: "json", options };
		},
		text: (options) => {
			calls.push({ parser: "text", options });
			return { parser: "text", options };
		},
		urlencoded: (options) => {
			calls.push({ parser: "urlencoded", options });
			return { parser: "urlencoded", options };
		},
	};
}

function createFakeApp() {
	const uses = [];
	return {
		uses,
		use: (...args) => {
			uses.push(args);
		},
	};
}

async function withServer(run) {
	const app = express();
	registerBodyLimitMiddleware(app);
	app.post("/api/test", (_req, res) => {
		res.json({ ok: true });
	});

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl);
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
}

test("body limit route table preserves exact scoped parser limits", () => {
	assert.deepEqual(ROUTE_JSON_BODY_LIMITS, [
		{
			paths: ["/api/chat-sdk", "/api/rovo/suggestions"],
			limit: "8mb",
		},
		{
			paths: ["/api/sound-generation", "/api/speech-transcription"],
			limit: "12mb",
		},
		{
			paths: "/api/rovo/files/upload",
			limit: "12mb",
		},
		{
			paths: "/api/rovo/chat",
			limit: "12mb",
		},
		{
			paths: "/api/personal-graph",
			limit: "12mb",
		},
		{
			paths: ["/api/rovo/threads", "/api/rovo/documents", "/api/genui-export"],
			limit: "50mb",
		},
	]);
	assert.equal(FALLBACK_BODY_LIMIT, "1mb");
});

test("registerBodyLimitMiddleware mounts scoped parsers before fallback parsers", () => {
	const app = createFakeApp();
	const expressImpl = createFakeExpress();

	registerBodyLimitMiddleware(app, { expressImpl });

	assert.deepEqual(app.uses.slice(0, 6), [
		[["/api/chat-sdk", "/api/rovo/suggestions"], { parser: "json", options: { limit: "8mb" } }],
		[["/api/sound-generation", "/api/speech-transcription"], { parser: "json", options: { limit: "12mb" } }],
		["/api/rovo/files/upload", { parser: "json", options: { limit: "12mb" } }],
		["/api/rovo/chat", { parser: "json", options: { limit: "12mb" } }],
		["/api/personal-graph", { parser: "json", options: { limit: "12mb" } }],
		[["/api/rovo/threads", "/api/rovo/documents", "/api/genui-export"], { parser: "json", options: { limit: "50mb" } }],
	]);
	assert.deepEqual(app.uses.slice(6, 9), [
		[{ parser: "json", options: { limit: "1mb" } }],
		[{ parser: "text", options: { limit: "1mb", type: "text/markdown" } }],
		[{ parser: "urlencoded", options: { limit: "1mb", extended: true } }],
	]);
	assert.equal(typeof app.uses[9][0], "function");
});

test("registerBodyLimitMiddleware validates app and parser dependencies", () => {
	assert.throws(() => registerBodyLimitMiddleware(null), /Express app/u);
	assert.throws(
		() => registerBodyLimitMiddleware(createFakeApp(), { expressImpl: { json: () => {} } }),
		/body parser helpers/u,
	);
});

test("payload-too-large handler preserves response shape and passes other errors through", () => {
	const handler = createPayloadTooLargeHandler();
	const responses = [];
	const res = {
		status: (statusCode) => {
			responses.push({ statusCode });
			return {
				json: (body) => {
					responses[responses.length - 1].body = body;
				},
			};
		},
	};
	const nextCalls = [];

	handler({ type: "entity.too.large" }, {}, res, (error) => {
		nextCalls.push(error);
	});

	assert.deepEqual(responses, [{
		statusCode: 413,
		body: {
			error: "Request payload is too large.",
			reason: "payload_too_large",
			details:
				"The request included more data than this endpoint can process, often from inline image/file data in chat history. You can continue chatting after starting a new thread or trimming history.",
			code: "PAYLOAD_TOO_LARGE",
		},
	}]);
	assert.deepEqual(nextCalls, []);

	const passthroughError = new Error("other");
	handler(passthroughError, {}, res, (error) => {
		nextCalls.push(error);
	});
	assert.deepEqual(nextCalls, [passthroughError]);
});

test("body limit middleware maps JSON parse failures to structured API errors", async () => {
	await withServer(async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/test`, {
			body: "{",
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 400);
		assert.match(response.headers.get("content-type") ?? "", /application\/json/u);
		assert.deepEqual(await response.json(), {
			error: "Invalid JSON request body.",
			code: "INVALID_JSON",
		});
	});
});

test("the fallback limit is 1 MB, and the routes that carry large bodies keep theirs", async () => {
	const app = express();
	registerBodyLimitMiddleware(app);
	app.post("/{*splat}", (req, res) => res.json({ bytes: JSON.stringify(req.body).length }));
	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const baseUrl = `http://127.0.0.1:${server.address().port}`;
	const bodyOf = (megabytes) => JSON.stringify({ data: "x".repeat(Math.round(megabytes * 1024 * 1024)) });
	const post = (route, body) => fetch(`${baseUrl}${route}`, {
		body,
		headers: { "Content-Type": "application/json" },
		method: "POST",
	});
	try {
		const cases = [
			["/api/agent-mode", 0.9, 200],
			["/api/agent-mode", 1.1, 413],
			["/api/rovo/messages", 1.1, 413],
			["/api/rovo/chat", 11, 200],
			["/api/rovo/chat", 13, 413],
			["/api/personal-graph/raw", 11, 200],
			["/api/rovo/threads", 40, 200],
			["/api/rovo/threads/059d607c-a1aa-48f5-880b-5d824fc5b99f", 40, 200],
			["/api/rovo/documents", 40, 200],
			["/api/genui-export", 40, 200],
			["/api/rovo/threads", 51, 413],
		];
		for (const [route, megabytes, status] of cases) {
			const response = await post(route, bodyOf(megabytes));
			assert.equal(response.status, status, `${route} ${megabytes} MB`);
			if (status === 413) {
				assert.equal((await response.json()).code, "PAYLOAD_TOO_LARGE");
			} else {
				await response.arrayBuffer();
			}
		}
	} finally {
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	}
});
