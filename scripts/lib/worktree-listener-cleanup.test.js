const assert = require("node:assert/strict");
const test = require("node:test");

const {
	cleanupListeningProcessesForWorktree,
	findListeningPidsForWorktree,
	findRovoSupervisorPidsForWorktree,
	listAncestorPids,
} = require("./worktree-listener-cleanup");

test("findListeningPidsForWorktree only returns listeners whose cwd matches the target worktree", () => {
	const worktreePath = "/tmp/repo-a";

	const matchedPids = findListeningPidsForWorktree({
		protectedPids: new Set([process.pid]),
		worktreePath,
		listListeningPidsFn: () => [320, 120, 220, 120],
		getProcessCwdFn: (pid) => {
			switch (pid) {
				case 120:
				case 320:
					return worktreePath;
				case 220:
					return "/tmp/repo-b";
				default:
					return null;
			}
		},
	});

	assert.deepEqual(matchedPids, [120, 320]);
});

test("findRovoSupervisorPidsForWorktree only returns matching per-port supervisors in the target worktree", () => {
	const worktreePath = "/tmp/repo-a";

	const matchedPids = findRovoSupervisorPidsForWorktree({
		protectedPids: new Set([process.pid]),
		worktreePath,
		listProcessInfoFn: () => [
			{ pid: 120, command: "node scripts/dev-rovo-port.js 8000" },
			{ pid: 220, command: "node scripts/dev-rovo-port.js 8001" },
			{ pid: 320, command: "node scripts/dev-backend.js" },
			{ pid: 120, command: "node scripts/dev-rovo-port.js 8000" },
		],
		getProcessCwdFn: (pid) => {
			switch (pid) {
				case 120:
					return worktreePath;
				case 220:
					return "/tmp/repo-b";
				case 320:
					return worktreePath;
				default:
					return null;
			}
		},
	});

	assert.deepEqual(matchedPids, [120]);
});

test("cleanupListeningProcessesForWorktree escalates only the matching listeners that survive SIGTERM", async () => {
	const alivePids = new Set([410, 420, 999]);
	const killCalls = [];
	const sleepCalls = [];

	const result = await cleanupListeningProcessesForWorktree({
		listAncestorPidsFn: () => [],
		worktreePath: "/tmp/repo-a",
		listListeningPidsFn: () => [410, 420, 999],
		listProcessInfoFn: () => [],
		getProcessCwdFn: (pid) => (pid === 999 ? "/tmp/repo-b" : "/tmp/repo-a"),
		killFn: (pid, signal) => {
			killCalls.push([pid, signal]);

			if (signal === 0) {
				if (!alivePids.has(pid)) {
					const error = new Error("ESRCH");
					error.code = "ESRCH";
					throw error;
				}
				return;
			}

			if (signal === "SIGTERM") {
				if (pid === 410) {
					alivePids.delete(pid);
				}
				return;
			}

			if (signal === "SIGKILL") {
				alivePids.delete(pid);
				return;
			}

			throw new Error(`Unexpected signal: ${signal}`);
		},
		sleepFn: async (ms) => {
			sleepCalls.push(ms);
		},
		gracePeriodMs: 25,
		logger: {
			log: () => {},
			warn: () => {},
		},
	});

	assert.deepEqual(killCalls, [
		[410, "SIGTERM"],
		[420, "SIGTERM"],
		[410, 0],
		[420, 0],
		[420, "SIGKILL"],
	]);
	assert.deepEqual(sleepCalls, [25]);
	assert.deepEqual(result, {
		worktreePath: "/tmp/repo-a",
		matchedListenerPids: [410, 420],
		matchedSupervisorPids: [],
		matchedPids: [410, 420],
		signalledCount: 2,
		gracefulCount: 1,
		forceKilledCount: 1,
	});
});

