const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const WORKTREE_CREATE_HOOK = path.join(__dirname, "worktree-create.sh");
const REPO_ROOT = path.resolve(__dirname, "..", "..");
// The SessionStart hook runs the checkout's own copies of these.
const SESSION_START_FILES = [
	".agents/hooks/setup-worktree.sh",
	"scripts/write-claude-launch-config.js",
	"scripts/lib/worktree-ports.js",
];

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		encoding: "utf8",
		...options,
	});

	assert.equal(
		result.status,
		0,
		[
			`${command} ${args.join(" ")} failed with status ${result.status}`,
			result.stdout,
			result.stderr,
		].join("\n"),
	);

	return result;
}

function createTempGitRepo(t) {
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-create-hook-"));
	const repoRoot = path.join(tempRoot, "repo");
	fs.mkdirSync(repoRoot);

	t.after(() => {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	});

	run("git", ["init"], { cwd: repoRoot });
	fs.writeFileSync(path.join(repoRoot, "README.md"), "# hook fixture\n");
	fs.writeFileSync(
		path.join(repoRoot, ".gitignore"),
		[
			".env*",
			"!*.example",
			"node_modules/",
			".cache/",
			".claude/worktrees/",
			".rovo/worktrees/",
			".codex/worktrees/",
			".cursor/worktrees/",
			"",
		].join("\n"),
	);
	fs.writeFileSync(path.join(repoRoot, "package.json"), '{"private":true}\n');
	fs.writeFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	fs.writeFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "packages:\n  - .\n  - backend\n");
	fs.writeFileSync(path.join(repoRoot, ".env.local.example"), "EXAMPLE_ONLY=true\n");
	fs.mkdirSync(path.join(repoRoot, "backend"), { recursive: true });
	fs.writeFileSync(path.join(repoRoot, "backend", "package.json"), '{"private":true}\n');
	fs.mkdirSync(path.join(repoRoot, ".agents", "hooks", "lib"), { recursive: true });
	fs.copyFileSync(
		path.join(__dirname, "lib", "worktree-bootstrap.sh"),
		path.join(repoRoot, ".agents", "hooks", "lib", "worktree-bootstrap.sh"),
	);
	for (const rel of SESSION_START_FILES) {
		fs.mkdirSync(path.dirname(path.join(repoRoot, rel)), { recursive: true });
		fs.copyFileSync(path.join(REPO_ROOT, rel), path.join(repoRoot, rel));
	}
	run(
		"git",
		[
			"add",
			"README.md",
			".gitignore",
			"package.json",
			"pnpm-lock.yaml",
			"pnpm-workspace.yaml",
			".env.local.example",
			"backend/package.json",
			".agents/hooks/lib/worktree-bootstrap.sh",
			...SESSION_START_FILES,
		],
		{ cwd: repoRoot },
	);
	run("git", ["commit", "-m", "Initial commit"], {
		cwd: repoRoot,
		env: {
			...process.env,
			GIT_AUTHOR_EMAIL: "test@example.com",
			GIT_AUTHOR_NAME: "Test User",
			GIT_COMMITTER_EMAIL: "test@example.com",
			GIT_COMMITTER_NAME: "Test User",
		},
	});

	return { repoRoot, tempRoot };
}

function createPnpmStub(tempRoot, exitCode = 0, { createsNodeModules = false } = {}) {
	const binDir = path.join(tempRoot, "bin");
	const recordPath = path.join(tempRoot, "pnpm-args.log");
	const pnpmPath = path.join(binDir, "pnpm");
	fs.mkdirSync(binDir, { recursive: true });
	fs.writeFileSync(
		pnpmPath,
		[
			"#!/usr/bin/env bash",
			"printf 'CI=%s %s\\n' \"${CI:-}\" \"$*\" >> \"$PNPM_RECORD\"",
			createsNodeModules ? "mkdir -p node_modules/.stub-install" : "",
			`exit ${exitCode}`,
			"",
		].join("\n"),
	);
	fs.chmodSync(pnpmPath, 0o755);

	return { binDir, recordPath };
}

function createCpStub(tempRoot, { cloneExitCode = 0 } = {}) {
	const binDir = path.join(tempRoot, "cp-bin");
	const recordPath = path.join(tempRoot, "cp-args.log");
	const cpPath = path.join(binDir, "cp");
	fs.mkdirSync(binDir, { recursive: true });
	fs.writeFileSync(
		cpPath,
		[
			"#!/usr/bin/env bash",
			"if [ \"$1\" = \"-c\" ]; then",
			"  printf '%s\\n' \"$*\" >> \"$CP_RECORD\"",
			`  if [ ${cloneExitCode} -ne 0 ]; then exit ${cloneExitCode}; fi`,
			"  shift",
			"  exec /bin/cp \"$@\"",
			"fi",
			"exec /bin/cp \"$@\"",
			"",
		].join("\n"),
	);
	fs.chmodSync(cpPath, 0o755);

	return { binDir, recordPath };
}

