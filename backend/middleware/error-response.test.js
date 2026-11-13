"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const express = require("express");

const { registerBodyLimitMiddleware } = require("./body-limits");
const {
	ERROR_CODES,
	PublicHttpError,
	createFinalErrorHandler,
	createOriginNotAllowedError,
	decideErrorResponse,
	registerFinalErrorHandlers,
	sendError,
} = require("./error-response");
const { registerSecurityMiddleware } = require("./security");

const SECRET_DETAIL = "upstream said: token=made-up-secret-value at /Users/someone/vpk/backend/lib/x.js:1:1";

function errorWith(fields) {
	return Object.assign(new Error(SECRET_DETAIL), fields);
}

test("decideErrorResponse maps every error to a status, a code and a safe message", () => {
	const cases = [
		["a plain thrown error", new Error(SECRET_DETAIL), { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." }],
		["a thrown string", SECRET_DETAIL, { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." }],
		["null", null, { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." }],
		["undefined", undefined, { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." }],
		["an upstream 502", errorWith({ status: 502 }), { status: 502, code: "INTERNAL_ERROR", message: "Internal server error." }],
		["statusCode instead of status", errorWith({ statusCode: 404 }), { status: 404, code: "NOT_FOUND", message: "Not Found." }],
		["a body-parser 400", errorWith({ status: 400, expose: true, type: "entity.parse.failed" }), { status: 400, code: "BAD_REQUEST", message: "Bad Request." }],
		["a body-parser 413", errorWith({ status: 413, type: "entity.too.large" }), { status: 413, code: "PAYLOAD_TOO_LARGE", message: "Payload Too Large." }],
		["a 415 with no mapped code", errorWith({ status: 415 }), { status: 415, code: "HTTP_415", message: "Unsupported Media Type." }],
		["a status below 400 is not an error status", errorWith({ status: 302 }), { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." }],
		["a status above 599", errorWith({ status: 700 }), { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." }],
		["a non-integer status", errorWith({ status: "404" }), { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." }],
		["a rejected origin", createOriginNotAllowedError("https://blocked.test"), { status: 403, code: "ORIGIN_NOT_ALLOWED", message: "Origin not allowed." }],
		["a public error", new PublicHttpError(409, "THREAD_BUSY", "Thread is busy."), { status: 409, code: "THREAD_BUSY", message: "Thread is busy." }],
		["a public error with a broken status", new PublicHttpError(200, "WRONG", "Fine."), { status: 500, code: "INTERNAL_ERROR", message: "Internal server error." }],
	];
	for (const [name, error, expected] of cases) {
		assert.deepEqual(decideErrorResponse(error), expected, name);
	}
});

test("a rejected origin keeps the origin for the server log only", () => {
	const error = createOriginNotAllowedError("https://blocked.test");
	assert.equal(error.message, "CORS: origin https://blocked.test not allowed");
	assert.equal(error.publicMessage, "Origin not allowed.");
});

test("sendError writes the shared shape and keeps a route's extra fields", () => {
	const sent = [];
	const res = {
		status(status) {
			sent.push({ status });
			return this;
		},
		json(body) {
			sent[sent.length - 1].body = body;
			return this;
		},
	};
	sendError(res, 404, ERROR_CODES.NOT_FOUND, "Thread not found.");
	sendError(res, 413, ERROR_CODES.PAYLOAD_TOO_LARGE, "Too large.", { reason: "payload_too_large", error: "ignored", code: "ignored" });
	assert.deepEqual(sent, [
		{ status: 404, body: { error: "Thread not found.", code: "NOT_FOUND" } },
		{ status: 413, body: { reason: "payload_too_large", error: "Too large.", code: "PAYLOAD_TOO_LARGE" } },
	]);
});

test("the final handler hands a started response to Express and logs the detail server-side", () => {
	const logged = [];
	const handler = createFinalErrorHandler({
		logger: { error: (...args) => logged.push(["error", ...args]), warn: (...args) => logged.push(["warn", ...args]) },
	});
	const error = new Error(SECRET_DETAIL);
	const forwarded = [];
	handler(error, { method: "GET", path: "/api/x" }, { headersSent: true }, (value) => forwarded.push(value));
	assert.deepEqual(forwarded, [error]);
	assert.equal(logged.length, 1);
	assert.equal(logged[0][0], "error");
	assert.equal(logged[0][1], "[HTTP] GET /api/x -> 500 INTERNAL_ERROR");
	assert.ok(String(logged[0][2]).includes(SECRET_DETAIL));
});

// The middleware order of the real backend: security, body limits, routes, final handlers.
async function withComposedApp(run, { routes = () => {} } = {}) {
	const app = express();
	registerSecurityMiddleware(app, { env: { ALLOWED_ORIGINS: "http://localhost:3000" } });
	registerBodyLimitMiddleware(app);
	routes(app);
	const logged = [];
	registerFinalErrorHandlers(app, {
		logger: { error: (...args) => logged.push(args.join(" ")), warn: (...args) => logged.push(args.join(" ")) },
	});
	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		await run(`http://127.0.0.1:${server.address().port}`, logged);
	} finally {
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	}
}

async function readResponse(response) {
	return {
		status: response.status,
		type: response.headers.get("content-type"),
		body: await response.json(),
	};
}

test("a disallowed origin gets a 403 in the shared shape, with no stack or path", async () => {
	await withComposedApp(async (baseUrl, logged) => {
		for (const init of [
			{ method: "POST", headers: { Origin: "http://evil.example", "Content-Type": "application/json" }, body: "{}" },
			{ method: "GET", headers: { Origin: "http://evil.example" } },
			{ method: "OPTIONS", headers: { Origin: "http://evil.example", "Access-Control-Request-Method": "POST" } },
		]) {
			const response = await fetch(`${baseUrl}/api/rovo/threads`, init);
			assert.equal(response.headers.get("access-control-allow-origin"), null);
			assert.deepEqual(await readResponse(response), {
				status: 403,
				type: "application/json; charset=utf-8",
				body: { error: "Origin not allowed.", code: "ORIGIN_NOT_ALLOWED" },
			}, init.method);
		}
		assert.ok(logged.some((line) => line.includes("CORS: origin http://evil.example not allowed")));
	}, {
		routes: (app) => app.all("/api/rovo/threads", (_req, res) => res.json({ reached: true })),
	});
});

test("an allowed or absent origin still reaches the route", async () => {
	await withComposedApp(async (baseUrl) => {
		for (const headers of [{}, { Origin: "http://localhost:3000" }]) {
			const response = await fetch(`${baseUrl}/api/rovo/threads`, { method: "POST", headers });
			assert.deepEqual(await response.json(), { reached: true });
		}
	}, {
		routes: (app) => app.post("/api/rovo/threads", (_req, res) => res.json({ reached: true })),
	});
});

test("an error thrown or rejected in a route gets a generic 500 in the shared shape", async () => {
	await withComposedApp(async (baseUrl, logged) => {
		for (const path of ["/api/throws", "/api/rejects", "/api/next-error", "/not-api/throws"]) {
			const response = await fetch(`${baseUrl}${path}`);
			const result = await readResponse(response);
			assert.deepEqual(result, {
				status: 500,
				type: "application/json; charset=utf-8",
				body: { error: "Internal server error.", code: "INTERNAL_ERROR" },
			}, path);
			assert.ok(!JSON.stringify(result).includes("made-up-secret-value"), path);
		}
		assert.equal(logged.filter((line) => line.includes(SECRET_DETAIL)).length, 4);
	}, {
		routes: (app) => {
			app.get("/api/throws", () => {
				throw new Error(SECRET_DETAIL);
			});
			app.get("/api/rejects", async () => {
				throw new Error(SECRET_DETAIL);
			});
			app.get("/api/next-error", (_req, _res, next) => next(new Error(SECRET_DETAIL)));
			app.get("/not-api/throws", () => {
				throw new Error(SECRET_DETAIL);
			});
		},
	});
});

test("an /api request no route answers gets a JSON 404 for every method", async () => {
	await withComposedApp(async (baseUrl) => {
		for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
			const response = await fetch(`${baseUrl}/api/does-not-exist`, { method });
			assert.deepEqual(await readResponse(response), {
				status: 404,
				type: "application/json; charset=utf-8",
				body: { error: "API route not found: /api/does-not-exist", code: "NOT_FOUND" },
			}, method);
		}
	});
});

test("body-limit errors keep their fields and gain the code", async () => {
	await withComposedApp(async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/echo`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{",
		});
		assert.deepEqual(await readResponse(response), {
			status: 400,
			type: "application/json; charset=utf-8",
			body: { error: "Invalid JSON request body.", code: "INVALID_JSON" },
		});
	}, {
		routes: (app) => app.post("/api/echo", (req, res) => res.json(req.body)),
	});
});
