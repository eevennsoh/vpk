import { existsSync, linkSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

function isOtherLiveProcess(pid) {
	return pid !== process.pid && isProcessAlive(pid);
}

function readJournal(filePath = journalPath) {
	if (!existsSync(filePath)) return null;
	try {
		const journal = JSON.parse(readFileSync(filePath, "utf8"));
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
	if (isOtherLiveProcess(journal?.pid)) {
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
 * Publishes this run's journal under its final name, only if no journal exists. The
 * journal is written in full to a private draft and then hard-linked into place, so a
 * competing export can never read a half-written journal and take a live run for a dead one.
 */
function publishJournal() {
	const draftPath = `${journalPath}.draft-${process.pid}`;
	writeFileSync(draftPath, journalText());
	try {
		linkSync(draftPath, journalPath);
		return true;
	} catch (error) {
		if (error?.code === "EEXIST") return false;
		throw error;
	} finally {
		rmSync(draftPath, { force: true });
	}
}

/**
 * Retires a dead run's journal so the name is free again. Renaming it aside lets exactly
 * one competitor win. It restores nothing: only the next owner puts routes back. If a live
 * run took the name between the liveness check and the rename, its journal is handed back.
 */
function retireDeadJournal() {
	const claimPath = `${journalPath}.claim-${process.pid}`;
	try {
		renameSync(journalPath, claimPath);
	} catch (error) {
		if (error?.code === "ENOENT") return;
		throw error;
	}
	const claimed = readJournal(claimPath);
	try {
		if (isOtherLiveProcess(claimed?.pid)) {
			try {
				linkSync(claimPath, journalPath);
			} catch (error) {
				if (error?.code !== "EEXIST") throw error;
				throw new Error(`Two static exports hold ${journalPath} (pid ${claimed.pid} and another); stop them, then run with --restore`);
			}
			throw runningError(claimed.pid);
		}
	} finally {
		rmSync(claimPath, { force: true });
	}
}

/**
 * Takes ownership of the export, so exports started together cannot both move the routes.
 * Only the owner restores routes left aside by an interrupted run (or by an older wrapper
 * that kept no journal); a run that is still competing never touches them. Returns the
 * routes restored.
 */
function acquireOwnership() {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		if (publishJournal()) {
			try {
				return restoreMoves(temporaryMoves);
			} catch (error) {
				rmSync(journalPath, { force: true });
				throw error;
			}
		}
		const journal = readJournal();
		if (isOtherLiveProcess(journal?.pid)) {
			throw runningError(journal.pid);
		}
		if (journal) retireDeadJournal();
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
