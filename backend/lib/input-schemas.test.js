"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	atlassianSiteHostSchema,
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
	validateStorageIdParam,
} = require("./input-schemas");

const OVERSIZED = "a".repeat(10_000);

test("storage ids: what the app creates passes, anything that can leave its directory fails", () => {
	const cases = [
		["a UUID", "059d607c-a1aa-48f5-880b-5d824fc5b99f", true],
		["a prefixed id", "rovo-app-1763100000000-k3j9xz", true],
		["an upload id", "upload-1763100000000-abc123", true],
		["the orphaned uploads bucket", "_orphaned", true],
		["path traversal", "../../../..", false],
		["encoded traversal after decoding", "..%2F..", false],
		["a slash", "a/b", false],
		["a backslash", "a\\b", false],
		["an absolute path", "/etc", false],
		["a dot segment", ".", false],
		["a hidden name", ".git", false],
		["a NUL byte", "a\u0000b", false],
		["empty", "", false],
		["oversized", OVERSIZED, false],
		["129 characters", "a".repeat(129), false],
		["a number", 42, false],
		["an object", { id: "a" }, false],
		["null", null, false],
	];
	for (const [name, value, expected] of cases) {
		assert.equal(isStorageId(value), expected, name);
	}
});

test("requireStorageId trims, and throws a public 400 for a hostile id", () => {
	assert.equal(requireStorageId("  thread-1  ", "threadId"), "thread-1");
	for (const value of ["../x", "/abs", 7, undefined]) {
		assert.throws(() => requireStorageId(value, "threadId"), (error) => {
			assert.equal(error.status, 400);
			assert.equal(error.code, "INVALID_INPUT");
			assert.equal(error.publicMessage, "Invalid threadId.");
			return true;
		});
	}
});

test("Atlassian site host: only a *.atlassian.net host receives the API token", () => {
	const cases = [
		["the default site", "product-fabric.atlassian.net", true],
		["another site", "hello.atlassian.net", true],
		["another host", "evil.example", false],
		["a lookalike suffix", "atlassian.net.evil.example", false],
		["userinfo", "evil.example@hello.atlassian.net", false],
		["a path appended", "evil.example/x.atlassian.net", false],
		["a fragment", "evil.example#.atlassian.net", false],
		["a port", "hello.atlassian.net:8443", false],
		["an internal address", "127.0.0.1", false],
		["a URL instead of a host", "https://hello.atlassian.net", false],
		["uppercase", "Hello.atlassian.net", false],
		["oversized", `${OVERSIZED}.atlassian.net`, false],
		["a number", 1, false],
	];
	for (const [name, value, expected] of cases) {
		assert.equal(atlassianSiteHostSchema.safeParse(value).success, expected, name);
	}
});

test("speech transcription options: no provider outside the list and no model path", () => {
	const ok = (value) => speechTranscriptionOptionsSchema.safeParse(value).success;
	assert.equal(ok({}), true);
	assert.equal(ok({ provider: "local-whisper", model: "large-v3", language: "en", mimeType: "audio/webm;codecs=opus" }), true);
	assert.equal(ok({ provider: "google", model: "gemini-2.5-flash", language: "pt-BR", mimeType: "audio/mp4" }), true);
	assert.equal(ok({ provider: "openai-compatible", model: "whisper-1" }), true);
	const hostile = [
		["an unknown provider", { provider: "shell" }],
		["a model path", { provider: "local-whisper", model: "/tmp/evil.pt" }],
		["a relative model path", { model: "../models/evil.pt" }],
		["a model with a slash for the gateway URL", { provider: "google", model: "x/../../admin" }],
		["a model that is a flag", { model: "--help" }],
		["an oversized model", { model: OVERSIZED }],
		["a language with a flag", { language: "en --task translate" }],
		["a wrong type", { provider: ["google"] }],
		["a numeric model", { model: 3 }],
	];
	for (const [name, value] of hostile) {
		assert.equal(ok(value), false, name);
	}
});

test("navigation URLs: http(s), about:blank and bare hosts open; other schemes do not", () => {
	const cases = [
		["https", "https://example.com/a?b=1", { ok: true, url: "https://example.com/a?b=1" }],
		["http to the local app", "http://localhost:3000/rovo", { ok: true, url: "http://localhost:3000/rovo" }],
		["a bare host", "example.com/x", { ok: true, url: "https://example.com/x" }],
		["a bare loopback host and port is the local dev server: http", "localhost:3000/x", { ok: true, url: "http://localhost:3000/x" }],
		["a bare 127.0.0.1", "127.0.0.1:8080", { ok: true, url: "http://127.0.0.1:8080/" }],
		["a bare *.localhost", "vpk.localhost/rovo", { ok: true, url: "http://vpk.localhost/rovo" }],
		["a non-loopback host and port stays https", "example.com:8443/x", { ok: true, url: "https://example.com:8443/x" }],
		["line breaks inside are dropped by the parser", "https://exa\r\nmple.com/a\tb", { ok: true, url: "https://example.com/ab" }],
		["the result is the parsed href", "HTTPS://Example.COM", { ok: true, url: "https://example.com/" }],
		["about:blank", " about:blank ", { ok: true, url: "about:blank" }],
		["a file URL", "file:///etc/passwd", { ok: false, message: "Only http(s) URLs and about:blank can be opened." }],
		["a chrome URL", "chrome://settings", { ok: false, message: "Only http(s) URLs and about:blank can be opened." }],
		["javascript", "javascript:alert(1)", { ok: false, message: "Only http(s) URLs and about:blank can be opened." }],
		["a data URL", "data:text/html,<script>1</script>", { ok: false, message: "Only http(s) URLs and about:blank can be opened." }],
		["view-source", "view-source:https://example.com", { ok: false, message: "Only http(s) URLs and about:blank can be opened." }],
		["an unparsable http URL", "http://", { ok: false, message: "URL is not valid." }],
		["oversized", `https://example.com/${OVERSIZED}`, { ok: false, message: "URL is too long." }],
		["empty", "  ", { ok: false, message: "A non-empty URL is required." }],
		["a wrong type", { href: "https://example.com" }, { ok: false, message: "A non-empty URL is required." }],
	];
	for (const [name, value, expected] of cases) {
		assert.deepEqual(parseNavigationUrl(value), expected, name);
	}
});

