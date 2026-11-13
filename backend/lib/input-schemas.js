"use strict";

// Schemas for request and socket inputs that reach a file path, a process spawn or an
// outbound fetch/navigation (C-9b). Only those boundaries are validated here; other
// inputs keep their route's own handling. A rejected input is a 400 in the shared error
// shape (backend/middleware/error-response.js).

const { z } = require("zod");

const { ERROR_CODES, PublicHttpError, sendError } = require("../middleware/error-response");

const INVALID_INPUT_CODE = "INVALID_INPUT";

// Thread, upload, document and browser-workspace ids become one path segment. Every id
// the app creates is a UUID or `<prefix>-<ms>-<base36>`; `_orphaned` is the uploads'
// own bucket. No dot, slash or backslash, so no id can leave its directory.
const STORAGE_ID_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$/u;
const storageIdSchema = z.string().regex(STORAGE_ID_PATTERN);

// The Jira host that receives the server's Atlassian API token.
const ATLASSIAN_SITE_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net$/u;
const atlassianSiteHostSchema = z.string().max(253).regex(ATLASSIAN_SITE_HOST_PATTERN);

const TRANSCRIPTION_PROVIDERS = Object.freeze(["google", "openai-compatible", "local-whisper"]);
// A model name, never a path: whisper loads a `--model` that names a file, and the
// Google path puts the model into the gateway URL unencoded.
const TRANSCRIPTION_MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const speechTranscriptionOptionsSchema = z.object({
	provider: z.enum(TRANSCRIPTION_PROVIDERS).optional(),
	model: z.string().regex(TRANSCRIPTION_MODEL_PATTERN).optional(),
	// A language code or name (whisper takes `en` or `English`).
	language: z.string().regex(/^[A-Za-z]{2,16}(?:-[A-Za-z0-9]{2,8}){0,3}$/u).optional(),
	mimeType: z.string().max(128).regex(/^[a-z]+\/[a-z0-9.+-]+(?:;[\w =.-]*)?$/u).optional(),
});

// Where a browser workspace or the Chromium preview may navigate. Local addresses stay
// allowed: the workspaces exist to preview the local app.
const NAVIGATION_URL_MAX_LENGTH = 8192;
const NAVIGATION_PROTOCOLS = new Set(["http:", "https:"]);

