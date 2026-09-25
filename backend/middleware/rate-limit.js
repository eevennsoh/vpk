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

function createInMemoryRateLimiter({ max, now = Date.now, windowMs }) {
	if (!Number.isFinite(max) || max <= 0) {
		throw new Error("createInMemoryRateLimiter requires a positive max");
	}
	if (typeof now !== "function") {
		throw new Error("createInMemoryRateLimiter requires now");
	}
	if (!Number.isFinite(windowMs) || windowMs <= 0) {
		throw new Error("createInMemoryRateLimiter requires a positive windowMs");
	}

	const buckets = new Map();
	return (req, res, next) => {
		const currentTime = now();
		const key = req.ip || req.socket?.remoteAddress || "unknown";
		const bucket = buckets.get(key);
		if (!bucket || bucket.resetAt <= currentTime) {
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
	AI_COST_RATE_LIMIT_PATHS,
	AI_COST_RATE_LIMIT_WINDOW_MS,
	createInMemoryRateLimiter,
	registerAiCostRateLimitMiddleware,
};
