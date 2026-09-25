"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	AI_COST_RATE_LIMIT_MAX,
	AI_COST_RATE_LIMIT_PATHS,
	AI_COST_RATE_LIMIT_WINDOW_MS,
	createInMemoryRateLimiter,
	registerAiCostRateLimitMiddleware,
} = require("./rate-limit");

function createResponse() {
	const headers = new Map();
	const payloads = [];
	return {
		headers,
		payloads,
		setHeader: (name, value) => {
			headers.set(name, value);
		},
		status: (statusCode) => ({
			json: (body) => {
				payloads.push({ body, statusCode });
			},
		}),
	};
}

test("AI cost rate-limit route table preserves exact protected paths", () => {
	assert.deepEqual(AI_COST_RATE_LIMIT_PATHS, [
		"/api/chat-sdk",
		"/api/rovo/suggestions",
		"/api/sound-generation",
		"/api/speech-transcription",
		"/api/rovo/files/upload",
	]);
	assert.equal(AI_COST_RATE_LIMIT_MAX, 60);
	assert.equal(AI_COST_RATE_LIMIT_WINDOW_MS, 60_000);
});

test("createInMemoryRateLimiter enforces max per remote key and resets by window", () => {
	let currentTime = 1_000;
	const limiter = createInMemoryRateLimiter({
		max: 2,
		now: () => currentTime,
		windowMs: 1_000,
	});
	const req = { ip: "127.0.0.1" };
	const res = createResponse();
	let nextCalls = 0;
	const next = () => {
		nextCalls += 1;
	};

	limiter(req, res, next);
	limiter(req, res, next);
	limiter(req, res, next);

	assert.equal(nextCalls, 2);
	assert.deepEqual(res.payloads, [{
		statusCode: 429,
		body: { error: "Too many requests" },
	}]);
	assert.equal(res.headers.get("Retry-After"), "1");

	currentTime = 2_000;
	limiter(req, res, next);
	assert.equal(nextCalls, 3);
});

test("createInMemoryRateLimiter separates callers by request IP", () => {
	const limiter = createInMemoryRateLimiter({
		max: 1,
		now: () => 1_000,
		windowMs: 1_000,
	});
	const res = createResponse();
	let nextCalls = 0;
	const next = () => {
		nextCalls += 1;
	};

	limiter({ ip: "one" }, res, next);
	limiter({ ip: "two" }, res, next);

	assert.equal(nextCalls, 2);
	assert.deepEqual(res.payloads, []);
});

test("registerAiCostRateLimitMiddleware mounts one shared limiter on protected paths", () => {
	const appUses = [];
	const limiter = () => {};
	const app = {
		use: (...args) => {
			appUses.push(args);
		},
	};
	const created = [];

	const returnedLimiter = registerAiCostRateLimitMiddleware(app, {
		createRateLimiter: (options) => {
			created.push(options);
			return limiter;
		},
	});

	assert.equal(returnedLimiter, limiter);
	assert.deepEqual(created, [{
		max: 60,
		windowMs: 60_000,
	}]);
	assert.deepEqual(appUses, [[AI_COST_RATE_LIMIT_PATHS, limiter]]);
});

test("rate-limit middleware validates dependencies", () => {
	assert.throws(() => createInMemoryRateLimiter({ max: 0, windowMs: 1 }), /positive max/u);
	assert.throws(() => createInMemoryRateLimiter({ max: 1, now: null, windowMs: 1 }), /now/u);
	assert.throws(() => createInMemoryRateLimiter({ max: 1, windowMs: 0 }), /positive windowMs/u);
	assert.throws(() => registerAiCostRateLimitMiddleware(null), /Express app/u);
	assert.throws(
		() => registerAiCostRateLimitMiddleware({ use: () => {} }, { createRateLimiter: null }),
		/createRateLimiter/u,
	);
});