function runWorktreeCreateHook(repoRoot, payload, env = {}) {
	return spawnSync("bash", [WORKTREE_CREATE_HOOK], {
		cwd: repoRoot,
		encoding: "utf8",
		input: JSON.stringify(payload),
		env: {
			...process.env,
			...env,
		},
	});
}

// Mirrors .claude/settings.json: the command cds to CLAUDE_PROJECT_DIR and the
// session's cwd arrives in the JSON payload on stdin.
function runSessionStartHook({ claudeProjectDir, sessionCwd, env = {} }) {
	return spawnSync("bash", [path.join(sessionCwd, ".agents", "hooks", "setup-worktree.sh")], {
		cwd: claudeProjectDir,
		encoding: "utf8",
		input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: sessionCwd }),
		env: {
			...process.env,
			CLAUDE_PROJECT_DIR: claudeProjectDir,
			...env,
		},
	});
}

function inProgressMarker(checkout) {
	const gitDir = run("git", ["rev-parse", "--absolute-git-dir"], { cwd: checkout }).stdout.trim();
	return path.join(gitDir, "vpk-bootstrap-in-progress");
}

function readLaunchPorts(checkout) {
	const launchPath = path.join(checkout, ".claude", "launch.json");
	if (!fs.existsSync(launchPath)) return null;
	return JSON.parse(fs.readFileSync(launchPath, "utf8")).configurations.map((entry) => entry.port);
}

test("WorktreeCreate creates the requested worktree while keeping stdout path-only", (t) => {
	const { repoRoot, tempRoot } = createTempGitRepo(t);
	const { binDir, recordPath } = createPnpmStub(tempRoot);
	const worktreeDir = path.join(tempRoot, "agent-worktree");
	fs.writeFileSync(path.join(repoRoot, ".env.local"), "ROVO_SESSION_TOKEN=test-token\n");
	fs.writeFileSync(path.join(repoRoot, ".env.development"), "NEXT_PUBLIC_FIXTURE=true\n");
	fs.mkdirSync(path.join(repoRoot, "nested"), { recursive: true });
	fs.writeFileSync(path.join(repoRoot, "nested", ".env.local"), "NESTED=true\n");
	fs.mkdirSync(path.join(repoRoot, ".cache"), { recursive: true });
	fs.writeFileSync(path.join(repoRoot, ".cache", "not-env"), "cache artifact\n");
	fs.writeFileSync(path.join(repoRoot, ".cache", ".env.local"), "INSIDE_IGNORED_DIR=true\n");
	for (const providerRoot of [".claude", ".rovo", ".codex", ".cursor"]) {
		fs.mkdirSync(path.join(repoRoot, providerRoot, "worktrees", "stale"), { recursive: true });
		fs.writeFileSync(
			path.join(repoRoot, providerRoot, "worktrees", "stale", ".env.local"),
			`${providerRoot}=stale\n`,
		);
	}

	const result = runWorktreeCreateHook(
		repoRoot,
		{
			name: "agent-worktree",
			base_ref: "HEAD",
			worktree_ref: "claude/agent-worktree",
			worktree_path: worktreeDir,
		},
		{
			PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
			PNPM_RECORD: recordPath,
		},
	);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout, `${worktreeDir}\n`);
	assert.match(result.stderr, /running CI=true pnpm install --prefer-offline/u);
	assert.equal(
		fs.readFileSync(path.join(worktreeDir, ".env.local"), "utf8"),
		"ROVO_SESSION_TOKEN=test-token\n",
	);
	assert.equal(
		fs.readFileSync(path.join(worktreeDir, ".env.development"), "utf8"),
		"NEXT_PUBLIC_FIXTURE=true\n",
	);
	assert.equal(
		fs.readFileSync(path.join(worktreeDir, "nested", ".env.local"), "utf8"),
		"NESTED=true\n",
	);
	assert.equal(fs.existsSync(path.join(worktreeDir, ".cache", "not-env")), false);
	assert.equal(fs.existsSync(path.join(worktreeDir, ".cache", ".env.local")), false);
	for (const providerRoot of [".claude", ".rovo", ".codex", ".cursor"]) {
		assert.equal(
			fs.existsSync(path.join(worktreeDir, providerRoot, "worktrees", "stale", ".env.local")),
			false,
		);
	}
	assert.equal(fs.readFileSync(recordPath, "utf8"), "CI=true install --prefer-offline\n");

	const branch = run("git", ["branch", "--show-current"], { cwd: worktreeDir });
	assert.equal(branch.stdout.trim(), "claude/agent-worktree");
});

