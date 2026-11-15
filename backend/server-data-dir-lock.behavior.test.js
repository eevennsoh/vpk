"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { makeTempDataDir, startBackend } = require("./__fixtures__/start-backend");

test("a second real backend on the same data directory exits 1 naming the first one's pid", { timeout: 60_000 }, async (t) => {
	const { dataDir, remove } = makeTempDataDir();
	const lockPath = path.join(dataDir, "backend.lock");
	const env = { VPK_BACKEND_DATA_DIR: dataDir };

	const first = startBackend(t, { env });
	await first.listening;
	t.after(remove);
	assert.equal(JSON.parse(fs.readFileSync(lockPath, "utf8")).pid, first.child.pid);

	const second = startBackend(t, { env });
	second.listening.catch(() => {}); // it must never listen; asserted below
	const { code } = await second.exited;
	assert.equal(code, 1, second.lines.join("\n"));
	assert.ok(
		second.lines.some((line) => line.includes(`already in use by backend pid ${first.child.pid}`)),
		second.lines.join("\n"),
	);
	assert.ok(!second.lines.some((line) => line.startsWith("[PROCESS] listening")), "the second backend never listened");
	assert.equal(JSON.parse(fs.readFileSync(lockPath, "utf8")).pid, first.child.pid, "the loser leaves the holder's lock in place");

	// A graceful stop removes the lock, so the next backend starts without a takeover.
	first.child.kill("SIGTERM");
	assert.equal((await first.exited).code, 0, first.lines.join("\n"));
	assert.equal(fs.existsSync(lockPath), false);

	const third = startBackend(t, { env });
	await third.listening;
	assert.ok(!third.lines.some((line) => line.includes("stale backend lock")), third.lines.join("\n"));
	third.child.kill("SIGTERM");
	await third.exited;
});

test("a real backend takes over a lock left by a process that is gone", { timeout: 60_000 }, async (t) => {
	const { dataDir, remove } = makeTempDataDir();
	const lockPath = path.join(dataDir, "backend.lock");
	// A pid far above any pid_max is never alive.
	fs.writeFileSync(lockPath, `${JSON.stringify({ pid: 2 ** 30, startedAt: "2026-01-01T00:00:00.000Z" })}\n`);

	const backend = startBackend(t, { env: { VPK_BACKEND_DATA_DIR: dataDir } });
	await backend.listening;
	t.after(remove);
	assert.ok(backend.lines.some((line) => line.includes(`pid ${2 ** 30} is gone`)), backend.lines.join("\n"));
	assert.equal(JSON.parse(fs.readFileSync(lockPath, "utf8")).pid, backend.child.pid);
	backend.child.kill("SIGTERM");
	await backend.exited;
});
