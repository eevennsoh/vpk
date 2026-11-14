const { execSync } = require("node:child_process");
const path = require("node:path");

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

const ROVO_SUPERVISOR_COMMAND_PATTERN =
	/(?:^|\s)(?:\S*\/)?node(?:\s+--[^\s]+)*\s+(?:\S*\/)?scripts\/dev-rovo-port\.js(?:\s|$)/;

function getUniqueSortedPids(values) {
	return Array.from(
		new Set(
			values.filter((value) => Number.isInteger(value) && value > 0)
		)
	).sort((left, right) => left - right);
}

function parseProcessInfoLine(line) {
	const match = line.match(/^(\d+)\s+(.*)$/);
	if (!match) {
		return null;
	}

	const pid = Number.parseInt(match[1], 10);
	if (!Number.isInteger(pid) || pid <= 0) {
		return null;
	}

	return {
		pid,
		command: match[2],
	};
}

function buildCleanupResult({
	worktreePath,
	matchedListenerPids,
	matchedSupervisorPids,
	signalledCount = 0,
	forceKilledCount = 0,
}) {
	const matchedPids = getUniqueSortedPids([
		...matchedListenerPids,
		...matchedSupervisorPids,
	]);

	return {
		worktreePath,
		matchedListenerPids,
		matchedSupervisorPids,
		matchedPids,
		signalledCount,
		gracefulCount: Math.max(signalledCount - forceKilledCount, 0),
		forceKilledCount,
	};
}

function listListeningPids({ execSyncFn = execSync } = {}) {
	try {
		const output = execSyncFn("lsof -nP -iTCP -sTCP:LISTEN -t", {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		return getUniqueSortedPids(
			output
				.trim()
				.split(/\s+/)
				.map((value) => Number.parseInt(value, 10))
		);
	} catch {
		return [];
	}
}

function listProcessInfo({ execSyncFn = execSync } = {}) {
	try {
		const output = execSyncFn("ps -axo pid=,command=", {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		return output
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.map(parseProcessInfoLine)
			.filter((entry) => entry !== null);
	} catch {
		return [];
	}
}

function getProcessCwd(pid, { execSyncFn = execSync } = {}) {
	try {
		const output = execSyncFn(`lsof -a -d cwd -p ${pid} -Fn`, {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const cwdLine = output
			.split("\n")
			.map((line) => line.trim())
			.find((line) => line.startsWith("n"));

		if (!cwdLine) {
			return null;
		}

		return path.resolve(cwdLine.slice(1));
	} catch {
		return null;
	}
}

// The cleanup's own ancestors (the shell, pnpm, and an agent session such as Claude Code that
// listens on a port with its cwd in the worktree) must never be signalled: killing them ends
// the caller's session.
function listAncestorPids({ pid = process.pid, execSyncFn = execSync } = {}) {
	let output;
	try {
		output = execSyncFn("ps -axo pid=,ppid=", {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
	} catch {
		return [];
	}

	const parentByPid = new Map();
	for (const line of output.split("\n")) {
		const match = line.trim().match(/^(\d+)\s+(\d+)$/);
		if (match) {
			parentByPid.set(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10));
		}
	}

	const ancestors = [];
	let current = parentByPid.get(pid);
	while (Number.isInteger(current) && current > 1 && !ancestors.includes(current)) {
		ancestors.push(current);
		current = parentByPid.get(current);
	}
	return ancestors;
}

function getProtectedPids(listAncestorPidsFn = listAncestorPids) {
	return new Set([process.pid, ...listAncestorPidsFn()]);
}

function findListeningPidsForWorktree({
	worktreePath = process.cwd(),
	listListeningPidsFn = listListeningPids,
	getProcessCwdFn = getProcessCwd,
	protectedPids = getProtectedPids(),
} = {}) {
	const normalizedWorktreePath = path.resolve(worktreePath);

	return getUniqueSortedPids(
		listListeningPidsFn()
			.filter((pid) => !protectedPids.has(pid))
			.filter((pid) => getProcessCwdFn(pid) === normalizedWorktreePath)
	);
}

function findRovoSupervisorPidsForWorktree({
	worktreePath = process.cwd(),
	listProcessInfoFn = listProcessInfo,
	getProcessCwdFn = getProcessCwd,
	protectedPids = getProtectedPids(),
} = {}) {
	const normalizedWorktreePath = path.resolve(worktreePath);

	return getUniqueSortedPids(
		listProcessInfoFn()
			.filter((entry) => entry && !protectedPids.has(entry.pid))
			.filter((entry) => ROVO_SUPERVISOR_COMMAND_PATTERN.test(entry.command))
			.filter((entry) => getProcessCwdFn(entry.pid) === normalizedWorktreePath)
			.map((entry) => entry.pid)
	);
}

async function cleanupListeningProcessesForWorktree({
	worktreePath = process.cwd(),
	listListeningPidsFn = listListeningPids,
	listProcessInfoFn = listProcessInfo,
	getProcessCwdFn = getProcessCwd,
	listAncestorPidsFn = listAncestorPids,
	killFn = process.kill,
	sleepFn = sleep,
	gracePeriodMs = 2_000,
	logger = console,
} = {}) {
	const normalizedWorktreePath = path.resolve(worktreePath);
	const protectedPids = getProtectedPids(listAncestorPidsFn);
	const matchedListenerPids = findListeningPidsForWorktree({
		worktreePath: normalizedWorktreePath,
		listListeningPidsFn,
		getProcessCwdFn,
		protectedPids,
	});
	const matchedSupervisorPids = findRovoSupervisorPidsForWorktree({
		worktreePath: normalizedWorktreePath,
		listProcessInfoFn,
		getProcessCwdFn,
		protectedPids,
	});
	const initialResult = buildCleanupResult({
		worktreePath: normalizedWorktreePath,
		matchedListenerPids,
		matchedSupervisorPids,
	});
	const { matchedPids } = initialResult;

	if (matchedPids.length === 0) {
		return initialResult;
	}

	logger.log?.(
		`[cleanup] Stopping ${matchedPids.length} worktree process(es) for ${normalizedWorktreePath}...`
	);

	let signalledCount = 0;
	for (const pid of matchedPids) {
		try {
			killFn(pid, "SIGTERM");
			signalledCount += 1;
		} catch {
			// Ignore kill failures; the process may already be gone.
		}
	}

	if (signalledCount === 0) {
		return initialResult;
	}

	await sleepFn(gracePeriodMs);

	let forceKilledCount = 0;
	for (const pid of matchedPids) {
		try {
			killFn(pid, 0);
		} catch {
			continue;
		}

		try {
			killFn(pid, "SIGKILL");
			forceKilledCount += 1;
		} catch {
			// Ignore kill failures; the process may have exited between checks.
		}
	}

	if (forceKilledCount > 0) {
		logger.warn?.(
			`[cleanup] Force-killed ${forceKilledCount} lingering process(es) for ${normalizedWorktreePath}.`
		);
	}

	return buildCleanupResult({
		worktreePath: normalizedWorktreePath,
		matchedListenerPids,
		matchedSupervisorPids,
		signalledCount,
		forceKilledCount,
	});
}

module.exports = {
	cleanupListeningProcessesForWorktree,
	findListeningPidsForWorktree,
	findRovoSupervisorPidsForWorktree,
	getProcessCwd,
	getProtectedPids,
	listAncestorPids,
	listProcessInfo,
	listListeningPids,
};
