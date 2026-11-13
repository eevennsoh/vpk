"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	AI_COST_RATE_LIMIT_MAX,
	AI_COST_RATE_LIMIT_MAX_KEYS,
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

test("createInMemoryRateLimiter keeps at most maxKeys buckets", () => {
	let currentTime = 1_000;
	const limiter = createInMemoryRateLimiter({ max: 5, maxKeys: 3, now: () => currentTime, windowMs: 1_000 });
	const res = createResponse();
	for (let index = 0; index < 50; index += 1) {
		currentTime += 10;
		limiter({ ip: `10.0.0.${index}` }, res, () => {});
		assert.ok(limiter.bucketCount() <= 3, `after ${index + 1} addresses: ${limiter.bucketCount()}`);
	}
	assert.equal(limiter.bucketCount(), 3);
	assert.equal(AI_COST_RATE_LIMIT_MAX_KEYS, 10_000);
});

test("a full limiter evicts expired buckets before a live one, so a throttled caller stays throttled", () => {
	let currentTime = 1_000;
	const limiter = createInMemoryRateLimiter({ max: 1, maxKeys: 2, now: () => currentTime, windowMs: 1_000 });
	const res = createResponse();
	let allowed = [];
	const call = (ip) => limiter({ ip }, res, () => allowed.push(ip));

	call("old"); // window ends at 2_000
	currentTime = 1_900;
	call("throttled"); // window ends at 2_900
	call("throttled"); // over max: 429
	currentTime = 2_100; // "old" has expired, "throttled" is live
	call("new");
	call("throttled"); // still inside its window, still over max

	assert.deepEqual(allowed, ["old", "throttled", "new"]);
	assert.equal(res.payloads.length, 2);
	assert.equal(limiter.bucketCount(), 2);
});

test("a limiter full of live buckets evicts the oldest window first", () => {
	let currentTime = 1_000;
	const limiter = createInMemoryRateLimiter({ max: 1, maxKeys: 2, now: () => currentTime, windowMs: 1_000 });
	const res = createResponse();
	const allowed = [];
	const call = (ip) => limiter({ ip }, res, () => allowed.push(ip));

	call("first");
	currentTime = 1_100;
	call("second");
	currentTime = 1_200;
	call("third"); // evicts "first", the oldest live window
	call("second"); // kept: over max
	call("first"); // evicted: a fresh window

	assert.deepEqual(allowed, ["first", "second", "third", "first"]);
});

test("a bucket whose window reset moves to the newest position", () => {
	let currentTime = 1_000;
	const limiter = createInMemoryRateLimiter({ max: 1, maxKeys: 2, now: () => currentTime, windowMs: 1_000 });
	const res = createResponse();
	const allowed = [];
	const call = (ip) => limiter({ ip }, res, () => allowed.push(ip));

	call("a");
	currentTime = 1_500;
	call("b");
	currentTime = 2_000; // "a" resets and becomes the newest window
	call("a");
	currentTime = 2_100;
	call("c"); // evicts "b" (window from 1_500), not "a" (from 2_000)
	call("a"); // still throttled

	assert.deepEqual(allowed, ["a", "b", "a", "c"]);
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
	assert.throws(() => createInMemoryRateLimiter({ max: 1, maxKeys: 0, windowMs: 1 }), /maxKeys/u);
	assert.throws(() => createInMemoryRateLimiter({ max: 1, windowMs: 0 }), /positive windowMs/u);
	assert.throws(() => registerAiCostRateLimitMiddleware(null), /Express app/u);
	assert.throws(
		() => registerAiCostRateLimitMiddleware({ use: () => {} }, { createRateLimiter: null }),
		/createRateLimiter/u,
	);
});
