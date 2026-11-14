"use strict";

// BE-F3b: cleanup removes only a file a run created, while it still has the content the run
// left; git is asked once per cleanup; a cleanup has a deadline; a full manifest says so.

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFile, execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { createRovoAppGeneratedFilesManager, MAX_MANIFEST_ENTRIES } = require("./rovo-app-generated-files");

async function createFixture(t) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "rovo-app-identity-"));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	const projectRoot = path.join(root, "project");
	await fs.mkdir(projectRoot, { recursive: true });
	execFileSync("git", ["init", "-q"], { cwd: projectRoot });
	const write = async (relativePath, content = "x") => {
		const absolutePath = path.join(projectRoot, relativePath);
		await fs.mkdir(path.dirname(absolutePath), { recursive: true });
		await fs.writeFile(absolutePath, content);
		return absolutePath;
	};
	const commit = (...files) => {
		execFileSync("git", ["add", "--", ...files], { cwd: projectRoot });
		execFileSync("git", ["-c", "user.email=t@example.test", "-c", "user.name=t", "commit", "-qm", "c"], { cwd: projectRoot });
	};
	const warnings = [];
	const logger = { info() {}, warn: (message) => warnings.push(String(message)) };
	const gitCalls = [];
	const countingExecFile = (file, args, options, callback) => {
		gitCalls.push(args[0]);
		return execFile(file, args, options, callback);
	};
	const manager = (options = {}) => createRovoAppGeneratedFilesManager({
		baseDir: path.join(root, "data"),
		projectRoot,
		logger,
		execFileImpl: countingExecFile,
		...options,
	});
	return { projectRoot, baseDir: path.join(root, "data"), write, commit, manager, warnings, gitCalls };
}

const exists = (absolutePath) => fs.lstat(absolutePath).then(() => true, () => false);

const run = (...events) => [{
	parts: events.map(([toolName, text, toolCallId = `${toolName}-${text.length}`]) => ({
		type: "data-thinking-event",
		data: { phase: "result", toolName, toolCallId, outputPreview: text },
	})),
}];

test("a no-op, failed or overwriting write records nothing, so deleting the thread leaves those files", async (t) => {
	const { write, manager } = await createFixture(t);
	const edited = await write("app/existing/edited.tsx", "the developer's file");
	const failedCreate = await write("app/existing/failed.tsx", "the developer's file");
	const overwritten = await write("app/existing/overwritten.tsx", "the developer's file");
	const created = await write("app/generated/new.tsx", "generated");
	const files = manager();

	await files.recordRunGeneratedFiles("thread-1", run(
		["find_and_replace_code", "Successfully replaced code in app/existing/edited.tsx:\n\n--- a\n+++ b"],
		["find_and_replace_code", "Error executing tool find_and_replace_code: app/existing/edited.tsx: No matches found for find string"],
		["create_file", "Error calling tool 'create_file': app/existing/failed.tsx already exists"],
		["create_file", "Successfully updated app/existing/overwritten.tsx."],
		["move_file", "Successfully moved app/existing/edited.tsx to app/generated/new.tsx."],
		["create_file", "Successfully created app/generated/new.tsx."],
	));
	assert.deepEqual((await files.readManifest("thread-1")).map((entry) => entry.requestedPath), ["app/generated/new.tsx"]);

	assert.equal(await files.deleteLegacyRootFiles("thread-1"), 1);
	assert.equal(await exists(created), false);
	for (const kept of [edited, failedCreate, overwritten]) {
		assert.equal(await fs.readFile(kept, "utf8"), "the developer's file", kept);
	}
});

