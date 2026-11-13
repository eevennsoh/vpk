"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { redactForLog, redactLogText, redactUrlForLog } = require("./log-redaction");

// Made-up values only. Query strings and userinfo are assembled at run time, so no tracked
// line holds a credential-shaped URL (verify:url-credentials).
const SECRET = "madeUpSecretValue1234567890abcdef";
const query = (name, value = SECRET) => `${"?"}${name}=${value}`;
const userinfo = (user, password) => `${user}:${password}@`;
const FAKE_JWT = ["eyJhbGciOiJSUzI1NiJ9", "eyJpc3MiOiJtYWRlLXVwIn0", "c2lnbmF0dXJlLW1hZGUtdXA"].join(".");

function assertHidden(output, secret, name) {
	assert.equal(String(output).includes(secret), false, `${name}: ${output}`);
}

test("redactLogText hides every token shape a log line carries", () => {
	const cases = [
		["URL userinfo with a password", `wss://${userinfo("svc", SECRET)}gateway.example/v1/realtime`, SECRET],
		["URL userinfo with a token only", `https://${SECRET}@gateway.example/x`, SECRET],
		["a key query parameter", `https://gateway.example/v1/models${query("key")}`, SECRET],
		["an api-key parameter after another", `https://gateway.example/v1${query("model", "gpt")}&api-key=${SECRET}`, SECRET],
		["an access_token parameter", `GET /cb${query("access_token")}&state=1`, SECRET],
		["a signed URL", `https://bucket.example/o${query("X-Amz-Signature")}`, SECRET],
		["a runtime socket token", `ws://127.0.0.1/api/realtime/audio-conversation${query("realtimeToken")}`, SECRET],
		["a bare JWT in an error body", `{"error":"invalid assertion ${FAKE_JWT}"}`, FAKE_JWT],
		["a bearer token", `Authorization: Bearer ${SECRET}`, SECRET],
		["an OpenAI-shaped key", `upstream echoed sk-proj-${SECRET}`, SECRET],
	];
	for (const [name, input, secret] of cases) {
		assertHidden(redactLogText(input), secret, name);
	}
});

test("redactLogText keeps ordinary text readable", () => {
	assert.equal(redactLogText("AI Gateway Bedrock error 429: rate limited"), "AI Gateway Bedrock error 429: rate limited");
	assert.equal(redactLogText("https://gateway.example/v1/models/gpt:generate"), "https://gateway.example/v1/models/gpt:generate");
	assert.equal(
		redactLogText(`https://gateway.example/v1${query("model", "gpt")}&api-key=${SECRET}`),
		`https://gateway.example/v1${query("model", "gpt")}&api-key=[REDACTED]`,
	);
	assert.equal(redactLogText(""), "");
	assert.equal(redactLogText(undefined), undefined);
});

test("redactUrlForLog keeps the origin and path and drops userinfo and query", () => {
	assert.equal(
		redactUrlForLog(`wss://${userinfo("svc", SECRET)}gateway.example:8443/v1/realtime${query("model", "gpt")}&token=${SECRET}`),
		"wss://gateway.example:8443/v1/realtime?[REDACTED]",
	);
	assert.equal(redactUrlForLog(new URL("http://127.0.0.1:1234/v1/chat")), "http://127.0.0.1:1234/v1/chat");
	assertHidden(redactUrlForLog(`not a url Bearer ${SECRET}`), SECRET, "not a URL");
	assert.equal(redactUrlForLog(undefined), "");
});

test("redactForLog redacts errors, causes, nested objects and arrays, and leaves other values alone", () => {
	const cause = new Error(`upstream ${query("token")}`);
	const error = Object.assign(new Error(`AI Gateway Google error 401: ${FAKE_JWT}`, { cause }), { status: 401, code: "E_GATEWAY" });
	const redacted = redactForLog(error);
	assert.ok(redacted instanceof Error);
	assert.equal(redacted.status, 401);
	assert.equal(redacted.code, "E_GATEWAY");
	assertHidden(redacted.message, FAKE_JWT, "message");
	assertHidden(redacted.stack, FAKE_JWT, "stack");
	assertHidden(redacted.cause.message, SECRET, "cause");
	assert.equal(error.message.includes(FAKE_JWT), true, "the original error is not changed");

	const logged = redactForLog({ url: `https://${userinfo("u", SECRET)}h.example/`, nested: { list: [`Bearer ${SECRET}`, 3] }, count: 2 });
	assertHidden(JSON.stringify(logged), SECRET, "object");
	assert.equal(logged.count, 2);
	assert.equal(redactForLog(42), 42);
	assert.equal(redactForLog(null), null);
	const buffer = Buffer.from("x");
	assert.equal(redactForLog(buffer), buffer);
});