const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/iu;
const HTTP_URL_PATTERN = /^https?:\/\//iu;
// `localhost:3000/x` reads as a scheme "localhost:"; it is a host and port.
const HOST_PORT_PATTERN = /^[A-Za-z0-9.-]+:\d{1,5}(?:[/?#]|$)/u;

/**
 * The navigation target the browser gets, as `normalizeChromiumPreviewUrl` produced it
 * before, minus every scheme other than http(s): `about:blank`, an http(s) URL as given,
 * or a bare host (`example.com/x`, `localhost:3000/x`) prefixed with https. `file:`,
 * `chrome:`, `javascript:`, `data:` and the rest are rejected. (Before, `host:port` was
 * passed on without a scheme, like any other scheme.)
 * @param {unknown} value
 * @returns {{ ok: true, url: string } | { ok: false, message: string }}
 */
function parseNavigationUrl(value) {
	if (typeof value !== "string" || !value.trim()) {
		return { ok: false, message: "A non-empty URL is required." };
	}
	const trimmed = value.trim();
	if (trimmed.length > NAVIGATION_URL_MAX_LENGTH) {
		return { ok: false, message: "URL is too long." };
	}
	if (trimmed === "about:blank") {
		return { ok: true, url: trimmed };
	}
	if (SCHEME_PATTERN.test(trimmed) && !HTTP_URL_PATTERN.test(trimmed) && !HOST_PORT_PATTERN.test(trimmed)) {
		return { ok: false, message: "Only http(s) URLs and about:blank can be opened." };
	}
	const url = HTTP_URL_PATTERN.test(trimmed) ? trimmed : `https://${trimmed}`;
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return { ok: false, message: "URL is not valid." };
	}
	if (!NAVIGATION_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) {
		return { ok: false, message: "Only http(s) URLs and about:blank can be opened." };
	}
	return { ok: true, url };
}

// agent-browser reads an option anywhere in its arguments and has no `--` end-of-options
// marker (checked with the installed CLI: `fill @e1 -- --help` prints help), so a request
// value that starts like an option would be read as one, also after leading whitespace.
// A `-` followed by any non-space character counts, unless the whole value is a number:
// "-", "-5", "-0.5" and "- item" are text; "-x", "--help", "-5px" and "  -x" are refused.
const OPTION_START = /^-\S/u;
const NUMBER_ARGUMENT = /^-(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu;
// A ref from an agent-browser snapshot: `e12` or `@e12`.
const AGENT_BROWSER_REF_PATTERN = /^@?e\d{1,6}$/u;
// A key the Chromium preview sends: a named key, or one printable character (letters,
// digits, punctuation such as `-` and `+`), with modifiers: `Enter`, `Control+a`, `Shift+-`.
const PREVIEW_KEY_PATTERN = /^(?:(?:ControlOrMeta|Control|Meta|Alt|Shift)\+)*(?:[A-Za-z][A-Za-z0-9]{0,15}|[^\p{Cc}\p{Cs}\p{Z}])$/u;
// Wheel deltas and pointer coordinates go to agent-browser as numbers; JSON allows
// `-1e999`, which is -Infinity, so they are bounded (provisional bound).
const MAX_POINTER_MAGNITUDE = 100_000;

function isOptionLikeArgument(value) {
	if (typeof value !== "string") {
		return false;
	}
	const start = value.trimStart();
	return OPTION_START.test(start) && !NUMBER_ARGUMENT.test(start.trimEnd());
}

/**
 * A finite integer within ±MAX_POINTER_MAGNITUDE (and at least `min`); anything that is not
 * a number becomes `min` or 0.
 * @param {unknown} value
 * @param {{ min?: number }} [options]
 * @returns {number}
 */
function toBoundedPointerNumber(value, { min = -MAX_POINTER_MAGNITUDE } = {}) {
	const number = Number(value);
	if (Number.isNaN(number)) {
		return Math.max(min, 0);
	}
	return Math.round(Math.min(MAX_POINTER_MAGNITUDE, Math.max(min, number)));
}

/**
 * A request value that goes into agent-browser's arguments, or a 400.
 * @param {unknown} value
 * @param {string} label
 * @returns {string}
 */
function requireBrowserArgument(value, label) {
	if (typeof value !== "string") {
		throw createInvalidInputError(`${label} must be a string.`);
	}
	if (isOptionLikeArgument(value)) {
		throw createInvalidInputError(`${label} cannot start like a command-line option.`);
	}
	return value;
}

/** @param {unknown} ref */
function requireAgentBrowserRef(ref) {
	const value = typeof ref === "string" ? ref.trim() : ref;
	if (typeof value !== "string" || !AGENT_BROWSER_REF_PATTERN.test(value)) {
		throw createInvalidInputError("An accessibility ref like @e12 is required.");
	}
	return value;
}

/** @param {unknown} key */
function requirePreviewKey(key) {
	const value = typeof key === "string" ? key.trim() : key;
	if (typeof value !== "string" || !PREVIEW_KEY_PATTERN.test(value)) {
		throw createInvalidInputError("A keyboard key like Enter or Control+a is required.");
	}
	return value;
}

function isStorageId(value) {
	return typeof value === "string" && STORAGE_ID_PATTERN.test(value);
}

function createInvalidInputError(message) {
	return new PublicHttpError(400, INVALID_INPUT_CODE, message);
}

/**
 * Returns the id or throws a 400 error. Used where an id becomes a path segment.
 * @param {unknown} value
 * @param {string} label
 */
function requireStorageId(value, label) {
	const candidate = typeof value === "string" ? value.trim() : value;
	if (!isStorageId(candidate)) {
		throw createInvalidInputError(`Invalid ${label}.`);
	}
	return /** @type {string} */ (candidate);
}

/**
 * Parses `value` with `schema`; on failure answers 400 and returns null.
 * @template T
 * @param {import("express").Response} res
 * @param {import("zod").ZodType<T>} schema
 * @param {unknown} value
 * @param {string} label
 * @returns {T | null}
 */
function parseOrReject(res, schema, value, label) {
	const result = schema.safeParse(value);
	if (result.success) {
		return result.data;
	}
	const field = result.error.issues[0]?.path?.join(".");
	sendError(res, 400, INVALID_INPUT_CODE, `Invalid ${field ? `${label}.${field}` : label}.`);
	return null;
}

/**
 * Express `router.param` handler: a route parameter that becomes a path segment.
 * @param {string} label
 */
function validateStorageIdParam(label) {
	return (_req, res, next, value) => {
		if (!isStorageId(value)) {
			return sendError(res, 400, INVALID_INPUT_CODE, `Invalid ${label}.`);
		}
		return next();
	};
}

module.exports = {
	ATLASSIAN_SITE_HOST_PATTERN,
	ERROR_CODES,
	INVALID_INPUT_CODE,
	NAVIGATION_URL_MAX_LENGTH,
	STORAGE_ID_PATTERN,
	TRANSCRIPTION_PROVIDERS,
	atlassianSiteHostSchema,
	createInvalidInputError,
	isOptionLikeArgument,
	isStorageId,
	parseNavigationUrl,
	requireAgentBrowserRef,
	requireBrowserArgument,
	requirePreviewKey,
	toBoundedPointerNumber,
	parseOrReject,
	requireStorageId,
	speechTranscriptionOptionsSchema,
	storageIdSchema,
	validateStorageIdParam,
};
