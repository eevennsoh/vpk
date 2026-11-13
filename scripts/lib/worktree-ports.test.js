const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
	getBackendBasePort,
	getFrontendBasePort,
	getPortInfoForPath,
	getRovoBasePort,
	getWorktreePortOffsetForPath,
	buildPortlessRunArgs,
} = require("./worktree-ports");

const WORKTREE_PORTS_MODULE_PATH = path.resolve(__dirname, "worktree-ports.js");

function createGitWorktreeFixture() {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-ports-fixture-"));
	const repoPath = path.join(tempDir, "repo");
	const worktreeAPath = path.join(tempDir, "wt-a");
	const worktreeBPath = path.join(tempDir, "wt-b");

	try {
		execSync(`git init ${JSON.stringify(repoPath)}`, { stdio: "ignore" });
		execSync("git config user.email test@example.com", {
			cwd: repoPath,
			stdio: "ignore",
		});
		execSync("git config user.name test", { cwd: repoPath, stdio: "ignore" });

		fs.writeFileSync(path.join(repoPath, "README.md"), "fixture\n", "utf8");
		execSync("git add README.md", { cwd: repoPath, stdio: "ignore" });
		execSync("git commit -m init", { cwd: repoPath, stdio: "ignore" });
		execSync("git branch feature-b", { cwd: repoPath, stdio: "ignore" });
		execSync("git branch feature-a", { cwd: repoPath, stdio: "ignore" });
		execSync(`git worktree add ${JSON.stringify(worktreeBPath)} feature-b`, {
			cwd: repoPath,
			stdio: "ignore",
		});
		execSync(`git worktree add ${JSON.stringify(worktreeAPath)} feature-a`, {
			cwd: repoPath,
			stdio: "ignore",
		});

		return {
			repoPath,
			worktreeAPath,
			worktreeBPath,
			cleanup() {
				fs.rmSync(tempDir, { recursive: true, force: true });
			},
		};
	} catch (error) {
		fs.rmSync(tempDir, { recursive: true, force: true });
		throw error;
	}
}

function runWorktreePortsExpression(cwd, expression) {
	const script = `
		const mod = require(${JSON.stringify(WORKTREE_PORTS_MODULE_PATH)});
		process.stdout.write(JSON.stringify(${expression}));
	`;

	return JSON.parse(
		execFileSync(process.execPath, ["-e", script], {
			cwd,
			encoding: "utf8",
		})
	);
}

test("worktree port helpers keep main first and assign linked worktree slots by identifier", () => {
	const fixture = createGitWorktreeFixture();

	try {
		const resolvedRepoPath = fs.realpathSync(fixture.repoPath);
		const resolvedWorktreeAPath = fs.realpathSync(fixture.worktreeAPath);
		const resolvedWorktreeBPath = fs.realpathSync(fixture.worktreeBPath);
		const allWorktreeInfo = runWorktreePortsExpression(
			fixture.repoPath,
			"mod.getAllWorktreePortInfo()"
		);
		const worktreeAInfo = runWorktreePortsExpression(
			fixture.repoPath,
			`mod.getPortInfoForPath(${JSON.stringify(resolvedWorktreeAPath)})`
		);
		const worktreeBInfo = runWorktreePortsExpression(
			fixture.repoPath,
			`mod.getPortInfoForPath(${JSON.stringify(resolvedWorktreeBPath)})`
		);

		assert.deepEqual(
			allWorktreeInfo.map(({ worktreeName, slot, offset, path, isMain }) => ({
				worktreeName,
				slot,
				offset,
				path,
				isMain,
			})),
			[
				{
					worktreeName: "main",
					slot: 0,
					offset: 0,
					path: resolvedRepoPath,
					isMain: true,
				},
				{
					worktreeName: "feature-a",
					slot: 1,
					offset: 20,
					path: resolvedWorktreeAPath,
					isMain: false,
				},
				{
					worktreeName: "feature-b",
					slot: 2,
					offset: 40,
					path: resolvedWorktreeBPath,
					isMain: false,
				},
			]
		);
		assert.match(allWorktreeInfo[0].identifier, /\S/u);
		assert.equal(allWorktreeInfo[1].identifier, "feature-a");
		assert.equal(allWorktreeInfo[2].identifier, "feature-b");
		assert.deepEqual(worktreeAInfo, {
			worktreeName: "feature-a",
			offset: 20,
			slot: 1,
			frontendBase: 3020,
			backendBase: 8100,
			rovoBase: 8020,
		});
		assert.deepEqual(worktreeBInfo, {
			worktreeName: "feature-b",
			offset: 40,
			slot: 2,
			frontendBase: 3040,
			backendBase: 8120,
			rovoBase: 8040,
		});
	} finally {
		fixture.cleanup();
	}
});

test("getPortInfoForPath falls back to main defaults for unknown paths", () => {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "worktree-ports-unknown-"));

	try {
		assert.equal(getWorktreePortOffsetForPath(tempDir), 0);
		assert.deepEqual(getPortInfoForPath(tempDir), {
			worktreeName: "main",
			offset: 0,
			slot: 0,
			frontendBase: 3000,
			backendBase: 8080,
			rovoBase: 8000,
		});
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
});

test("buildPortlessRunArgs returns no args for the main checkout", () => {
	assert.deepEqual(buildPortlessRunArgs(null), []);
	assert.deepEqual(
		buildPortlessRunArgs({ isMain: true, branch: "main", path: "/repo" }),
		[]
	);
});

