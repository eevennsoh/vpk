// @ts-check
"use strict";

const AI_COST_RATE_LIMIT_PATHS = [
	"/api/chat-sdk",
	"/api/rovo/suggestions",
	"/api/sound-generation",
	"/api/speech-transcription",
	"/api/rovo/files/upload",
];

const AI_COST_RATE_LIMIT_MAX = 60;
const AI_COST_RATE_LIMIT_WINDOW_MS = 60_000;

// Provisional: one bucket per client address. Local development sees one address and a
// deployment behind a proxy sees the proxy's few addresses, so this only binds under a
// flood of distinct addresses; 10,000 buckets are about 1 MB.
const AI_COST_RATE_LIMIT_MAX_KEYS = 10_000;

/**
 * Makes room for one new bucket: expired buckets go first, then the oldest window (Map
 * order is window start order, because a bucket is re-inserted when its window resets).
 * Evicting an unexpired bucket gives that address a fresh window; that only happens
 * when `maxKeys` addresses were all seen within one window.
 * @param {Map<string, { count: number, resetAt: number }>} buckets
 * @param {{ currentTime: number, maxKeys: number }} options
 */
function makeRoomForBucket(buckets, { currentTime, maxKeys }) {
	if (buckets.size < maxKeys) {
		return;
	}
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= currentTime) {
			buckets.delete(key);
		}
	}
	while (buckets.size >= maxKeys) {
		const oldestKey = buckets.keys().next().value;
		buckets.delete(oldestKey);
	}
}

function createInMemoryRateLimiter({ max, maxKeys = AI_COST_RATE_LIMIT_MAX_KEYS, now = Date.now, windowMs }) {
	if (!Number.isFinite(max) || max <= 0) {
		throw new Error("createInMemoryRateLimiter requires a positive max");
	}
	if (!Number.isInteger(maxKeys) || maxKeys <= 0) {
		throw new Error("createInMemoryRateLimiter requires a positive integer maxKeys");
	}
	if (typeof now !== "function") {
		throw new Error("createInMemoryRateLimiter requires now");
	}
	if (!Number.isFinite(windowMs) || windowMs <= 0) {
		throw new Error("createInMemoryRateLimiter requires a positive windowMs");
	}

	/** @type {Map<string, { count: number, resetAt: number }>} */
	const buckets = new Map();
	const limiter = (req, res, next) => {
		const currentTime = now();
		const key = req.ip || req.socket?.remoteAddress || "unknown";
		const bucket = buckets.get(key);
		if (!bucket || bucket.resetAt <= currentTime) {
			// Delete first so a reset bucket moves to the end of the Map's order.
			buckets.delete(key);
			makeRoomForBucket(buckets, { currentTime, maxKeys });
			buckets.set(key, { count: 1, resetAt: currentTime + windowMs });
			return next();
		}

		bucket.count += 1;
		if (bucket.count > max) {
			res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - currentTime) / 1000)));
			return res.status(429).json({ error: "Too many requests" });
		}

		return next();
	};
	limiter.bucketCount = () => buckets.size;
	return limiter;
}

function registerAiCostRateLimitMiddleware(app, {
	createRateLimiter = createInMemoryRateLimiter,
} = {}) {
	if (!app || typeof app.use !== "function") {
		throw new Error("registerAiCostRateLimitMiddleware requires an Express app");
	}
	if (typeof createRateLimiter !== "function") {
		throw new Error("registerAiCostRateLimitMiddleware requires createRateLimiter");
	}

	const aiCostRateLimit = createRateLimiter({
		max: AI_COST_RATE_LIMIT_MAX,
		windowMs: AI_COST_RATE_LIMIT_WINDOW_MS,
	});
	app.use(AI_COST_RATE_LIMIT_PATHS, aiCostRateLimit);
	return aiCostRateLimit;
}

module.exports = {
	AI_COST_RATE_LIMIT_MAX,
	AI_COST_RATE_LIMIT_MAX_KEYS,
	AI_COST_RATE_LIMIT_PATHS,
	AI_COST_RATE_LIMIT_WINDOW_MS,
	createInMemoryRateLimiter,
	registerAiCostRateLimitMiddleware,
};
