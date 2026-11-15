const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	buildEvalEnv,
	createSandboxProject,
	describeModel,
	findSkillCreatorDir,
	hasHeadlessAuth,
	parseArgs,
	resolveRunEvalProjectRoot,
	resolveUserPath,
	writeResult,
} = require("./skill-trigger-eval");

function makeFakeRepo() {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "skill-trigger-eval-test-")));
	const skillsDir = path.join(root, ".agents", "skills");
	for (const name of ["vpk-design", "vpk-remote", "vpk-tidy"]) {
		fs.mkdirSync(path.join(skillsDir, name), { recursive: true });
		fs.writeFileSync(path.join(skillsDir, name, "SKILL.md"), `---\nname: ${name}\ndescription: x\n---\n`);
	}
	fs.writeFileSync(path.join(skillsDir, "INDEX.md"), "");
	fs.mkdirSync(path.join(root, ".claude"));
	fs.writeFileSync(path.join(root, "AGENTS.md"), "# repo");
	return { root, skillsDir };
}

test("the sandbox links sibling skills but never the skill under test", (t) => {
	const { root, skillsDir } = makeFakeRepo();
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-trigger-eval-sandbox-"));
	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
		fs.rmSync(tmpRoot, { recursive: true, force: true });
	});

	const { projectDir, siblings } = createSandboxProject({ skill: "vpk-remote", skillsDir, repoRoot: root, tmpRoot });

	assert.deepEqual(siblings, ["vpk-design", "vpk-tidy"]);
	assert.deepEqual(fs.readdirSync(path.join(projectDir, ".claude", "skills")).sort(), ["vpk-design", "vpk-tidy"]);
	assert.equal(fs.existsSync(path.join(projectDir, ".claude", "skills", "vpk-remote")), false);
	assert.equal(fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf8"), "# repo");
});

test("run_eval's project-root lookup lands in the sandbox, not the repo or $HOME", (t) => {
	const { root, skillsDir } = makeFakeRepo();
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-trigger-eval-sandbox-"));
	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
		fs.rmSync(tmpRoot, { recursive: true, force: true });
	});

	// The old recipe ran from the repo (or skill-creator's folder), so the temporary command landed
	// next to the real skill (or in ~/.claude/commands).
	assert.equal(resolveRunEvalProjectRoot(path.join(root, ".agents", "skills")), root);

	const { projectDir } = createSandboxProject({ skill: "vpk-remote", skillsDir, repoRoot: root, tmpRoot });
	assert.equal(resolveRunEvalProjectRoot(projectDir), projectDir);
});

// Guards against drift between the JS pre-flight check and the plugin's own lookup.
test("skill-creator's own find_project_root resolves the sandbox", (t) => {
	const skillCreatorDir = findSkillCreatorDir();
	if (!skillCreatorDir) {
		t.skip("skill-creator is not installed");
		return;
	}
	const { root, skillsDir } = makeFakeRepo();
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skill-trigger-eval-sandbox-"));
	t.after(() => {
		fs.rmSync(root, { recursive: true, force: true });
		fs.rmSync(tmpRoot, { recursive: true, force: true });
	});
	const { projectDir } = createSandboxProject({ skill: "vpk-remote", skillsDir, repoRoot: root, tmpRoot });
	const result = spawnSync("python3", ["-c", "from scripts.run_eval import find_project_root; print(find_project_root())"], {
		cwd: projectDir,
		env: { ...process.env, PYTHONPATH: skillCreatorDir },
		encoding: "utf8",
	});
	if (result.error) {
		t.skip("python3 is not available");
		return;
	}
	assert.equal(result.status, 0, result.stderr);
	assert.equal(fs.realpathSync(result.stdout.trim()), resolveRunEvalProjectRoot(projectDir));
});

test("the child env isolates Claude config and lets run_eval import from skill-creator", () => {
	const env = buildEvalEnv({
		baseEnv: { CLAUDECODE: "1", PATH: "/bin", PYTHONPATH: "/existing" },
		skillCreatorDir: "/sc",
		configDir: "/tmp/cfg",
	});
	assert.equal(env.CLAUDECODE, undefined);
	assert.equal(env.CLAUDE_CONFIG_DIR, "/tmp/cfg");
	assert.equal(env.PYTHONPATH, `/sc${path.delimiter}/existing`);
	assert.equal(env.PATH, "/bin");

	const kept = buildEvalEnv({ baseEnv: { CLAUDE_CONFIG_DIR: "/mine" }, skillCreatorDir: "/sc", configDir: null });
	assert.equal(kept.CLAUDE_CONFIG_DIR, "/mine");
});

