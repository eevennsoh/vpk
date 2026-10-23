#!/usr/bin/env node
// T3 (ws6 §8, integration K24): secret-scan.mjs detection, no echo, data: URI stripping,
// backend parity and module shape. Fake secrets are assembled at run time so committed
// files never trip secret scanners or push protection.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const MODULE_PATH = path.join(__dirname, "secret-scan.mjs");
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const BACKEND_REDACTION = path.join(REPO_ROOT, "backend", "lib", "secret-redaction.js");

const SAMPLES = {
	"AWS Access Key": () => "AK" + "IA" + "ABCDEFGHIJ234567",
	"OpenAI API Key": () => "sk-" + "proj-" + "a".repeat(24),
	"Anthropic API Key": () => "sk-" + "ant-" + "api03-" + "b".repeat(24),
	"GitHub token": () => "gh" + "p_" + "x".repeat(36),
	"GitHub Fine-Grained PAT": () => "github" + "_pat_" + "A".repeat(30),
	"GitLab PAT": () => "glpat" + "-" + "c".repeat(20),
	"Private Key": () => "-----BEGIN " + "RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----",
	"Database URL": () => "postgres" + "://admin:hunter2pass@db.internal:5432/app",
	"Bearer Token": () => "Authorization: Bear" + "er " + "d".repeat(32),
	"Slack Token": () => "xo" + "xb-" + "1234567890-abcdef",
	"SendGrid API Key": () => "SG" + "." + "e".repeat(22) + "." + "f".repeat(43),
	"Google API Key": () => "AI" + "za" + "g".repeat(35),
	"JWT": () => "ey" + "J" + "h".repeat(12) + ".ey" + "J" + "i".repeat(12) + "." + "j".repeat(12),
	"Credential assignment": () => "pass" + "word = \"" + "k".repeat(14) + "\"",
};

// One sample per backend DEFAULT_SECRET_PATTERNS label; both scanners must detect it.
const BACKEND_SAMPLES = {
	"AWS Access Key": SAMPLES["AWS Access Key"],
	"OpenAI API Key": SAMPLES["OpenAI API Key"],
	"Anthropic API Key": SAMPLES["Anthropic API Key"],
	"GitHub PAT": () => "gh" + "p_" + "y".repeat(36),
	"GitHub App Token": () => "gh" + "s_" + "z".repeat(36),
	"GitHub Fine-Grained PAT": SAMPLES["GitHub Fine-Grained PAT"],
	"GitLab PAT": SAMPLES["GitLab PAT"],
	"Private Key": SAMPLES["Private Key"],
	"Database URL": SAMPLES["Database URL"],
	"Bearer Token": SAMPLES["Bearer Token"],
	"Slack Token": SAMPLES["Slack Token"],
	"SendGrid API Key": SAMPLES["SendGrid API Key"],
};

async function load() {
	return import("./secret-scan.mjs");
}

test("secretPatterns lists the fourteen labels with compilable sources", async () => {
	const { secretPatterns } = await load();
	const patterns = secretPatterns();
	assert.deepEqual(patterns.map(p => p.label).sort(), Object.keys(SAMPLES).sort());
	for (const { source, flags } of patterns) {
		assert.equal(typeof source, "string");
		assert.equal(typeof flags, "string");
		assert.doesNotThrow(() => new RegExp(source, flags));
	}
	assert.notEqual(secretPatterns(), secretPatterns(), "built fresh on every call");
});

test("each pattern detects its runtime-built sample", async () => {
	const { scanSecrets } = await load();
	for (const [label, build] of Object.entries(SAMPLES)) {
		const text = `<p>before</p> ${build()} <p>after</p>`;
		const labels = scanSecrets(text).map(finding => finding.label);
		assert.ok(labels.includes(label), `${label} not detected in ${JSON.stringify(text)}: ${labels.join(", ")}`);
	}
	assert.equal(scanSecrets("API_KEY: 'abcdefghijklmnop'")[0]?.label, "Credential assignment", "credential rule is case-insensitive");
	assert.deepEqual(scanSecrets(""), []);
	assert.deepEqual(scanSecrets(null), []);
	assert.deepEqual(scanSecrets("plain prose with a password field and sk-short"), []);
});