test("a created file changed since its run is kept, and a later run's edit drops it from the thread", async (t) => {
	const { write, manager, warnings } = await createFixture(t);
	const changedByDeveloper = await write("app/generated/a.tsx", "generated a");
	const editedByLaterRun = await write("app/generated/b.tsx", "generated b");
	const editedInSameRun = await write("app/generated/c.tsx", "generated c, then replaced in the same run");
	const files = manager();
	await files.recordRunGeneratedFiles("thread-1", run(
		["create_file", "Successfully created app/generated/a.tsx."],
		["create_file", "Successfully created app/generated/b.tsx."],
		["create_file", "Successfully created app/generated/c.tsx."],
		["find_and_replace_code", "Successfully replaced code in app/generated/c.tsx:\n\n--- diff"],
	));

	await fs.writeFile(changedByDeveloper, "generated a, then edited by hand");
	// The developer edits b; a later run edits b again. What is on disk now is partly the
	// developer's, so the thread gives b up instead of adopting it.
	await fs.writeFile(editedByLaterRun, "generated b, edited by hand, then by the next run");
	await files.recordRunGeneratedFiles("thread-1", run(["find_and_replace_code", "Successfully replaced code in app/generated/b.tsx:\n\n--- diff"]));
	assert.deepEqual((await files.readManifest("thread-1")).map((entry) => entry.requestedPath), ["app/generated/a.tsx", "app/generated/c.tsx"]);
	assert.equal(warnings.some((message) => message.includes("edited by a later run")), true);

	assert.equal(await files.deleteLegacyRootFiles("thread-1"), 1);
	assert.equal(await fs.readFile(changedByDeveloper, "utf8"), "generated a, then edited by hand");
	assert.equal(await fs.readFile(editedByLaterRun, "utf8"), "generated b, edited by hand, then by the next run");
	assert.equal(await exists(editedInSameRun), false, "created and edited in one run: its final content is recorded");
});

test("a result path that only normalizes to the developer's file is never recorded", async (t) => {
	const { write, manager } = await createFixture(t);
	const developersFile = await write("lib/a.ts", "the developer's untracked file");
	const files = manager();
	for (const rawPath of [".lib/a.ts", "..lib/a.ts", "../lib/a.ts", "./../../lib/a.ts", ".//lib/a.ts", "lib//a.ts", "lib/./a.ts", "lib/../lib/a.ts"]) {
		await files.recordRunGeneratedFiles("thread-1", run(["create_file", `Successfully created ${rawPath}.`, rawPath]));
	}
	assert.deepEqual(await files.readManifest("thread-1"), []);
	assert.equal(await files.deleteLegacyRootFiles("thread-1"), 0);
	assert.equal(await fs.readFile(developersFile, "utf8"), "the developer's untracked file");

	// One leading "./" is how a tool may write a plain path; it names the same file.
	await files.recordRunGeneratedFiles("thread-2", run(["create_file", "Successfully created ./lib/a.ts."]));
	assert.deepEqual((await files.readManifest("thread-2")).map((entry) => entry.requestedPath), ["lib/a.ts"]);
});

test("a failure in output never records, whatever the preview says; an empty file gets no identity", async (t) => {
	const { write, manager } = await createFixture(t);
	await write("app/generated/failed.tsx", "x");
	await write("app/generated/empty.tsx", "");
	const files = manager();
	await files.recordRunGeneratedFiles("thread-1", [{
		parts: [
			{ type: "data-thinking-event", data: { phase: "result", toolName: "create_file", toolCallId: "f1", output: "Error calling tool 'create_file': failed", outputPreview: "Successfully created app/generated/failed.tsx." } },
			{ type: "data-thinking-event", data: { phase: "result", toolName: "create_file", toolCallId: "e1", output: "Successfully created app/generated/empty.tsx." } },
		],
	}]);
	assert.deepEqual(await files.readManifest("thread-1"), []);
});

test("a tracked file with a non-ASCII name renamed to another case or normalization still counts as tracked", async (t) => {
	const { projectRoot, write, commit, manager } = await createFixture(t);
	await write("app/Résumé.tsx", "tracked");
	commit("app/Résumé.tsx");
	// Rename on disk, through a temporary name, to another case and to decomposed (NFD) form.
	const renamed = "app/RÉSUMÉ.tsx".normalize("NFD");
	await fs.rename(path.join(projectRoot, "app", "Résumé.tsx"), path.join(projectRoot, "app", "tmp.tsx"));
	await fs.rename(path.join(projectRoot, "app", "tmp.tsx"), path.join(projectRoot, renamed));
	const files = manager();
	await files.recordRunGeneratedFiles("thread-1", run(["create_file", `Successfully created ${renamed}.`]));
	assert.equal((await files.readManifest("thread-1")).length, 1, "the planted-by-a-model record exists");

	assert.equal(await files.deleteLegacyRootFiles("thread-1"), 0);
	assert.equal(await fs.readFile(path.join(projectRoot, renamed), "utf8"), "tracked");
});