test("cleanupListeningProcessesForWorktree also stops orphaned rovo supervisors in the matching worktree", async () => {
	const alivePids = new Set([430, 999]);
	const killCalls = [];
	const sleepCalls = [];

	const result = await cleanupListeningProcessesForWorktree({
		listAncestorPidsFn: () => [],
		worktreePath: "/tmp/repo-a",
		listListeningPidsFn: () => [],
		listProcessInfoFn: () => [
			{ pid: 430, command: "node scripts/dev-rovo-port.js 8000" },
			{ pid: 440, command: "node scripts/dev-backend.js" },
			{ pid: 999, command: "node scripts/dev-rovo-port.js 8001" },
		],
		getProcessCwdFn: (pid) => (pid === 999 ? "/tmp/repo-b" : "/tmp/repo-a"),
		killFn: (pid, signal) => {
			killCalls.push([pid, signal]);

			if (signal === 0) {
				if (!alivePids.has(pid)) {
					const error = new Error("ESRCH");
					error.code = "ESRCH";
					throw error;
				}
				return;
			}

			if (signal === "SIGTERM") {
				alivePids.delete(pid);
				return;
			}

			throw new Error(`Unexpected signal: ${signal}`);
		},
		sleepFn: async (ms) => {
			sleepCalls.push(ms);
		},
		gracePeriodMs: 25,
		logger: {
			log: () => {},
			warn: () => {},
		},
	});

	assert.deepEqual(killCalls, [
		[430, "SIGTERM"],
		[430, 0],
	]);
	assert.deepEqual(sleepCalls, [25]);
	assert.deepEqual(result, {
		worktreePath: "/tmp/repo-a",
		matchedListenerPids: [],
		matchedSupervisorPids: [430],
		matchedPids: [430],
		signalledCount: 1,
		gracefulCount: 1,
		forceKilledCount: 0,
	});
});

test("cleanupListeningProcessesForWorktree never signals its own ancestors, such as an agent session listening in the worktree", async () => {
	const worktreePath = "/tmp/repo-a";
	const agentSessionPid = 66593;
	const devServerPid = 540;
	const killCalls = [];

	const result = await cleanupListeningProcessesForWorktree({
		worktreePath,
		listListeningPidsFn: () => [agentSessionPid, devServerPid],
		listProcessInfoFn: () => [],
		getProcessCwdFn: () => worktreePath,
		listAncestorPidsFn: () => [7001, agentSessionPid],
		killFn: (pid, signal) => {
			killCalls.push([pid, signal]);
			if (signal === 0) {
				throw new Error("gone");
			}
		},
		sleepFn: async () => {},
		logger: { log: () => {}, warn: () => {} },
	});

	assert.deepEqual(killCalls, [
		[devServerPid, "SIGTERM"],
		[devServerPid, 0],
	]);
	assert.deepEqual(result.matchedPids, [devServerPid]);
});

test("listAncestorPids walks the parent chain from the given pid and stops at launchd", () => {
	const ancestors = listAncestorPids({
		pid: 300,
		execSyncFn: () => "  1     0\n 100     1\n 200   100\n 300   200\n 400   300\n",
	});

	assert.deepEqual(ancestors, [200, 100]);
});

test("with the process table unreadable, the cleanup signals nothing", async () => {
	assert.equal(listAncestorPids({ execSyncFn: () => { throw new Error("ps: Operation not permitted"); } }), null);
	assert.equal(listAncestorPids({ pid: 999, execSyncFn: () => "  1     0\n" }), null, "our own pid missing from the table");
	const signals = [];
	const result = await cleanupListeningProcessesForWorktree({
		worktreePath: "/repo/worktree",
		listListeningPidsFn: () => [4242],
		listProcessInfoFn: () => [],
		getProcessCwdFn: () => "/repo/worktree",
		listAncestorPidsFn: () => null,
		killFn: (pid, signal) => signals.push([pid, signal]),
		sleepFn: async () => {},
		logger: { log() {}, warn() {} },
	});
	assert.equal(result.blocked, true);
	assert.deepEqual(signals, []);
});
