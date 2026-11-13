"use strict";

// Real lock files and a real process holding one open (no fake holder check), so the
// held/unheld distinction is the one the command relies on: lsof on macOS, /proc on Linux.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { spawnInGroup } = require("../lib/test-process");
const { inspectIndexLocks, removeStaleIndexLocks } = require("./index-locks");
const { MINUTE_MS } = require("./worktree-staleness");

function makeGitDir(root, name, ageMinutes) {
	const gitDir = path.join(root, name);
	fs.mkdirSync(gitDir, { recursive: true });
	const lock = path.join(gitDir, "index.lock");
	fs.writeFileSync(lock, "");
	const when = new Date(Date.now() - ageMinutes * MINUTE_MS);
	fs.utimesSync(lock, when, when);
	return { worktree: path.join(root, `${name}-worktree`), gitDir, lock };
}

// A child that opens the file, says so, and keeps it open until killed.
async function holdOpen(t, file) {
	const child = spawnInGroup(process.execPath, ["-e", "const fd = require('node:fs').openSync(process.argv[1], 'r+'); process.stdout.write('open\\n'); setInterval(() => fd, 1000);", file], { stdio: ["ignore", "pipe", "inherit"] }, { t });
	await new Promise((resolve, reject) => {
		child.stdout.once("data", resolve);
		child.once("exit", (code) => reject(new Error(`holder exited ${code}`)));
	});
	return child;
}

test("a stale lock nobody holds is removed; a held one, a young one and the main checkout's stay", async (t) => {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "index-locks-")));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const unheld = makeGitDir(root, "unheld", 60);
	const held = makeGitDir(root, "held", 60);
	const young = makeGitDir(root, "young", 1);
	const main = makeGitDir(root, "main", 60);
	const holder = await holdOpen(t, held.lock);

	const inspected = await inspectIndexLocks(
		[unheld, held, young, { ...main, protectedCheckout: true }],
		{ minAgeMs: 30 * MINUTE_MS },
	);
	const byName = Object.fromEntries(inspected.map((entry) => [path.basename(path.dirname(entry.lock)), entry]));
	if (byName.held.holders === null) {
		// The process table could not be fully read (Linux as a non-root user cannot read
		// root's descriptors): unknown is never safe, so nothing is removed.
		assert.equal(inspected.every((entry) => entry.decision.action === "keep"), true);
		await removeStaleIndexLocks(inspected);
		assert.equal([unheld, held, young, main].every(({ lock }) => fs.existsSync(lock)), true);
		return;
	}
	assert.equal(byName.unheld.decision.action, "remove");
	assert.deepEqual(byName.held.holders.map(({ pid }) => pid), [holder.pid]);
	assert.equal(byName.held.decision.action, "keep");
	assert.equal(byName.young.decision.action, "keep");
	assert.equal(byName.main.decision.action, "keep");

	const results = await removeStaleIndexLocks(inspected);
	assert.deepEqual(results.filter((entry) => entry.removed).map((entry) => entry.lock), [unheld.lock]);
	assert.equal(fs.existsSync(unheld.lock), false);
	assert.equal(fs.existsSync(held.lock), true);
	assert.equal(fs.existsSync(young.lock), true);
	assert.equal(fs.existsSync(main.lock), true);
});

test("when the holder check cannot run, nothing is removed", async (t) => {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "index-locks-")));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const stale = makeGitDir(root, "stale", 60);
	const unreadable = async () => null;

	const inspected = await inspectIndexLocks([stale], { minAgeMs: 30 * MINUTE_MS, findHolders: unreadable, readProcessCwds: unreadable });
	assert.equal(inspected[0].holders, null);
	assert.equal(inspected[0].decision.action, "keep");
	assert.deepEqual(await removeStaleIndexLocks(inspected, { findHolders: unreadable, readProcessCwds: unreadable }), [
		{ lock: stale.lock, removed: false, reason: "lock holders unknown (process check unavailable)" },
	]);
	assert.equal(fs.existsSync(stale.lock), true);
});

test("a lock that changed or became held after inspection is kept on the recheck", async (t) => {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "index-locks-")));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const changed = makeGitDir(root, "changed", 60);
	const nowHeld = makeGitDir(root, "now-held", 60);
	const inspected = await inspectIndexLocks([changed, nowHeld], { minAgeMs: 30 * MINUTE_MS, findHolders: async (paths) => new Map(paths.map((file) => [file, []])), readProcessCwds: async () => [] });
	fs.utimesSync(changed.lock, new Date(), new Date());
	const results = await removeStaleIndexLocks(inspected, {
		findHolders: async (paths) => new Map(paths.map((file) => [file, [{ pid: 9, command: "git" }]])),
		readProcessCwds: async () => [],
	});
	assert.deepEqual(results.map(({ removed, reason }) => ({ removed, reason })), [
		{ removed: false, reason: "changed since it was inspected" },
		{ removed: false, reason: "held on recheck" },
	]);
	assert.equal(fs.existsSync(changed.lock) && fs.existsSync(nowHeld.lock), true);
});