test("buildPortlessRunArgs returns no args for a branched worktree (vanilla prefixes by branch)", () => {
	assert.deepEqual(
		buildPortlessRunArgs({
			isMain: false,
			branch: "feature-a",
			path: "/tmp/wt-a",
		}),
		[]
	);
});

test("buildPortlessRunArgs names a detached worktree by its unique path token", () => {
	// Nested managed layout (Codex): basename is the repo dir name, so the
	// unique token is the PARENT dir — using the basename would collide.
	assert.deepEqual(
		buildPortlessRunArgs(
			{
				isMain: false,
				branch: null,
				path: "/Users/x/.codex/worktrees/972c/example-repo",
			},
			"example-repo"
		),
		["--name", "972c"]
	);
	// Flat layout (.claude/worktrees/<feature>): basename is already unique.
	assert.deepEqual(
		buildPortlessRunArgs(
			{
				isMain: false,
				branch: "",
				path: "/Users/x/.claude/worktrees/composer-padding-12px",
			},
			"example-repo"
		),
		["--name", "composer-padding-12px"]
	);
	// Defensive: a record without a path yields no args (no crash).
	assert.deepEqual(
		buildPortlessRunArgs({ isMain: false, branch: null }, "example-repo"),
		[]
	);
});

test("buildPortlessRunArgs gives two nested detached worktrees DISTINCT names (no collision)", () => {
	const a = buildPortlessRunArgs(
		{ isMain: false, branch: null, path: "/Users/x/.codex/worktrees/972c/example-repo" },
		"example-repo"
	);
	const b = buildPortlessRunArgs(
		{ isMain: false, branch: null, path: "/Users/x/.codex/worktrees/90ba/example-repo" },
		"example-repo"
	);
	assert.deepEqual(a, ["--name", "972c"]);
	assert.deepEqual(b, ["--name", "90ba"]);
	assert.notDeepEqual(a, b);
});

test("getPortlessRunArgs resolves [] on main/branch and --name when detached", () => {
	const fixture = createGitWorktreeFixture();
	const detachedPath = path.join(path.dirname(fixture.repoPath), "wt-detached");
	// Reproduce the managed nested layout `.../<hash>/<repo-dir>` (e.g. Codex),
	// where the worktree basename equals the repo dir name ("repo" here).
	const nestedHashDir = path.join(path.dirname(fixture.repoPath), "abcd1234");
	const nestedDetachedPath = path.join(
		nestedHashDir,
		path.basename(fixture.repoPath)
	);

	try {
		execSync(`git worktree add --detach ${JSON.stringify(detachedPath)}`, {
			cwd: fixture.repoPath,
			stdio: "ignore",
		});
		fs.mkdirSync(nestedHashDir, { recursive: true });
		execSync(
			`git worktree add --detach ${JSON.stringify(nestedDetachedPath)}`,
			{ cwd: fixture.repoPath, stdio: "ignore" }
		);

		// Main checkout -> bare `portless run` -> <package-name>.localhost
		assert.deepEqual(
			runWorktreePortsExpression(fixture.repoPath, "mod.getPortlessRunArgs()"),
			[]
		);
		// Branched worktree -> bare `portless run` -> <branch>.<package-name>.localhost
		assert.deepEqual(
			runWorktreePortsExpression(
				fixture.worktreeAPath,
				"mod.getPortlessRunArgs()"
			),
			[]
		);
		assert.equal(
			runWorktreePortsExpression(fixture.worktreeAPath, "mod.getWorktreeName()"),
			"feature-a"
		);
		// Flat detached worktree -> basename is unique -> --name <dir>
		assert.deepEqual(
			runWorktreePortsExpression(detachedPath, "mod.getPortlessRunArgs()"),
			["--name", path.basename(detachedPath)]
		);
		assert.equal(
			runWorktreePortsExpression(detachedPath, "mod.getWorktreeName()"),
			path.basename(detachedPath)
		);
		// Nested detached worktree (basename == repo dir name) -> --name <parent>,
		// NOT the repo dir name (which would collide with main and siblings).
		assert.deepEqual(
			runWorktreePortsExpression(
				nestedDetachedPath,
				"mod.getPortlessRunArgs()"
			),
			["--name", path.basename(nestedHashDir)]
		);
		assert.equal(
			runWorktreePortsExpression(nestedDetachedPath, "mod.getWorktreeName()"),
			path.basename(nestedHashDir)
		);
		assert.equal(
			runWorktreePortsExpression(
				fixture.repoPath,
				`mod.getPortInfoForPath(${JSON.stringify(fs.realpathSync(nestedDetachedPath))}).worktreeName`
			),
			path.basename(nestedHashDir)
		);
	} finally {
		fixture.cleanup();
	}
});

test("base port helpers honor explicit environment overrides", () => {
	const originalPort = process.env.PORT;
	const originalBackendPort = process.env.BACKEND_PORT;
	const originalRovoPort = process.env.ROVO_PORT;

	process.env.PORT = "4100";
	process.env.BACKEND_PORT = "9100";
	process.env.ROVO_PORT = "9200";

	try {
		assert.equal(getFrontendBasePort(), 4100);
		assert.equal(getBackendBasePort(), 9100);
		assert.equal(getRovoBasePort(), 9200);
	} finally {
		if (originalPort === undefined) {
			delete process.env.PORT;
		} else {
			process.env.PORT = originalPort;
		}

		if (originalBackendPort === undefined) {
			delete process.env.BACKEND_PORT;
		} else {
			process.env.BACKEND_PORT = originalBackendPort;
		}

		if (originalRovoPort === undefined) {
			delete process.env.ROVO_PORT;
		} else {
			process.env.ROVO_PORT = originalRovoPort;
		}
	}
});
