"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	CONTENT_SECURITY_POLICY_DIRECTIVES,
	DEFAULT_ALLOWED_ORIGINS,
	createCorsOptions,
	createHelmetOptions,
	isAllowedOrigin,
	registerSecurityMiddleware,
	resolveAllowedOrigins,
} = require("./security");

function createFakeApp() {
	const uses = [];
	return {
		uses,
		use: (...args) => {
			uses.push(args);
		},
	};
}

test("security middleware preserves CSP and cross-origin options", () => {
	assert.deepEqual(CONTENT_SECURITY_POLICY_DIRECTIVES, {
		defaultSrc: ["'self'"],
		scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
		connectSrc: [
			"'self'",
			"https://ai-gateway.us-east-1.staging.atl-paas.net",
			"wss:",
			"ws:",
		],
		imgSrc: ["'self'", "data:", "blob:", "https:"],
		mediaSrc: ["'self'", "data:", "blob:", "https:"],
		styleSrc: [
			"'self'",
			"'unsafe-inline'",
			"https://fonts.googleapis.com",
			"https://ds-cdn.prod-east.frontend.public.atl-paas.net",
		],
		fontSrc: [
			"'self'",
			"data:",
			"https://fonts.gstatic.com",
			"https://*.atlassian.com",
			"https://ds-cdn.prod-east.frontend.public.atl-paas.net",
		],
		workerSrc: ["'self'", "blob:"],
		frameSrc: ["'self'", "https:"],
		objectSrc: ["'none'"],
		baseUri: ["'self'"],
	});

	assert.deepEqual(createHelmetOptions(), {
		contentSecurityPolicy: {
			directives: CONTENT_SECURITY_POLICY_DIRECTIVES,
		},
		crossOriginEmbedderPolicy: false,
		crossOriginResourcePolicy: { policy: "cross-origin" },
	});
});

test("resolveAllowedOrigins preserves defaults and ALLOWED_ORIGINS override", () => {
	assert.deepEqual(resolveAllowedOrigins({}), DEFAULT_ALLOWED_ORIGINS);
	assert.deepEqual(
		resolveAllowedOrigins({
			ALLOWED_ORIGINS: " http://localhost:3000, https://example.test ,,",
		}),
		["http://localhost:3000", "https://example.test"],
	);
});

test("CORS origin gate allows same-origin and explicit allowlist only", () => {
	const options = createCorsOptions(["https://allowed.test"]);
	const results = [];

	options.origin(undefined, (error, allowed) => {
		results.push({ allowed, error: error?.message });
	});
	options.origin("https://allowed.test", (error, allowed) => {
		results.push({ allowed, error: error?.message });
	});
	options.origin("https://blocked.test", (error, allowed) => {
		results.push({ allowed, error: error?.message });
	});

	assert.deepEqual(results, [
		{ allowed: true, error: undefined },
		{ allowed: true, error: undefined },
		{
			allowed: undefined,
			error: "CORS: origin https://blocked.test not allowed",
		},
	]);
	assert.equal(isAllowedOrigin("", []), true);
	assert.equal(isAllowedOrigin("https://allowed.test", ["https://allowed.test"]), true);
	assert.equal(isAllowedOrigin("https://blocked.test", ["https://allowed.test"]), false);
});

test("registerSecurityMiddleware mounts helmet before CORS and returns allowed origins", () => {
	const app = createFakeApp();
	const helmetCalls = [];
	const corsCalls = [];

	const result = registerSecurityMiddleware(app, {
		env: { ALLOWED_ORIGINS: "https://allowed.test" },
		helmetImpl: (options) => {
			helmetCalls.push(options);
			return { middleware: "helmet", options };
		},
		corsImpl: (options) => {
			corsCalls.push(options);
			return { middleware: "cors", options };
		},
	});

	assert.deepEqual(result, { allowedOrigins: ["https://allowed.test"] });
	assert.deepEqual(helmetCalls, [createHelmetOptions()]);
	assert.equal(corsCalls.length, 1);
	assert.equal(corsCalls[0].credentials, true);
	assert.deepEqual(app.uses, [
		[{ middleware: "helmet", options: createHelmetOptions() }],
		[{ middleware: "cors", options: corsCalls[0] }],
	]);
});

test("registerSecurityMiddleware validates dependencies", () => {
	assert.throws(() => registerSecurityMiddleware(null), /Express app/u);
	assert.throws(
		() => registerSecurityMiddleware(createFakeApp(), { helmetImpl: null }),
		/helmet/u,
	);
	assert.throws(
		() => registerSecurityMiddleware(createFakeApp(), { corsImpl: null }),
		/cors/u,
	);
});
