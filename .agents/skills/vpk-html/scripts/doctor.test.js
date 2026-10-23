#!/usr/bin/env node
// T5 (ws6 §8, C2): doctor.mjs with injected probes, the read-only guarantee and a CLI smoke
// run with --no-launch. CI has no Chromium binary, so the CLI exit code is not asserted.

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const SKILL_ROOT = path.join(__dirname, "..");
const FAKE_CHROME = "/fake/chromium/chrome";
const C2_IDS = ["node", "skill-files", "fonts", "styles-sync", "playwright", "chromium", "chromium-launch", "git", "gh", "twg", "artifact-scripts", "ffmpeg", "ffprobe"];

async function load() {
	return import("./doctor.mjs");
}

function makeDeps({ missing = [], failAuth = false, failWhoami = false, launchError = null, playwright = true, fontBytes = null, env = {}, nodeVersion = "24.1.0", calls = [] } = {}) {
	const real = { existsSync: fs.existsSync, readFileSync: fs.readFileSync, readdirSync: fs.readdirSync };
	return {
		fs: {
			...real,
			existsSync: file => file === FAKE_CHROME || real.existsSync(file),
			readFileSync: (file, encoding) => (fontBytes && String(file).endsWith(".woff2") ? fontBytes : real.readFileSync(file, encoding)),
		},
		execFile: async (command, args) => {
			calls.push([command, ...args]);
			const name = command.endsWith("/.local/bin/twg") ? "twg-local" : command;
			if (missing.includes(name)) return { code: 127, stdout: "", stderr: `spawn ${command} ENOENT` };
			if (command === "gh" && args[0] === "auth") return failAuth ? { code: 1, stdout: "", stderr: "You are not logged into any GitHub hosts." } : { code: 0, stdout: "Logged in", stderr: "" };
			if (args.includes("whoami")) return failWhoami ? { code: 1, stdout: "", stderr: "401 Unauthorized" } : { code: 0, stdout: "{}", stderr: "" };
			return { code: 0, stdout: `${path.basename(command)} version 9.9.9\n`, stderr: "" };
		},
		importPlaywright: async () => {
			if (!playwright) throw new Error("Cannot find package '@playwright/test' imported from doctor.mjs");
			return { chromium: { executablePath: () => FAKE_CHROME }, version: "1.62.1" };
		},
		launchProbe: async ({ timeout }) => {
			assert.equal(timeout, 15000);
			if (launchError) throw new Error(launchError);
		},
		checkStyleSource: () => [],
		env,
		repoRoot: null,
		skillRoot: SKILL_ROOT,
		homedir: "/home/fake",
		nodeVersion,
	};
}

const byId = report => Object.fromEntries(report.checks.map(check => [check.id, check]));

test("all probes ok: ok true, exit 0, exactly the C2 ids in order", async () => {
	const { collectDoctorReport, runDoctor, DOCTOR_CHECK_IDS } = await load();
	assert.deepEqual([...DOCTOR_CHECK_IDS], C2_IDS);
	const report = await collectDoctorReport({}, makeDeps());
	assert.equal(report.ok, true, JSON.stringify(report.checks.filter(check => check.status !== "ok"), null, 2));
	assert.equal(report.skill, "vpk-html");
	assert.equal(report.node, "24.1.0");
	assert.deepEqual(report.checks.map(check => check.id), C2_IDS);
	for (const check of report.checks) {
		assert.deepEqual(Object.keys(check).filter(key => !["id", "label", "required", "status", "version", "purpose", "detail", "fix"].includes(key)), []);
		assert.ok(["ok", "missing", "degraded", "skipped"].includes(check.status));
		assert.equal(typeof check.required, "boolean");
	}
	assert.equal(byId(report)["artifact-scripts"].status, "missing", "no repo root");
	assert.equal(byId(report)["artifact-scripts"].required, false);
	const lines = [];
	assert.equal(await runDoctor({}, { ...makeDeps(), log: line => lines.push(line) }), 0);
	assert.match(lines.join("\n"), /OK: core render and verification ready$/);
	assert.match(lines.join("\n"), /^OPTIONAL-MISSING\s+artifact-scripts/m);
});

test("missing playwright is a required failure with the pnpm install fix", async () => {
	const { collectDoctorReport, runDoctor } = await load();
	const report = await collectDoctorReport({}, makeDeps({ playwright: false }));
	assert.equal(report.ok, false);
	assert.equal(byId(report).playwright.status, "missing");
	assert.equal(byId(report).playwright.fix, "pnpm install");
	assert.equal(byId(report).chromium.status, "missing");
	const lines = [];
	assert.equal(await runDoctor({}, { ...makeDeps({ playwright: false }), log: line => lines.push(line) }), 1);
	assert.match(lines.join("\n"), /ERROR: core capability missing: --verify, --pdf and gates will fail/);
});

