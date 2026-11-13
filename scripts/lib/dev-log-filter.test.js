const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createCappedWriter, createLineFilter, maskSecrets } = require("./dev-log-filter.js");

const FILTER = path.join(__dirname, "dev-log-filter.js");
// Synthetic values only; none is a real credential.
const FAKE = "abcd1234efgh5678ijkl9012mnop3456";
const FAKE_JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.c2lnbmF0dXJlZml4dHVyZQ";

test("secret-shaped values are masked and ordinary output is left alone", () => {
	const cases = [
		[`[backend] Authorization: Bearer ${FAKE}`, "[backend] Authorization: [masked]"],
		[`curl -H "authorization: Basic ${FAKE}"`, 'curl -H "authorization: [masked]"'],
		[`Set-Cookie: session=${FAKE}; Path=/`, "Set-Cookie: [masked]"],
		[`  cookie: a=1; b=${FAKE}`, "  cookie: [masked]"],
		[`ROVO_SESSION_TOKEN=${FAKE}`, "ROVO_SESSION_TOKEN=[masked]"],
		[`{"apiKey":"${FAKE}","model":"x"}`, '{"apiKey":"[masked]","model":"x"}'],
		[`client_secret: ${FAKE}`, "client_secret: [masked]"],
		[`token ${FAKE_JWT} ok`, "token [masked] ok"],
		[`key sk-proj-${FAKE}`, "key [masked]"],
		[`GET https://bucket.s3.amazonaws.com/a.png?X-Amz-Signature=${FAKE}&X-Amz-Date=20261113`, "GET https://bucket.s3.amazonaws.com/a.png?X-Amz-Signature=[masked]&X-Amz-Date=20261113"],
		["-----BEGIN RSA PRIVATE KEY-----MIIEow", "-----BEGIN PRIVATE KEY----- [masked]"],
	];
	for (const [line, expected] of cases) assert.equal(maskSecrets(line), expected, line);

	const untouched = [
		"[backend]   ASAP_PRIVATE_KEY: SET",
		"[backend]   AI_GATEWAY_URL: MISSING",
		"[frontend]  GET /jira-team-eu26 200 in 83ms (next.js: 5ms, application-code: 78ms)",
		"[backend] [worktree: a-2b-doctor] Backend base port: 8100",
		"[backend] =============================================================",
		"[frontend] - Local:         http://127.0.0.1:4198",
	];
	for (const line of untouched) assert.equal(maskSecrets(line), line);
});

test("lines are masked whole even when a chunk splits them", () => {
	const written = [];
	const filter = createLineFilter((text) => written.push(text));
	filter.push("first line\nAuthorization: Bear");
	filter.push(`er ${FAKE}\npartial`);
	filter.end();
	assert.equal(written.join(""), "first line\nAuthorization: [masked]\npartial");
});

test("the log stays under its cap and keeps its newest lines behind a marker", (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-log-filter-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const file = path.join(dir, "dev.log");
	const write = createCappedWriter(file, { maxBytes: 2000 });
	for (let index = 0; index < 200; index += 1) write(`line ${String(index).padStart(3, "0")} ${"x".repeat(20)}\n`);

	const text = fs.readFileSync(file, "utf8");
	assert.ok(Buffer.byteLength(text) <= 2000, `${Buffer.byteLength(text)} bytes`);
	const lines = text.trimEnd().split("\n");
	assert.match(lines[0], /^\[dev-log: trimmed to its newest 1 KB at /u);
	assert.equal(lines.at(-1), `line 199 ${"x".repeat(20)}`);
	// Whole lines only after the marker.
	assert.ok(lines.slice(1).every((line) => /^line \d{3} x{20}$/u.test(line)));
});

test("the CLI reads the pane from stdin, masks it and writes the capped file", (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-log-filter-cli-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const file = path.join(dir, "dev.log");
	const result = spawnSync(process.execPath, [FILTER, "--out", file, "--max-bytes", "4096"], {
		input: `[backend] ready\n[backend] Bearer ${FAKE}\n`,
		encoding: "utf8",
	});
	assert.equal(result.status, 0, result.stderr);
	assert.equal(fs.readFileSync(file, "utf8"), "[backend] ready\n[backend] Bearer [masked]\n");
	assert.equal(spawnSync(process.execPath, [FILTER], { input: "", encoding: "utf8" }).status, 1);
});
