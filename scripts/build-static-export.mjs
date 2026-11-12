import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const JOURNAL_SCHEMA = 1;
const rootDir = process.cwd();
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const journalPath = join(rootDir, ".static-export-journal.json");
const temporaryMoves = [
	{
		source: join(rootDir, "app", "api"),
		backup: join(rootDir, ".api-routes-backup"),
	},
];
const TERMINATION_EXIT_CODES = { SIGHUP: 129, SIGINT: 130, SIGTERM: 143 };

let buildProcess = null;

function isProcessAlive(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error?.code === "EPERM";
	}
}

function readJournal() {
	if (!existsSync(journalPath)) return null;
	try {
		const journal = JSON.parse(readFileSync(journalPath, "utf8"));
		if (journal?.schema === JOURNAL_SCHEMA && Array.isArray(journal.moves)) return journal;
	} catch {
		// Fall through: an unreadable journal is treated like a journal from a dead run.
	}
	return { schema: JOURNAL_SCHEMA, moves: temporaryMoves, pid: null, startedAt: null };
}

function journalText() {
	return `${JSON.stringify({
		schema: JOURNAL_SCHEMA,
		moves: temporaryMoves,
		pid: process.pid,
		startedAt: new Date().toISOString(),
	}, null, "\t")}\n`;
}

// Move every backup that is still aside back to its source, newest first. Safe to repeat.
function restoreMoves(moves) {
	const restored = [];
	for (const move of [...moves].reverse()) {
		if (!existsSync(move.backup)) continue;
		if (existsSync(move.source)) {
			throw new Error(`Both ${move.source} and ${move.backup} exist; keep the right one and delete the other before exporting`);
		}
		renameSync(move.backup, move.source);
		restored.push(move.source);
	}
	return restored;
}

function describeState() {
	const journal = readJournal();
	const leftovers = temporaryMoves.filter((move) => existsSync(move.backup)).map((move) => move.backup);
	if (journal && isProcessAlive(journal.pid) && journal.pid !== process.pid) {
		return { state: "running", pid: journal.pid, startedAt: journal.startedAt, leftovers };
	}
	if (journal || leftovers.length > 0) {
		return { state: "interrupted", pid: journal?.pid ?? null, startedAt: journal?.startedAt ?? null, leftovers };
	}
	return { state: "clean", leftovers };
}

function runningError(pid) {
	return new Error(`Another static export (pid ${pid}) is running; wait for it or stop it first`);
}

/**
 * Takes ownership of the export by creating the journal exclusively, so two exports
 * started together cannot both move the routes. A journal left by a dead run is claimed
 * by renaming it (only one claimant can win), its routes are put back, and creation is
 * retried. Returns the routes restored from an interrupted run.
 */
function acquireOwnership() {
	const restored = [];
	for (let attempt = 0; attempt < 5; attempt += 1) {
		try {
			writeFileSync(journalPath, journalText(), { flag: "wx" });
			// A backup with no journal (left by an older wrapper) is also ours to restore now.
			restored.push(...restoreMoves(temporaryMoves));
			return restored;
		} catch (error) {
			if (error?.code !== "EEXIST") throw error;
		}
		const journal = readJournal();
		if (journal && isProcessAlive(journal.pid) && journal.pid !== process.pid) {
			throw runningError(journal.pid);
		}
		const claimPath = `${journalPath}.claim-${process.pid}`;
		try {
			renameSync(journalPath, claimPath);
		} catch (error) {
			if (error?.code === "ENOENT") continue;
			throw error;
		}
		let claimed = {};
		try {
			claimed = JSON.parse(readFileSync(claimPath, "utf8"));
		} catch {
			// An unreadable journal is treated like one from a dead run.
		}
		if (isProcessAlive(claimed.pid) && claimed.pid !== process.pid) {
			// A live run re-created the journal between the read and the claim: hand it back.
			renameSync(claimPath, journalPath);
			throw runningError(claimed.pid);
		}
		restored.push(...restoreMoves(Array.isArray(claimed.moves) ? claimed.moves : temporaryMoves));
		rmSync(claimPath, { force: true });
	}
	throw new Error(`Could not take ownership of ${journalPath}; another export keeps re-creating it`);
}

function releaseOwnership() {
	restoreMoves(temporaryMoves);
	rmSync(journalPath, { force: true });
}

function handleTermination(signal) {
	buildProcess?.kill(signal);
	releaseOwnership();
	process.exit(TERMINATION_EXIT_CODES[signal] ?? 1);
}

async function runExport() {
	const restored = acquireOwnership();
	for (const source of restored) {
		console.log(`[build:export] Restored ${source} left aside by an interrupted export.`);
	}

	for (const signal of Object.keys(TERMINATION_EXIT_CODES)) {
		process.once(signal, handleTermination);
	}

	try {
		for (const move of temporaryMoves) {
			if (existsSync(move.source)) renameSync(move.source, move.backup);
		}

		const result = await new Promise((resolve) => {
			buildProcess = spawn(pnpmBin, ["run", "build"], {
				env: {
					...process.env,
					NEXT_OUTPUT: "export",
				},
				stdio: "inherit",
			});

			buildProcess.on("exit", (status, signal) => {
				resolve({ status, signal });
			});

			buildProcess.on("error", (error) => {
				console.error(error);
				resolve({ status: 1, signal: null });
			});
		});
		buildProcess = null;

		if (result.signal) {
			process.kill(process.pid, result.signal);
		}

		if (result.status !== 0) {
			process.exitCode = result.status ?? 1;
		}
	} finally {
		releaseOwnership();
	}
}

const args = new Set(process.argv.slice(2));
if (args.has("--status")) {
	console.log(JSON.stringify(describeState(), null, "\t"));
} else if (args.has("--restore")) {
	const restored = acquireOwnership();
	rmSync(journalPath, { force: true });
	console.log(restored.length > 0 ? `Restored: ${restored.join(", ")}` : "Nothing to restore.");
} else {
	await runExport();
}
