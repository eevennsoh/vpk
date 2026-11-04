const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const launcher = path.join(__dirname, "vpk-ai-api.sh");

function fixture(t) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-ai-api-"));
	const bin = path.join(root, "caller-bin");
	const config = path.join(root, ".config/litellm-proximity");
	fs.mkdirSync(bin, { recursive: true });
	fs.mkdirSync(path.join(config, "bin"), { recursive: true });
	const write = (file, content) => { fs.writeFileSync(file, content, { mode: 0o755 }); };
	write(path.join(config, "defaults.env"), 'GPT_MODEL="gpt-test"\nGPT_EFFORT_DEFAULT="medium"\nCLAUDE_EFFORT_DEFAULT="medium"\nALIAS_sonnet="claude-sonnet-5-5"\n');
	write(path.join(config, "master_key"), "fixture-secret-do-not-print");
	write(path.join(config, "bin/vpk-remote-preflight.js"), 'require("node:fs").writeFileSync(process.env.PROBE_MARKER,"probe");process.exit(process.env.PROBE_FAIL ? 1 : 0);');
	write(path.join(bin, "curl"), '#!/bin/sh\nprintf curl > "$CURL_MARKER"\nexit 0\n');
	write(path.join(bin, "codex"), '#!/usr/bin/env node\nconsole.log(JSON.stringify({args:process.argv.slice(2),key:process.env.LITELLM_KEY ? "set" : "unset",stdin:process.argv.at(-1)==="-" ? require("node:fs").readFileSync(0,"utf8") : ""}));process.exit(Number(process.env.WORKER_EXIT || 0));\n');
	write(path.join(bin, "open"), '#!/bin/sh\nprintf "%s" "$1" > "$OPEN_MARKER"\n');
	write(path.join(bin, "osascript"), '#!/bin/sh\nexit 0\n');
	const env = { ...process.env, HOME: root, HERDR_ENV: "0", PATH: `${bin}:${path.dirname(process.execPath)}:/usr/bin:/bin`, OPEN_MARKER: path.join(root, "opened"), PROBE_MARKER: path.join(root, "probed"), CURL_MARKER: path.join(root, "curl-used") };
	delete env.LITELLM_KEY;
	delete env.PROBE_FAIL;
	delete env.WORKER_EXIT;
	t.after(() => {
		if (fs.existsSync(env.OPEN_MARKER)) {
			const script = fs.readFileSync(env.OPEN_MARKER, "utf8");
			fs.rmSync(path.dirname(script), { recursive: true, force: true });
		}
		fs.rmSync(root, { recursive: true, force: true });
	});
	return { root, bin, config, env, run: (args, extraEnv = {}) => spawnSync("/bin/bash", [launcher, ...args], { cwd: root, env: { ...env, ...extraEnv }, encoding: "utf8" }) };
}

test("model IDs cannot evaluate Bash array subscripts during alias resolution", (t) => {
	const f = fixture(t);
	const result = f.run(["codex", "--model", "claude-opus-5-5[$(touch pwned)]", "--dry-run"]);
	assert.notEqual(result.status, 0);
	assert.equal(fs.existsSync(path.join(f.root, "pwned")), false);
	assert.equal(fs.existsSync(f.env.CURL_MARKER), false);
});

test("full Claude IDs with a context suffix are accepted without alias evaluation", (t) => {
	const f = fixture(t);
	const result = f.run(["codex", "--model", "claude-opus-5-5[1m]", "--dry-run"]);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout.includes("claude-opus-5-5"), true);
});

test("dry-run does not contact services, read credentials, probe, or open windows", (t) => {
	const f = fixture(t);
	fs.rmSync(path.join(f.config, "master_key"));
	const result = f.run(["codex", "--model", "sonnet", "--new-window", "--dry-run"]);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(fs.existsSync(f.env.CURL_MARKER), false);
	assert.equal(fs.existsSync(f.env.PROBE_MARKER), false);
	assert.equal(fs.existsSync(f.env.OPEN_MARKER), false);
	assert.equal(result.stdout.includes("fixture-secret"), false);
});

test("new windows preserve Codex and Node resolution without embedding the key", (t) => {
	const f = fixture(t);
	const result = f.run(["codex", "--model", "sonnet", "--fork", "fixture-session", "--new-window"]);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(fs.existsSync(f.env.PROBE_MARKER), true);
	const script = fs.readFileSync(f.env.OPEN_MARKER, "utf8");
	const content = fs.readFileSync(script, "utf8");
	assert.equal(content.includes("fixture-secret-do-not-print"), false);
	assert.equal(content.includes(path.join(f.bin, "codex")), true);
	assert.equal(fs.statSync(script).mode & 0o777, 0o700);
	const child = spawnSync("/bin/bash", [script], { encoding: "utf8", env: { ...f.env, PATH: "/usr/bin:/bin" } });
	assert.equal(child.status, 0, child.stderr);
	const output = JSON.parse(child.stdout);
	assert.equal(output.key, "set");
	assert.equal(output.args[0], "fork");
	assert.equal(output.args.at(-1), "fixture-session");
	assert.equal(output.args.includes("claude-sonnet-5-5"), true);
});

test("failed readiness prevents a new window or a worker from being launched", (t) => {
	const f = fixture(t);
	const result = f.run(["codex", "--model", "sonnet", "--new-window"], { PROBE_FAIL: "1" });
	assert.notEqual(result.status, 0);
	assert.equal(fs.existsSync(f.env.OPEN_MARKER), false);
	assert.equal(result.stderr.includes("no session launched"), true);
});

