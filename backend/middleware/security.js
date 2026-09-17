"use strict";

const cors = require("cors");
const helmet = require("helmet");

const DEFAULT_ALLOWED_ORIGINS = [
	"http://localhost:3000",
	"http://localhost:8000",
	"http://localhost:8080",
];

const CONTENT_SECURITY_POLICY_DIRECTIVES = {
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
};

function resolveAllowedOrigins(env = process.env) {
	return (env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS.join(","))
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
}

function isAllowedOrigin(origin, allowedOrigins) {
	return Boolean(!origin || allowedOrigins.includes(origin));
}

function createHelmetOptions() {
	return {
		contentSecurityPolicy: {
			directives: CONTENT_SECURITY_POLICY_DIRECTIVES,
		},
		// Static-export HTML embeds inline JSON/scripts via Next.js; let app handle COEP.
		crossOriginEmbedderPolicy: false,
		// Allow same-origin and document-controlled resource loading for embedded media.
		crossOriginResourcePolicy: { policy: "cross-origin" },
	};
}

function createCorsOptions(allowedOrigins) {
	return {
		origin: (origin, cb) => {
			// Same-origin requests (no Origin header) and explicit allowlist matches pass.
			if (isAllowedOrigin(origin, allowedOrigins)) {
				return cb(null, true);
			}
			return cb(new Error(`CORS: origin ${origin} not allowed`));
		},
		credentials: true,
	};
}

function registerSecurityMiddleware(app, {
	corsImpl = cors,
	env = process.env,
	helmetImpl = helmet,
} = {}) {
	if (!app || typeof app.use !== "function") {
		throw new Error("registerSecurityMiddleware requires an Express app");
	}
	if (typeof helmetImpl !== "function") {
		throw new Error("registerSecurityMiddleware requires helmet");
	}
	if (typeof corsImpl !== "function") {
		throw new Error("registerSecurityMiddleware requires cors");
	}

	const allowedOrigins = resolveAllowedOrigins(env);
	app.use(helmetImpl(createHelmetOptions()));
	app.use(corsImpl(createCorsOptions(allowedOrigins)));

	return { allowedOrigins };
}

module.exports = {
	CONTENT_SECURITY_POLICY_DIRECTIVES,
	DEFAULT_ALLOWED_ORIGINS,
	createCorsOptions,
	createHelmetOptions,
	isAllowedOrigin,
	registerSecurityMiddleware,
	resolveAllowedOrigins,
};
