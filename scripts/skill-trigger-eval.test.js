const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	buildEvalEnv,
	createSandboxProject,
	hasHeadlessAuth,
	parseArgs,
	resolveRunEvalProjectRoot,
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
	assert.notEqual(resolveRunEvalProjectRoot(projectDir), fs.realpathSync(os.homedir()));
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