test("a sandboxed launch failure gets the sandbox hint; other launch failures suggest a reinstall", async () => {
	const { collectDoctorReport } = await load();
	for (const message of ["browserType.launch: Target page, context or browser has been closed", "spawn EPERM", "Operation not permitted"]) {
		const launch = byId(await collectDoctorReport({}, makeDeps({ launchError: message })))["chromium-launch"];
		assert.equal(launch.status, "missing");
		assert.equal(launch.fix, "Chromium could not start: inside an OS sandbox, run Chromium commands unsandboxed");
	}
	const other = byId(await collectDoctorReport({}, makeDeps({ launchError: "Executable doesn't exist" })))["chromium-launch"];
	assert.match(other.fix, /reinstall Chromium/);
	const skipped = await collectDoctorReport({ launch: false }, makeDeps({ launchError: "would fail" }));
	assert.equal(byId(skipped)["chromium-launch"].status, "skipped");
	assert.equal(skipped.ok, true, "skipped counts as passing");
});

test("a font that drifts from MANIFEST.md is degraded", async () => {
	const { collectDoctorReport } = await load();
	const report = await collectDoctorReport({}, makeDeps({ fontBytes: Buffer.from("not the committed font") }));
	assert.equal(byId(report).fonts.status, "degraded");
	assert.match(byId(report).fonts.detail, /differs from MANIFEST\.md/);
	assert.match(byId(report).fonts.fix, /ensure-fonts\.mjs/);
	assert.equal(byId(await collectDoctorReport({}, makeDeps())).fonts.status, "ok");
});

test("optional tools: a missing gh keeps ok; auth probes run only with --online; twg falls back to ~/.local/bin", async () => {
	const { collectDoctorReport } = await load();
	const noGh = await collectDoctorReport({}, makeDeps({ missing: ["gh"] }));
	assert.equal(noGh.ok, true);
	assert.equal(byId(noGh).gh.status, "missing");

	const offlineCalls = [];
	await collectDoctorReport({}, makeDeps({ failAuth: true, calls: offlineCalls }));
	assert.ok(!offlineCalls.some(call => call.includes("auth") || call.includes("whoami")), "offline by default");

	const tokenHint = byId(await collectDoctorReport({ online: true }, makeDeps({ failAuth: true, env: { GITHUB_TOKEN: "x" } }))).gh;
	assert.equal(tokenHint.status, "degraded");
	assert.match(tokenHint.fix, /GITHUB_TOKEN env var overrides stored auth; run `env -u GITHUB_TOKEN gh auth status`/);
	assert.equal(byId(await collectDoctorReport({ online: true }, makeDeps({ failAuth: true }))).gh.fix, "gh auth login");

	const local = byId(await collectDoctorReport({ online: true }, makeDeps({ missing: ["twg"], failWhoami: true }))).twg;
	assert.equal(local.status, "degraded");
	assert.match(local.detail, /401 Unauthorized/);
	assert.equal(local.fix, "twg --env prod login --site hello");
	assert.equal(byId(await collectDoctorReport({}, makeDeps({ missing: ["twg", "twg-local"] }))).twg.status, "missing");
	assert.equal(byId(await collectDoctorReport({}, makeDeps({ nodeVersion: "20.11.0" }))).node.status, "missing");
});

test("read-only: a write-throwing fs proxy raises nothing", async () => {
	const { collectDoctorReport } = await load();
	const deps = makeDeps();
	const writes = new Set(["writeFileSync", "appendFileSync", "mkdirSync", "rmSync", "unlinkSync", "renameSync", "copyFileSync", "openSync", "writeSync", "cpSync"]);
	deps.fs = new Proxy(deps.fs, {
		get(target, key) {
			if (writes.has(key)) return () => { throw new Error(`doctor attempted fs.${String(key)}`); };
			return target[key];
		},
	});
	const report = await collectDoctorReport({}, deps);
	assert.equal(report.ok, true);
});

test("CLI smoke: --json --no-launch prints the C2 shape and ok matches the exit code", async t => {
	const run = script => spawnSync(process.execPath, [script, ...(script.endsWith("build.mjs") ? ["--doctor"] : []), "--json", "--no-launch"], { encoding: "utf8", env: { ...process.env, OPENSSL_CONF: "/dev/null" }, timeout: 60_000 });
	const check = result => {
		const report = JSON.parse(result.stdout);
		assert.deepEqual(report.checks.map(item => item.id), C2_IDS);
		assert.equal(report.checks.find(item => item.id === "chromium-launch").status, "skipped");
		assert.equal(report.ok, result.status === 0);
	};
	check(run(path.join(__dirname, "doctor.mjs")));
	const build = path.join(__dirname, "build.mjs");
	await t.test("build.mjs --doctor", { skip: !fs.readFileSync(build, "utf8").includes("--doctor") && "build.mjs --doctor lands at B1 (integration §3)" }, () => check(run(build)));
});
