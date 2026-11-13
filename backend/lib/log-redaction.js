"use strict";

// Redaction for what the backend writes to its logs (C-9d): the credential patterns of
// secret-redaction.js, plus what a log line carries that a tool output usually does not:
// credentials in a URL's userinfo, secret-bearing query parameters, and bare JWTs (ASAP
// and gateway tokens have no "Bearer " prefix in an error body). Tool-output redaction
// (redactSecrets) is unchanged.

const { redactSecrets } = require("./secret-redaction");

/** @type {Array<{ pattern: RegExp, replacement: string }>} */
const LOG_REDACTIONS = [
	// scheme://user:password@host or scheme://token@host
	{ pattern: /\b([a-z][a-z0-9+.-]*:\/\/)[^/\s?#@"'<>]+@/giu, replacement: "$1[REDACTED]@" },
	// Query or form parameters named like a key, token, signature, password or secret
	{
		pattern: /([?&;](?:api[-_]?key|key|access[-_]?token|refresh[-_]?token|id[-_]?token|token|auth|authorization|sig|signature|password|passwd|secret|client[-_]?secret|session[-_]?token|[a-z]*socket[-_]?token|preview[-_]?token|realtime[-_]?token|x-amz-signature|x-amz-credential|x-amz-security-token)=)[^&\s#"'<>]+/giu,
		replacement: "$1[REDACTED]",
	},
	// A JSON Web Token: three base64url segments, the header starting with `{"` (eyJ).
	{ pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/gu, replacement: "[REDACTED: JWT]" },
];

/**
 * @param {string} text
 * @returns {string}
 */
function redactLogText(text) {
	if (typeof text !== "string" || text.length === 0) {
		return text;
	}
	let result = redactSecrets(text);
	for (const { pattern, replacement } of LOG_REDACTIONS) {
		pattern.lastIndex = 0;
		result = result.replace(pattern, replacement);
	}
	return result;
}

/**
 * A URL as it may appear in a log: origin and path only. Userinfo, query and fragment
 * are dropped, so a signed or keyed URL never reaches the log. Not a URL: redacted text.
 * @param {unknown} value
 * @returns {string}
 */
function redactUrlForLog(value) {
	const text = value instanceof URL ? value.href : String(value ?? "");
	try {
		const url = new URL(text);
		const hidden = url.search || url.hash ? "?[REDACTED]" : "";
		return `${url.protocol}//${url.host}${url.pathname}${hidden}`;
	} catch {
		return redactLogText(text);
	}
}

const MAX_DEPTH = 4;

/**
 * A copy of a log argument with every string redacted. Errors keep their name, code and
 * status; their message and stack are redacted. Other values pass through.
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
function redactForLog(value, depth = 0) {
	if (typeof value === "string") {
		return redactLogText(value);
	}
	if (value instanceof Error) {
		const copy = new Error(redactLogText(value.message));
		copy.name = value.name;
		copy.stack = redactLogText(value.stack ?? `${value.name}: ${value.message}`);
		for (const key of ["code", "status", "statusCode", "type"]) {
			if (key in value) {
				Object.defineProperty(copy, key, { value: /** @type {any} */ (value)[key], enumerable: true });
			}
		}
		if (value.cause !== undefined && depth < MAX_DEPTH) {
			copy.cause = redactForLog(value.cause, depth + 1);
		}
		return copy;
	}
	if (value instanceof URL) {
		return redactUrlForLog(value);
	}
	if (depth >= MAX_DEPTH || value === null || typeof value !== "object") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => redactForLog(item, depth + 1));
	}
	const proto = Object.getPrototypeOf(value);
	if (proto !== Object.prototype && proto !== null) {
		return value;
	}
	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, redactForLog(item, depth + 1)]),
	);
}

module.exports = {
	redactForLog,
	redactLogText,
	redactUrlForLog,
};