test("WorktreeCreate warms dependencies with clonefile copy when lockfiles match", (t) => {
	const { repoRoot, tempRoot } = createTempGitRepo(t);
	const pnpm = createPnpmStub(tempRoot);
	const cp = createCpStub(tempRoot);
	const worktreeDir = path.join(tempRoot, "clone-worktree");
	fs.mkdirSync(path.join(repoRoot, "node_modules", "fixture"), { recursive: true });
	fs.writeFileSync(path.join(repoRoot, "node_modules", "fixture", "index.js"), "module.exports = true;\n");
	fs.mkdirSync(path.join(repoRoot, "backend", "node_modules", "fixture"), { recursive: true });
	fs.writeFileSync(path.join(repoRoot, "backend", "node_modules", "fixture", "index.js"), "module.exports = 'backend';\n");
	fs.mkdirSync(path.join(repoRoot, ".claude", "worktrees", "stale", "node_modules", "fixture"), { recursive: true });
	fs.writeFileSync(
		path.join(repoRoot, ".claude", "worktrees", "stale", "node_modules", "fixture", "index.js"),
		"module.exports = 'stale';\n",
	);

	const result = runWorktreeCreateHook(
		repoRoot,
		{
			name: "clone-worktree",
			base_ref: "HEAD",
			worktree_path: worktreeDir,
		},
		{
			PATH: `${cp.binDir}${path.delimiter}${pnpm.binDir}${path.delimiter}${process.env.PATH}`,
			CP_RECORD: cp.recordPath,
			PNPM_RECORD: pnpm.recordPath,
		},
	);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout, `${worktreeDir}\n`);
	assert.match(fs.readFileSync(cp.recordPath, "utf8"), /-c -R/u);
	assert.equal(
		fs.readFileSync(path.join(worktreeDir, "node_modules", "fixture", "index.js"), "utf8"),
		"module.exports = true;\n",
	);
	assert.equal(
		fs.readFileSync(path.join(worktreeDir, "backend", "node_modules", "fixture", "index.js"), "utf8"),
		"module.exports = 'backend';\n",
	);
	assert.equal(
		fs.existsSync(
			path.join(worktreeDir, ".claude", "worktrees", "stale", "node_modules", "fixture", "index.js"),
		),
		false,
	);
	assert.equal(fs.existsSync(pnpm.recordPath), false);
});

test("WorktreeCreate falls back to pnpm install when clonefile copy fails", (t) => {
	const { repoRoot, tempRoot } = createTempGitRepo(t);
	const pnpm = createPnpmStub(tempRoot);
	const cp = createCpStub(tempRoot, { cloneExitCode: 64 });
	const worktreeDir = path.join(tempRoot, "clone-fails-worktree");
	fs.mkdirSync(path.join(repoRoot, "node_modules", "fixture"), { recursive: true });
	fs.writeFileSync(path.join(repoRoot, "node_modules", "fixture", "index.js"), "module.exports = true;\n");

	const result = runWorktreeCreateHook(
		repoRoot,
		{
			name: "clone-fails-worktree",
			base_ref: "HEAD",
			worktree_path: worktreeDir,
		},
		{
			PATH: `${cp.binDir}${path.delimiter}${pnpm.binDir}${path.delimiter}${process.env.PATH}`,
			CP_RECORD: cp.recordPath,
			PNPM_RECORD: pnpm.recordPath,
		},
	);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout, `${worktreeDir}\n`);
	assert.match(result.stderr, /falling back to pnpm install/u);
	assert.equal(fs.readFileSync(pnpm.recordPath, "utf8"), "CI=true install --prefer-offline\n");
	assert.equal(fs.existsSync(path.join(worktreeDir, "node_modules", "fixture", "index.js")), false);
});

