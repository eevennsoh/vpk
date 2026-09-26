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
	]);
	assert.equal(FALLBACK_BODY_LIMIT, "50mb");
});

test("registerBodyLimitMiddleware mounts scoped parsers before fallback parsers", () => {
	const app = createFakeApp();
	const expressImpl = createFakeExpress();

	registerBodyLimitMiddleware(app, { expressImpl });

	assert.deepEqual(app.uses.slice(0, 3), [
		[["/api/chat-sdk", "/api/rovo/suggestions"], { parser: "json", options: { limit: "8mb" } }],
		[["/api/sound-generation", "/api/speech-transcription"], { parser: "json", options: { limit: "12mb" } }],
		["/api/rovo/files/upload", { parser: "json", options: { limit: "12mb" } }],
	]);
	assert.deepEqual(app.uses.slice(3, 6), [
		[{ parser: "json", options: { limit: "50mb" } }],
		[{ parser: "text", options: { limit: "50mb", type: "text/markdown" } }],
		[{ parser: "urlencoded", options: { limit: "50mb", extended: true } }],
	]);
	assert.equal(typeof app.uses[6][0], "function");
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
		});
	});
});
