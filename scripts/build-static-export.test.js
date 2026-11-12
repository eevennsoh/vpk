const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.resolve(__dirname, "build-static-export.mjs");

function fakeBuildsStillRunning(root) {
	const result = spawnSync("pgrep", ["-f", path.join(root, "bin", "pnpm")], { encoding: "utf8" });
	return result.stdout.split("\n").filter(Boolean);
}

async function waitFor(predicate, timeoutMs = 10_000) {
	const started = Date.now();
	while (!predicate()) {
		if (Date.now() - started > timeoutMs) throw new Error("timed out waiting for the fake build");
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
}

// A throwaway project whose `pnpm run build` is a fake that records whether the
// API routes were hidden, then waits for a `release` file (so a test can kill it mid-build).
// Cleanup releases every fake build, kills each export's process group, and fails the
// test if any fake build survives.
function createProject(t) {
	const root = mkdtempSync(path.join(tmpdir(), "build-static-export-"));
	const children = [];
	t.after(async () => {
		writeFileSync(path.join(root, "release"), "");
		for (const child of children) {
			try {
				process.kill(-child.pid, "SIGKILL");
			} catch {
				// The group already exited.
			}
		}
		await waitFor(() => fakeBuildsStillRunning(root).length === 0);
		assert.deepEqual(fakeBuildsStillRunning(root), [], "no fake build may outlive the test");
		rmSync(root, { force: true, recursive: true });
	});
	mkdirSync(path.join(root, "app", "api", "health"), { recursive: true });
	writeFileSync(path.join(root, "app", "api", "health", "route.ts"), "export const GET = () => null;\n");
	const bin = path.join(root, "bin");
	mkdirSync(bin);
	writeFileSync(path.join(bin, "pnpm"), [
		"#!/bin/sh",
		"if [ -e app/api ]; then echo visible > build-saw-api; else echo hidden > build-saw-api; fi",
		"echo \"$NEXT_OUTPUT\" > build-saw-output",
		"touch build-started",
		"echo $$ >> builds",
		"while [ -n \"$FAKE_BUILD_WAIT\" ] && [ ! -e release ]; do sleep 0.05; done",
		"exit \"${FAKE_BUILD_EXIT:-0}\"",
		"",
	].join("\n"));
	chmodSync(path.join(bin, "pnpm"), 0o755);
	const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` };
	// One line per fake build that started.
	const buildCount = () => (existsSync(path.join(root, "builds")) ? readFileSync(path.join(root, "builds"), "utf8").split("\n").filter(Boolean).length : 0);
	return {
		env,
		root,
		exists: (relative) => existsSync(path.join(root, relative)),
		read: (relative) => readFileSync(path.join(root, relative), "utf8").trim(),
		run: (args = [], extraEnv = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: "utf8", env: { ...env, ...extraEnv } }),
		// Starts an export that holds its fake build until `release`, in its own process group.
		start: () => {
			const child = spawn(process.execPath, [SCRIPT], { cwd: root, detached: true, env: { ...env, FAKE_BUILD_WAIT: "1" }, stdio: "ignore" });
			children.push(child);
			return child;
		},
		release: () => writeFileSync(path.join(root, "release"), ""),
		buildCount,
		// Resolves once every export but one has exited (refused), or a second build has started.
		waitForRefusals: async (runs) => {
			let exited = 0;
			for (const child of runs) {
				if (child.exitCode !== null || child.signalCode !== null) exited += 1;
				else child.once("exit", () => { exited += 1; });
			}
			await waitFor(() => buildCount() > 1 || (exited >= runs.length - 1 && buildCount() === 1));
		},
	};
}

test("static export hides the API routes during the build and restores them afterwards", (t) => {
	const project = createProject(t);
	const result = project.run();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(project.read("build-saw-api"), "hidden");
	assert.equal(project.read("build-saw-output"), "export");
	assert.equal(project.exists("app/api/health/route.ts"), true);
	assert.equal(project.exists(".api-routes-backup"), false);
	assert.equal(project.exists(".static-export-journal.json"), false);
});

test("a failing build still restores the API routes and keeps its exit code", (t) => {
	const project = createProject(t);
	const result = project.run([], { FAKE_BUILD_EXIT: "3" });
	assert.equal(result.status, 3);
	assert.equal(project.exists("app/api/health/route.ts"), true);
	assert.equal(project.exists(".static-export-journal.json"), false);
});

test("the next run restores routes left aside by an export that was killed mid-build", async (t) => {
	const project = createProject(t);
	const child = project.start();
	await waitFor(() => project.exists("build-started"));
	const exited = new Promise((resolve) => child.once("exit", resolve));
	child.kill("SIGKILL");
	await exited;
	assert.equal(project.exists("app/api"), false, "SIGKILL skips every cleanup handler");
	assert.equal(project.exists(".api-routes-backup/health/route.ts"), true);

	const status = JSON.parse(project.run(["--status"]).stdout);
	assert.equal(status.state, "interrupted");
	assert.equal(status.pid, child.pid);

	rmSync(path.join(project.root, "build-saw-api"));
	const rerun = project.run();
	assert.equal(rerun.status, 0, rerun.stderr);
	assert.match(rerun.stdout, /Restored .*app\/api left aside by an interrupted export/u);
	assert.equal(project.read("build-saw-api"), "hidden");
	assert.equal(project.exists("app/api/health/route.ts"), true);
	assert.equal(project.exists(".api-routes-backup"), false);
	assert.equal(JSON.parse(project.run(["--status"]).stdout).state, "clean");
});

test("--restore puts routes back without building, and refuses while the exporting process is alive", async (t) => {
	const project = createProject(t);
	const child = project.start();
	await waitFor(() => project.exists("build-started"));

	assert.equal(JSON.parse(project.run(["--status"]).stdout).state, "running");
	const refused = project.run(["--restore"]);
	assert.notEqual(refused.status, 0);
	assert.match(refused.stderr, new RegExp(`Another static export \\(pid ${child.pid}\\) is running`, "u"));
	assert.equal(project.exists("app/api"), false);

	const exited = new Promise((resolve) => child.once("exit", resolve));
	child.kill("SIGKILL");
	await exited;
	rmSync(path.join(project.root, "build-started"));
	const restored = project.run(["--restore"]);
	assert.equal(restored.status, 0, restored.stderr);
	assert.equal(project.exists("app/api/health/route.ts"), true);
	assert.equal(project.exists("build-started"), false, "--restore does not build");
});

for (const signal of ["SIGHUP", "SIGTERM"]) {
	test(`${signal} during the build restores the API routes`, async (t) => {
		const project = createProject(t);
		const child = project.start();
		await waitFor(() => project.exists("build-started"));
		const exited = new Promise((resolve) => child.once("exit", (code) => resolve(code)));
		child.kill(signal);
		await exited;
		assert.equal(project.exists("app/api/health/route.ts"), true);
		assert.equal(project.exists(".static-export-journal.json"), false);
	});
}

test("a second export started during a build is refused and leaves the first run's routes alone", async (t) => {
	const project = createProject(t);
	const first = project.start();
	await waitFor(() => project.exists("build-started"));

	const second = project.run();
	assert.notEqual(second.status, 0);
	assert.match(second.stderr, new RegExp(`Another static export \\(pid ${first.pid}\\) is running`, "u"));
	assert.equal(project.exists("app/api"), false, "the refused run must not restore the first run's routes mid-build");
	assert.equal(JSON.parse(readFileSync(path.join(project.root, ".static-export-journal.json"), "utf8")).pid, first.pid);

	const exited = new Promise((resolve) => first.once("exit", resolve));
	project.release();
	assert.equal(await exited, 0);
	assert.equal(project.exists("app/api/health/route.ts"), true);
	assert.equal(project.exists(".static-export-journal.json"), false);
});

test("exports started together: exactly one builds, the rest are refused", async (t) => {
	const project = createProject(t);
	const runs = Array.from({ length: 8 }, () => project.start());
	const exits = runs.map((child) => new Promise((resolve) => child.once("exit", resolve)));
	await project.waitForRefusals(runs);
	assert.equal(project.buildCount(), 1, "only one export may move the routes and build");
	assert.equal(project.exists("app/api"), false);

	project.release();
	const codes = await Promise.all(exits);
	assert.equal(codes.filter((code) => code === 0).length, 1);
	assert.equal(project.exists("app/api/health/route.ts"), true);
	assert.equal(project.exists(".api-routes-backup"), false);
	assert.equal(project.exists(".static-export-journal.json"), false);
});

test("exports started together over a killed run's leftovers: one owner restores the routes and builds", async (t) => {
	const project = createProject(t);
	const killed = project.start();
	await waitFor(() => project.exists("build-started"));
	const killedExit = new Promise((resolve) => killed.once("exit", resolve));
	process.kill(-killed.pid, "SIGKILL");
	await killedExit;
	await waitFor(() => fakeBuildsStillRunning(project.root).length === 0);
	assert.equal(project.exists("app/api"), false, "the killed run left its routes aside");
	for (const leftover of ["build-started", "build-saw-api", "builds"]) rmSync(path.join(project.root, leftover), { force: true });

	const runs = Array.from({ length: 8 }, () => project.start());
	const exits = runs.map((child) => new Promise((resolve) => child.once("exit", resolve)));
	await project.waitForRefusals(runs);
	assert.equal(project.buildCount(), 1, "only one export may take over the killed run and build");
	assert.equal(project.read("build-saw-api"), "hidden");
	assert.equal(project.exists("app/api"), false, "a refused run must not restore the owner's routes mid-build");

	project.release();
	const codes = await Promise.all(exits);
	assert.equal(codes.filter((code) => code === 0).length, 1);
	assert.equal(project.exists("app/api/health/route.ts"), true);
	assert.equal(project.exists(".api-routes-backup"), false);
	assert.deepEqual(readdirSync(project.root).filter((name) => name.startsWith(".static-export-journal")), [], "no journal, draft or claim file is left behind");
});