test("a git process working in the worktree keeps an unheld old lock; only a non-git one does not", async (t) => {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "index-locks-")));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const committing = makeGitDir(root, "committing", 60);
	const agentOnly = makeGitDir(root, "agent-only", 60);
	const unknown = makeGitDir(root, "unknown", 60);
	const nobody = async (paths) => new Map(paths.map((file) => [file, []]));
	const cwds = [
		{ pid: 101, command: "git", cwd: committing.worktree },
		{ pid: 102, command: "claude", cwd: path.join(agentOnly.worktree, "backend") },
	];

	const inspected = await inspectIndexLocks([committing, agentOnly], { minAgeMs: 30 * MINUTE_MS, findHolders: nobody, readProcessCwds: async () => cwds });
	assert.deepEqual(inspected.map((entry) => entry.decision.action), ["keep", "remove"]);
	assert.equal(inspected[0].decision.reason, "git is running in the worktree: pid 101 (git)");
	const [unknownEntry] = await inspectIndexLocks([unknown], { minAgeMs: 30 * MINUTE_MS, findHolders: nobody, readProcessCwds: async () => null });
	assert.equal(unknownEntry.decision.action, "keep");

	// A git command that starts between inspection and removal keeps the lock.
	const results = await removeStaleIndexLocks(inspected, {
		findHolders: nobody,
		readProcessCwds: async () => [...cwds, { pid: 103, command: "git", cwd: agentOnly.worktree }],
	});
	assert.deepEqual(results.map(({ removed, reason }) => ({ removed, reason })), [
		{ removed: false, reason: "git is running in the worktree: pid 101 (git)" },
		{ removed: false, reason: "on recheck: git is running in the worktree: pid 103 (git)" },
	]);
	assert.equal(fs.existsSync(committing.lock) && fs.existsSync(agentOnly.lock), true);

	// With the git command gone, the agent-only lock is removed.
	const removed = await removeStaleIndexLocks(inspected, { findHolders: nobody, readProcessCwds: async () => cwds });
	assert.deepEqual(removed.map(({ removed: done }) => done), [false, true]);
	assert.equal(fs.existsSync(agentOnly.lock), false);
});

test("a lock replaced while its holders were being read is kept", async (t) => {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "index-locks-")));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const stale = makeGitDir(root, "stale", 60);
	const nobody = async (paths) => new Map(paths.map((file) => [file, []]));
	const inspected = await inspectIndexLocks([stale], { minAgeMs: 30 * MINUTE_MS, findHolders: nobody, readProcessCwds: async () => [] });
	assert.equal(inspected[0].decision.action, "remove");

	// A git command removes the old lock and takes a new one during the recheck's scan.
	// Both files exist at once before the rename, so the new one has another inode even on
	// filesystems that reuse freed inode numbers; its mtime is made identical on purpose.
	const replacing = async (paths) => {
		const next = `${stale.lock}.next`;
		fs.writeFileSync(next, "");
		const when = new Date(inspected[0].mtimeMs);
		fs.utimesSync(next, when, when);
		fs.renameSync(next, stale.lock);
		return nobody(paths);
	};
	const [result] = await removeStaleIndexLocks(inspected, { findHolders: replacing, readProcessCwds: async () => [] });
	assert.deepEqual({ removed: result.removed, reason: result.reason }, { removed: false, reason: "replaced during the recheck" });
	assert.equal(fs.existsSync(stale.lock), true);
});

test("a lock released right after it was found does not abort the inspection", async (t) => {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "index-locks-")));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const released = makeGitDir(root, "released", 60);
	const kept = makeGitDir(root, "kept", 60);
	// git finishes between the stat that found the lock and anything after it.
	const statSync = fs.statSync;
	fs.statSync = (file, ...rest) => {
		const stat = statSync(file, ...rest);
		if (file === released.lock) fs.rmSync(file, { force: true });
		return stat;
	};
	t.after(() => {
		fs.statSync = statSync;
	});
	const inspected = await inspectIndexLocks([released, kept], { minAgeMs: 30 * MINUTE_MS, findHolders: async () => new Map(), readProcessCwds: async () => [] });
	fs.statSync = statSync;
	assert.deepEqual(inspected.map((entry) => entry.lock).sort(), [kept.lock, released.lock].sort());
	const removals = await removeStaleIndexLocks(inspected, { findHolders: async () => new Map(), readProcessCwds: async () => [] });
	const byLock = Object.fromEntries(removals.map((entry) => [entry.lock, entry]));
	assert.deepEqual([byLock[released.lock].removed, byLock[released.lock].reason], [false, "changed since it was inspected"]);
	assert.equal(byLock[kept.lock].removed, true);
});
