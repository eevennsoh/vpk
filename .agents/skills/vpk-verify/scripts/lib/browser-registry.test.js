const assert = require("node:assert/strict");
const { mkdtempSync, readdirSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");

const {
	BROWSER_IDLE_HOURS,
	classifyBrowserRecord,
	listBrowserRecords,
	noteBrowserUse,
	ownerState,
	removeBrowserRecord,
	resolveOwner,
} = require("./browser-registry.js");
const { closeBrowserSessionBestEffort, closeOrphanedBrowsers, closeRecordedBrowser } = require("./browser.js");

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const OWNER = { pid: 4100, startedAt: "Fri Nov 13 09:00:00 2026", name: "claude" };

function withRegistry(callback) {
	const dir = mkdtempSync(join(tmpdir(), "browser-registry-test-"));
	try {
		return callback(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function fakeProcesses(table) {
	return (pid) => table[pid] ?? null;
}

test("the owner is the nearest claude, codex or cursor-agent ancestor", () => {
	const read = fakeProcesses({
		200: { ppid: 150, startedAt: "a", name: "node" },
		150: { ppid: 120, startedAt: "b", name: "zsh" },
		120: { ppid: 1, startedAt: "Fri Nov 13 09:00:00 2026", name: "claude" },
	});
	assert.deepEqual(resolveOwner({ env: {}, startPid: 200, read }), { pid: 120, startedAt: "Fri Nov 13 09:00:00 2026", name: "claude" });
});

test("no agent ancestor means no owner", () => {
	const read = fakeProcesses({ 200: { ppid: 1, startedAt: "a", name: "launchd-child" } });
	assert.equal(resolveOwner({ env: {}, startPid: 200, read }), null);
});

test("VPK_BROWSER_OWNER_PID names the owner directly", () => {
	const read = fakeProcesses({ 77: { ppid: 1, startedAt: "c", name: "node" } });
	assert.deepEqual(resolveOwner({ env: { VPK_BROWSER_OWNER_PID: "77" }, startPid: 200, read }), { pid: 77, startedAt: "c", name: "node" });
});

test("a reused pid with a different start time is not the owner", () => {
	const exists = () => "exists";
	assert.equal(ownerState(OWNER, { probe: exists, read: fakeProcesses({ 4100: { ppid: 1, startedAt: OWNER.startedAt, name: "claude" } }) }), "alive");
	assert.equal(ownerState(OWNER, { probe: exists, read: fakeProcesses({ 4100: { ppid: 1, startedAt: "Fri Nov 13 11:59:00 2026", name: "zsh" } }) }), "gone");
	assert.equal(ownerState(OWNER, { probe: () => "missing", read: fakeProcesses({}) }), "gone");
});

test("an owner that cannot be inspected is unknown, not gone", () => {
	// A sandbox denies ps (and may deny signals) while the recorded owner is still running.
	assert.equal(ownerState(OWNER, { probe: () => "exists", read: () => null }), "unknown");
	assert.equal(ownerState(OWNER, { probe: () => "unknown", read: () => null }), "unknown");
	const fresh = { session: "s", owner: OWNER, lastUsedAt: new Date(NOW - 10 * 60_000).toISOString() };
	const unknown = classifyBrowserRecord(fresh, { stateOf: () => "unknown", now: NOW });
	assert.equal(unknown.action, "keep");
	assert.match(unknown.reason, /owner claude pid 4100 unknown/u);
	const idle = { ...fresh, lastUsedAt: new Date(NOW - (BROWSER_IDLE_HOURS + 1) * HOUR).toISOString() };
	assert.equal(classifyBrowserRecord(idle, { stateOf: () => "unknown", now: NOW }).action, "close");
});

test("cleanup --browser keeps this chat's record when the close fails", () => {
	const forgotten = [];
	const forget = (session) => forgotten.push(session);
	const resolveSession = () => "vpk-verify-mine";
	const findRecord = () => null;
	assert.equal(closeBrowserSessionBestEffort({ findRecord, forget, resolveSession, runCommand: () => ({ status: 1, stderr: "daemon did not answer", stdout: "" }) }), false);
	assert.equal(closeBrowserSessionBestEffort({ findRecord, forget, resolveSession, runCommand: () => ({ status: null, error: Object.assign(new Error("spawnSync ETIMEDOUT"), { code: "ETIMEDOUT" }) }) }), false);
	assert.deepEqual(forgotten, []);
	assert.equal(closeBrowserSessionBestEffort({ findRecord, forget, resolveSession, runCommand: () => ({ status: 0, stdout: "✓ Browser closed" }) }), true);
	assert.equal(closeBrowserSessionBestEffort({ findRecord, forget, resolveSession, runCommand: () => ({ status: 1, stderr: "No browser session found" }) }), true);
	assert.deepEqual(forgotten, ["vpk-verify-mine", "vpk-verify-mine"]);
});

test("a starting command records the browser; other commands only refresh a record", () => {
	withRegistry((dir) => {
		assert.equal(noteBrowserUse("vpk-verify-a", { dir, env: {}, now: NOW, owner: OWNER, started: false }), null);
		assert.deepEqual(readdirSync(dir), []);

		noteBrowserUse("vpk-verify-a", { dir, env: { AGENT_BROWSER_NAMESPACE: "ns1" }, now: NOW, owner: OWNER, started: true, worktree: "/wt/a" });
		noteBrowserUse("vpk-verify-a", { dir, env: { AGENT_BROWSER_NAMESPACE: "ns1" }, now: NOW + HOUR, started: false, worktree: "/wt/a" });
		const [entry] = listBrowserRecords({ dir });
		assert.equal(entry.record.session, "vpk-verify-a");
		assert.equal(entry.record.namespace, "ns1");
		assert.equal(entry.record.worktree, "/wt/a");
		assert.deepEqual(entry.record.owner, OWNER);
		assert.equal(entry.record.startedAt, new Date(NOW).toISOString());
		assert.equal(entry.record.lastUsedAt, new Date(NOW + HOUR).toISOString());
		assert.deepEqual(readdirSync(dir).filter((name) => name.endsWith(".tmp")), []);

		removeBrowserRecord("vpk-verify-a", { dir, namespace: "ns1" });
		assert.deepEqual(listBrowserRecords({ dir }), []);
	});
});

test("records are closed when the owner is gone or the browser sat unused", () => {
	const alive = () => "alive";
	const gone = () => "gone";
	const fresh = { session: "s", owner: OWNER, lastUsedAt: new Date(NOW - 10 * 60_000).toISOString() };
	const stale = { ...fresh, lastUsedAt: new Date(NOW - (BROWSER_IDLE_HOURS + 1) * HOUR).toISOString() };
	const ownerless = { session: "s", owner: null, lastUsedAt: fresh.lastUsedAt };

	assert.equal(classifyBrowserRecord(fresh, { stateOf: alive, now: NOW }).action, "keep");
	assert.match(classifyBrowserRecord(fresh, { stateOf: gone, now: NOW }).reason, /owner claude pid 4100 is gone/u);
	assert.equal(classifyBrowserRecord(fresh, { stateOf: gone, now: NOW }).action, "close");
	assert.equal(classifyBrowserRecord(stale, { stateOf: alive, now: NOW }).action, "close");
	assert.equal(classifyBrowserRecord(ownerless, { stateOf: alive, now: NOW }).action, "keep");
	assert.equal(classifyBrowserRecord({ ...ownerless, lastUsedAt: stale.lastUsedAt }, { now: NOW }).action, "close");
});

test("orphan cleanup closes and forgets only what it should, and keeps a record it could not close", () => {
	const entries = [
		{ file: "/r/keep.json", record: { session: "keep", worktree: "/wt/a" } },
		{ file: "/r/close.json", record: { session: "close", worktree: "/wt/b", namespace: "ns" } },
		{ file: "/r/stuck.json", record: { session: "stuck", worktree: "/wt/c" } },
	];
	const classify = (record) => (record.session === "keep" ? { action: "keep", reason: "owner alive" } : { action: "close", reason: "owner gone" });
	const closed = [];
	const removed = [];
	const lines = closeOrphanedBrowsers({
		classify,
		close: (record) => {
			closed.push(record.session);
			return { closed: record.session !== "stuck" };
		},
		records: entries,
		remove: (entry) => removed.push(entry.file),
	});
	assert.deepEqual(closed, ["close", "stuck"]);
	assert.deepEqual(removed, ["/r/close.json"]);
	assert.deepEqual(lines, [
		"kept browser keep from /wt/a: owner alive",
		"closed browser close (namespace ns) from /wt/b: owner gone",
		"FAILED to close browser stuck from /wt/c: owner gone",
	]);

	const dryClosed = [];
	const dry = closeOrphanedBrowsers({ classify, close: (record) => ({ closed: dryClosed.push(record) > 0 }), dryRun: true, records: entries, remove: () => assert.fail("dry run removed a record") });
	assert.deepEqual(dryClosed, []);
	assert.match(dry[1], /^would close browser close/u);
});

test("a record file that is not JSON is ignored", () => {
	withRegistry((dir) => {
		require("node:fs").writeFileSync(join(dir, "broken.json"), "{");
		assert.deepEqual(listBrowserRecords({ dir }), []);
		assert.equal(readFileSync(join(dir, "broken.json"), "utf8"), "{");
	});
});

// A daemon recorded with its pid and start time; `table` maps pid -> process info as the fake ps sees it.
function daemonCase({ closeResult, table, afterTerm = {} }) {
	const record = { session: "vpk-verify-x", worktree: "/wt/x", daemon: { pid: 500, startedAt: "Fri Nov 13 13:00:00 2026", name: "agent-browser-darwin-arm64" } };
	const processes = { ...table };
	const signals = [];
	const outcome = closeRecordedBrowser(record, {
		children: (pid) => (pid === 500 ? [501] : pid === 501 ? [502] : []),
		read: (pid) => processes[pid] ?? null,
		runCommand: () => closeResult,
		signal: (pid, name) => {
			signals.push(`${name} ${pid}`);
			if (name === "SIGCONT") Object.assign(processes, afterTerm);
		},
		wait: (condition) => condition(),
	});
	return { outcome, signals };
}
const LIVE = { 500: { ppid: 1, startedAt: "Fri Nov 13 13:00:00 2026", name: "agent-browser-darwin-arm64" } };

test("a 'failed to connect' close with the daemon still alive is not taken as closed: it is ended by pid", () => {
	const { outcome, signals } = daemonCase({
		closeResult: { status: 1, stderr: "Failed to connect to daemon socket" },
		table: LIVE,
		afterTerm: { 500: undefined },
	});
	assert.deepEqual(signals, ["SIGTERM 500", "SIGTERM 501", "SIGTERM 502", "SIGCONT 500", "SIGCONT 501", "SIGCONT 502"]);
	assert.equal(outcome.closed, true);
	assert.match(outcome.detail, /ended daemon pid 500 and 2 descendant/u);
});

test("a daemon that survives SIGTERM keeps its record and is reported", () => {
	const { outcome } = daemonCase({ closeResult: { status: 1, stderr: "Failed to connect" }, table: LIVE });
	assert.equal(outcome.closed, false);
	assert.match(outcome.detail, /daemon pid 500 still running after SIGTERM/u);
	const line = closeOrphanedBrowsers({
		classify: () => ({ action: "close", reason: "owner gone" }),
		close: () => outcome,
		records: [{ file: "/r/x.json", record: { session: "vpk-verify-x", worktree: "/wt/x" } }],
		remove: () => assert.fail("a running daemon's record was removed"),
	});
	assert.match(line[0], /^FAILED to close browser vpk-verify-x .*daemon pid 500 still running/u);
});

test("a daemon pid that is gone, or reused by another process, counts as closed and is never signalled", () => {
	const gone = daemonCase({ closeResult: { status: 0 }, table: {} });
	assert.equal(gone.outcome.closed, true);
	assert.deepEqual(gone.signals, []);
	const reused = daemonCase({ closeResult: { status: 1, stderr: "Failed to connect" }, table: { 500: { ppid: 1, startedAt: "Fri Nov 13 13:20:00 2026", name: "zsh" } } });
	assert.equal(reused.outcome.closed, true);
	assert.deepEqual(reused.signals, []);
});

test("a recorded pid that is not an agent-browser process is never signalled", () => {
	const { outcome, signals } = daemonCase({
		closeResult: { status: 1, stderr: "timeout" },
		table: { 500: { ppid: 1, startedAt: "Fri Nov 13 13:00:00 2026", name: "python3" } },
	});
	assert.equal(outcome.closed, false);
	assert.deepEqual(signals, []);
});

test("a record without a daemon pid falls back to the close command's result", () => {
	const record = { session: "vpk-verify-old", worktree: "/wt/x" };
	assert.equal(closeRecordedBrowser(record, { runCommand: () => ({ status: 0 }) }).closed, true);
	assert.equal(closeRecordedBrowser(record, { runCommand: () => ({ status: 1, stderr: "No browser session found" }) }).closed, true);
	assert.equal(closeRecordedBrowser(record, { runCommand: () => ({ status: 1, stderr: "boom" }) }).closed, false);
});