function createResponse() {
	const sent = [];
	return {
		sent,
		status(status) {
			sent.push({ status });
			return this;
		},
		json(body) {
			sent.at(-1).body = body;
			return this;
		},
	};
}

test("parseOrReject answers 400 in the shared shape and names the field", () => {
	const res = createResponse();
	assert.deepEqual(parseOrReject(res, speechTranscriptionOptionsSchema, { provider: "google" }, "body"), { provider: "google" });
	assert.equal(parseOrReject(res, speechTranscriptionOptionsSchema, { model: "../x" }, "body"), null);
	assert.deepEqual(res.sent, [{ status: 400, body: { error: "Invalid body.model.", code: "INVALID_INPUT" } }]);
});

test("validateStorageIdParam rejects a hostile route parameter before the route runs", () => {
	const handler = validateStorageIdParam("threadId");
	const res = createResponse();
	let nextCalls = 0;
	handler({}, res, () => {
		nextCalls += 1;
	}, "059d607c-a1aa-48f5-880b-5d824fc5b99f");
	handler({}, res, () => {
		nextCalls += 1;
	}, "../../../..");
	assert.equal(nextCalls, 1);
	assert.deepEqual(res.sent, [{ status: 400, body: { error: "Invalid threadId.", code: "INVALID_INPUT" } }]);
});

test("browser arguments: text that agent-browser would read as an option is rejected", () => {
	const optionLike = ["--help", "--executable-path=/bin/sh", "-h", "--", "-x value", "--session other", " --leading-space", "\t-h", "-5px", "-9a", "-=x", "-=", "-/", "-.", "-é", "-1e3x", "-5 items"];
	const text = ["hello", "-", "-5", "-120", "-0.5", "-.5", "-1e3", "-5 ", "- item", "-\titem", "a --flag", "", "  "];
	for (const value of optionLike) {
		assert.equal(isOptionLikeArgument(value), true, value);
		assert.throws(() => requireBrowserArgument(value, "Text"), (error) => error.status === 400 && error.code === "INVALID_INPUT", value);
	}
	for (const value of text) {
		assert.equal(isOptionLikeArgument(value), false, value);
		assert.equal(requireBrowserArgument(value, "Text"), value);
	}
	assert.throws(() => requireBrowserArgument(7, "Text"), /must be a string/u);
});

test("refs and preview keys match what the UI sends and nothing else", () => {
	for (const ref of ["e1", "@e12", " @e3 "]) assert.equal(typeof requireAgentBrowserRef(ref), "string", ref);
	for (const ref of ["--help", "#email", "e", "@e1 --x", "e1234567", 3, null]) {
		assert.throws(() => requireAgentBrowserRef(ref), (error) => error.status === 400, String(ref));
	}
	for (const key of ["Enter", "Space", "ArrowUp", "PageDown", "Control+a", "Meta+Shift+Tab", "ControlOrMeta+c", "a", "7", "-", "+", "Shift+-", "Control++", "/", ".", "?", "é"]) {
		assert.equal(requirePreviewKey(key), key, key);
	}
	for (const key of ["--help", "-x", "Control+", "Enter --x", "Super+a", "", " ", "\n", "x".repeat(40), {}]) {
		assert.throws(() => requirePreviewKey(key), (error) => error.status === 400, String(key));
	}
});

test("pointer numbers are finite and bounded, whatever JSON carried", () => {
	assert.equal(toBoundedPointerNumber(-1e999), -100_000, "JSON -1e999 is -Infinity");
	assert.equal(toBoundedPointerNumber(1e999), 100_000);
	assert.equal(toBoundedPointerNumber("-1e999"), -100_000);
	assert.equal(toBoundedPointerNumber(Number.NaN), 0);
	assert.equal(toBoundedPointerNumber("abc"), 0);
	assert.equal(toBoundedPointerNumber(undefined), 0);
	assert.equal(toBoundedPointerNumber(-120.4), -120);
	assert.equal(toBoundedPointerNumber(-5, { min: 0 }), 0);
	assert.equal(toBoundedPointerNumber(Infinity, { min: 0 }), 100_000);
	assert.equal(toBoundedPointerNumber(Number.NaN, { min: 0 }), 0);
	for (const value of [-1e999, 1e999, Number.NaN, "x", null, {}]) {
		assert.equal(Number.isFinite(toBoundedPointerNumber(value)), true, String(value));
	}
});