test("one cleanup asks git twice in total, however many files or threads it covers", async (t) => {
	const { write, manager, gitCalls } = await createFixture(t);
	const files = manager();
	const created = [];
	for (const threadId of ["thread-a", "thread-b"]) {
		const events = [];
		for (let index = 0; index < 25; index += 1) {
			const relativePath = `app/${threadId}/file-${index}.tsx`;
			created.push(await write(relativePath, `${threadId} ${index}`));
			events.push(["create_file", `Successfully created ${relativePath}.`, `${threadId}-${index}`]);
		}
		await files.recordRunGeneratedFiles(threadId, run(...events));
	}
	assert.deepEqual(gitCalls, [], "recording asks git nothing");

	assert.equal((await files.captureRootFilesToWorkspace("thread-a")).copiedCount, 25);
	assert.deepEqual(gitCalls.splice(0), ["ls-files", "check-ignore"]);
	assert.equal(await files.deleteGeneratedFilesForThreads(["thread-a", "thread-b"]), 50);
	assert.deepEqual(gitCalls.splice(0), ["ls-files", "check-ignore"]);
	for (const absolutePath of created) {
		assert.equal(await exists(absolutePath), false, absolutePath);
	}
});

test("a cleanup stops at its deadline, asks git nothing after it, and names what it left", async (t) => {
	const { projectRoot, write, manager, warnings, gitCalls } = await createFixture(t);
	let clock = 0;
	// Each look at the clock moves it one second; the deadline is three seconds away.
	const files = manager({ nowImpl: () => (clock += 1_000), cleanupDeadlineMs: 3_000 });
	const events = [];
	for (let index = 0; index < 6; index += 1) {
		await write(`app/generated/f${index}.tsx`, `f${index}`);
		events.push(["create_file", `Successfully created app/generated/f${index}.tsx.`, `c${index}`]);
	}
	await files.recordRunGeneratedFiles("thread-1", run(...events));
	clock = 0;

	assert.equal(await files.deleteLegacyRootFiles("thread-1"), 0);
	assert.deepEqual(gitCalls, [], "no git view once the deadline passed");
	const stop = warnings.find((message) => message.includes("stopped at its deadline"));
	assert.match(stop, /6 file\(s\) left in place/u);
	assert.match(stop, /thread-1:app\/generated\/f0\.tsx/u);
	for (let index = 0; index < 6; index += 1) {
		assert.equal(await exists(path.join(projectRoot, "app", "generated", `f${index}.tsx`)), true, `f${index}`);
	}
});

test("a full manifest forgets its oldest entries and logs it", async (t) => {
	const { write, manager, warnings, baseDir } = await createFixture(t);
	const files = manager();
	// A manifest already at the cap, all older than the next run.
	const manifestPath = path.join(baseDir, "rovo-app", "threads", "thread-1", "generated-files.json");
	await fs.mkdir(path.dirname(manifestPath), { recursive: true });
	await fs.writeFile(manifestPath, JSON.stringify(Array.from({ length: MAX_MANIFEST_ENTRIES }, (_, index) => ({
		requestedPath: `app/old/f${index}.tsx`,
		lastObservedAt: "2000-01-01T00:00:00.000Z",
		identity: { sha256: "0".repeat(64), size: 1 },
	}))));
	await write("app/generated/new.tsx", "new");
	await files.recordRunGeneratedFiles("thread-1", run(["create_file", "Successfully created app/generated/new.tsx."]));

	const manifest = await files.readManifest("thread-1");
	assert.equal(manifest.length, MAX_MANIFEST_ENTRIES);
	assert.equal(manifest.some((entry) => entry.requestedPath === "app/generated/new.tsx"), true);
	assert.equal(warnings.some((message) => message.includes("is full: forgetting the 1 oldest entries")), true);
});