test("WorktreeCreate creates a named branch when worktree_ref is omitted", (t) => {
	const { repoRoot, tempRoot } = createTempGitRepo(t);
	const { binDir, recordPath } = createPnpmStub(tempRoot, 23);
	const worktreeDir = path.join(tempRoot, "install-fails-worktree");

	const result = runWorktreeCreateHook(
		repoRoot,
		{
			name: "install-fails-worktree",
			base_ref: "HEAD",
			worktree_path: worktreeDir,
		},
		{
			PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
			PNPM_RECORD: recordPath,
		},
	);

	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.stdout, `${worktreeDir}\n`);
	assert.match(result.stderr, /pnpm install failed/u);
	assert.match(result.stderr, /\.env files missing/u);
	assert.equal(fs.readFileSync(recordPath, "utf8"), "CI=true install --prefer-offline\n");
	assert.ok(fs.existsSync(path.join(worktreeDir, "README.md")));

	const branch = run("git", ["branch", "--show-current"], { cwd: worktreeDir });
	assert.equal(branch.stdout.trim(), "claude/install-fails-worktree");
});

test("SessionStart bootstraps the session's worktree when CLAUDE_PROJECT_DIR is the main checkout", (t) => {
	const { repoRoot, tempRoot } = createTempGitRepo(t);
	const pnpm = createPnpmStub(tempRoot);
	const worktreeDir = path.join(tempRoot, "session-worktree");
	run("git", ["worktree", "add", "-b", "claude/session-worktree", worktreeDir, "HEAD"], { cwd: repoRoot });
	fs.writeFileSync(path.join(repoRoot, ".env.local"), "FIXTURE=true\n");

	const result = runSessionStartHook({
		claudeProjectDir: repoRoot,
		sessionCwd: worktreeDir,
		env: { PATH: `${pnpm.binDir}${path.delimiter}${process.env.PATH}`, PNPM_RECORD: pnpm.recordPath },
	});

	assert.equal(result.status, 0, result.stderr);
	// Slot 1 is the first linked worktree: frontend 3020, backend 8100, Rovo 8020.
	assert.deepEqual(readLaunchPorts(worktreeDir), [3020, 8100, 8020, 3020, 3020]);
	assert.equal(readLaunchPorts(repoRoot), null);
	assert.equal(fs.readFileSync(path.join(worktreeDir, ".env.local"), "utf8"), "FIXTURE=true\n");
	assert.equal(fs.readFileSync(pnpm.recordPath, "utf8"), "CI=true install --prefer-offline\n");
	assert.equal(fs.existsSync(inProgressMarker(worktreeDir)), false, "a finished install clears its marker");
	assert.equal(fs.existsSync(inProgressMarker(repoRoot)), false);
});

test("SessionStart returns before any lookup once env files and a finished bootstrap exist", (t) => {
	const { repoRoot, tempRoot } = createTempGitRepo(t);
	const pnpm = createPnpmStub(tempRoot, 0, { createsNodeModules: true });
	const env = { PATH: `${pnpm.binDir}${path.delimiter}${process.env.PATH}`, PNPM_RECORD: pnpm.recordPath };
	const worktreeDir = path.join(tempRoot, "ready-worktree");
	fs.writeFileSync(path.join(repoRoot, ".env.local"), "FIXTURE=true\n");
	const created = runWorktreeCreateHook(repoRoot, { name: "ready-worktree", base_ref: "HEAD", worktree_path: worktreeDir }, env);
	assert.equal(created.status, 0, created.stderr);
	assert.equal(fs.existsSync(inProgressMarker(worktreeDir)), false);
	fs.writeFileSync(path.join(repoRoot, ".env.development"), "ADDED_LATER=true\n");

	const result = runSessionStartHook({ claudeProjectDir: repoRoot, sessionCwd: worktreeDir, env });

	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /Worktree already bootstrapped/u);
	assert.equal(fs.existsSync(path.join(worktreeDir, ".env.development")), false);
	assert.equal(fs.readFileSync(pnpm.recordPath, "utf8"), "CI=true install --prefer-offline\n");
});

test("a checkout whose node_modules predates the marker counts as complete and is not reinstalled", (t) => {
	const { repoRoot, tempRoot } = createTempGitRepo(t);
	const pnpm = createPnpmStub(tempRoot);
	const worktreeDir = path.join(tempRoot, "existing-worktree");
	run("git", ["worktree", "add", "-b", "claude/existing-worktree", worktreeDir, "HEAD"], { cwd: repoRoot });
	fs.writeFileSync(path.join(worktreeDir, ".env.local"), "FIXTURE=true\n");
	fs.mkdirSync(path.join(worktreeDir, "node_modules", "fixture"), { recursive: true });

	const result = runSessionStartHook({
		claudeProjectDir: repoRoot,
		sessionCwd: worktreeDir,
		env: { PATH: `${pnpm.binDir}${path.delimiter}${process.env.PATH}`, PNPM_RECORD: pnpm.recordPath },
	});

	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stderr, /Worktree already bootstrapped/u);
	assert.equal(fs.existsSync(pnpm.recordPath), false, "no install in a checkout that was already complete");
});

