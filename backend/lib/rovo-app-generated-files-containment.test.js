"use strict";

// BE-F3: generated-file cleanup only touches files a run recorded, inside the
// generated-file directories, through real directories, case-exactly, untracked by git.

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
	createRovoAppGeneratedFilesManager,
} = require("./rovo-app-generated-files");

const silentLogger = { info() {}, warn() {} };

async function createFixture(t) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "rovo-app-containment-"));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	const projectRoot = path.join(root, "project");
	const outside = path.join(root, "outside");
	const baseDir = path.join(projectRoot, "backend", "data");
	await fs.mkdir(projectRoot, { recursive: true });
	await fs.mkdir(outside, { recursive: true });
	execFileSync("git", ["init", "-q"], { cwd: projectRoot });

	const write = async (relativePath, content = "keep") => {
		const absolutePath = path.join(projectRoot, relativePath);
		await fs.mkdir(path.dirname(absolutePath), { recursive: true });
		await fs.writeFile(absolutePath, content);
		return absolutePath;
	};
	await fs.writeFile(path.join(outside, "secret.txt"), "keep");
	return { root, projectRoot, outside, baseDir, write };
}

// A manifest written straight to disk, as one planted by an older backend would be.
async function plantManifest(baseDir, threadId, requestedPaths) {
	const manifestPath = path.join(baseDir, "rovo-app", "threads", threadId, "generated-files.json");
	await fs.mkdir(path.dirname(manifestPath), { recursive: true });
	await fs.writeFile(manifestPath, JSON.stringify(requestedPaths.map((requestedPath) => ({ requestedPath }))));
}

async function exists(absolutePath) {
	return fs.lstat(absolutePath).then(() => true, () => false);
}

test("cleanup deletes a recorded generated file and nothing a planted manifest names outside the rules", async (t) => {
	const { projectRoot, outside, baseDir, write } = await createFixture(t);
	const generated = await write("app/generated/page.tsx", "generated");
	const kept = {
		rootFile: await write("notes.txt"),
		nodeModules: await write("app/node_modules/pkg/index.js"),
		otherThread: await write("backend/data/rovo-app/threads/other/thread.json"),
		ignoredArtifact: await write("artifacts/report.html"),
		tracked: await write("components/tracked.tsx"),
		hidden: await write("lib/.cache/state.json"),
	};
	execFileSync("git", ["add", "components/tracked.tsx"], { cwd: projectRoot });
	await fs.symlink(outside, path.join(projectRoot, "app", "linked"));
	await fs.symlink(path.join(outside, "secret.txt"), path.join(projectRoot, "app", "evil.txt"));

	await plantManifest(baseDir, "thread-1", [
		"app/generated/page.tsx",
		"notes.txt",
		"app/node_modules/pkg/index.js",
		"backend/data/rovo-app/threads/other/thread.json",
		"artifacts/report.html",
		"components/tracked.tsx",
		"components/TRACKED.tsx",
		"lib/.cache/state.json",
		"app/linked/secret.txt",
		"app/evil.txt",
		"../outside/secret.txt",
		"app/../../outside/secret.txt",
		path.join(outside, "secret.txt"),
	]);
	const manager = createRovoAppGeneratedFilesManager({ baseDir, projectRoot, logger: silentLogger });

	assert.equal(await manager.deleteLegacyRootFiles("thread-1"), 1);
	assert.equal(await exists(generated), false, "the recorded generated file is deleted");
	for (const [name, absolutePath] of Object.entries(kept)) {
		assert.equal(await exists(absolutePath), true, name);
	}
	assert.equal(await fs.readFile(path.join(outside, "secret.txt"), "utf8"), "keep", "nothing outside the project");
	assert.equal(await exists(path.join(projectRoot, "app", "evil.txt")), true, "the symlink itself is left alone");
});

test("a case variant of a tracked file is never deleted, on either kind of filesystem", async (t) => {
	const { projectRoot, baseDir, write } = await createFixture(t);
	const tracked = await write("app/page.tsx", "tracked");
	execFileSync("git", ["add", "app/page.tsx"], { cwd: projectRoot });
	await plantManifest(baseDir, "thread-1", ["app/PAGE.tsx", "APP/page.tsx"]);
	const manager = createRovoAppGeneratedFilesManager({ baseDir, projectRoot, logger: silentLogger });

	assert.equal(await manager.deleteLegacyRootFiles("thread-1"), 0);
	assert.equal(await fs.readFile(tracked, "utf8"), "tracked");
});

test("without a usable git every file counts as tracked, and the delete still succeeds", async (t) => {
	const { projectRoot, baseDir, write } = await createFixture(t);
	const generated = await write("app/generated/page.tsx");
	await plantManifest(baseDir, "thread-1", ["app/generated/page.tsx"]);
	const missingGit = (_file, _args, _options, callback) => callback(Object.assign(new Error("spawn git ENOENT"), { code: "ENOENT" }));
	const manager = createRovoAppGeneratedFilesManager({ baseDir, projectRoot, logger: silentLogger, execFileImpl: missingGit });

	assert.equal(await manager.deleteLegacyRootFiles("thread-1"), 0);
	assert.equal(await exists(generated), true);
});

test("an unreadable manifest never makes cleanup fail", async (t) => {
	const { projectRoot, baseDir } = await createFixture(t);
	// A directory where the manifest file should be: reading it fails with EISDIR.
	await fs.mkdir(path.join(baseDir, "rovo-app", "threads", "thread-1", "generated-files.json"), { recursive: true });
	const manager = createRovoAppGeneratedFilesManager({ baseDir, projectRoot, logger: silentLogger });

	assert.equal(await manager.deleteLegacyRootFiles("thread-1"), 0);
	assert.deepEqual(await manager.captureRootFilesToWorkspace("thread-1"), { copiedCount: 0, entries: [] });
});

test("capture copies only files that pass the same rules", async (t) => {
	const { projectRoot, outside, baseDir, write } = await createFixture(t);
	await write("app/generated/page.tsx", "generated");
	await write("notes.txt", "private");
	await fs.symlink(path.join(outside, "secret.txt"), path.join(projectRoot, "app", "evil.txt"));
	await plantManifest(baseDir, "thread-1", ["app/generated/page.tsx", "notes.txt", "app/evil.txt"]);
	const manager = createRovoAppGeneratedFilesManager({ baseDir, projectRoot, logger: silentLogger });

	const { copiedCount } = await manager.captureRootFilesToWorkspace("thread-1");
	assert.equal(copiedCount, 1);
	const source = path.join(baseDir, "rovo-app", "threads", "thread-1", "workspace", "source");
	assert.equal(await exists(path.join(source, "app", "generated", "page.tsx.snapshot")), true);
	assert.equal(await exists(path.join(source, "notes.txt.snapshot")), false);
	assert.equal(await exists(path.join(source, "app", "evil.txt.snapshot")), false);
});

test("recording a run's messages writes the manifest the cleanup reads", async (t) => {
	const { projectRoot, baseDir, write } = await createFixture(t);
	const generated = await write("app/generated/page.tsx");
	const manager = createRovoAppGeneratedFilesManager({ baseDir, projectRoot, logger: silentLogger });
	await manager.recordRunGeneratedFiles("thread-1", [{
		parts: [{
			type: "data-thinking-event",
			data: { phase: "result", toolName: "create_file", toolCallId: "t1", outputPreview: "Successfully created app/generated/page.tsx." },
		}],
	}]);
	assert.equal(await manager.deleteLegacyRootFiles("thread-1"), 1);
	assert.equal(await exists(generated), false);
});