test("findings never echo the secret: previews are four characters plus an ellipsis", async () => {
	const { scanSecrets } = await load();
	for (const build of Object.values(SAMPLES)) {
		const secret = build();
		const findings = scanSecrets(`x ${secret} y`);
		assert.ok(findings.length > 0);
		for (const finding of findings) {
			assert.equal([...finding.preview].length, 5);
			assert.ok(finding.preview.endsWith(String.fromCharCode(8230)));
			assert.ok(!JSON.stringify(finding).includes(secret.slice(4)), "no finding carries the secret body");
			assert.deepEqual(Object.keys(finding).sort(), ["index", "label", "preview"]);
		}
	}
});

test("data: URIs are blanked before matching and offsets stay aligned", async () => {
	const { scanSecrets } = await load();
	const fakeKeyInFont = "AI" + "za" + "Q".repeat(35);
	const font = `@font-face { src: url(data:font/woff2;base64,${fakeKeyInFont}/BBBB+AAAA); }`;
	assert.deepEqual(scanSecrets(font), [], "base64 font data does not fire (V26)");
	assert.equal(scanSecrets(font, { stripDataUris: false })[0]?.label, "Google API Key");

	const token = SAMPLES["GitHub token"]();
	const text = `${font} then ${token}`;
	const [finding] = scanSecrets(text);
	assert.equal(finding.label, "GitHub token");
	assert.equal(finding.index, text.indexOf(token));
	assert.equal(scanSecrets("metadata:" + token)[0]?.label, "GitHub token", "only a real data: scheme is stripped");
});

test("findings are sorted by offset", async () => {
	const { scanSecrets } = await load();
	const text = `${SAMPLES["Slack Token"]()} middle ${SAMPLES["AWS Access Key"]()}`;
	const indexes = scanSecrets(text).map(finding => finding.index);
	assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
});

test("parity: every backend DEFAULT_SECRET_PATTERNS label is detected by both scanners", { skip: !fs.existsSync(BACKEND_REDACTION) && "backend/lib/secret-redaction.js not present (standalone skill)" }, async () => {
	const { scanSecrets } = await load();
	const { DEFAULT_SECRET_PATTERNS, detectSecrets } = require(BACKEND_REDACTION);
	for (const { label } of DEFAULT_SECRET_PATTERNS) {
		const build = BACKEND_SAMPLES[label];
		assert.ok(build, `backend label "${label}" has no sample: add a sample and a skill pattern`);
		const sample = `x ${build()} y`;
		assert.ok(detectSecrets(sample).some(found => found.label === label), `backend does not detect its own ${label} sample`);
		assert.ok(scanSecrets(sample).length > 0, `skill scanner misses backend label ${label}`);
	}
});

test("module shape: export function declarations only, self-contained scanSecrets, no self-matches", async () => {
	const mod = await load();
	const source = fs.readFileSync(MODULE_PATH, "utf8");
	let rest = source;
	for (const fn of Object.values(mod)) {
		const text = fn.toString();
		const at = rest.indexOf(text);
		assert.ok(at >= 0, `function ${fn.name} source not found verbatim`);
		rest = rest.slice(0, at) + rest.slice(at + text.length);
	}
	rest = rest.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\bexport\b/g, "");
	assert.equal(rest.trim(), "");
	assert.doesNotMatch(source, /^\s*import\b/m);
	assert.doesNotMatch(source, /[^\x00-\x7f]/);
	assert.ok(!source.includes("<"));

	const sandbox = vm.createContext({});
	const isolated = vm.runInContext(`(${mod.scanSecrets.toString()})`, sandbox);
	assert.equal(isolated(`x ${SAMPLES["GitHub token"]()}`)[0].label, "GitHub token");

	assert.deepEqual(mod.scanSecrets(source), [], "the module's own text does not match its patterns");
	assert.deepEqual(mod.scanSecrets(mod.secretPatterns().map(p => p.source).join("\n")), []);
});