test("a stopped translator is started before the model probe and worker", (t) => {
	const f = fixture(t);
	const started = path.join(f.root, "translator-started");
	fs.writeFileSync(path.join(f.bin, "curl"), '#!/bin/sh\ntest -f "$START_MARKER"\n', { mode: 0o755 });
	fs.writeFileSync(path.join(f.config, "start.sh"), '#!/bin/sh\nsleep 0.1\ntouch "$START_MARKER"\n', { mode: 0o755 });
	const result = f.run(["codex", "--model", "sonnet"], { START_MARKER: started });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(fs.existsSync(started), true);
	assert.equal(fs.existsSync(f.env.PROBE_MARKER), true);
	assert.equal(JSON.parse(result.stdout).args.includes("claude-sonnet-5-5"), true);
});

test("a fork with a task preserves SESSION_ID before PROMPT", (t) => {
	const f = fixture(t);
	const result = f.run(["codex", "--model", "sonnet", "--fork", "fixture-session", "--new-window", "--", "Run /vpk-remote audit these charts"]);
	assert.equal(result.status, 0, result.stderr);
	const script = fs.readFileSync(f.env.OPEN_MARKER, "utf8");
	const child = spawnSync("/bin/bash", [script], { env: f.env, encoding: "utf8" });
	assert.equal(child.status, 0, child.stderr);
	assert.deepEqual(JSON.parse(child.stdout).args.slice(-2), ["fixture-session", "Run /vpk-remote audit these charts"]);
});

test("conflicting session and launch modes fail before any network calls", (t) => {
	const f = fixture(t);
	for (const args of [["--resume", "a", "--fork", "b"], ["--new-window", "--background", "task"]]) {
		const result = f.run(["codex", ...args]);
		assert.notEqual(result.status, 0);
	}
	assert.equal(fs.existsSync(f.env.CURL_MARKER), false);
	assert.equal(fs.existsSync(f.env.PROBE_MARKER), false);
});

test("new-window creation uses a portable mktemp directory template", (t) => {
	const f = fixture(t);
	const realMktemp = spawnSync("which", ["mktemp"], { encoding: "utf8" }).stdout.trim();
	fs.writeFileSync(path.join(f.bin, "mktemp"), '#!/bin/sh\ntest "$1" = -d || exit 9\ncase "$2" in *.XXXXXX) ;; *) exit 10 ;; esac\nexec "$REAL_MKTEMP" "$@"\n', { mode: 0o755 });
	const result = f.run(["codex", "--new-window"], { REAL_MKTEMP: realMktemp });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(path.basename(fs.readFileSync(f.env.OPEN_MARKER, "utf8")), "session.command");
});

for (const mode of ["--resume", "--fork"]) {
	test(`background ${mode} puts exec flags before fork and reads the brief from stdin`, async (t) => {
		const f = fixture(t);
		const result = f.run(["codex", "--model", "sonnet", mode, "fixture-session", "--background", "fixture fork task"]);
		assert.equal(result.status, 0, result.stderr);
		const runs = path.join(f.config, "runs");
		let output;
		for (let attempt = 0; attempt < 500; attempt++) {
			const file = fs.readdirSync(runs).find((name) => name.endsWith(".log"));
			const text = file ? fs.readFileSync(path.join(runs, file), "utf8") : "";
			if (text.includes("\n--- exit")) { output = JSON.parse(text.split("\n")[0]); break; }
			await new Promise((resolve) => setTimeout(resolve, 20));
		}
		assert.ok(output, "background fork did not finish");
		assert.equal(output.args[0], "exec");
		assert.deepEqual(output.args.slice(-3), ["fork", "fixture-session", "-"]);
		assert.ok(output.args.indexOf("--sandbox") < output.args.indexOf("fork"));
		assert.ok(output.args.indexOf("-m") < output.args.indexOf("fork"));
		assert.equal(output.stdin.includes("fixture fork task"), true);
	});
}

test("unsupported background last-session forks stop before preflight", (t) => {
	const f = fixture(t);
	for (const mode of ["--continue", "--fork-last"]) {
		const result = f.run(["codex", mode, "--background", "task"]);
		assert.notEqual(result.status, 0);
		assert.equal(result.stderr.includes("explicit --fork or --resume session ID"), true);
	}
	assert.equal(fs.existsSync(f.env.PROBE_MARKER), false);
});

test("background failures still produce an honest summary and preserve the reopen model", async (t) => {
	const f = fixture(t);
	const result = f.run(["codex", "--model", "sonnet", "--background", "fixture task"], { WORKER_EXIT: "7" });
	assert.equal(result.status, 0, result.stderr);
	const runs = path.join(f.config, "runs");
	let summary;
	for (let attempt = 0; attempt < 500; attempt++) {
		const file = fs.readdirSync(runs).find((name) => name.endsWith(".summary.md"));
		if (file) {
			const text = fs.readFileSync(path.join(runs, file), "utf8");
			if (text.includes("reopen:")) { summary = text; break; }
		}
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	assert.ok(summary, "failed worker did not publish a summary");
	assert.equal(summary.includes("no summary returned (exit 7)"), true);
	assert.equal(summary.includes("--model claude-sonnet-5-5 --effort medium"), true);
	assert.equal(summary.includes("fixture-secret-do-not-print"), false);
});