test("node_modules left by a failed install keeps its marker and is reinstalled, which clears it", (t) => {
	const { repoRoot, tempRoot } = createTempGitRepo(t);
	const failing = createPnpmStub(path.join(tempRoot, "failing"), 23, { createsNodeModules: true });
	const worktreeDir = path.join(tempRoot, "interrupted-worktree");
	fs.writeFileSync(path.join(repoRoot, ".env.local"), "FIXTURE=true\n");

	const created = runWorktreeCreateHook(
		repoRoot,
		{ name: "interrupted-worktree", base_ref: "HEAD", worktree_path: worktreeDir },
		{ PATH: `${failing.binDir}${path.delimiter}${process.env.PATH}`, PNPM_RECORD: failing.recordPath },
	);
	assert.equal(created.status, 0, created.stderr);
	assert.ok(fs.existsSync(path.join(worktreeDir, "node_modules", ".stub-install")));
	assert.ok(fs.existsSync(inProgressMarker(worktreeDir)), "a failed install keeps its marker");

	const passing = createPnpmStub(path.join(tempRoot, "passing"));
	const env = { PATH: `${passing.binDir}${path.delimiter}${process.env.PATH}`, PNPM_RECORD: passing.recordPath };
	const resumed = runSessionStartHook({ claudeProjectDir: worktreeDir, sessionCwd: worktreeDir, env });
	assert.equal(resumed.status, 0, resumed.stderr);
	assert.match(resumed.stderr, /did not finish/u);
	assert.equal(fs.readFileSync(passing.recordPath, "utf8"), "CI=true install --prefer-offline\n");
	assert.equal(fs.existsSync(inProgressMarker(worktreeDir)), false);

	const settled = runSessionStartHook({ claudeProjectDir: worktreeDir, sessionCwd: worktreeDir, env });
	assert.equal(settled.status, 0, settled.stderr);
	assert.match(settled.stderr, /Worktree already bootstrapped/u);
	assert.equal(fs.readFileSync(passing.recordPath, "utf8"), "CI=true install --prefer-offline\n");
});

test("SessionStart ignores a payload cwd inside another repository", (t) => {
	const { repoRoot, tempRoot } = createTempGitRepo(t);
	const pnpm = createPnpmStub(tempRoot);
	const otherRepo = path.join(tempRoot, "other-repo");
	fs.mkdirSync(otherRepo);
	run("git", ["init", "-q"], { cwd: otherRepo });
	fs.writeFileSync(path.join(otherRepo, "package.json"), '{"private":true}\n');
	fs.writeFileSync(path.join(repoRoot, ".env.local"), "FIXTURE=true\n");
	fs.mkdirSync(path.join(repoRoot, "node_modules"));

	// The script comes from this repository, as the registered hook command runs it.
	const result = spawnSync("bash", [path.join(repoRoot, ".agents", "hooks", "setup-worktree.sh")], {
		cwd: repoRoot,
		encoding: "utf8",
		input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: otherRepo }),
		env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot, PATH: `${pnpm.binDir}${path.delimiter}${process.env.PATH}`, PNPM_RECORD: pnpm.recordPath },
	});

	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(fs.readdirSync(otherRepo).sort(), [".git", "package.json"], "nothing is copied, installed or written there");
	assert.equal(fs.existsSync(pnpm.recordPath), false);
	assert.notEqual(readLaunchPorts(repoRoot), null, "the hook falls back to CLAUDE_PROJECT_DIR");
});

// The test timeout only turns a hang into a failure; t.after still kills the child.
test("SessionStart returns when stdin is a pipe that never closes", { timeout: 30_000 }, async (t) => {
	const { repoRoot } = createTempGitRepo(t);
	fs.writeFileSync(path.join(repoRoot, ".env.local"), "FIXTURE=true\n");
	fs.mkdirSync(path.join(repoRoot, "node_modules"));
	const child = spawn("bash", [path.join(repoRoot, ".agents", "hooks", "setup-worktree.sh")], {
		cwd: repoRoot,
		env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot },
		stdio: ["pipe", "ignore", "pipe"],
	});
	t.after(() => {
		child.stdin.destroy();
		if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
	});
	child.stdin.write(JSON.stringify({ hook_event_name: "SessionStart", cwd: repoRoot }));

	const [code] = await once(child, "exit");
	assert.equal(code, 0);
	child.stdin.end();
});