test("an isolated config needs headless auth from the environment", () => {
	assert.equal(hasHeadlessAuth({}), false);
	assert.equal(hasHeadlessAuth({ ANTHROPIC_API_KEY: "x" }), true);
	assert.equal(hasHeadlessAuth({ CLAUDE_CODE_OAUTH_TOKEN: "x" }), true);
	assert.equal(hasHeadlessAuth({ ANTHROPIC_AUTH_TOKEN: "x" }), true);
});

test("arguments pass through to run_eval with wrapper defaults", () => {
	const options = parseArgs(["--", "vpk-remote", "--runs-per-query", "1", "--model", "claude-sonnet-5-5", "--keep-user-config"]);
	assert.equal(options.skill, "vpk-remote");
	assert.equal(options.keepUserConfig, true);
	assert.deepEqual(options.runEvalArgs, [
		"--runs-per-query",
		"1",
		"--timeout",
		"60",
		"--num-workers",
		"1",
		"--model",
		"claude-sonnet-5-5",
		"--verbose",
	]);
	assert.equal(parseArgs(["--help"]).help, true);
});

test("--flag=value overrides the wrapper default and feeds the worker warning", () => {
	const options = parseArgs(["vpk-remote", "--num-workers=4", "--model", "x", "--out=/tmp/r.json"]);
	assert.deepEqual(options.runEvalArgs, ["--runs-per-query", "3", "--timeout", "60", "--num-workers", "4", "--model", "x", "--verbose"]);
	assert.equal(options.numWorkers, 4);
	assert.equal(options.model, "x");
	assert.equal(options.out, "/tmp/r.json");
	assert.equal(parseArgs(["vpk-remote", "--loop"]).loop, true);
});

test("the wrapper's own value flags refuse a missing value", () => {
	assert.throws(() => parseArgs(["vpk-remote", "--out"]), /--out needs a value/);
	assert.throws(() => parseArgs(["vpk-remote", "--eval-set", "--model", "x"]), /--eval-set needs a value/);
});

test("a failed run never overwrites an earlier good result", (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-trigger-eval-out-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const out = path.join(dir, "triggers.json");
	fs.writeFileSync(out, "good");

	assert.deepEqual(writeResult({ out, code: 1, stdout: Buffer.from("partial") }), { ok: false, target: `${out}.failed` });
	assert.equal(fs.readFileSync(out, "utf8"), "good");
	assert.equal(fs.readFileSync(`${out}.failed`, "utf8"), "partial");

	assert.deepEqual(writeResult({ out, code: 0, stdout: Buffer.alloc(0) }), { ok: false, target: null });
	assert.equal(fs.readFileSync(out, "utf8"), "good");

	assert.deepEqual(writeResult({ out, code: 0, stdout: Buffer.from("new") }), { ok: true, target: out });
	assert.equal(fs.readFileSync(out, "utf8"), "new");
});

test("user paths resolve against where pnpm was run, and the plugin lookup honours CLAUDE_CONFIG_DIR", (t) => {
	assert.equal(resolveUserPath("r.json", { INIT_CWD: "/work/sub" }), "/work/sub/r.json");
	assert.equal(resolveUserPath("/abs/r.json", { INIT_CWD: "/work/sub" }), "/abs/r.json");

	const config = fs.mkdtempSync(path.join(os.tmpdir(), "skill-trigger-eval-config-"));
	t.after(() => fs.rmSync(config, { recursive: true, force: true }));
	const installPath = path.join(config, "cache", "sc");
	fs.mkdirSync(path.join(installPath, "skills", "skill-creator", "scripts"), { recursive: true });
	fs.writeFileSync(path.join(installPath, "skills", "skill-creator", "scripts", "run_eval.py"), "");
	fs.mkdirSync(path.join(config, "plugins"));
	fs.writeFileSync(
		path.join(config, "plugins", "installed_plugins.json"),
		JSON.stringify({ plugins: { "skill-creator@x": [{ installPath }] } }),
	);
	assert.equal(
		findSkillCreatorDir({ env: { CLAUDE_CONFIG_DIR: config }, home: "/nonexistent" }),
		path.join(installPath, "skills", "skill-creator"),
	);
	assert.equal(findSkillCreatorDir({ env: {}, home: "/nonexistent" }), null);
});

test("the model line says where the model came from", () => {
	assert.match(describeModel({ model: "m" }, { ANTHROPIC_MODEL: "e" }), /^m \(--model\)/);
	assert.match(describeModel({ model: null }, { ANTHROPIC_MODEL: "e" }), /^e \(ANTHROPIC_MODEL\)/);
	assert.match(describeModel({ model: null }, {}), /default/);
});
