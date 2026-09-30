const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { buildClaudeLaunchConfig, writeClaudeLaunchConfig } = require("./write-claude-launch-config.js");

const MAIN_PORTS = { backendBase: 8080, frontendBase: 3000, rovoBase: 8000 };
const WORKTREE_PORTS = { backendBase: 8180, frontendBase: 3100, rovoBase: 8100 };

test("each preview config waits on the port its script actually binds in this checkout", () => {
	const ports = Object.fromEntries(buildClaudeLaunchConfig(WORKTREE_PORTS).configurations.map((entry) => [entry.name, entry.port]));
	assert.deepEqual(ports, {
		frontend: 3100,
		backend: 8180,
		rovo: 8100,
		"dev (frontend + backend)": 3100,
		"rovo-stack (all three)": 3100,
	});
});

test("the main checkout keeps the default ports", () => {
	const [frontend] = buildClaudeLaunchConfig(MAIN_PORTS).configurations;
	assert.deepEqual(frontend, { name: "frontend", runtimeExecutable: "pnpm", runtimeArgs: ["run", "dev:frontend"], port: 3000 });
});

test("writes only when the checkout's config changes", () => {
	const root = mkdtempSync(path.join(os.tmpdir(), "claude-launch-"));
	try {
		const launchPath = path.join(root, ".claude", "launch.json");
		assert.equal(writeClaudeLaunchConfig({ launchPath, portInfo: WORKTREE_PORTS }), true);
		assert.equal(writeClaudeLaunchConfig({ launchPath, portInfo: WORKTREE_PORTS }), false);
		assert.equal(JSON.parse(readFileSync(launchPath, "utf8")).configurations[0].port, 3100);
		assert.equal(writeClaudeLaunchConfig({ launchPath, portInfo: MAIN_PORTS }), true);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
});
