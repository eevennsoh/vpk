const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { collectDoctorReport, formatDoctorReport, main } = require("./doctor.js");

const REPO = "/repo/worktree";

function fakes(overrides = {}) {
	return {
		repoRoot: REPO,
		envFileExists: (name) => name === ".env.local",
		getPortInfo: () => ({ worktreeName: "feature-x", slot: 2, frontendBase: 3040, backendBase: 8120, rovoBase: 8040 }),
		logFile: "/repo/worktree/output/logs/worktree/dev.log",
		preflight: () => ({ failures: [], warnings: [], nodeVersion: "v24.0.0", pnpm: { version: "11.25.0" }, packageManager: "pnpm@11.25.0+sha512.abc" }),
		readPortFile: (name) => ({ ".dev-frontend-port": "3040", ".dev-backend-port": "8120" })[name] ?? null,
		requestHealth: async () => ({
			status: 200,
			error: "",
			body: JSON.stringify({
				status: "OK",
				envCheck: { ASAP_PRIVATE_KEY: "SET", ROVO_PORT: "MISSING" },
				llmRouting: { aiGatewayConfig: { AI_GATEWAY_URL: "SET", AI_GATEWAY_CLOUD_ID_KIND: "UUID", OPENAI_REALTIME_MODEL: "model-value-from-env" } },
			}),
		}),
		stack: async () => ({ ok: true, origin: "https://feature-x.vpk.localhost", frontendListening: true, frontendStatus: 200, backendListening: true }),
		tmuxSessions: () => [
			{ name: "vpk-dev-feature-x", path: REPO },
			{ name: "vpk-dev-other", path: "/repo/other" },
		],
		measureNext: () => ({ totalBytes: 11 * 1024 ** 3, devOutputBytes: 6.3 * 1024 ** 3, devCacheBytes: 4.4 * 1024 ** 3, devOtherBytes: 0, buildCacheBytes: 0, buildOutputBytes: 0 }),
		...overrides,
	};
}

test("a ready worktree reports ok with its ports, its own tmux session and SET/MISSING settings only", async () => {
	const report = await collectDoctorReport(fakes());
	assert.equal(report.ok, true);
	assert.deepEqual(report.ports, {
		worktreeName: "feature-x",
		slot: 2,
		reserved: { frontend: 3040, backend: 8120, rovo: 8040 },
		running: { frontend: "3040", backend: "8120" },
	});
	assert.deepEqual(report.stack.tmuxSessions, ["vpk-dev-feature-x"]);
	assert.equal(report.preflight.packageManager, "pnpm@11.25.0");
	assert.deepEqual(report.env, {
		files: { ".env.local": "present", ".env": "absent" },
		settings: { ASAP_PRIVATE_KEY: "SET", ROVO_PORT: "MISSING", AI_GATEWAY_URL: "SET" },
		settingsSource: "/api/health",
	});
	const text = formatDoctorReport(report);
	const json = JSON.stringify(report);
	for (const output of [text, json]) {
		assert.equal(output.includes("model-value-from-env"), false, "no value from the environment is printed");
	}
	assert.match(text, /^ok {3}health {5}\/api\/health OK$/mu);
	assert.match(text, /^ {5}\.next {6}11\.0 GiB: dev output 6\.3 GiB, dev cache 4\.4 GiB, build cache 0\.0 GiB, build output 0\.0 GiB$/mu);
	assert.match(text, /^ {7}ASAP_PRIVATE_KEY: SET$/mu);
});

test("with no backend only env file presence is known, and nothing opens an env file", async (t) => {
	const readFileSync = fs.readFileSync;
	const opened = [];
	t.mock.method(fs, "readFileSync", (file, ...rest) => {
		opened.push(String(file));
		return readFileSync(file, ...rest);
	});
	const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-env-"));
	t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
	fs.writeFileSync(path.join(repoRoot, ".env.local"), "FIXTURE_SECRET=do-not-print\n");
	const { envFileExists: _fake, ...rest } = fakes({
		stack: async () => ({ ok: false, origin: "", frontendListening: false, frontendStatus: 0, backendListening: false }),
		tmuxSessions: () => [],
	});
	const report = await collectDoctorReport({ ...rest, repoRoot });

	assert.equal(report.ok, false);
	assert.deepEqual(report.env.files, { ".env.local": "present", ".env": "absent" });
	assert.equal(report.env.settings, null);
	assert.equal(JSON.stringify(report).includes("do-not-print"), false);
	assert.match(report.env.settingsSource, /only file presence is known/u);
	assert.deepEqual(report.health, { ok: false, status: null, error: "no origin" });
	assert.deepEqual(opened.filter((file) => /(^|\/)\.env/u.test(file)), []);
	const text = formatDoctorReport(report);
	assert.match(text, /^FAIL stack {6}no origin; tmux none; frontend not listening$/mu);
	assert.match(text, /^next {3}pnpm run dev:tmux:start$/mu);
});

test("a backend that answers without JSON fails health and reports no settings", async () => {
	const report = await collectDoctorReport(fakes({ requestHealth: async () => ({ status: 502, error: "", body: "<html>Bad gateway</html>" }) }));
	assert.equal(report.ok, false);
	assert.deepEqual(report.health, { ok: false, status: 502, error: "response was not JSON" });
	assert.equal(report.env.settings, null);
});

test("doctor rejects an unknown argument before collecting anything", async (t) => {
	const previous = process.exitCode;
	t.after(() => {
		process.exitCode = previous;
	});
	const writes = [];
	t.mock.method(process.stderr, "write", (chunk) => {
		writes.push(String(chunk));
		return true;
	});
	await main(["--yaml"]);
	assert.equal(process.exitCode, 2);
	assert.match(writes.join(""), /Usage: pnpm run doctor \[--json\]/u);
});
